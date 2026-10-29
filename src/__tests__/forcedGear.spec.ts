import { describe, expect, it } from 'vitest'
import { attrsOf, attrSources, maxHpFor } from '@/engine/character'
import { itemRules, slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { forcedGearPool } from '@/engine/forcedGear'
import { gearRules, gearSummary } from '@/engine/gear'
import { enterLocation } from '@/engine/grid'
import { equipItem, lockedGear, putOn, unequipItem } from '@/engine/inventory'
import { sanitizeItem } from '@/engine/mods'
import { freePlayer, pcOf } from '@/engine/party'
import { answerMasterEvent, eventFits, masterCandidates, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import { notForSale } from '@/engine/trade'
import type { GameState, Report } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}
function enslaved(tags?: string[]): GameState {
  const state = game()
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: { ...rec!, ...(tags ? { tags } : {}) } }, mark: 'labor' })
  return state
}
const event = (id: string) => slaveryRules.master_events.events.find((e) => e.id === id)!

describe('gear attributes', () => {
  it('change the effective attributes and hit points while worn', () => {
    const state = game()
    const pc = pcOf(state)
    const base = { ...pc.attrs }
    putOn(pc, '力之護腕', { base: 'bracers', material: 'leather', attrs: { str: 2, int: -1 } })
    expect(attrsOf(pc)).toMatchObject({ str: base.str + 2, int: base.int - 1 })
    expect(attrSources(pc)).toContainEqual({ label: '裝備【力之護腕】', attrs: { str: 2, int: -1 } })
    expect(pc.maxHp).toBe(maxHpFor(pc.level, attrsOf(pc)))
    expect(gearSummary(pc.gear!.wrists!.spec)).toContain('力量 +2、智力 -1')
    unequipItem(state, pc.id, 'wrists')
    expect(attrsOf(pc)).toEqual(base)
  })

  it('stack only up to the cap across all gear', () => {
    const pc = pcOf(game())
    const base = pc.attrs.dex
    putOn(pc, 'a', { base: 'ring_swift', material: 'copper', attrs: { dex: 3 } }, 'ring_1')
    putOn(pc, 'b', { base: 'ring_swift', material: 'copper', attrs: { dex: 3 } }, 'ring_2')
    expect(attrsOf(pc).dex).toBe(base + gearRules.attrs.cap)
    expect(attrSources(pc).at(-1)).toEqual({ label: `裝備的加減上限 ±${gearRules.attrs.cap}`, attrs: { dex: -2 } })
  })

  it('are clamped in content, and keep such gear off the shelves', () => {
    const item = sanitizeItem('試作護腕', { category: 'equipment', price_cc: 10, tags: ['smith'], gear: { base: 'bracers', material: 'leather', attrs: { str: 9, dex: 0 } }, master_force: { tags: ['villain', 'nope'] } }, true)
    expect(item.gear!.attrs).toEqual({ str: 3 })
    expect(item.master_force).toEqual({ tags: ['villain'] })
    expect(notForSale(item)).toBe(true)
    for (const i of itemRules.items.filter((x) => x.master_force)) expect(notForSale(i), i.name).toBe(true)
  })
})

describe('master forced gear', () => {
  it('is picked by the master’s tags', () => {
    const any = forcedGearPool(enslaved(['traveler']), ['traveler'])
    expect(any).toEqual(expect.arrayContaining(['奴隸項圈', '腕鐐', '腳鐐']))
    expect(any).not.toContain('刺釘項圈')
    expect(forcedGearPool(enslaved(['villain']), ['villain'])).toContain('刺釘項圈')
  })

  it('locks the gear on until the contract ends, returning what it replaced', () => {
    const state = enslaved()
    const pc = pcOf(state)
    const master = contractOf(pc)!.master
    const r = blank(state)
    const before = { ...pc.gear }
    applyEffects(state, r, [{ type: 'force_equip', npc: master, item: '腕鐐' }])
    expect(pc.gear!.wrists).toMatchObject({ name: '腕鐐', locked: master })
    expect(lockedGear(pc, 'wrists')).toBeTruthy()
    if (before.wrists) expect(r.changes.items_gained).toContainEqual({ name: before.wrists.name, qty: 1, owner: 'pc' })
    expect(() => unequipItem(state, pc.id, 'wrists')).toThrow('主人強制')
    state.inventory.push({ name: '皮護腕', qty: 1 })
    expect(() => equipItem(state, '皮護腕', pc.id, 'wrists')).toThrow('主人強制')
    expect(attrsOf(pc).dex).toBe(pc.attrs.dex - 1)
    freePlayer(state)
    expect(lockedGear(pc, 'wrists')).toBeUndefined()
    unequipItem(state, pc.id, 'wrists')
  })

  it('comes from a master event only while something can still be put on', () => {
    const state = enslaved()
    const pc = pcOf(state)
    const master = { id: contractOf(pc)!.master, tags: [] }
    expect(eventFits(state, master, event('force_gear'))).toBe(true)
    startMasterEvent(state, event('force_gear'))
    answerMasterEvent(state, 0)
    expect(Object.values(pc.gear!).some((g) => g?.locked)).toBe(true)
    // 項圈、腕鐐、腳鐐都戴上之後，就沒有能強制的了
    for (const name of forcedGearPool(state, [])) applyEffects(state, blank(state), [{ type: 'force_equip', npc: master.id, item: name }])
    expect(forcedGearPool(state, [])).toEqual([])
    expect(eventFits(state, master, event('force_gear'))).toBe(false)
  })
})

describe('restraint bases', () => {
  it('give nothing but the item’s attributes, and stay out of crafting and random gear', async () => {
    const { gearStats, ordinaryBases, randomGear, creationSlots, sanitizeGearSpec } = await import('@/engine/gear')
    const { Rng } = await import('@/engine/rng')
    const restraints = Object.entries(gearRules.bases).filter(([, b]) => b.restraint).map(([id]) => id)
    expect(restraints).toEqual(['slave_collar', 'manacles', 'shackles', 'spiked_collar', 'choker', 'chastity_belt', 'leather_harness', 'silk_binding',
      'blindfold', 'armbinder', 'hobble_chain', 'ballet_boots', 'rope_harness', 'shibari', 'vibe_egg', 'nipple_clamps'])
    for (const i of itemRules.items.filter((x) => x.master_force)) {
      expect(restraints, i.name).toContain(i.gear!.base)
      const s = gearStats(i.gear!)
      expect(Object.values(s.mods).filter(Boolean), i.name).toEqual([])
      expect(Object.values(s.resist).filter(Boolean), i.name).toEqual([])
    }
    const ordinary = ordinaryBases()
    for (const id of restraints) expect(ordinary).not.toContain(id)
    const rng = new Rng(1)
    for (let n = 0; n < 300; n++) expect(restraints).not.toContain(randomGear(rng, 10).base)
    for (const s of creationSlots('fighter')) for (const id of restraints) expect(s.bases).not.toContain(id)
    expect(sanitizeGearSpec({ base: 'slave_collar', material: 'iron' }, { maxLevel: 20 })).toBeUndefined()
  })

  it('cannot be commissioned', async () => {
    const state = game()
    const { prepareAction } = await import('@/engine/actions')
    const { standOn } = await import('@/engine/grid')
    standOn(state, 'smithy')
    state.money_cc = 100000
    expect(() => prepareAction(state, { kind: 'craft', target: 'slave_collar:iron', text: '' })).toThrow('項圈不能打造')
  })
})
