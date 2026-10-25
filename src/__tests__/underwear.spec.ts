import { describe, expect, it } from 'vitest'
import { createNpc } from '@/engine/character'
import { itemRules } from '@/engine/data'
import { forcedGearPool } from '@/engine/forcedGear'
import { gearRules, gearStats, UNDERWEAR_SLOTS } from '@/engine/gear'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { portraitComposition, portraitPrompt, portraitSubject, DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, LEGACY_PORTRAIT_TEMPLATES } from '@/narrator/imageInfo'
import { addTattoo, tattooFromTemplate } from '@/engine/tattoos'
import type { NpcDef } from '@/engine/data'

const npc = (gender: string): NpcDef => ({ id: `t_${gender}`, name: '測', race: 'human', class: 'fighter', level: 3, location: 'soriel', hire_cc: 0, personality: '', gender })

describe('underwear slots', () => {
  it('dresses new characters by body type', () => {
    const fem = newGame({ name: '莉婭', race: 'human', classId: 'fighter', seed: 1, body: 'fem' }).party[0]!
    expect(fem.gear?.underwear_top?.spec.base).toBe('breast_band')
    expect(fem.gear?.underwear_bottom?.spec.base).toBe('panties')
    const masc = createNpc(npc('male'), new Rng(1))
    expect(masc.gear?.underwear_top?.spec.base).toBe('undershirt')
    expect(masc.gear?.underwear_bottom?.spec.base).toBe('loincloth')
    // 第一級材料（亞麻）沒有加成
    for (const s of UNDERWEAR_SLOTS) expect(Object.values(gearStats(masc.gear![s]!.spec).mods).filter(Boolean)).toEqual([])
  })

  it('does not change the rest of a generated loadout', () => {
    const a = createNpc(npc('female'), new Rng(7))
    const b = createNpc(npc('male'), new Rng(7))
    const strip = (g: typeof a.gear) => Object.fromEntries(Object.entries(g ?? {}).filter(([k]) => !k.startsWith('underwear')))
    expect(strip(a.gear)).toEqual(strip(b.gear))
  })

  it('scales like jewelry and sells at the tailor', () => {
    const silk = itemRules.items.find((i) => i.gear?.base === 'lace_bra' && i.gear.material === 'silk')!
    expect(silk.tags).toContain('tailor')
    expect(gearStats(silk.gear!).mods.crit).toBe(1)
    expect(gearRules.bases.lace_bra!.slot).toBe('underwear_top')
  })

  it('offers charm-leaning unique pieces and forced pieces for masters', () => {
    const charm = itemRules.items.filter((i) => i.gear?.unique && UNDERWEAR_SLOTS.includes(gearRules.bases[i.gear.base]!.slot as never))
    expect(charm.length).toBeGreaterThanOrEqual(8)
    const state = newGame({ name: '莉婭', race: 'human', classId: 'fighter', seed: 1, body: 'fem' })
    expect(forcedGearPool(state, ['noble'])).toEqual(expect.arrayContaining(['貞操帶', '家紋束胸綢']))
  })
})

describe('portrait composition', () => {
  it('pulls back to show lower-body tattoos and visible underwear', () => {
    expect(portraitComposition([], [])).toBe('upper body')
    expect(portraitComposition(['belly'], [])).toBe('cowboy shot')
    expect(portraitComposition(['left_thigh'], [])).toBe('full body')
    expect(portraitComposition([], ['leg_accessory'])).toBe('full body')
  })

  it('writes the thigh tattoo and a full-body composition into the prompt', () => {
    const state = newGame({ name: '莉婭', race: 'human', classId: 'fighter', seed: 1, body: 'fem' })
    const pc = state.party[0]!
    addTattoo(pc, tattooFromTemplate('butterfly', pc, 'left_thigh'), state.time)
    const subject = portraitSubject(state, pc.id)!
    const prompt = portraitPrompt(subject, DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE)
    expect(prompt).toContain('左大腿：蝴蝶')
    expect(prompt).toContain('Composition: full body')
    // 上身有鎧甲：內衣標成穿在裡面
    expect(prompt).toContain('（穿在裡面）')
    // 舊的預設模板（寫死 upper body）也會換
    expect(portraitPrompt(subject, LEGACY_PORTRAIT_TEMPLATES[0]!, DEFAULT_STYLE)).toContain('Composition: full body')
  })
})
