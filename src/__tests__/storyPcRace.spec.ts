import { describe, expect, it } from 'vitest'
import { sanitizeCond } from '@/engine/mods'
import { newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'

// 劇情條件「主角的種族」（EAST_CONTENT_PLAN 11.12 節）：pc_races 是其中一個、pc_races_none 不是其中任何一個
describe('story condition: the player character’s race', () => {
  const centaur = () => newGame({ name: '測試者', race: 'centaur', classId: 'fighter', seed: 3, birthplace: 'jinzhang' })
  const human = () => newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })

  it('holds when the player is one of the listed races', () => {
    expect(condMet(centaur(), { pc_races: ['centaur'] })).toBe(true)
    expect(condMet(human(), { pc_races: ['centaur'] })).toBe(false)
    expect(condMet(human(), { pc_races: ['centaur', 'human'] })).toBe(true)
  })

  it('holds when the player is none of the excluded races', () => {
    expect(condMet(centaur(), { pc_races_none: ['centaur'] })).toBe(false)
    expect(condMet(human(), { pc_races_none: ['centaur'] })).toBe(true)
  })

  it('combines with the other conditions', () => {
    const s = centaur()
    expect(condMet(s, { pc_races: ['centaur'], flags: ['nope'] })).toBe(false)
    expect(condMet(s, { pc_races: ['centaur'], pc_races_none: ['human'] })).toBe(true)
  })

  it('keeps only known races when sanitizing', () => {
    expect(sanitizeCond({ pc_races: ['centaur', 'dragon_god', 'centaur', 7], pc_races_none: ['human', 'x'] })).toEqual({ pc_races: ['centaur'], pc_races_none: ['human'] })
    expect(sanitizeCond({ pc_races: ['x'] })).toBeUndefined()
  })
})
