import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { stories, type StoryDef } from '@/engine/data'
import { deadlineText, expireDeadlines, questDeadlineDays, storyDeadline } from '@/engine/deadlines'
import { enterLocation } from '@/engine/grid'
import { addHours, newGame } from '@/engine/state'
import { startStory } from '@/engine/story'
import { acceptQuest } from '@/engine/town'
import type { GameState, Quest } from '@/engine/types'
import { useGame } from '@/stores/game'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 2, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

function quest(state: GameState, area: Quest['area'], target = state.location): Quest {
  const q: Quest = { id: `q_${area}`, title: `測試委託（${area}）`, rank: 'F', kind: 'patrol', area, giver: state.location, target, goal: 1, progress: 0, reward_cc: 30, status: 'available' }
  state.quests.push(q)
  return q
}

describe('quest deadlines', () => {
  it('sets a deadline by place: town, outskirts, dungeon plus the trip', () => {
    const state = game()
    expect(questDeadlineDays({ area: 'town', giver: 'soriel', target: 'soriel' })).toBe(3)
    expect(questDeadlineDays({ area: 'outskirts', giver: 'soriel', target: 'soriel' })).toBe(5)
    const far = questDeadlineDays({ area: 'dungeon', giver: 'soriel', target: 'whisper_crypt' })!
    expect(far).toBeGreaterThan(7)
    const q = quest(state, 'town')
    const before = { ...state.time }
    acceptQuest(state, q.id)
    expect(q.deadline).toEqual(addHours(before, 3 * 24))
    expect(deadlineText(state, q.deadline)).toMatch(/剩 [23] 天/)
  })

  it('fails accepted quests past the deadline, but not ones whose goal is done', () => {
    const state = game()
    const late = quest(state, 'town')
    const done = quest(state, 'outskirts')
    acceptQuest(state, late.id)
    acceptQuest(state, done.id)
    done.status = 'ready'
    expect(expireDeadlines(state)).toEqual([])
    state.time = addHours(state.time, 6 * 24)
    const [report] = expireDeadlines(state)
    expect(report!.outcome.tags).toContain('委託逾期')
    expect(report!.changes.reputation).toEqual([{ faction: 'guild', delta: -1 }])
    expect(state.quests.map((q) => q.id)).toEqual([done.id])
  })

  it('fails a special quest after its time limit', () => {
    const state = game()
    const story = {
      id: 'test_timed', title: '限時的委託', summary: '', rank: 'F', start: { kind: 'manual' }, time_limit: 2,
      nodes: [{ id: 'n1', title: '去酒館', text: '', kind: 'story', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, success: { complete: true } }],
    } as StoryDef
    stories.push(story)
    try {
      startStory(state, 'test_timed')
      expect(storyDeadline(state, 'test_timed')).toBeDefined()
      state.time = addHours(state.time, 47)
      expect(expireDeadlines(state)).toEqual([])
      state.time = addHours(state.time, 2)
      const [report] = expireDeadlines(state)
      expect(report!.outcome.summary).toContain('過了期限')
      expect(state.stories!.test_timed!.status).toBe('failed')
    } finally {
      stories.splice(stories.indexOf(story), 1)
    }
  })

  it('checks deadlines after every action in the store', () => {
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    const s = g.state!
    const q = quest(s, 'town')
    g.runAction((st) => acceptQuest(st, q.id))
    g.runAction((st) => {
      st.time = addHours(st.time, 5 * 24)
    })
    expect(g.state!.quests.some((x) => x.id === q.id)).toBe(false)
  })
})
