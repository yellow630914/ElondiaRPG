import { describe, expect, it } from 'vitest'
import { baseSlotsFor, creationCatalog, generateLoadout, gearRules, slotNameFor } from '@/engine/gear'
import { putOn, equipItem, unequipItem } from '@/engine/inventory'
import { builtinBase, sanitizeBase } from '@/engine/mods'
import { exposureLevel } from '@/engine/lewd'
import { npcOutfit } from '@/engine/outfits'
import { Rng } from '@/engine/rng'
import { newGame, addItem } from '@/engine/state'
import type { GearSpec, GameState } from '@/engine/types'
import { restrainPc } from '@/engine/forcedGear'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { canStart, storyWearUnfit } from '@/engine/story'
import { baseReport } from '@/engine/town'
import { portraitSubject } from '@/narrator/imageInfo'
import storiesJson from '@data/rules/stories.json'

// 人馬族的裝備欄（docs/ITEMS.md 第 2 節）：內褲那一格是「後蹄」（鞋子類），下身、鞋子、後蹄、腿部飾品只能穿人馬族的底材
const RESTRICTED = ['legs', 'feet', 'underwear_bottom', 'leg_accessory'] as const
const centaurBase = (id: string) => !!gearRules.bases[id]?.races?.includes('centaur')
const spec = (base: string, material: string): GearSpec => ({ base, material })

describe('centaur gear slots', () => {
  it('renames the underwear slot to 後蹄 and lets it take hoof gear only', () => {
    expect(slotNameFor('underwear_bottom', 'centaur')).toBe('後蹄')
    expect(slotNameFor('underwear_bottom', 'human')).toBe(gearRules.slots.underwear_bottom)
    expect(baseSlotsFor('horseshoe', 'centaur')).toEqual(['feet', 'underwear_bottom'])
    expect(baseSlotsFor('hoof_bells', 'centaur')).toEqual(['leg_accessory', 'extra_1', 'extra_2'])
    // 一般的鞋子、褲子、腿部飾品、內褲：人馬族不能穿（也不能塞進額外飾品欄）
    for (const b of ['boots', 'trousers', 'long_skirt', 'anklet_wind', 'thigh_band']) expect(baseSlotsFor(b, 'centaur'), b).toEqual([])
    const panties = Object.entries(gearRules.bases).find(([, b]) => b.slot === 'underwear_bottom')![0]
    expect(baseSlotsFor(panties, 'centaur')).toEqual([])
    // 其他種族穿不了人馬族的底材，其他欄位照常
    for (const b of ['horse_cloth', 'horse_barding', 'horseshoe', 'hoof_boots', 'hoof_bells', 'horse_leg_ring']) {
      expect(centaurBase(b), b).toBe(true)
      expect(baseSlotsFor(b, 'human'), b).toEqual([])
    }
    expect(baseSlotsFor('longsword', 'centaur')).toEqual(['main_hand'])
    expect(baseSlotsFor('helm', 'centaur')).toEqual(['head'])
  })

  it('refuses the wrong gear when putting it on, and wears two pairs of hoof gear', () => {
    const s = newGame({ name: '其其格', race: 'centaur', classId: 'fighter', seed: 1, birthplace: 'longan' })
    const pc = s.party[0]!
    expect(() => putOn(pc, '皮靴', spec('boots', 'leather'))).toThrow()
    expect(putOn(pc, '鋼蹄鐵', spec('horseshoe', 'steel')).target).toBe('feet')
    expect(putOn(pc, '蹄靴', spec('hoof_boots', 'leather')).target).toBe('underwear_bottom')
    const human = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1 }).party[0]!
    expect(() => putOn(human, '鋼蹄鐵', spec('horseshoe', 'steel'))).toThrow('只有人馬族')
  })

  it('starts a centaur without underwear bottoms, and offers only centaur pieces at creation', () => {
    for (const body of ['fem', 'masc'] as const) {
      const s = newGame({ name: '托雅', race: 'centaur', classId: 'rogue', seed: 2, birthplace: 'longan', body })
      expect(s.party[0]!.gear?.underwear_bottom, body).toBeUndefined()
      for (const slot of RESTRICTED) {
        const g = s.party[0]!.gear?.[slot]
        if (g) expect(centaurBase(g.spec.base), `${body} ${slot}`).toBe(true)
      }
    }
    for (const c of ['fighter', 'wizard', 'ranger']) {
      for (const row of creationCatalog(c, 'centaur')) {
        if (!(RESTRICTED as readonly string[]).includes(row.slot)) continue
        for (const o of row.options) expect(centaurBase(o.spec.base), `${c} ${row.slot} ${o.name}`).toBe(true)
      }
      for (const row of creationCatalog(c, 'human')) for (const o of row.options) expect(centaurBase(o.spec.base), `${c} human ${o.name}`).toBe(false)
    }
    expect(creationCatalog('fighter', 'centaur').find((r) => r.slot === 'legs')!.options.some((o) => o.spec.base === 'horse_barding')).toBe(true)
  })

  it('dresses centaur companions and townsfolk in centaur gear', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = generateLoadout('fighter', 12, new Rng(seed), 'centaur')
      for (const slot of [...RESTRICTED, 'extra_1'] as const) {
        const x = g[slot]
        if (x && slot !== 'extra_1') expect(centaurBase(x.spec.base), `${seed} ${slot} ${x.name}`).toBe(true)
        if (x && slot === 'extra_1') expect(baseSlotsFor(x.spec.base, 'centaur'), x.name).toContain('extra_1')
      }
    }
    for (let i = 0; i < 20; i++) {
      const o = npcOutfit({ id: `npc_t${i}`, race: 'centaur', gender: i % 2 ? 'male' : 'female', tags: ['commoner'], occupation: '牧民' })
      for (const slot of RESTRICTED) if (o[slot]) expect(centaurBase(o[slot]!.spec.base), `${i} ${slot}`).toBe(true)
    }
  })

  it('keeps the race limit through the content editor', () => {
    for (const id of ['horse_cloth', 'horseshoe', 'hoof_bells']) expect(sanitizeBase(builtinBase(id)!, false, id).races, id).toEqual(['centaur'])
    // 自建的底材可以限定種族；不存在的種族拿掉
    expect(sanitizeBase({ name: '測試蹄套', slot: 'feet', kind: 'leather', price: 10, races: ['centaur', 'nope'] }, true).races).toEqual(['centaur'])
    expect(sanitizeBase({ name: '測試靴', slot: 'feet', kind: 'leather', price: 10 }, true).races).toBeUndefined()
  })

  it('does not count hoof gear in the underwear slot as covering the lower body', () => {
    const top = { name: '亞麻裹胸', spec: spec('breast_band', 'linen') }
    const gear = { underwear_top: top, underwear_bottom: { name: '蹄靴', spec: spec('hoof_boots', 'leather') } }
    const human = exposureLevel({ gear: { underwear_top: top, underwear_bottom: { name: '亞麻內褲', spec: spec('panties', 'linen') } } })
    expect(exposureLevel({ gear, race: 'centaur' })).toBeGreaterThan(human)
  })
})

describe('炎華之地：人馬族與限定穿著', () => {
  type Story = { id: string; tags?: string[]; start: { min_level?: number; requires?: Record<string, unknown> }; nodes: { id: string; at?: Record<string, unknown>; options?: { tags?: string[]; requires?: unknown }[] }[] }
  const stories = (storiesJson as unknown as { stories: Story[] }).stories
  const by = (id: string) => stories.find((s) => s.id === id)!
  function game(race: string): GameState {
    const s = newGame({ name: '測試者', race, classId: 'fighter', seed: 3, birthplace: 'quanzhou' })
    enterLocation(s)
    return s
  }

  it('不發限定穿著有主角種族穿不了的任務（打工線要腳鍊、網襪、丁字褲）', () => {
    const centaur = game('centaur')
    const human = game('human')
    const work = ['dance_bazaar', 'dance_chief', 'dance_night', 'expo_parade', 'bath_scrub', 'bath_vip', 'bath_deep', 'mate_paint', 'mate_chase', 'mate_bonfire', 'brine_bride', 'brine_parade', 'brine_spring']
    for (const id of work) {
      const def = by(id) as never
      expect(storyWearUnfit(centaur, def).length, id).toBeGreaterThan(0)
      expect(storyWearUnfit(human, def), id).toEqual([])
      expect(canStart(centaur, def), id).toBe(false)
    }
    // 全部任務裡，人馬族穿不了的就是這 13 條
    const unfit = stories.filter((s) => storyWearUnfit(centaur, s as never).length).map((s) => s.id)
    expect(unfit.sort()).toEqual([...work].sort())
  })

  it('穿不了的原因照種族寫，日誌的欄位照種族叫', () => {
    const s = game('centaur')
    const pc = pcOf(s)
    expect(() => putOn(pc, '皮靴', { base: 'boots', material: 'leather' })).toThrow(/人馬族穿不了一般的鞋子，只能穿人馬族的蹄鐵、蹄靴/)
    expect(() => putOn(pc, '綁帶內褲', { base: 'panties', material: 'cotton' })).toThrow(/人馬族沒有穿內褲的地方（那一格是後蹄/)
    delete pc.gear!.feet
    delete pc.gear!.underwear_bottom
    addItem(s.inventory, '鐵蹄鐵', 2)
    s.customItems = { ...(s.customItems ?? {}), 鐵蹄鐵: { gear: { base: 'horseshoe', material: 'iron' } } as never }
    expect(equipItem(s, '鐵蹄鐵', pc.id, 'underwear_bottom').outcome.summary).toContain('在後蹄裝上了鐵蹄鐵')
    unequipItem(s, pc.id, 'underwear_bottom')
    expect(() => unequipItem(s, pc.id, 'underwear_bottom')).toThrow('後蹄沒有裝備')
  })

  it('步鍊：人馬族戴不上', () => {
    const s = game('centaur')
    expect(restrainPc(s, baseReport(s, 'event', 0), '步鍊')).toBe('人馬族戴不上步鍊')
  })

  it('形象圖把人馬族的後蹄當鞋子：不算穿在裡面、不拉成腰部的構圖', () => {
    const s = game('centaur')
    const pc = pcOf(s)
    pc.gear = { body: pc.gear!.body!, underwear_bottom: { name: '蹄靴', spec: { base: 'hoof_boots', material: 'leather' } } }
    const p = portraitSubject(s, pc.id)!
    expect(p.gear).toContain('蹄靴')
    expect(p.gear.join()).not.toContain('穿在裡面')
    expect(p.composition).toBe('upper body')
  })
})
