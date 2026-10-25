import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { acceptPendingJoin, awayCompanions, declinePendingJoin, lodgeAtTavern, lodgeRefusal, sendHome, takeLodger, tavernKey } from '@/engine/away'
import { invitable, validateInvite } from '@/engine/companions'
import { companionRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { assertNoStandoff, enterLocation, settlementArea, tavernSpot } from '@/engine/grid'
import { buyHome, lotsOf, residents } from '@/engine/homes'
import { generateNpc, npcRecord } from '@/engine/npcs'
import { joinParty, leaveParty, partyMax, partyRoom } from '@/engine/party'
import { areaOf, hireable, npcCell, whereToday } from '@/engine/population'
import { restEventBlock } from '@/engine/rest'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { squadMissing, squadOf } from '@/engine/squads'
import { newGame, withRng } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(location = 'soriel'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: location })
  enterLocation(state)
  state.money_cc = 1000000
  return state
}

/** 雇滿隊伍（主角＋3 人） */
function fill(state: GameState, n = 3) {
  return Array.from({ length: n }, () => joinParty(state, withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', location: state.location })), 'voluntary'))
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('lodging companions at the tavern', () => {
  it('keeps them waiting in that tavern without leaving the party for good', () => {
    const state = game()
    const [a] = fill(state)
    setAffinity(state, a!.id, 30)
    valid(lodgeAtTavern(state, a!.id))
    expect(state.party.some((m) => m.id === a!.id)).toBe(false)
    const rec = state.npcs![a!.id]!
    expect(rec.staying).toBe(tavernKey('soriel'))
    expect(rec.at).toMatchObject(tavernSpot('soriel')!)
    expect(areaOf(state, rec)).toBe(tavernSpot('soriel')!.area)
    // 不在雇用、邀請名單上；一直待著
    expect(hireable(state).map((r) => r.id)).not.toContain(a!.id)
    expect(invitable(state).map((r) => r.id)).not.toContain(a!.id)
    state.time.day += 20
    expect(areaOf(state, rec)).toBe(tavernSpot('soriel')!.area)
    expect(awayCompanions(state)).toMatchObject([{ id: a!.id, place: { kind: 'tavern', location: 'soriel' }, days: 20 }])

    // 別的城鎮帶不走
    state.location = 'rivervale'
    expect(() => takeLodger(state, a!.id)).toThrow('沒有寄放在這裡')
    state.location = 'soriel'
    valid(takeLodger(state, a!.id))
    const back = state.party.find((m) => m.id === a!.id)!
    expect(back.bond).toBe('voluntary')
    expect(state.relationships![a!.id]!.affinity).toBe(30)
    expect(state.npcs![a!.id]?.staying).toBeUndefined()
    expect(state.npcs![a!.id]?.at).toBeUndefined()
  })

  it('refuses slaves (only your house can keep them)', () => {
    const state = game()
    const slave = joinParty(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1 })), 'slave')
    expect(lodgeRefusal(state, slave)).toContain('奴隸')
    expect(() => lodgeAtTavern(state, slave.id)).toThrow('奴隸')
    expect(lodgeRefusal(state, state.party[0]!)).toBe('主角')
  })
})

describe('sending companions home from anywhere in town', () => {
  it('only works in a town where you own a house, and you pick the house', () => {
    const state = game()
    const [a, b] = fill(state, 2)
    const lots = lotsOf('soriel')
    buyHome(state, lots[0]!.id)
    buyHome(state, lots[1]!.id)
    const [h1, h2] = Object.values(state.homes!)
    valid(sendHome(state, h2!.id, b!.id))
    expect(residents(state, h2!.id).map((m) => m.id)).toEqual([b!.id])
    expect(residents(state, h1!.id)).toEqual([])
    state.location = 'rivervale'
    expect(() => sendHome(state, h1!.id, a!.id)).toThrow('沒有這棟房子')
    expect(awayCompanions(state)[0]).toMatchObject({ id: b!.id, place: { kind: 'home', location: 'soriel' } })
  })
})

describe('joins waiting for room', () => {
  it('waits for the player instead of dropping the companion, and blocks moving on', () => {
    const state = game()
    const [a] = fill(state)
    const notes = applyEffects(state, blank(state), [{ type: 'companion', npc: { name: '獵戶' }, mode: 'voluntary' }])
    expect(notes.at(-1)).toContain('騰出位子')
    expect(state.party).toHaveLength(4)
    const p = state.pendingJoins![0]!
    expect(() => assertNoStandoff(state)).toThrow('想入隊')
    expect(restEventBlock(state)).toContain('想入隊')
    expect(() => acceptPendingJoin(state, p.id)).toThrow('還要騰出 1 個位子')
    lodgeAtTavern(state, a!.id)
    valid(acceptPendingJoin(state, p.id))
    expect(state.party.map((m) => m.name)).toContain('獵戶')
    expect(state.pendingJoins).toBeUndefined()
    expect(() => assertNoStandoff(state)).not.toThrow()
  })

  it('can be declined', () => {
    const state = game()
    fill(state)
    applyEffects(state, blank(state), [{ type: 'companion', npc: { name: '獵戶' }, mode: 'slave' }])
    valid(declinePendingJoin(state, state.pendingJoins![0]!.id))
    expect(state.pendingJoins).toBeUndefined()
    expect(state.party).toHaveLength(4)
  })

  it('keeps a squad together: all of them or none', () => {
    const state = game('dawnlight')
    fill(state, 2)
    expect(partyRoom(state)).toBe(1)
    applyEffects(state, blank(state), [{ type: 'companion', npc: 'npc_mira', mode: 'voluntary' }])
    expect(state.party.some((m) => m.id === 'npc_mira')).toBe(false)
    const p = state.pendingJoins![0]!
    expect(p.npcs).toEqual(['npc_mira', 'npc_ael'])
    lodgeAtTavern(state, state.party[1]!.id)
    acceptPendingJoin(state, p.id)
    expect(state.party.filter((m) => m.squad === 'npc_mira').map((m) => m.id)).toEqual(['npc_mira', 'npc_ael'])
  })

  it('waits for room to follow another party too', () => {
    const state = game()
    fill(state)
    const leader = withRng(state, (rng) => generateNpc(state, rng, { level: 3 }))
    const m1 = withRng(state, (rng) => generateNpc(state, rng, { level: 3 }))
    const m2 = withRng(state, (rng) => generateNpc(state, rng, { level: 3 }))
    applyEffects(state, blank(state), [{ type: 'join_party', leader: leader.id, members: [m1.id, m2.id], pay_cc: 50 }])
    const p = state.pendingJoins![0]!
    expect(p.kind).toBe('follow')
    lodgeAtTavern(state, state.party[1]!.id)
    acceptPendingJoin(state, p.id)
    expect(partyMax(state)).toBe(6)
    expect(state.party).toHaveLength(6)
  })
})

describe('people who leave the party', () => {
  it('stay at the tavern of that town for a few days, then go back to their haunts', () => {
    const state = game('soriel')
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', location: 'soriel' }))
    rec.haunts = [{ location: 'soriel', zone: 'town', weight: 1 }]
    joinParty(state, rec, 'hired')
    state.location = 'rivervale'
    enterLocation(state)
    leaveParty(state, rec.id)
    const stored = npcRecord(state, rec.id)!
    expect(areaOf(state, stored)).toBe(tavernSpot('rivervale')!.area)
    expect(hireable(state).map((r) => r.id)).toContain(rec.id)
    state.time.day += companionRules.leave_stay_days + 1
    expect(whereToday(stored, state.time.day)?.location).toBe('soriel')
    expect(areaOf(state, stored)?.startsWith('soriel/')).toBe(true)
  })
})

describe('squad members already with you', () => {
  it('do not count as missing when you invite their leader', () => {
    const state = game('dawnlight')
    expect(squadOf('npc_ael')?.leader).toBe('npc_mira')
    joinParty(state, npcRecord(state, 'npc_ael')!, 'voluntary').squad = 'npc_mira'
    const sq = squadOf('npc_mira')!
    expect(squadMissing(state, sq)).toEqual([])
    // 米菈就在身邊時可以單獨邀請（艾爾溫已經在隊上）
    const mira = npcRecord(state, 'npc_mira')!
    for (let d = 1; d < 400; d++) {
      const t = whereToday(mira, d)
      if (t?.location === 'dawnlight' && t.zone === 'town') { state.time.day = d; break }
    }
    enterLocation(state)
    const area = settlementArea(areaOf(state, mira)!)!
    const cell = npcCell(state, mira, area)!
    state.position = { area: area.key, x: cell.x, y: cell.y }
    ensureRelationship(state, mira)
    setAffinity(state, 'npc_mira', 40)
    expect(() => validateInvite(state, 'npc_mira')).not.toThrow()
  })
})
