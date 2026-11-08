import { describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { activeNodes, nodesHere, playNode, refreshStoryMarkers, startAutoStories, startStory, storyDef, storyHints } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import { sanitizeStory, storyIssues } from '@/engine/storyMods'
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
    // 世界編輯器存檔、匯出入時留下筆記上的提示
    expect(sanitizeStory(def.id, def, false).hints).toEqual(def.hints)
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

  it('also starts from the eastern political lines and the lines leading to them', () => {
    const state = game('longan')
    startStory(state, 'yhk_exam_marks')
    expect(state.stories?.epic_guide?.status).toBe('active')
    const td = game('jinzhang')
    startStory(td, 'tdl_stolen_horse')
    expect(td.stories?.epic_guide?.status).toBe('active')
  })

  it('starts for an old save as soon as it is checked (load, any action), without a quest event', () => {
    const state = game()
    setFlag(state, 'rv_start', true)
    expect(state.stories?.epic_guide).toBeUndefined()
    const out = startAutoStories(state)
    expect(out.map((r) => r.story?.id)).toEqual(['epic_guide'])
    // 已經開始的不會再開始
    expect(startAutoStories(state)).toEqual([])
  })

  it('keeps a goal in the notebook between the quest points', () => {
    const def = storyDef('epic_guide')!
    const state = game('rivervale')
    startStory(state, 'rhine_raid')
    standOn(state, 'guild')
    playNode(state, nodesHere(state).find((n) => n.def.id === 'epic_guide')!.ref)
    expect(storyHints(state, def).join()).toContain('風暴的前夜')
    expect(storyHints(state, def).join()).toContain('A 級')
    setFlag(state, 'pol_start', true)
    expect(storyHints(state, def).join()).not.toContain('風暴的前夜')
    expect(storyHints(state, def).join()).toContain('阿契隆的注視')
    // 東大陸：走完一條通往大燁政體的線之後，提示到龍安府接「女帝的新政」
    setFlag(state, 'yhk_end_court', true)
    expect(storyHints(state, def).join()).toContain('女帝的新政')
    setFlag(state, 'yhpol_1_started', true)
    expect(storyHints(state, def).join()).not.toContain('女帝的新政')
    // 巨龍那一段寫出等級與階級
    const drg = def.nodes.find((n) => n.id === 'dragons')!
    expect(drg.success?.text).toContain('19 級')
    expect(drg.success?.text).toContain('S 級')
  })
})
