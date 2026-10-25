import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { invitable, joinableSquads, squadOptions, validateInvite } from '@/engine/companions'
import { applyEffects } from '@/engine/effects'
import { npcs } from '@/engine/data'
import { enterLocation, settlementArea } from '@/engine/grid'
import { sanitizeNpc } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { leaderOf, partyMax } from '@/engine/party'
import { areaOf, hireable, npcCell, whereToday } from '@/engine/population'
import { restChecks } from '@/engine/rest'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { followsLeader, inActiveSquad, squadOf } from '@/engine/squads'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import { dismiss } from '@/engine/town'
import type { GameState, Report } from '@/engine/types'

// 內建範例：米菈（隊長）＋艾爾溫的「旅歌隊」
function cityDay(state: GameState, follows: boolean): number {
  const mira = npcRecord(state, 'npc_mira')!
  for (let d = 1; d < 400; d++) {
    const t = whereToday(mira, d)
    if (t?.location === 'dawnlight' && t.zone === 'town' && !!followsLeader(state, { id: 'npc_ael' }, d) === follows) return d
  }
  throw new Error('no day')
}

function nearMira(follows = true): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'dawnlight' })
  state.time.day = cityDay(state, follows)
  enterLocation(state)
  const mira = npcRecord(state, 'npc_mira')!
  const area = settlementArea(areaOf(state, mira)!)!
  const cell = npcCell(state, mira, area)!
  state.position = { area: area.key, x: cell.x, y: cell.y }
  for (const id of ['npc_mira', 'npc_ael']) {
    ensureRelationship(state, npcRecord(state, id)!)
    setAffinity(state, id, 40)
  }
  return state
}

function act(state: GameState, kind: 'invite' | 'squad_join', target: string, natural: number) {
  prepareAction(state, { kind, target, text: '' })
  state.pendingAction!.natural = natural
  return resolveAction(state, null)
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('fixed NPC squads', () => {
  it('keeps members next to the leader and out of the hiring lists', () => {
    const state = nearMira()
    expect(squadOf('npc_ael')?.leader).toBe('npc_mira')
    const mira = npcRecord(state, 'npc_mira')!
    const ael = npcRecord(state, 'npc_ael')!
    expect(areaOf(state, ael)).toBe(areaOf(state, mira))
    const area = settlementArea(areaOf(state, mira)!)!
    const a = npcCell(state, mira, area)!
    const b = npcCell(state, ael, area)!
    expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThanOrEqual(1)
    expect(hireable(state).some((r) => r.id === 'npc_mira' || r.id === 'npc_ael')).toBe(false)
    // 只能透過隊長整隊邀請
    expect(invitable(state).map((r) => r.id)).toContain('npc_mira')
    expect(invitable(state).map((r) => r.id)).not.toContain('npc_ael')
    expect(() => validateInvite(state, 'npc_ael')).toThrow('整隊邀請')
    expect(squadOptions(state, 'npc_mira').size).toBe(2)
  })

  it('waits for everyone before an invite', () => {
    const state = nearMira(false)
    expect(() => validateInvite(state, 'npc_mira')).toThrow('今天不在')
  })

  it('brings the whole squad in on an invite and sends them away together', () => {
    const state = nearMira()
    act(state, 'invite', 'npc_mira', 20)
    const mates = state.party.filter((m) => m.squad === 'npc_mira')
    expect(mates.map((m) => m.id).sort()).toEqual(['npc_ael', 'npc_mira'])
    expect(mates.every((m) => m.bond === 'voluntary')).toBe(true)
    dismiss(state, 'npc_ael')
    expect(state.party.some((m) => m.id === 'npc_mira' || m.id === 'npc_ael')).toBe(false)
  })

  it('leaves together when one of them has had enough', () => {
    const state = nearMira()
    act(state, 'invite', 'npc_mira', 20)
    const ael = state.party.find((m) => m.id === 'npc_ael')!
    setAffinity(state, 'npc_ael', -50)
    ael.affinity = -50
    const lines = restChecks(state, blank(state), 'short')
    expect(lines.join('')).toContain('米菈')
    expect(state.party.some((m) => m.id === 'npc_mira')).toBe(false)
  })

  it('lets the hero follow the squad as part of their party', () => {
    const state = nearMira()
    expect(joinableSquads(state).map((q) => q.leader)).toContain('npc_mira')
    act(state, 'squad_join', 'npc_mira', 20)
    expect(leaderOf(state)?.id).toBe('npc_mira')
    const ael = state.party.find((m) => m.id === 'npc_ael')!
    expect(ael.bond).toBe('ally')
    expect(ael.group).toBe('npc_mira')
    expect(partyMax(state)).toBe(6)
  })

  it('brings the whole squad through event effects', () => {
    const state = nearMira()
    applyEffects(state, blank(state), [{ type: 'companion', npc: 'npc_ael', mode: 'voluntary' }])
    expect(state.party.filter((m) => m.squad === 'npc_mira')).toHaveLength(2)

    const other = nearMira()
    applyEffects(other, blank(other), [{ type: 'join_party', leader: 'npc_mira' }])
    expect(leaderOf(other)?.id).toBe('npc_mira')
    expect(other.party.find((m) => m.id === 'npc_ael')?.group).toBe('npc_mira')
  })

  it('is not a squad while its conditions are unmet', () => {
    const state = nearMira()
    const def = npcs.find((n) => n.id === 'npc_mira')!
    const before = def.squad!.requires
    def.squad!.requires = { flags: ['squad_formed'] }
    try {
      expect(inActiveSquad(state, 'npc_ael')).toBeUndefined()
      expect(followsLeader(state, { id: 'npc_ael' })).toBeUndefined()
      setFlag(state, 'squad_formed')
      expect(inActiveSquad(state, 'npc_ael')?.leader).toBe('npc_mira')
    } finally {
      if (before) def.squad!.requires = before
      else delete def.squad!.requires
    }
  })

  it('sanitizes the squad field', () => {
    const out = sanitizeNpc('npc_x', { name: '測', squad: { name: '', members: ['npc_x', 'a', 'b', 'c', 'd', 'a'], together: 3 } }, true)
    expect(out.squad).toEqual({ name: '測的小隊', members: ['a', 'b', 'c'] })
    expect(sanitizeNpc('npc_x', { name: '測', squad: { name: 'q', members: ['npc_x'] } }, true).squad).toBeUndefined()
  })
})
