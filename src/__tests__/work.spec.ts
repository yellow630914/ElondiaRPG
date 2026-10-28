import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { madamHere } from '@/engine/brothel'
import { contractDef, geography, locationById, slaveryRules, tagDef } from '@/engine/data'
import { cellName, enterLocation, standOn, zonesOf } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { isBound, isNoncombatant, leaderOf } from '@/engine/party'
import { ensureRoster } from '@/engine/population'
import { answerMasterEvent, masterCandidates, maybeMasterEvent, startAsSlave, startMarking } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { contractOf } from '@/engine/tattoos'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(location = 'soriel', seed = 3): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  ensureRoster(state, location)
  return state
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}


describe('brothels on the map', () => {
  it('appear in every settlement, staffed by a madam and workers', () => {
    for (const l of geography.locations.filter((x) => x.type !== 'dungeon')) expect(zonesOf(l), l.name).toContain('brothel')
    const state = game()
    const madam = madamHere(state)!
    expect(madam.tags).toEqual(['prostitute', 'merchant'])
    expect(madam.spot).toBe('brothel')
    const workers = state.rosters!.soriel!.members.filter((id) => npcRecord(state, id)?.tags?.includes('prostitute'))
    expect(workers.length).toBeGreaterThanOrEqual(3)
    const town = game('rivervale')
    expect(town.rosters!.rivervale!.members.some((id) => npcRecord(town, id)?.tags?.includes('prostitute'))).toBe(true)
  })

  it('keeps the brothel names', () => {
    expect(cellName('brothel')).toBe('娼館')
    expect(tagDef('prostitute')!.name).toBe('娼妓')
    expect(contractDef('brothel').name).toBe('娼妓契約')
  })
})

describe('working', () => {
  it('trades hours for money, scaled by how well it goes', () => {
    const state = game()
    standOn(state, 'tavern')
    const money = state.money_cc
    const hour = state.time.hour
    const r = act(state, { kind: 'work', target: '4', text: '專心招呼熟客' }, 20)
    expect(state.money_cc - money).toBe(Math.round(4 * 3 * 1.5))
    expect(r.time.end.hour).toBe((hour + 4) % 24)
    expect(() => prepareAction(state, { kind: 'work', target: '3', text: '' })).toThrow('時數')
    standOn(state, 'gate')
    expect(() => prepareAction(state, { kind: 'work', target: '4', text: '' })).toThrow('沒有工作')
  })

  it('settles money by the AI\'s amount instead of adding it to the wage', () => {
    const state = game()
    standOn(state, 'tavern')
    const money = state.money_cc
    prepareAction(state, { kind: 'work', target: '4', text: '專心招呼熟客' })
    state.pendingAction!.natural = 20
    const r = resolveAction(state, { attr: 'cha', dc: 10, degree: 'success', effects: [{ type: 'money', amount: 12 }], relationship_updates: [] })
    expect(state.money_cc - money).toBe(4 * 3)
    expect(r.changes.money_cc).toBe(4 * 3)

    // AI 給了不同的金額（例如小費）：以 AI 的為準
    const before = state.money_cc
    prepareAction(state, { kind: 'work', target: '4', text: '專心招呼熟客' })
    state.pendingAction!.natural = 20
    const tipped = resolveAction(state, { attr: 'cha', dc: 10, degree: 'success', effects: [{ type: 'money', amount: 20 }], relationship_updates: [] })
    expect(state.money_cc - before).toBe(20)
    expect(tipped.outcome.summary).toContain('規則原本是')
  })

  it('pays the master their share when the player is bound', () => {
    const state = game()
    const [rec] = masterCandidates('soriel', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    standOn(state, 'inn')
    const money = state.money_cc
    act(state, { kind: 'work', target: '8', text: '' }, 10)
    expect(state.money_cc - money).toBe(Math.round(8 * 2 / 2))
  })
})

describe('the brothel', () => {
  it('lets free visitors spend money and relax; owned slaves may not', () => {
    const state = game()
    standOn(state, 'brothel')
    state.money_cc = 100
    act(state, { kind: 'patron', text: '' }, 20)
    expect(state.money_cc).toBe(100 - 6)
    expect(state.party[0]!.status).toContain('relaxed')

    const slave = game()
    const [rec] = masterCandidates('soriel', 3)
    startAsSlave(slave, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    standOn(slave, 'brothel')
    expect(() => prepareAction(slave, { kind: 'patron', text: '' })).toThrow('不能')
  })

  it('may force a passing slave to work there; the earnings go to the master', () => {
    const state = game()
    const [rec] = masterCandidates('soriel', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    standOn(state, 'brothel')
    let ev
    for (let i = 0; i < 40 && !ev; i++) {
      delete state.lastMasterEvent
      ev = maybeMasterEvent(state, 0)
    }
    expect(ev?.id).toBe('brothel_forced')
    expect(ev?.text).toContain('娼館')
    const money = state.money_cc
    const r = answerMasterEvent(state, 0)
    expect(validate(r)).toBe(true)
    expect(state.money_cc - money).toBe(15)
  })

  it('lets an unowned slave ask the madam to take them in; she re-marks them', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    standOn(state, 'brothel')
    const madam = madamHere(state)!
    act(state, { kind: 'seek_master', target: madam.id, text: '' }, 20)
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(madam.id)
    expect(isNoncombatant(leaderOf(state)!)).toBe(true)
    expect(contractOf(state.party[0]!)).toMatchObject({ kind: 'brothel', master: madam.id })
    // 大成功：服從懲罰 -1
    expect(contractOf(state.party[0]!)!.obedience).toBe(slaveryRules.contracts.brothel!.obedience_penalty - 1)
  })

  it('marks with the brothel contract when that is what the master intends', () => {
    const state = game()
    const [rec] = masterCandidates('soriel', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    startMarking(state, 'brothel')
    act(state, { kind: 'marking', text: '' }, 2)
    expect(state.pendingMark?.allowed).toEqual(['brothel'])
  })
})
