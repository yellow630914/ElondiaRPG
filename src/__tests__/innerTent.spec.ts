// 金帳的內帳：金帳地標的內部，只在有特殊任務點在裡面時進得去（LandmarkDef.interior_story）。
// 之前只能從公會的任務點傳送進去，離開之後或任務本身沒有傳送的就卡住了
import { describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { currentArea, enterLocation, standOn } from '@/engine/grid'
import { enterLandmark, interiorBlocked } from '@/engine/landmarks'
import { newGame } from '@/engine/state'
import { activeNodes, nodesHere, placeText, startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import type { GameState } from '@/engine/types'

function atTent(): GameState {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 5 })
  state.location = 'jinzhang'
  enterLocation(state)
  expect(standOn(state, 'lm_td_golden_tent')).toBe(true)
  return state
}

describe('金帳的內帳', () => {
  it('沒有事要辦時進不去', () => {
    expect(interiorBlocked(atTent())).toBe('沒有事要辦時進不去金帳的內帳')
  })

  // 每個在內帳裡有任務點的特殊任務：條件成立時都能從金帳走進去、站上任務點
  const inside = stories.flatMap((d) => d.nodes.filter((n) => n.at.where === 'special' && n.at.special_map === 'sm_td_inner_tent').map((n) => ({ d, n })))
  it.each(inside.map(({ d, n }) => [`${d.title}・${n.title}`, d.id, n.id] as const))('%s', (_, storyId, nodeId) => {
    const state = atTent()
    startStory(state, storyId)
    const node = stories.find((d) => d.id === storyId)!.nodes.find((n) => n.id === nodeId)!
    for (const f of node.requires?.flags ?? []) setFlag(state, f)
    // 只在夜裡的任務點
    if (node.hours === 'night') state.time.hour = 21
    const ref = activeNodes(state).find((n) => n.node.id === nodeId)
    expect(ref, 'active').toBeTruthy()
    expect(placeText(node)).toContain('從金帳王庭的金帳進去')
    expect(interiorBlocked(state)).toBeUndefined()
    enterLandmark(state)
    const area = currentArea(state)
    expect(area.key).toBe('sm/sm_td_inner_tent')
    const i = area.cells.findIndex((c) => c.storyNode === ref!.ref)
    expect(i, 'marker').toBeGreaterThanOrEqual(0)
    state.position = { area: area.key, x: i % area.width, y: Math.floor(i / area.width) }
    expect(nodesHere(state).map((n) => n.node.id)).toContain(nodeId)
  })
})
