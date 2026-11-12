import { afterEach, describe, expect, it } from 'vitest'
import { creationSlots, EXTRA_SLOT, EXTRA_SLOTS, gearName, gearRules, generateLoadout, setExtraSlotCount, SLOTS, slotName, slotsFor } from '@/engine/gear'
import { forceEquip } from '@/engine/forcedGear'
import { enterLocation } from '@/engine/grid'
import { enforceExtraSlots, extraOverflow, putOn } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { bindModifiers } from '@/engine/schools'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { baseReport } from '@/engine/town'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
const spec = (base: string, material = 'leather') => ({ base, material })

describe('額外飾品欄', () => {
  afterEach(() => setExtraSlotCount(2))

  it('八格額外飾品欄都在 gear.json 的 slots 裡（有名字、SLOTS 列得到）', () => {
    for (const s of EXTRA_SLOTS) {
      expect(SLOTS).toContain(s)
      expect(slotName(s)).toBe('額外飾品')
    }
    expect(Object.keys(gearRules.slots)).toHaveLength(24)
  })

  it('飾品與拘束具可以放，護具與服裝不行；原本的部位滿了才放額外飾品欄', () => {
    expect(slotsFor(spec('ring_swift', 'copper'))).toEqual(['ring_1', 'ring_2', 'extra_1', 'extra_2'])
    expect(slotsFor(spec('blindfold'))).toContain(EXTRA_SLOT)
    expect(slotsFor(spec('maid_dress', 'linen'))).not.toContain(EXTRA_SLOT)
    expect(slotsFor(spec('panties', 'linen'))).not.toContain(EXTRA_SLOT)
    const pc = pcOf(game())
    const ring = spec('ring_swift', 'copper')
    expect(putOn(pc, gearName(ring), ring).target).toBe('ring_1')
    expect(putOn(pc, gearName(ring), ring).target).toBe('ring_2')
    expect(putOn(pc, gearName(ring), ring).target).toBe(EXTRA_SLOT)
    // 額外飾品欄有兩格
    expect(putOn(pc, gearName(ring), ring).target).toBe('extra_2')
  })

  it('拘束具放在額外飾品欄時原本的部位空著，雙面效應照算', () => {
    const pc = pcOf(game())
    const helm = spec('hood', 'linen')
    putOn(pc, gearName(helm), helm, 'head')
    const blind = spec('blindfold')
    putOn(pc, gearName(blind), blind, EXTRA_SLOT)
    expect(pc.gear?.head?.spec.base).toBe('hood')
    expect(pc.gear?.[EXTRA_SLOT]?.spec.base).toBe('blindfold')
    expect(bindModifiers(pc, { context: 'action', attr: 'int' }).length).toBeGreaterThan(0)
  })

  it('主人強制的拘束具戴在原本的部位', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    const pc = pcOf(state)
    const line = forceEquip(state, baseReport(state, 'event', 0), rec!.id, '腕鐐')
    expect(line).toContain('手腕')
    expect(pc.gear?.[EXTRA_SLOT]).toBeUndefined()
  })

  it('建角可以選，NPC 依等級有機會戴', () => {
    expect(creationSlots('fighter').find((s) => s.slot === EXTRA_SLOT)?.bases).toContain('ring_swift')
    const rng = new Rng(1)
    const worn = Array.from({ length: 30 }, () => generateLoadout('fighter', 15, rng)).filter((g) => g[EXTRA_SLOT])
    expect(worn.length).toBeGreaterThan(5)
  })

  it('存檔規則調多：可以放進更多格；調成 0：沒有額外飾品欄', () => {
    const state = game()
    state.options = { ...state.options!, extraSlots: 4 }
    enforceExtraSlots(state)
    expect(slotsFor(spec('ring_swift', 'copper'))).toEqual(['ring_1', 'ring_2', 'extra_1', 'extra_2', 'extra_3', 'extra_4'])
    const pc = pcOf(state)
    const ring = spec('ring_swift', 'copper')
    for (let i = 0; i < 6; i++) putOn(pc, gearName(ring), ring)
    expect(pc.gear?.extra_4?.spec.base).toBe('ring_swift')
    state.options = { ...state.options!, extraSlots: 0 }
    enforceExtraSlots(state)
    expect(slotsFor(ring)).toEqual(['ring_1', 'ring_2'])
    expect(creationSlots('fighter').some((x) => EXTRA_SLOTS.includes(x.slot))).toBe(false)
  })

  it('調少時超出的格子收進行囊，上了鎖的留在身上', () => {
    const state = game()
    state.options = { ...state.options!, extraSlots: 4 }
    enforceExtraSlots(state)
    const pc = pcOf(state)
    const ring = spec('ring_swift', 'copper')
    const name = gearName(ring)
    pc.gear!.extra_2 = { name, spec: ring }
    pc.gear!.extra_3 = { name, spec: ring }
    pc.gear!.extra_4 = { name: '眼罩', spec: spec('blindfold'), lock: 'white' }
    const before = state.inventory.find((x) => x.name === name)?.qty ?? 0
    state.options = { ...state.options!, extraSlots: 1 }
    expect(extraOverflow(state)).toBe(true)
    const lines = enforceExtraSlots(state)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('只開 1 格')
    expect(pc.gear?.extra_2).toBeUndefined()
    expect(pc.gear?.extra_3).toBeUndefined()
    expect(pc.gear?.extra_4?.name).toBe('眼罩')
    expect(state.inventory.find((x) => x.name === name)?.qty).toBe(before + 2)
    // 再跑一次沒有東西要收
    expect(extraOverflow(state)).toBe(false)
    expect(enforceExtraSlots(state)).toEqual([])
  })

  it('預設 2 格：舊存檔沒有這個規則照兩格', () => {
    const state = game()
    delete state.options!.extraSlots
    setExtraSlotCount(5)
    enforceExtraSlots(state)
    expect(slotsFor(spec('ring_swift', 'copper'))).toEqual(['ring_1', 'ring_2', 'extra_1', 'extra_2'])
  })
})

describe('開新遊戲一律用預設的格數', () => {
  afterEach(() => setExtraSlotCount(2))
  it('不沿用上一個存檔的格數，也不收開新遊戲時給的格數', () => {
    setExtraSlotCount(8)
    expect(() => newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, gear: { extra_2: { base: 'ring_guard', tier: 1 } }, gearBudget: 3, options: { extraSlots: 0 } })).not.toThrow()
    const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, options: { extraSlots: 6 } })
    expect(state.options?.extraSlots).toBeUndefined()
    expect(creationSlots('fighter', 'human').filter((s) => EXTRA_SLOTS.includes(s.slot)).length).toBe(2)
    setExtraSlotCount(8)
    expect(() => newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, gear: { extra_5: { base: 'ring_guard', tier: 1 } }, gearBudget: 3 })).toThrow('額外飾品不能選')
  })

  it('額外飾品欄的拘束具摘要不列不生效的加成', async () => {
    const { gearSummary } = await import('@/engine/gear')
    const box = { base: 'box_binder', material: 'beast_hide', enchants: { mods: { save: 1, dr: 1 } }, lewd: { endurance: 8 } }
    expect(gearSummary(box)).toContain('豁免 +1')
    const off = gearSummary(box, true)
    expect(off).not.toContain('豁免 +1')
    expect(off).toContain('忍耐 +11')
  })
})
