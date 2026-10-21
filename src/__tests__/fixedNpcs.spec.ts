import { afterEach, describe, expect, it } from 'vitest'
import { createNpc } from '@/engine/character'
import { npcs as namedNpcs } from '@/engine/data'
import { blockKeys, enterLocation, getArea, settlementArea } from '@/engine/grid'
import { applyContent, emptyMods, newNpc, normalizeMods, sanitizeNpc, type ContentMods } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { joinParty, partyRoom } from '@/engine/party'
import { peopleHere, refreshRosters } from '@/engine/population'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import { dismiss } from '@/engine/town'
import type { GameState } from '@/engine/types'

afterEach(() => {
  applyContent(emptyMods())
})

function mods(patch: Partial<ContentMods>): ContentMods {
  return normalizeMods({ ...emptyMods(), ...patch })
}

function game(): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 4, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

/** 站到某個區塊的第一個可以走的格子 */
function standIn(state: GameState, key: string) {
  const area = getArea(state, key)
  const i = area.cells.findIndex((c) => c.kind === 'floor')
  state.position = { area: key, x: i % area.width, y: Math.floor(i / area.width) }
}

describe('fixed NPCs', () => {
  it('adds a custom character with set stats, skills and gear', () => {
    const n = newNpc('mod_npc_x')
    n.name = '灰鴉'
    n.class = 'rogue'
    n.level = 4
    n.attrs = { dex: 18, cha: 15 }
    n.abilities = ['sneak_attack', 'nonsense']
    n.gear = { main_hand: { base: 'dagger', material: 'steel' }, head: { base: 'longsword', material: 'iron' } }
    applyContent(mods({ npcs: { mod_npc_x: n } }))
    const def = namedNpcs.find((x) => x.id === 'mod_npc_x')!
    expect(def.name).toBe('灰鴉')
    // 不存在的能力、放不進欄位的裝備會被拿掉
    expect(Object.keys(def.gear ?? {})).toEqual(['main_hand'])
    const c = createNpc(def, new Rng(1))
    expect(c.attrs.dex).toBe(18)
    expect(c.attrs.cha).toBe(15)
    expect(c.abilities).toEqual(def.abilities)
    expect(c.gear?.main_hand?.spec).toEqual({ base: 'dagger', material: 'steel' })
    expect(c.gear?.body).toBeUndefined()
    applyContent(emptyMods())
    expect(namedNpcs.some((x) => x.id === 'mod_npc_x')).toBe(false)
  })

  it('stands on a fixed cell, only after the story flag is set, and stays through roster turnover', () => {
    const key = blockKeys('soriel')[0]!
    const area = settlementArea(key)!
    const i = area.cells.findIndex((c) => c.kind === 'floor')
    const n = { ...newNpc('mod_npc_y'), name: '守門老人', haunts: [], fixed: { area: key, x: i % area.width, y: Math.floor(i / area.width) }, requires: { flags: ['met_elder'] } }
    applyContent(mods({ npcs: { mod_npc_y: n } }))
    const state = game()
    standIn(state, key)
    expect(peopleHere(state).some((p) => p.rec.id === 'mod_npc_y')).toBe(false)
    setFlag(state, 'met_elder')
    const here = peopleHere(state).find((p) => p.rec.id === 'mod_npc_y')
    expect(here).toMatchObject({ x: n.fixed.x, y: n.fixed.y })
    // 一年的名單變動之後還在
    state.time.day += 365
    refreshRosters(state)
    expect(npcRecord(state, 'mod_npc_y')).toBeDefined()
    expect(peopleHere(state).some((p) => p.rec.id === 'mod_npc_y')).toBe(true)
  })

  it('keeps fixed cells on walkable ground only', () => {
    const key = blockKeys('soriel')[0]!
    const area = settlementArea(key)!
    const wall = area.cells.findIndex((c) => c.kind === 'wall')
    const out = sanitizeNpc('a', { ...newNpc('a'), fixed: { area: key, x: wall % area.width, y: Math.floor(wall / area.width) } }, true)
    expect(out.fixed).toBeUndefined()
    expect(sanitizeNpc('b', { ...newNpc('b'), fixed: { area: 'nowhere/x', x: 0, y: 0 } }, true).fixed).toBeUndefined()
  })

  it('lets a quest companion join without taking a party slot, and not be dismissed', () => {
    const state = game()
    const room = partyRoom(state)
    joinParty(state, npcRecord(state, 'npc_lina')!, 'guest')
    expect(partyRoom(state)).toBe(room)
    expect(() => dismiss(state, 'npc_lina')).toThrow('任務')
  })
})
