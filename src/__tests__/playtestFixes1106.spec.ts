// 2026-11-06 真空、R20、R21 試玩的修正
import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { craftLessons, learnCraft } from '@/engine/craftLessons'
import { skillOf } from '@/engine/crafting'
import { gearRules } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { exposureLevel, vacuumSides } from '@/engine/lewd'
import { sanitizeBase } from '@/engine/mods'
import { generateNpc } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { pcTagEffectLines } from '@/engine/pcTags'
import { checkBonus, checkSkills } from '@/engine/perks'
import { addItem, newGame, withRng } from '@/engine/state'
import type { Character, EquippedGear, GearSlot } from '@/engine/types'

function game(tags: string[] = []) {
  const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel', tags } as Parameters<typeof newGame>[0])
  enterLocation(s)
  s.money_cc = 50000
  return s
}

describe('學工藝：隊伍裡的夥伴也能學', () => {
  it('teaches the chosen member and logs it as an event', () => {
    const s = game()
    const rec = withRng(s, (rng) => generateNpc(s, rng, { level: 3, kind: 'adventurer', location: s.location }))
    const m = joinParty(s, rec, 'voluntary')
    standOn(s, 'smithy')
    expect(craftLessons(s, m.id).map((l) => [l.craft, l.from])).toEqual([['smithing', 0], ['woodworking', 0]])
    const r = learnCraft(s, 'smithing', m.id)
    expect(skillOf(m, 'smithing').level).toBe(1)
    expect(skillOf(pcOf(s), 'smithing').level).toBe(0)
    expect(r.kind).toBe('event')
    expect(r.outcome.summary).toContain(`替${m.name}付了`)
    expect(r.outcome.summary).not.toContain('花練了')
  })
})

describe('委託打造由店主擲：不加主角的修正', () => {
  it('leaves out the protagonist perks and tags', () => {
    const s = game(['blacksmith'])
    pcOf(s).perks = [...(pcOf(s).perks ?? []), 'artisan']
    standOn(s, 'smithy')
    addItem(s.inventory, '鐵礦石', 5)
    const p = prepareAction(s, { kind: 'craft', text: '', target: 'dagger:iron' })
    expect(p.situational.map((x) => x.label)).toEqual([expect.stringContaining('工匠的手藝')])
    const r = resolveAction(s, null)
    expect(r.check?.keeper).toBe(true)
  })
})

describe('上衣類不遮下身', () => {
  const wear = (base: string): EquippedGear => ({ name: gearRules.bases[base]!.name, spec: { base, material: 'linen' } }) as EquippedGear
  const dressed = (slots: Partial<Record<GearSlot, string>>): Character => {
    const pc = pcOf(newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 1 }))
    pc.body = 'fem'
    pc.gear = Object.fromEntries(Object.entries(slots).map(([k, b]) => [k, wear(b!)])) as Character['gear']
    return pc
  }
  it('looks at the panties when only a top is worn', () => {
    // 襯衫＋內衣、沒穿下身也沒穿內褲：全裸
    expect(exposureLevel(dressed({ body: 'shirt', underwear_top: 'undershirt' }))).toBe(3)
    // 穿著內褲：看得到內褲
    expect(exposureLevel(dressed({ body: 'shirt', underwear_top: 'undershirt', underwear_bottom: 'briefs' }))).toBeGreaterThan(0)
    expect(vacuumSides(dressed({ body: 'shirt', underwear_top: 'undershirt' }))).toEqual([])
    // 連身裙照樣遮住下身
    expect(exposureLevel(dressed({ body: 'dress', underwear_top: 'undershirt', underwear_bottom: 'briefs' }))).toBe(0)
    // 鎧甲沒穿下身也照舊
    expect(exposureLevel(dressed({ body: 'chain', underwear_top: 'undershirt', underwear_bottom: 'briefs' }))).toBe(0)
  })
  it('keeps top_only on custom body bases only', () => {
    expect(sanitizeBase({ ...gearRules.bases.shirt, top_only: true } as never, true, 'my_top')?.top_only).toBe(true)
    expect(sanitizeBase({ ...gearRules.bases.trousers, top_only: true } as never, true, 'my_legs')?.top_only).toBeUndefined()
  })
})

describe('檢定分類：任務選項可以寫，沒寫時照屬性推', () => {
  it('defaults by attribute, but not for free actions or training', () => {
    expect([...checkSkills({ context: 'action', attr: 'cha' })]).toEqual(['persuade'])
    expect([...checkSkills({ context: 'action', attr: 'cha', skill: 'deceive' })]).toEqual(['deceive'])
    expect([...checkSkills({ context: 'action', kind: 'free', attr: 'cha' })]).toEqual([])
    expect([...checkSkills({ context: 'action', kind: 'train', attr: 'cha' })]).toEqual([])
    const s = game()
    pcOf(s).perks = ['silver_tongue']
    expect(checkBonus(pcOf(s), { context: 'action', attr: 'cha' })).toBe(2)
  })
})

describe('建角說明：工匠身分的開局工藝', () => {
  it('says which crafts start at Lv.2', () => {
    expect(pcTagEffectLines('leatherworker').join('；')).toContain('製革、裁縫從 Lv.2 開始')
    expect(pcTagEffectLines('hunter').join('；')).not.toContain('Lv.2')
  })
})
