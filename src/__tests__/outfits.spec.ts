import { afterEach, describe, expect, it } from 'vitest'
import { createNpc } from '@/engine/character'
import { setAdultContent } from '@/engine/content'
import { itemRules, type NpcDef } from '@/engine/data'
import { creationSlots, gearRules, itemShown, ordinaryBases, randomBases } from '@/engine/gear'
import { npcOutfit } from '@/engine/outfits'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { enterLocation } from '@/engine/grid'
import { shopState } from '@/engine/trade'

afterEach(() => setAdultContent(false))

const def = (o: Partial<NpcDef>): NpcDef => ({ id: 'o_1', name: '測', race: 'human', class: 'fighter', level: 3, location: 'soriel', hire_cc: 0, personality: '', ...o })

describe('outfits', () => {
  it('has regular, anime and adult outfits in existing slots, sold in three tiers', () => {
    const outfits = Object.entries(gearRules.bases).filter(([, b]) => b.outfit)
    for (const k of ['regular', 'anime', 'adult']) expect(outfits.filter(([, b]) => b.outfit === k).length, k).toBeGreaterThanOrEqual(8)
    for (const [, b] of outfits) if (b.outfit === 'adult') expect(b.adult).toBe(true)
    expect(itemRules.items.filter((i) => i.gear?.base === 'maid_dress').map((i) => i.name)).toEqual(['亞麻女僕裝', '絲綢女僕裝', '月影絲女僕裝'])
  })

  it('keeps outfits out of random loot and hides adult ones unless adult content is on', () => {
    expect(randomBases()).not.toContain('maid_dress')
    expect(ordinaryBases()).toContain('maid_dress')
    expect(ordinaryBases()).not.toContain('reverse_bunny')
    expect(itemShown(itemRules.items.find((i) => i.gear?.base === 'reverse_bunny'))).toBe(false)
    expect(creationSlots('wizard').find((s) => s.slot === 'body')!.bases).toEqual(expect.arrayContaining(['robe', 'dress', 'maid_dress']))
    expect(creationSlots('wizard').find((s) => s.slot === 'body')!.bases).not.toContain('lewd_maid')
    setAdultContent(true)
    expect(ordinaryBases()).toContain('reverse_bunny')
    expect(creationSlots('wizard').find((s) => s.slot === 'body')!.bases).toContain('lewd_maid')
  })

  it('sells a few outfits at the tailor each day', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg' })
    enterLocation(state)
    const deals = shopState(state, 'tailor').deals
    const outfit = deals.filter((d) => { const i = itemRules.items.find((x) => x.name === d.title); return !!(i?.gear && gearRules.bases[i.gear.base]?.outfit) })
    expect(outfit.length).toBeGreaterThanOrEqual(2)
    expect(outfit.every((d) => !gearRules.bases[itemRules.items.find((x) => x.name === d.title)!.gear!.base]!.adult)).toBe(true)
  })

  it('dresses NPCs by tag, occupation and body', () => {
    expect(npcOutfit(def({ gender: 'female', tags: ['noble'] })).body?.spec.base).toMatch(/gown|gothic_lolita|dress/)
    expect(npcOutfit(def({ gender: 'female', tags: ['priest'] })).body?.spec.base).toBe('nun_habit')
    expect(npcOutfit(def({ gender: 'female', occupation: '女僕' })).body?.spec.base).toBe('maid_dress')
    // 娼妓：成人向關閉時是旗袍、連身裙這類；開啟時有成人向的
    const off = npcOutfit(def({ gender: 'female', tags: ['prostitute'] }))
    expect(Object.values(off).every((g) => !gearRules.bases[g!.spec.base]!.adult)).toBe(true)
    setAdultContent(true)
    const on = npcOutfit(def({ gender: 'female', tags: ['prostitute'] }))
    expect(on.underwear_bottom?.spec.base).toMatch(/thong|crotchless/)
  })

  it('only fills empty non-armour slots on adventurers', () => {
    const c = createNpc(def({ gender: 'female', tags: ['noble'] }), new Rng(2))
    expect(c.gear?.body?.spec.base).not.toMatch(/gown|dress/)
    expect(c.gear?.underwear_top?.spec.base).toMatch(/lace_bra|bodice/)
  })
})
