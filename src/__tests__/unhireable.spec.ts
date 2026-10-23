import { afterEach, describe, expect, it } from 'vitest'
import { enterLocation } from '@/engine/grid'
import { applyContent, emptyMods, newNpc, sanitizeNpc } from '@/engine/mods'
import { hireable } from '@/engine/population'
import { newGame } from '@/engine/state'
import { recruitableHere } from '@/engine/town'
import { hireAtAsking } from '@/engine/companions'

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
