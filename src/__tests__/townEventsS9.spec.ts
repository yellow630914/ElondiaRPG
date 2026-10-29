import { describe, expect, it } from 'vitest'
import { charmLevel } from '@/engine/charm'
import { enterLocation, getArea, currentArea } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { travelEvents } from '@/engine/road'
import { addItem, newGame } from '@/engine/state'
import { townCandidates } from '@/engine/townEvents'
import { sanitizeTravelEvent } from '@/engine/travelEventMods'
import type { GameState } from '@/engine/types'

const S9 = travelEvents.templates.filter((t) => t.scope === 'town' && t.id.startsWith('tn_') && t.requires?.charm)

function game(location: string): GameState {
  const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 4, birthplace: location, gender: '女', body: 'fem' })
  enterLocation(state)
  return state
}
const ids = (state: GameState, cell: string) => townCandidates(state, getArea(state, currentArea(state).key), cell).map((t) => t.id)

describe('S9-4 魅氣濃的城鎮事件', () => {
  it('20 件都要魅氣濃度 3 以上，其中 5 件要 4；一半以上是機會', () => {
    expect(S9).toHaveLength(20)
    expect(S9.filter((t) => t.requires!.charm!.min === 4)).toHaveLength(5)
    expect(S9.filter((t) => ['opportunity', 'commerce'].includes(t.category ?? '')).length).toBeGreaterThanOrEqual(10)
    for (const t of S9) expect(sanitizeTravelEvent(t.id, t, false), t.id).toEqual(t)
  })

  it('普通的城鎮沒有，放縱的城鎮有，淫靡的城鎮多了專屬的', () => {
    expect(charmLevel('rhineburg')).toBeLessThan(3)
    expect(ids(game('rhineburg'), 'tavern')).not.toContain('tn_strip_dice')
    expect(charmLevel('albena')).toBe(3)
    const albena = game('albena')
    expect(ids(albena, 'tavern')).toContain('tn_strip_dice')
    expect(ids(albena, 'temple')).not.toContain('tn_lust_festival')
    expect(charmLevel('bloodplume')).toBe(4)
    const south = game('bloodplume')
    expect(ids(south, 'temple')).toContain('tn_lust_festival')
    expect(ids(south, 'gate')).toContain('tn_gate_lust_tax')
  })

  it('戴著拘束具時才會被當成奴隸', () => {
    const state = game('albena')
    expect(ids(state, 'tavern')).not.toContain('tn_mistaken_slave')
    addItem(state.inventory, '絲帶手銬', 1)
    equipItem(state, '絲帶手銬', pcOf(state).id)
    expect(ids(state, 'tavern')).toContain('tn_mistaken_slave')
    expect(ids(state, 'gate')).toContain('tn_gate_restrained')
  })
})
