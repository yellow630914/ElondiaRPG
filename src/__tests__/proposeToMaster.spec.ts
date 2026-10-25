import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { resolveCaptive } from '@/engine/captives'
import { buySlave, marketStock, masterBudget, proposeDc, tavernCandidates, validateProposal } from '@/engine/companions'
import { applyEffects } from '@/engine/effects'
import { currentArea, enterLocation } from '@/engine/grid'
import { generateNpc, npcRecord, registerNpc } from '@/engine/npcs'
import { changeMaster, isBound, isEnslaved, leaderOf, partyMax, partyRoom } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame, withRng } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
import { contractOf } from '@/engine/tattoos'

function slave(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  return state
}

function act(state: GameState, target: string, natural: number) {
  prepareAction(state, { kind: 'propose', target, text: '' })
  state.pendingAction!.natural = natural
  return resolveAction(state, null)
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('proposing to the master', () => {
  it('lets a bound slave ask the master to hire an adventurer, paid by the master', () => {
    const state = slave()
    expect(isBound(state)).toBe(true)
    const master = leaderOf(state)!
    // 跟著別人的隊伍（主人）時上限放寬
    expect(partyMax(state)).toBe(6)
    const c = tavernCandidates(state)[0]!
    expect(proposeDc(state, { kind: 'hire', npc: c.npc })).toBeGreaterThan(0)
    expect(masterBudget(state)).toBeGreaterThan(0)
    const money = state.money_cc
    act(state, `hire:${c.npc}`, 20)
    const m = state.party.find((x) => x.id === c.npc)!
    expect(m.bond).toBe('ally')
    expect(m.group).toBe(master.id)
    expect(state.money_cc).toBe(money)
  })

  it('lets the master buy a slave who then belongs to the master', () => {
    const state = slave()
    const master = leaderOf(state)!
    const l = marketStock(state, 'public')[0]!
    act(state, `buy:public:${l.npc}`, 20)
    const m = state.party.find((x) => x.id === l.npc)!
    expect(m.bond).toBe('ally')
    expect(contractOf(m)?.master).toBe(master.id)
    expect(marketStock(state, 'public').some((x) => x.npc === l.npc)).toBe(false)
  })

  it('makes the slave pay half on a partial success and remembers a refusal for the day', () => {
    const state = slave()
    const [a, b] = tavernCandidates(state)
    const dc = proposeDc(state, { kind: 'hire', npc: a!.npc })
    state.money_cc = 1e6
    // 部分成功：骰到剛好比 DC 少一點（依規則判定）
    prepareAction(state, { kind: 'propose', target: `hire:${a!.npc}`, text: '' })
    const p = state.pendingAction!
    const mod = p.modifiers.cha + p.situational.reduce((s, x) => s + x.value, 0)
    p.natural = Math.max(2, Math.min(19, dc - 2 - mod))
    const r = resolveAction(state, null)
    expect(r.check?.degree).toBe('partial')
    expect(state.money_cc).toBeLessThan(1e6)
    expect(state.party.some((x) => x.id === a!.npc)).toBe(true)
    // 失敗：今天不再提這個人
    act(state, `hire:${b!.npc}`, 1)
    expect(state.party.some((x) => x.id === b!.npc)).toBe(false)
    expect(() => validateProposal(state, { kind: 'hire', npc: b!.npc })).toThrow('今天不想再聽')
  })

  it('is only for a slave whom a master leads', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    enterLocation(state)
    const c = tavernCandidates(state)[0]!
    expect(() => prepareAction(state, { kind: 'propose', target: `hire:${c.npc}`, text: '' })).toThrow('主人帶著')
  })
})

describe('slaves cannot own slaves', () => {
  it('stops an ownerless slave from buying or enslaving, and a bound one from following someone else', () => {
    const state = slave()
    // 被帶著時，事件的 join_party 不生效
    const other = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 2 }, 'tst')))
    const notes = applyEffects(state, blank(state), [{ type: 'join_party', leader: other.id }])
    expect(notes.join('')).toContain('跟不了別人的隊伍')
    expect(state.party.some((m) => m.id === other.id)).toBe(false)

    // 無主：還是有印記，不能買奴隸、不能把俘虜收為奴隸
    changeMaster(state, null, blank(state), '測試')
    expect(isEnslaved(state)).toBe(true)
    expect(isBound(state)).toBe(false)
    const l = marketStock(state, 'public')[0]!
    state.money_cc = 1e6
    expect(() => buySlave(state, 'public', l.npc)).toThrow('不能擁有奴隸')
    const foe = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1 }, 'cap')))
    state.captives = { npcs: [foe.id], aggressor: 'npc', location: state.location, area: currentArea(state).key, day: state.time.day }
    expect(partyRoom(state)).toBeGreaterThan(0)
    expect(() => resolveCaptive(state, foe.id, 'enslave')).toThrow('不能擁有奴隸')
    expect(npcRecord(state, foe.id)).toBeTruthy()
  })
})
