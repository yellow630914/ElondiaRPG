import { beforeEach, describe, expect, it } from 'vitest'
import { activeEvents, pendingEvents, snoozed } from '@/components/events/eventQueue'
import { enterLocation } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { ensureRelationship, addSuggestions } from '@/engine/social'
import { newGame, withRng } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 2, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

beforeEach(() => {
  snoozed.value = new Set()
})

describe('event queue', () => {
  it('lists blocking events first, then relationship changes and level-ups', () => {
    const state = game()
    expect(pendingEvents(state)).toEqual([])
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', location: state.location }))
    ensureRelationship(state, rec)
    addSuggestions(state, [{ id: rec.id, to_player: '開始信任你了' }], 'r1')
    state.party[0]!.attrPoints = 2
    state.pendingMasterEvent = { id: 'chores', master: 'm1', at: { ...state.time } } as unknown as GameState['pendingMasterEvent']
    const list = pendingEvents(state)
    expect(list.map((e) => e.kind)).toEqual(['master', 'suggestion', 'levelup'])
    expect(list[0]).toMatchObject({ blocking: true, icon: '⛓️' })
    expect(list[1]!.title).toContain(rec.name)
    expect(list[2]!.title).toContain('分配 2 點屬性')
    // 同一件事的 id 不變
    expect(pendingEvents(state).map((e) => e.id)).toEqual(list.map((e) => e.id))
  })

  it('lets non-blocking events be put off, but not blocking ones', () => {
    const state = game()
    state.party[0]!.attrPoints = 1
    state.roadEvent = { x: 3, template: 'x' }
    const [road, level] = pendingEvents(state)
    snoozed.value = new Set([road!.id, level!.id])
    expect(activeEvents(state).map((e) => e.kind)).toEqual(['road'])
    // 稍後的事件一有變化（又多一點屬性）就是新的一件
    state.party[0]!.attrPoints = 2
    expect(activeEvents(state).map((e) => e.kind)).toEqual(['road', 'levelup'])
  })

  it('waits while an action is being judged and during combat', () => {
    const state = game()
    state.standoff = { foes: [] } as unknown as GameState['standoff']
    expect(pendingEvents(state).map((e) => e.kind)).toEqual(['standoff'])
    state.pendingAction = {} as GameState['pendingAction']
    expect(pendingEvents(state)).toEqual([])
    delete state.pendingAction
    state.combat = {} as GameState['combat']
    expect(pendingEvents(state)).toEqual([])
  })
})
