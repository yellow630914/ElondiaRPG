import { describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { activeNodes, nodesHere, playNode, refreshStoryMarkers, startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import { storyIssues } from '@/engine/storyMods'
import type { GameState, Report } from '@/engine/types'

// 史詩的指引（epic_guide）：開頭是「條件成立時自動開始」（start.kind = auto）。
// 接了政治或巨龍相關的故事線就自動開始，指引到河谷鎮公會的政治史詩，政治史詩落幕後指引到巨龍史詩
function game(at = 'soriel'): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5, birthplace: at })
  enterLocation(state)
  return state
}

describe('epic guide', () => {
  it('is a valid auto-start quest', () => {
    const def = stories.find((s) => s.id === 'epic_guide')!
    expect(def.start.kind).toBe('auto')
    expect(storyIssues(def)).toEqual([])
  })

  it('starts by itself when a political or dragon quest starts, not for other quests', () => {
    const state = game()
    startStory(state, 'lost_relic')
    expect(state.stories?.epic_guide).toBeUndefined()

    const before = state.reports.length
    startStory(state, 'rhine_raid')
    expect(state.stories?.epic_guide?.status).toBe('active')
    // 接任務一則、指引一則
    expect(state.reports.length).toBe(before + 2)
    expect(state.reports.at(-1)!.story?.id).toBe('epic_guide')
    expect(activeNodes(state).filter((n) => n.def.id === 'epic_guide').map((n) => n.node.id)).toEqual(['politics'])

    const dragon = game()
    startStory(dragon, 'kagni_hammer_tone')
    expect(dragon.stories?.epic_guide?.status).toBe('active')
  })

  it('points to the political epic, then to the dragon epic after it, and completes', () => {
    const state = game('rivervale')
    startStory(state, 'rhine_raid')
    standOn(state, 'guild')
    const pol = nodesHere(state).find((n) => n.def.id === 'epic_guide')!
    expect(pol.node.id).toBe('politics')
    playNode(state, pol.ref)
    expect(activeNodes(state).some((n) => n.def.id === 'epic_guide')).toBe(false)

    setFlag(state, 'pol_start', true)
    setFlag(state, 'dragon_calamity', true)
    refreshStoryMarkers(state)
    const drg = nodesHere(state).find((n) => n.def.id === 'epic_guide')!
    expect(drg.node.id).toBe('dragons')
    const r = playNode(state, drg.ref) as Report
    expect(r.outcome.summary).toContain('卡格尼')
    expect(state.stories?.epic_guide?.status).toBe('completed')
  })

  it('does not start once the dragon epic has begun', () => {
    const state = game()
    setFlag(state, 'drg_kag_start', true)
    startStory(state, 'rhine_raid')
    expect(state.stories?.epic_guide).toBeUndefined()
  })
})
