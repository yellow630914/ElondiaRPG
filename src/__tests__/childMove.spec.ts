// 把孩子送到別的城（玩家回報：在別的城生了孩子，搬不回常住的城；docs/FAMILY.md 第 7.4 節）
import { describe, expect, it } from 'vitest'
import { addChild, childMoveOptions, childrenAtHome, hasTemple, moveChild } from '@/engine/children'
import { enterLocation } from '@/engine/grid'
import { buyHome, lotsOf } from '@/engine/homes'
import { familyRules } from '@/engine/pregMarks'
import { newGame } from '@/engine/state'

describe('moving a baby to another town', () => {
  it('offers your homes and nurseries in other towns, escorted for a fee by the day', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
    state.money_cc = 200000
    state.location = 'rhineburg'
    enterLocation(state)
    buyHome(state, lotsOf('rhineburg').find((l) => l.district === 'house')!.id)
    const home = Object.values(state.homes!)[0]!
    state.location = 'soriel'
    enterLocation(state)
    expect(hasTemple('soriel')).toBe(true)
    const kid = addChild(state, { name: '小米', gender: 'female', race: 'human', born: state.time.day, mother: { id: 'pc', name: '艾倫' }, where: { kind: 'temple', location: 'soriel', since: state.time.day, paidUntil: state.time.day } })

    const opts = childMoveOptions(state, kid)
    const toHome = opts.find((o) => o.to.kind === 'home')!
    expect(toHome.label).toContain(home.name)
    expect(toHome.cost % (familyRules.nursery as { escort_cc_per_day: number }).escort_cc_per_day).toBe(0)
    expect(opts.some((o) => o.to.kind === 'temple' && o.to.location === 'rhineburg')).toBe(hasTemple('rhineburg'))
    // 這座城的地方不列在這裡（原本的按鈕）
    expect(opts.every((o) => o.to.kind === 'home' || o.to.location !== 'soriel')).toBe(true)

    const before = state.money_cc
    moveChild(state, kid.id, toHome.to)
    expect(childrenAtHome(state, home.id).map((c) => c.id)).toEqual([kid.id])
    expect(state.money_cc).toBe(before - toHome.cost)
    // 孩子不在這座城：要到孩子所在的城才能安排
    expect(() => moveChild(state, kid.id, { kind: 'temple', location: 'soriel' })).toThrow('所在的城')
  })
})
