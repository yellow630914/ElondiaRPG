// 有特殊任務點在裡面的特殊地圖都要有路進去：地標的內部（interior_story：只在有任務點在裡面時開放）或通道。
// 之前金帳的內帳、宣德樓的城樓、赤鬟的走私船艙只能從任務傳送進去，離開之後或任務本身沒有傳送的就卡住了
import { describe, expect, it } from 'vitest'
import { landmarks, specialMaps, stories } from '@/engine/data'
import { currentArea, enterLocation, standOn, type CellKind } from '@/engine/grid'
import { enterLandmark, interiorBlocked } from '@/engine/landmarks'
import { newGame } from '@/engine/state'
import { activeNodes, nodesHere, placeText, startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import type { GameState } from '@/engine/types'

const doors = Object.values(landmarks).filter((l) => l.interior && l.interior_story)

function atDoor(landmark: string, location: string): GameState {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 5 })
  state.location = location
  enterLocation(state)
  expect(standOn(state, landmark as CellKind)).toBe(true)
  return state
}

describe('有任務點的特殊地圖都進得去', () => {
  it('每張有任務點在裡面的特殊地圖：有地標的內部或通道', () => {
    const reachable = new Set<string>(Object.values(landmarks).flatMap((l) => (l.interior ? [l.interior] : [])))
    for (const [id, m] of Object.entries(specialMaps)) {
      for (const c of m.connections ?? []) {
        reachable.add(id)
        reachable.add(c.to.area.replace(/^sm\//, ''))
      }
    }
    const stuck = [...new Set(stories.flatMap((d) => d.nodes.filter((n) => n.at.where === 'special').map((n) => n.at.special_map!)))].filter((id) => !reachable.has(id))
    expect(stuck).toEqual([])
  })

  it.each(doors.map((l) => [l.name, l.id, l.location, l.interior!] as const))('%s：沒有事要辦時進不去', (_, id, location, map) => {
    expect(interiorBlocked(atDoor(id, location))).toBe(`沒有事要辦時進不去${specialMaps[map]!.name}`)
  })

  // 每個在這些地圖裡有任務點的特殊任務：條件成立時都能從地標走進去、站上任務點
  const inside = doors.flatMap((l) => stories.flatMap((d) => d.nodes.filter((n) => n.at.where === 'special' && n.at.special_map === l.interior).map((n) => ({ l, d, n }))))
  it.each(inside.map(({ l, d, n }) => [`${l.name}・${d.title}・${n.title}`, l.id, l.location, d.id, n.id] as const))('%s', (_, door, location, storyId, nodeId) => {
    const state = atDoor(door, location)
    startStory(state, storyId)
    const node = stories.find((d) => d.id === storyId)!.nodes.find((n) => n.id === nodeId)!
    for (const f of node.requires?.flags ?? []) setFlag(state, f)
    // 只在夜裡的任務點
    if (node.hours === 'night') state.time.hour = 21
    const ref = activeNodes(state).find((n) => n.node.id === nodeId)
    expect(ref, 'active').toBeTruthy()
    expect(placeText(node)).toContain(`的${landmarks[door]!.name}進去`)
    expect(interiorBlocked(state)).toBeUndefined()
    enterLandmark(state)
    const area = currentArea(state)
    expect(area.key).toBe(`sm/${node.at.special_map}`)
    const i = area.cells.findIndex((c) => c.storyNode === ref!.ref)
    expect(i, 'marker').toBeGreaterThanOrEqual(0)
    state.position = { area: area.key, x: i % area.width, y: Math.floor(i / area.width) }
    expect(nodesHere(state).map((n) => n.node.id)).toContain(nodeId)
  })
})
