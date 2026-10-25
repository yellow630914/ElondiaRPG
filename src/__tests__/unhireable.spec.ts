import { afterEach, describe, expect, it } from 'vitest'
import { enterLocation } from '@/engine/grid'
import { applyContent, emptyMods, newNpc, sanitizeNpc } from '@/engine/mods'
import { hireable } from '@/engine/population'
import { newGame } from '@/engine/state'
import { recruitableHere } from '@/engine/town'
import { hireAtAsking } from '@/engine/companions'
import { prepareAction } from '@/engine/actions'
import { npcRecord, registerNpc } from '@/engine/npcs'

afterEach(() => applyContent(emptyMods()))

describe('unhireable fixed NPCs', () => {
  it('keeps rulers out of hiring', () => {
    const mods = emptyMods()
    mods.npcs.mod_npc_emperor = sanitizeNpc('mod_npc_emperor', { ...newNpc('mod_npc_emperor'), name: '測試皇帝', class: 'fighter', level: 15, location: 'soriel', unhireable: true, haunts: [{ location: 'soriel', zone: 'town', weight: 1 }] }, true)
    expect(mods.npcs.mod_npc_emperor!.unhireable).toBe(true)
    applyContent(mods)
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, birthplace: 'soriel' })
    enterLocation(state)
    state.money_cc = 1e6
    expect(recruitableHere(state).map((n) => n.id)).not.toContain('mod_npc_emperor')
    expect(hireable(state).map((r) => r.id)).not.toContain('mod_npc_emperor')
    expect(() => hireAtAsking(state, 'mod_npc_emperor', 999999)).toThrow()
  })
  it('only keeps the flag on adventurers', () => {
    expect(sanitizeNpc('mod_npc_x', { ...newNpc('mod_npc_x'), kind: 'commoner', unhireable: true }, true).unhireable).toBeUndefined()
  })
})

describe('guarded fixed NPCs', () => {
  function nextTo(guard: { no_attack?: boolean; no_steal?: boolean }) {
    const mods = emptyMods()
    mods.npcs.mod_npc_queen = sanitizeNpc('mod_npc_queen', { ...newNpc('mod_npc_queen'), name: '測試女王', class: 'fighter', level: 15, location: 'soriel', unhireable: true, ...guard }, true)
    applyContent(mods)
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, birthplace: 'soriel' })
    enterLocation(state)
    const p = state.position!
    registerNpc(state, { ...npcRecord(state, 'mod_npc_queen')!, at: { area: p.area, x: p.x, y: p.y, until: state.time.day } })
    return state
  }

  it('cannot be ambushed or robbed', () => {
    const state = nextTo({ no_attack: true, no_steal: true })
    expect(() => prepareAction(state, { kind: 'attack', target: 'mod_npc_queen', text: '' })).toThrow('戒備森嚴')
    expect(() => prepareAction(state, { kind: 'steal', target: 'mod_npc_queen', text: '' })).toThrow('戒備森嚴')
    // 聊天照常
    expect(() => prepareAction(state, { kind: 'chat', target: 'mod_npc_queen', text: '' })).not.toThrow()
  })

  it('still allows what is not forbidden', () => {
    const state = nextTo({ no_steal: true })
    expect(() => prepareAction(state, { kind: 'attack', target: 'mod_npc_queen', text: '' })).not.toThrow()
  })

  it('keeps no_attack only on adventurers', () => {
    const c = sanitizeNpc('mod_npc_x', { ...newNpc('mod_npc_x'), kind: 'commoner', no_attack: true, no_steal: true }, true)
    expect(c.no_attack).toBeUndefined()
    expect(c.no_steal).toBe(true)
  })
})

describe('adult appearance', () => {
  it('adds the adult details only with adult content on', async () => {
    const { setAdultContent } = await import('@/engine/content')
    const { appearanceOf } = await import('@/engine/npcs')
    setAdultContent(false)
    expect(appearanceOf('npc_aurelia', '金髮。')).toBe('金髮。')
    setAdultContent(true)
    expect(appearanceOf('npc_aurelia', '金髮。')).toMatch(/^金髮。陰唇/)
    expect(appearanceOf('npc_amber', '黑髮。')).toBe('黑髮。')
    setAdultContent(false)
  })
  it('keeps the field through the content editor', () => {
    expect(sanitizeNpc('mod_npc_x', { ...newNpc('mod_npc_x'), adult_appearance: '細節' }, true).adult_appearance).toBe('細節')
  })
})
