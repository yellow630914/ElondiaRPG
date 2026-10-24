import { afterEach, describe, expect, it } from 'vitest'
import { blockedMove, enterLocation, move, setStepMinutes, stepMinutesFor } from '@/engine/grid'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import mapsJson from '@data/world/maps.json'

const minutes = (s: GameState) => ((s.time.day - 1) * 24 + s.time.hour) * 60 + (s.time.minute ?? 0)

/** 往第一個走得過去、走進去不會觸發事件的方向走一步，回傳花了幾分鐘 */
function stepOnce(state: GameState): number {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (blockedMove(state, dx, dy)) continue
    const before = minutes(state)
    const r = move(state, dx, dy)
    if (r.report || r.combat) continue
    return minutes(state) - before
  }
  throw new Error('no free step')
}

describe('walking time setting', () => {
  afterEach(() => setStepMinutes(undefined))

  it('uses the map defaults, then the configured minutes per step', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 2 })
    enterLocation(state)
    expect(stepMinutesFor('settlement')).toBe(mapsJson.generation.step_minutes.settlement)
    expect(stepOnce(state)).toBe(mapsJson.generation.step_minutes.settlement)
    setStepMinutes({ settlement: 1, wild: '', dungeon: 999 })
    expect(stepMinutesFor('settlement')).toBe(1)
    expect(stepMinutesFor('wild')).toBe(mapsJson.generation.step_minutes.wild)
    expect(stepMinutesFor('dungeon')).toBe(60)
    expect(stepOnce(state)).toBe(1)
  })
})
