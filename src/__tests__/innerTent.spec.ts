// 有特殊任務點在裡面的特殊地圖都要有路進去：地標的內部（interior_story：只在有任務點在裡面時開放）或通道。
// 之前金帳的內帳、宣德樓的城樓、赤鬟的走私船艙只能從任務傳送進去，離開之後或任務本身沒有傳送的就卡住了
import { describe, expect, it } from 'vitest'
import { landmarks, specialMaps, stories } from '@/engine/data'
import { blockKeys, crossLink, currentArea, enterLocation, getArea, linkEntryBlock, standOn, type CellKind } from '@/engine/grid'
import { enterLandmark, interiorBlocked, landmarkClosed } from '@/engine/landmarks'
import { pcOf } from '@/engine/party'
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

// 宣德樓、金帳在王城裡：任務點在裡面時王城的衛兵放行（被召見），逃亡奴隸也進得去；沒有事要辦時照舊要聲望或說服
describe('被召見時王城的衛兵放行', () => {
  const palace = doors.filter((l) => l.at.area.endsWith('/palace'))
  const pick = (map: string) => stories.flatMap((d) => d.nodes.filter((n) => n.at.where === 'special' && n.at.special_map === map).map((n) => ({ d, n })))[0]!

  /** 站到通往地標那一區的路口 */
  function atGate(state: GameState, area: string) {
    for (const key of blockKeys(state.location)) {
      const a = getArea(state, key)
      const i = a.cells.findIndex((c) => c.kind === 'link' && c.link?.area === area)
      if (i >= 0) return void (state.position = { area: a.key, x: i % a.width, y: Math.floor(i / a.width) })
    }
    throw new Error(`no gate to ${area}`)
  }

  it.each(palace.map((l) => [l.name, l] as const))('%s', (_, l) => {
    const { d, n } = pick(l.interior!)
    const state = atDoor(l.id, l.location)
    atGate(state, l.at.area)
    expect(linkEntryBlock(state)?.zone).toBe('palace')
    startStory(state, d.id)
    for (const f of n.requires?.flags ?? []) setFlag(state, f)
    if (n.hours === 'night') state.time.hour = 21
    expect(linkEntryBlock(state)).toBeNull()
    crossLink(state)
    expect(currentArea(state).key).toBe(l.at.area)
    // 逃亡奴隸：官方機構照樣讓被召見的人進去
    standOn(state, l.id as CellKind)
    pcOf(state).status.push('fugitive')
    expect(interiorBlocked(state)).toBeUndefined()
    // 沒有事要辦時：逃亡奴隸照舊被官方機構擋下
    expect(landmarkClosed(state, l)).toContain('契約印記')
  })
})
