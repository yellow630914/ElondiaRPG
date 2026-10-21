import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { enemies, materialQuestRules } from '@/engine/data'
import { enterLocation, generateLayer, goOutskirts, standOn } from '@/engine/grid'
import { advanceBossHunts, canTurnIn, deliverable, rankForLevel, RANK_ORDER, rewardFor } from '@/engine/materialQuests'
import { locationById } from '@/engine/data'
import { newGame, withRng } from '@/engine/state'
import { acceptQuest, guildQuests, turnInQuest } from '@/engine/town'
import type { GameState, Quest } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 8): GameState {
  return newGame({ name: '測試者', race: 'human', classId: 'fighter', seed })
}

/** 換天直到委託板出現符合的委託，接下來（階級不夠時直接標成已接） */
function take(state: GameState, match: (q: Quest) => boolean): Quest {
  for (let day = state.time.day; day < state.time.day + 80; day++) {
    state.quests = state.quests.filter((q) => q.status !== 'available')
    state.time.day = day
    const q = guildQuests(state).find((x) => x.status === 'available' && match(x))
    if (q) {
      const rank = state.guild!.rank
      state.guild!.rank = 'S'
      acceptQuest(state, q.id)
      state.guild!.rank = rank
      return q
    }
  }
  throw new Error('no matching quest generated')
}

function give(state: GameState, name: string, qty: number) {
  const it = state.inventory.find((i) => i.name === name)
  if (it) it.qty += qty
  else state.inventory.push({ name, qty })
}

describe('material quests', () => {
  it('post gathering and drop quests with the right ranks and a 3x cap', () => {
    const state = game()
    const seen = new Set<string>()
    for (let day = 1; day < 40; day++) {
      state.time.day = day
      state.quests = []
      for (const q of guildQuests(state)) {
        seen.add(q.kind)
        if (q.kind === 'gather_wild') expect(q.rank).toBe('F')
        if (q.kind === 'gather_dungeon') {
          expect(q.rank).toBe('E')
          expect(q.layer).toBe('outskirts')
        }
        if (q.kind === 'drop_wild') expect(['F', 'E']).toContain(q.rank)
        if (q.kind === 'drop_dungeon' || q.kind === 'boss_hunt') {
          expect(RANK_ORDER.indexOf(q.rank)).toBeLessThanOrEqual(RANK_ORDER.indexOf('B'))
          expect(q.rank).toBe(rankForLevel(enemies[q.monster!]!.level, ['F', 'B']))
        }
        if (q.kind.startsWith('gather_') || q.kind.startsWith('drop_') || q.kind === 'boss_hunt') {
          expect(q.max).toBe(q.goal * materialQuestRules.max_multiplier)
        }
      }
    }
    for (const k of ['gather_wild', 'drop_wild', 'gather_dungeon', 'drop_dungeon', 'boss_hunt']) expect(seen, k).toContain(k)
  })

  it('makes sure the outskirts have enough gathering points, and pays more for extra', () => {
    const state = game()
    const q = take(state, (x) => x.kind === 'gather_wild')
    standOn(state, 'gate')
    expect(goOutskirts(state)).toBeUndefined()
    const area = state.areas![`${state.location}/outskirts`]!
    const spots = area.cells.filter((c) => c.kind === 'resource' && c.item === q.item).length
    expect(spots).toBeGreaterThanOrEqual(Math.min(materialQuestRules.max_cells, q.goal))

    give(state, q.item!, q.goal - 1)
    expect(canTurnIn(state, q)).toBe(false)
    give(state, q.item!, q.goal * 5)
    expect(deliverable(state, q)).toBe(q.max)
    enterLocation(state)
    standOn(state, 'guild')
    const money = state.money_cc
    const r = turnInQuest(state, q.id, q.goal * 2)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(state.money_cc - money).toBe(rewardFor(q, q.goal * 2))
    expect(rewardFor(q, q.goal * 2)).toBe(q.reward_cc * 2)
    expect(state.inventory.find((i) => i.name === q.item)?.qty).toBe(q.goal - 1 + q.goal * 5 - q.goal * 2)
    expect(q.status).toBe('completed')
    expect(q.delivered).toBe(q.goal * 2)
  })

  it('places enough of the target monster in the outskirts for drop quests', () => {
    const state = game()
    const q = take(state, (x) => x.kind === 'drop_wild')
    standOn(state, 'gate')
    goOutskirts(state)
    const area = state.areas![`${state.location}/outskirts`]!
    const fights = area.cells.filter((c) => c.kind === 'encounter' && c.group?.some(([id]) => id === q.monster)).length
    expect(fights).toBeGreaterThanOrEqual(1)
  })

  it('places gathering points and monsters in the right dungeon layer', () => {
    const state = game()
    const gather = take(state, (x) => x.kind === 'gather_dungeon')
    const drop = take(state, (x) => x.kind === 'drop_dungeon')
    for (const q of [gather, drop]) {
      const layer = ['outskirts', 'shallow', 'middle', 'deep'].indexOf(q.layer!)
      const area = withRng(state, (rng) => generateLayer(state, locationById(q.target), layer, rng))
      const n = area.cells.filter((c) => (q.kind === 'gather_dungeon'
        ? c.kind === 'resource' && c.item === q.item
        : c.kind === 'encounter' && c.group?.some(([id]) => id === q.monster))).length
      expect(n, q.title).toBeGreaterThanOrEqual(1)
    }
  })

  it('counts boss kills up to the cap and pays per kill', () => {
    const state = game()
    const q = take(state, (x) => x.kind === 'boss_hunt')
    for (let i = 0; i < 5; i++) advanceBossHunts(state, q.target, [q.monster!])
    expect(q.progress).toBe(q.max)
    expect(q.status).toBe('ready')
    standOn(state, 'guild')
    const money = state.money_cc
    turnInQuest(state, q.id)
    expect(state.money_cc - money).toBe(rewardFor(q, q.max!))
  })
})
