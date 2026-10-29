import { describe, expect, it } from 'vitest'
import { charmGateOpen, charmGatePass, charmLevel, charmNote, neighborRegions, spreadExposure } from '@/engine/charm'
import { setContentFilters } from '@/engine/content'
import { rollTraits } from '@/engine/combat'
import { enemies } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { addLewd, exposureAt, lewdDaily } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(at = 'bloodplume'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: at })
  enterLocation(state)
  return state
}

describe('魅氣濃度', () => {
  it('地區預設，個別地點覆蓋；給 AI 的風氣', () => {
    expect(charmLevel('bloodplume')).toBe(4)
    expect(charmLevel('silvermoon')).toBe(1)
    expect(charmLevel('albena')).toBe(3)
    expect(charmLevel('rhineburg')).toBe(2)
    expect(charmNote({ location: 'bloodplume' })).toContain('淫靡')
  })

  it('曝露名聲在濃度高的地方累積得比較快，並傳到相鄰地區', () => {
    const at = (loc: string) => {
      const state = game(loc)
      const pc = pcOf(state)
      delete pc.gear!.body
      delete pc.gear!.legs
      lewdDaily(state, state.time.day, state.time.day + 1)
      return exposureAt(state, pc.id, state.location === 'bloodplume' ? 'south' : 'central')
    }
    expect(at('bloodplume')).toBeGreaterThan(at('rhineburg'))
    expect(neighborRegions('south').length).toBeGreaterThan(0)
    const state = game()
    const pc = pcOf(state)
    addLewd(state, pc, 'exposure', 60, undefined, 'south')
    spreadExposure(state)
    const n = neighborRegions('south')[0]!
    expect(exposureAt(state, pc.id, n)).toBe(1)
  })

  it('濃度高的地方怪物比較容易發情', () => {
    const def = Object.values(enemies).find((e) => e.rut)!
    const count = (mult: number) => {
      const rng = new Rng(9)
      let n = 0
      for (let i = 0; i < 400; i++) if (rollTraits(rng, def, 0.5, mult).includes('rut')) n++
      return n
    }
    expect(count(2)).toBeGreaterThan(count(1))
  })

  it('濃度 4 的城門：照規矩戴上拘束具，當天不用盤查；關掉「主角非自願」時沒有這個選項', () => {
    const state = game()
    expect(charmGateOpen(state)).toBe(true)
    const report = charmGatePass(state)
    expect(report.outcome.tags).toContain('照規矩戴上拘束具')
    expect(state.gatePass?.bloodplume).toBe(state.time.day)
    expect(Object.values(pcOf(state).gear ?? {}).some((g) => g?.name === '腕鐐' && g.lock === 'white')).toBe(true)
    expect(charmGateOpen(game('rhineburg'))).toBe(false)
    setContentFilters({ pc_unwilling: false })
    expect(charmGateOpen(state)).toBe(false)
    setContentFilters({ pc_unwilling: true })
  })
})
