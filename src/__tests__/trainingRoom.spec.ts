import { describe, expect, it } from 'vitest'
import { sendHome } from '@/engine/away'
import { buySlave, marketStock } from '@/engine/companions'
import { lewdRules, masterEventPool } from '@/engine/data'
import { currentArea, enterLocation, placeAt, type Area } from '@/engine/grid'
import { buyHome, furnitureSummary, lotsOf, ownHomeOfArea, placeFurniture, residents, trainingRoomOf } from '@/engine/homes'
import { lewdDaily, lewdOf } from '@/engine/lewd'
import { afterTraining, trainingDcMods } from '@/engine/ownerTraining'
import { ensureRoster } from '@/engine/population'
import { addItem, newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import type { GameState, Home } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: 'albena' })
  enterLocation(state)
  ensureRoster(state, 'albena')
  state.money_cc = 10_000_000
  return state
}

function withSlave(state: GameState) {
  const l = marketStock(state, 'public')[0]!
  buySlave(state, 'public', l.npc)
  return state.party.find((m) => m.id === l.npc)!
}

function home(state: GameState): { home: Home; ground: Area; floors: { x: number; y: number }[] } {
  buyHome(state, lotsOf('albena')[0]!.id)
  const h = Object.values(state.homes!)[0]!
  const ground = h.areas[h.floors.find((k) => h.areas[k]!.homeFloor === 'ground')!]!
  const floors = ground.cells.map((c, i) => ({ c, x: i % ground.width, y: Math.floor(i / ground.width) })).filter((x) => x.c.kind === 'floor')
  return { home: h, ground, floors }
}

describe('調教室', () => {
  it('調教家具的加值合計，最多 +3', () => {
    const state = game()
    const { home: h, ground, floors } = home(state)
    for (const n of ['調教台', '刑架', '拘束台']) addItem(state.inventory, n, 1)
    expect(trainingRoomOf(h)).toBe(0)
    placeFurniture(state, ground, floors[0]!.x, floors[0]!.y, '調教台')
    expect(trainingRoomOf(h)).toBe(2)
    placeFurniture(state, ground, floors[1]!.x, floors[1]!.y, '刑架')
    placeFurniture(state, ground, floors[2]!.x, floors[2]!.y, '拘束台')
    expect(trainingRoomOf(h)).toBe(lewdRules.training.room_max)
    expect(furnitureSummary({ places: ['indoor'], function: 'training', training: 2 })).toContain('調教室（在家調教 +2）')
  })

  it('在自己家裡調教時檢定有加值', () => {
    const state = game()
    const slave = withSlave(state)
    const { ground, floors } = home(state)
    addItem(state.inventory, '調教台', 1)
    placeFurniture(state, ground, floors[0]!.x, floors[0]!.y, '調教台')
    expect(trainingDcMods(state, slave).some((m) => m.label === '調教室')).toBe(false)
    placeAt(state, ground, floors[1]!.x, floors[1]!.y)
    expect(ownHomeOfArea(state, currentArea(state))).toBeDefined()
    expect(trainingDcMods(state, slave)).toContainEqual({ label: '調教室', value: 2 })
  })

  it('留在擺了調教家具的房子裡的奴隸，每天順從 +1', () => {
    const state = game()
    const slave = withSlave(state)
    const { home: h, ground, floors } = home(state)
    sendHome(state, h.id, slave.id)
    const c = residents(state, h.id)[0]!
    const before = lewdOf(c).submission
    lewdDaily(state, state.time.day, state.time.day + 2)
    const plain = lewdOf(c).submission
    addItem(state.inventory, '刑架', 1)
    placeFurniture(state, ground, floors[0]!.x, floors[0]!.y, '刑架')
    lewdDaily(state, state.time.day + 2, state.time.day + 4)
    expect(lewdOf(c).submission - plain).toBe(2 + (plain - before))
  })

  it('反彈時有機會趁機逃走（暫時離隊）', () => {
    const state = game()
    const slave = withSlave(state)
    state.relationships![slave.id]!.affinity = -50
    const chance = lewdRules.training.escape_chance
    lewdRules.training.escape_chance = 1
    try {
      const e = masterEventPool('owner').find((x) => x.course === 'serve')!
      const notes = afterTraining(state, baseReport(state, 'event', 0), slave, e, false)
      expect(notes.some((n) => n.includes('逃走'))).toBe(true)
      expect(slave.status).toContain('away')
    } finally {
      lewdRules.training.escape_chance = chance
    }
  })

  it('主人的家多了刑架、拘束台、調教室的事件', () => {
    const ids = masterEventPool('master').filter((e) => e.at_home).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining(['home_rack', 'home_restraint_bed', 'home_training_room']))
  })
})
