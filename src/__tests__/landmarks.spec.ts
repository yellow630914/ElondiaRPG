import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import mapsJson from '@data/world/maps.json'
import { geography, landmarks, landmarkTypes } from '@/engine/data'
import { CELL_ICON, cellName, currentCell, enterLocation, getArea, settlementArea, standOn } from '@/engine/grid'
import { builtinLandmark, newLandmark } from '@/engine/landmarkMods'
import { landmarkHere, withLandmark } from '@/engine/landmarks'
import { applyContent, emptyMods, newNpc, normalizeMods } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { fixedCell } from '@/engine/population'
import { computePlacements } from '@/engine/shopMods'
import { newGame } from '@/engine/state'
import { newStory, sanitizeStory } from '@/engine/storyMods'
import { useContent } from '@/stores/content'
import { editableWorld } from './testWorld'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const game = (birthplace = 'rhineburg') => {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace })
  enterLocation(state)
  return state
}
const kindAt = (r: { area: string; x: number; y: number }) => {
  const a = settlementArea(r.area)!
  return a.cells[r.y * a.width + r.x]!.kind
}
const maps = mapsJson as unknown as { maps: Record<string, { blocks: { id: string; grid: string[] }[] }> }

describe('built-in landmarks', () => {
  it('sit on a road cell of their own settlement, one cell each, with known types', () => {
    const list = Object.values(landmarks)
    expect(list.length).toBeGreaterThanOrEqual(40)
    const cells = new Set<string>()
    for (const l of list) {
      expect(l.id).toMatch(/^lm_[a-z0-9_]+$/)
      expect(geography.locations.find((x) => x.id === l.location)?.type).not.toBe('dungeon')
      const [loc, block] = l.at.area.split('/')
      expect(loc).toBe(l.location)
      const grid = maps.maps[loc!]!.blocks.find((b) => b.id === block)!.grid
      expect(grid[l.at.y]![l.at.x], l.id).toBe('.')
      expect(cells.has(`${l.at.area}:${l.at.x},${l.at.y}`)).toBe(false)
      cells.add(`${l.at.area}:${l.at.x},${l.at.y}`)
      expect(l.types.length).toBeGreaterThan(0)
      for (const t of l.types) expect(landmarkTypes[t], `${l.id} ${t}`).toBeDefined()
      expect(kindAt(l.at)).toBe(l.id)
      expect(cellName(l.id as never)).toBe(l.name)
      expect(CELL_ICON[l.id as never]).toBe(l.emoji)
    }
  })

  it('give the action scene the landmark mood when standing there', () => {
    const state = game()
    expect(standOn(state, 'lm_knight_academy')).toBe(true)
    expect(landmarkHere(state)?.name).toBe('騎士學院')
    expect(withLandmark(state, '萊茵堡')).toContain('騎士學院（')
    standOn(state, 'inn')
    expect(withLandmark(state, '萊茵堡')).toBe('萊茵堡')
  })

  it('cannot be covered by a shop placement', () => {
    const at = landmarks.lm_knight_academy!.at
    const r = computePlacements({ shop_x: { custom: true, name: '店', places: [at] } })
    expect(r.rejected[0]).toMatchObject({ reason: '那一格不是空地（道路）' })
  })
})

describe('editing landmarks', () => {
  it('moves a built-in landmark inside its settlement, refuses walls, and restores it', () => {
    const c = editableWorld()
    const from = landmarks.lm_knight_academy!.at
    const area = settlementArea(from.area)!
    const floor = area.cells.findIndex((x, i) => x.kind === 'floor' && i !== from.y * area.width + from.x)
    const to = { area: from.area, x: floor % area.width, y: Math.floor(floor / area.width) }
    c.saveLandmark('lm_knight_academy', { ...builtinLandmark('lm_knight_academy')!, at: to, name: '王立騎士學院' })
    expect(kindAt(from)).toBe('floor')
    expect(kindAt(to)).toBe('lm_knight_academy')
    expect(landmarks.lm_knight_academy!.name).toBe('王立騎士學院')
    // 換聚落不算（內建的不能搬到別的聚落）、牆上不行
    const wall = area.cells.findIndex((x) => x.kind === 'wall')
    expect(() => c.saveLandmark('lm_knight_academy', { ...landmarks.lm_knight_academy!, at: { area: from.area, x: wall % area.width, y: Math.floor(wall / area.width) } })).toThrow('不是空地')
    c.saveLandmark('lm_knight_academy', { ...landmarks.lm_knight_academy!, at: { area: 'soriel/pilgrim', x: 1, y: 1 } })
    expect(landmarks.lm_knight_academy!.location).toBe('rhineburg')
    c.restoreLandmark('lm_knight_academy')
    expect(kindAt(from)).toBe('lm_knight_academy')
    expect(useContent().mods.landmarks.lm_knight_academy).toBeUndefined()
  })

  it('custom landmarks: fixed NPCs stay there, story nodes target them, and both block deletion', () => {
    const c = editableWorld()
    const id = 'lm_test1'
    c.saveLandmark(id, { ...newLandmark(id, 'soriel'), name: '許願池', types: ['monument', 'bogus'] })
    expect(landmarks[id]).toMatchObject({ name: '許願池', location: 'soriel', types: ['monument'] })
    expect(kindAt(landmarks[id]!.at)).toBe(id)
    // 固定 NPC 待在地標：站在地標那一格，地標搬家時跟著走
    c.saveNpc('mod_npc_lm', { ...newNpc('mod_npc_lm'), location: 'soriel', landmark: id })
    const state = game('soriel')
    expect(fixedCell(npcRecord(state, 'mod_npc_lm')!)).toEqual(landmarks[id]!.at)
    expect(() => c.deleteLandmark(id)).toThrow('待在這裡')
    c.deleteNpc('mod_npc_lm')
    // 特殊任務的任務點
    const s = newStory('mod_story_lm')
    s.nodes[0] = { ...s.nodes[0]!, at: { where: 'cell', location: 'soriel', cell: id } }
    expect(sanitizeStory('mod_story_lm', s, true).nodes[0]!.at.cell).toBe(id)
    // 別的地點的地標不收
    expect(sanitizeStory('mod_story_lm', { ...s, nodes: [{ ...s.nodes[0]!, at: { where: 'cell', location: 'rhineburg', cell: id } }] }, true).nodes[0]!.at.cell).toBe('tavern')
    c.saveStory('mod_story_lm', s)
    expect(() => c.deleteLandmark(id)).toThrow('任務點')
    c.deleteStory('mod_story_lm')
    c.deleteLandmark(id)
    expect(landmarks[id]).toBeUndefined()
    expect(() => c.deleteLandmark('lm_knight_academy')).toThrow('內建')
  })

  it('survive normalizing a saved world, and old saves see the moved map', () => {
    const at = newLandmark('lm_test2', 'rhineburg').at
    const mods = normalizeMods({ ...emptyMods(), landmarks: { lm_test2: { ...newLandmark('lm_test2', 'rhineburg'), name: '噴泉' }, bad: { name: 'x' } } })
    expect(Object.keys(mods.landmarks)).toEqual(['lm_test2'])
    applyContent(mods)
    const state = game()
    expect(getArea(state, at.area).cells[at.y * getArea(state, at.area).width + at.x]!.kind).toBe('lm_test2')
    expect(standOn(state, 'lm_test2')).toBe(true)
    expect(currentCell(state).kind).toBe('lm_test2')
  })
})
