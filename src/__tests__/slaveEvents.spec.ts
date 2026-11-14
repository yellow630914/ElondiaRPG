// 奴隸主動找主角（docs/COMPANIONS.md 2.9 節；engine/slaveEvents.ts）
import { describe, expect, it } from 'vitest'
import { setBond } from '@/engine/bondStyle'
import { setContentFilters } from '@/engine/content'
import { buySlave, marketStock } from '@/engine/companions'
import { masterEventPool, slaveryRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { sanitizeMasterEvent } from '@/engine/masterEventMods'
import { ensureRoster } from '@/engine/population'
import { maybeSlaveEvent, slaveEventFits, slaveTravelChance } from '@/engine/slaveEvents'
import { answerMasterEvent, eventRoles } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function owner(): { state: GameState; slave: string } {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: 'albena' })
  enterLocation(state)
  ensureRoster(state, 'albena')
  state.money_cc = 10_000_000
  const l = marketStock(state, 'public')[0]!
  buySlave(state, 'public', l.npc)
  return { state, slave: l.npc }
}

const setAffinity = (state: GameState, id: string, n: number) => { state.relationships![id]!.affinity = n }

/** 擲很多次，數一數抽到哪些 */
function sample(state: GameState, n = 200): Set<string> {
  const seen = new Set<string>()
  for (let i = 0; i < n; i++) {
    delete state.pendingMasterEvent
    delete state.lastSlaveEvent
    state.rngState = i + 1
    const e = maybeSlaveEvent(state, 1)
    if (e) seen.add(e.id)
  }
  delete state.pendingMasterEvent
  return seen
}

describe('a slave comes to you', () => {
  it('only happens with your own slave in the party, and not again right away', () => {
    const bare = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: 'albena' })
    enterLocation(bare)
    expect(maybeSlaveEvent(bare, 1)).toBeUndefined()
    expect(slaveTravelChance(bare)).toBe(0)
    const { state, slave } = owner()
    expect(slaveTravelChance(state)).toBeGreaterThan(0)
    const e = maybeSlaveEvent(state, 1)!
    expect(e).toMatchObject({ pool: 'slave', actor: slave })
    expect(e.text).not.toContain('{actor}')
    delete state.pendingMasterEvent
    expect(maybeSlaveEvent(state, 1)).toBeUndefined()
  })

  it('picks events by how the slave feels about you', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, -60)
    const low = sample(state)
    expect(low).toContain('sl_escape_glance')
    expect(low).not.toContain('sl_past')
    setAffinity(state, slave, 70)
    const high = sample(state)
    expect(high).toContain('sl_past')
    expect(high).not.toContain('sl_resent')
  })

  it('has events of its own for each bond', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, 70)
    expect([...sample(state)].some((id) => id.startsWith('sl_lovers_'))).toBe(false)
    setBond(state, slave, 'lovers')
    expect(sample(state)).toContain('sl_lovers_date')
  })

  it('stays away when the save rule is 0', () => {
    const { state } = owner()
    state.options = { ...state.options!, slaveEventMult: 0 }
    expect(sample(state, 30).size).toBe(0)
    expect(slaveTravelChance(state)).toBe(0)
  })

  it('gives the slave what is written for the other side and you what is written for you', () => {
    const { state, slave } = owner()
    const meal = masterEventPool('slave').find((e) => e.id === 'sl_meal')!
    const m = state.party.find((x) => x.id === slave)!
    expect(slaveEventFits(state, m, meal)).toBe(true)
    state.pendingMasterEvent = { id: 'sl_meal', pool: 'slave', actor: slave, text: `${m.name}端來一碗湯。` }
    expect(eventRoles(state).subject.id).toBe(slave)
    const before = state.relationships![slave]!.affinity
    const r = answerMasterEvent(state, 0)
    expect(state.party[0]!.status).toContain('fed_well')
    expect(m.status).toContain('fed_well')
    expect(state.relationships![slave]!.affinity).toBe(before + 2)
    expect(r.narration?.focus?.[0]).toContain('主動來找主角')
  })

  it('keeps the content editor from losing who an effect is for', () => {
    const meal = masterEventPool('slave').find((e) => e.id === 'sl_meal')!
    const { custom: _c, pool, ...saved } = sanitizeMasterEvent('sl_meal', { ...structuredClone(meal), pool: 'slave' }, false)
    expect(pool).toBe('slave')
    expect(saved).toEqual(meal)
    expect(slaveryRules.slave_events.events.length).toBeGreaterThan(10)
  })

  it('keeps adult visits from male slaves when male partners are filtered out', () => {
    const { state, slave } = owner()
    const m = state.party.find((x) => x.id === slave)!
    m.gender = 'male'
    const visit = slaveryRules.slave_events.events.find((e) => e.id === 'sl_night_visit')!
    setAffinity(state, slave, 50)
    expect(slaveEventFits(state, m, visit)).toBe(true)
    setContentFilters({ male_partner: false })
    try {
      expect(slaveEventFits(state, m, visit)).toBe(false)
      expect(slaveEventFits(state, m, slaveryRules.slave_events.events.find((e) => e.id === 'sl_meal')!)).toBe(true)
    } finally {
      setContentFilters({ male_partner: true })
    }
  })
})

describe('slave events do not keep repeating', () => {
  it('skips events seen in the last few days until every fitting one has come up', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, 50)
    const m = state.party.find((x) => x.id === slave)!
    const fitting = slaveryRules.slave_events.events.filter((e) => slaveEventFits(state, m, e)).length
    const got: string[] = []
    for (let i = 0; i < fitting; i++) {
      delete state.pendingMasterEvent
      delete state.lastSlaveEvent
      state.rngState = 1000 + i
      const e = maybeSlaveEvent(state, 1)
      if (e) got.push(e.id)
    }
    // 同一天裡抽到的都不重複（全部抽過之前）
    expect(new Set(got).size).toBe(got.length)
    // 過了 repeat_days 天就又可能抽到
    state.time.day += (slaveryRules.slave_events.repeat_days ?? 4)
    expect(state.eventSeen && Object.values(state.eventSeen).every((d) => state.time.day - d >= 4)).toBe(true)
  })
})
