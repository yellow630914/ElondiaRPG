import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { craftCount, craftMaxCount, craftPlan, craftTarget, makeTarget, parseCraftTarget } from '@/engine/craft'
import { gearSpecOf, gearRules } from '@/engine/gear'
import { craftRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  delete state.party[0]!.crafts
  enterLocation(state)
  state.money_cc = 50000
  state.inventory = []
  addItem(state.inventory, '隨身鍛造工具', 1)
  return state
}
const pc = (state: GameState) => state.party[0]!
const madeCount = (state: GameState, names: { name: string; qty: number }[]) =>
  names.filter((i) => gearSpecOf(state, i.name)?.base === 'longsword').reduce((s, i) => s + i.qty, 0)

describe('打造件數：一次做好幾件', () => {
  it('clamps the count and keeps it in the target', () => {
    expect(craftMaxCount()).toBe(gearRules.craft.max_count)
    expect(craftCount(0)).toBe(1)
    expect(craftCount(99)).toBe(craftMaxCount())
    const t = craftTarget('longsword', 'iron', [], { count: 3 })
    expect(t).toContain('!n=3')
    expect(parseCraftTarget(t).opts.count).toBe(3)
    expect(craftTarget('longsword', 'iron', [], { count: 1 })).not.toContain('!n=')
  })

  it('multiplies material, fee and time for making it yourself', () => {
    const state = game()
    addItem(state.inventory, '鐵礦石', 6)
    const one = craftPlan(state, 'longsword', 'iron', [], pc(state))
    const three = craftPlan(state, 'longsword', 'iron', [], pc(state), { count: 3 })
    expect(three.count).toBe(3)
    expect(three.units).toBe(one.units * 3)
    expect(three.blocked).toBeUndefined()
    expect(craftPlan(state, 'longsword', 'iron', [], pc(state), { count: 4 }).blocked).toContain('打造材料不夠')
    const money = state.money_cc
    const t0 = state.time.day * 24 + (state.time.hour ?? 0)
    prepareAction(state, { kind: 'make', target: makeTarget('pc', 'longsword', 'iron', [], { count: 3 }), text: '' })
    state.pendingAction!.natural = 15
    const r = resolveAction(state, null)
    expect(state.money_cc).toBe(money - three.fee)
    expect(state.inventory.some((i) => i.name === '鐵礦石')).toBe(false)
    expect(madeCount(state, state.inventory)).toBe(3)
    expect(r.changes.craft_xp![0]!.amount).toBeGreaterThan(0)
    expect(state.time.day * 24 + (state.time.hour ?? 0) - t0).toBeGreaterThanOrEqual(craftRules.self.hours * 3)
  })

  it('loses half of all the material on a failure', () => {
    const state = game()
    addItem(state.inventory, '鐵礦石', 6)
    prepareAction(state, { kind: 'make', target: makeTarget('pc', 'longsword', 'iron', [], { count: 3 }), text: '' })
    state.pendingAction!.natural = 5
    const r = resolveAction(state, null)
    expect(r.check?.degree).toBe('fail')
    expect(state.inventory.find((i) => i.name === '鐵礦石')?.qty).toBe(6 - Math.ceil(6 * gearRules.craft.lost_on_fail))
    expect(madeCount(state, state.inventory)).toBe(0)
  })

  it('charges the commission fee per piece and hands over every piece', () => {
    const state = game()
    standOn(state, 'smithy')
    const one = craftPlan(state, 'longsword', 'iron')
    const two = craftPlan(state, 'longsword', 'iron', [], undefined, { count: 2 })
    expect(two.fee).toBe(one.fee * 2)
    const money = state.money_cc
    prepareAction(state, { kind: 'craft', target: craftTarget('longsword', 'iron', [], { count: 2 }), text: '' })
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    expect(state.money_cc).toBe(money - two.fee)
    expect(madeCount(state, state.inventory)).toBe(2)
  })
})
