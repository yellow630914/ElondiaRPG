import { describe, expect, it } from 'vitest'
import { baseSlotsFor, creationCatalog, generateLoadout, gearRules, slotNameFor } from '@/engine/gear'
import { putOn } from '@/engine/inventory'
import { builtinBase, sanitizeBase } from '@/engine/mods'
import { exposureLevel } from '@/engine/lewd'
import { npcOutfit } from '@/engine/outfits'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import type { GearSpec } from '@/engine/types'

// 人馬族的裝備欄（docs/ITEMS.md 第 2 節）：內褲那一格是「後蹄」（鞋子類），下身、鞋子、後蹄、腿部飾品只能穿人馬族的底材
const RESTRICTED = ['legs', 'feet', 'underwear_bottom', 'leg_accessory'] as const
const centaurBase = (id: string) => !!gearRules.bases[id]?.races?.includes('centaur')
const spec = (base: string, material: string): GearSpec => ({ base, material })

describe('centaur gear slots', () => {
  it('renames the underwear slot to 後蹄 and lets it take hoof gear only', () => {
    expect(slotNameFor('underwear_bottom', 'centaur')).toBe('後蹄')
    expect(slotNameFor('underwear_bottom', 'human')).toBe(gearRules.slots.underwear_bottom)
    expect(baseSlotsFor('horseshoe', 'centaur')).toEqual(['feet', 'underwear_bottom'])
    expect(baseSlotsFor('hoof_bells', 'centaur')).toEqual(['leg_accessory', 'extra_1'])
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
