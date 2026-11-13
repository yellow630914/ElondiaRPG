// 主僕關係（docs/COMPANIONS.md 2.8 節；engine/bondStyle.ts）
import { describe, expect, it } from 'vitest'
import { prepareAction } from '@/engine/actions'
import { bondChoiceBlocked, bondOf, bondStatus, bondWeight, pcBond, setBond } from '@/engine/bondStyle'
import { buySlave, marketStock } from '@/engine/companions'
import { setContentFilters } from '@/engine/content'
import { masterEventPool, slaveryRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { changeMaster, leaderOf } from '@/engine/party'
import { ensureRoster } from '@/engine/population'
import { generateNpc } from '@/engine/npcs'
import { startTraining } from '@/engine/ownerTraining'
import { answerMasterEvent, askableEvents, masterCandidates, maybeMasterEvent, startAsSlave } from '@/engine/slavery'
import { formatContext, selectContext } from '@/engine/social'
import { newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { GameState } from '@/engine/types'
import { buildActionPrompt, partyLines } from '@/narrator/judge'

const rules = slaveryRules.bond_styles

function bound(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  standOn(state, 'gate')
  return state
}

const masterId = (state: GameState) => leaderOf(state)!.id
const setAffinity = (state: GameState, id: string, n: number) => { state.relationships![id]!.affinity = n }

function owner(): { state: GameState; slave: string } {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: 'albena' })
  enterLocation(state)
  ensureRoster(state, 'albena')
  state.money_cc = 10_000_000
  const l = marketStock(state, 'public')[0]!
  buySlave(state, 'public', l.npc)
  return { state, slave: l.npc }
}

/** 擲很多次主人的突發事件，數一數抽到哪些 */
function sample(state: GameState, n = 300): Map<string, number> {
  const seen = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    delete state.pendingMasterEvent
    delete state.lastMasterEvent
    state.rngState = i + 1
    const e = maybeMasterEvent(state, 1)
    if (e) seen.set(e.id, (seen.get(e.id) ?? 0) + 1)
  }
  delete state.pendingMasterEvent
  return seen
}

describe('choosing the bond', () => {
  it('unlocks at the affinity threshold, lapses below the keep threshold and comes back', () => {
    const state = bound()
    const m = masterId(state)
    expect(pcBond(state)).toBe('strict')
    setAffinity(state, m, rules.unlock_affinity - 1)
    expect(bondChoiceBlocked(state, m, 'playful')).toContain(`${rules.unlock_affinity}`)
    setAffinity(state, m, rules.unlock_affinity)
    expect(bondChoiceBlocked(state, m, 'playful')).toBeUndefined()
    const r = setBond(state, m, 'playful')
    expect(r.narration?.focus?.join('\n')).toContain('情趣主奴')
    expect(r.narration?.focus?.join('\n')).toContain(rules.personality_rule)
    expect(contractOf(state.party[0]!)?.style).toBe('playful')
    expect(pcBond(state)).toBe('playful')
    setAffinity(state, m, rules.keep_affinity - 1)
    expect(pcBond(state)).toBe('strict')
    expect(bondStatus(state, m)).toMatchObject({ chosen: 'playful', active: 'strict' })
    setAffinity(state, m, rules.keep_affinity)
    expect(pcBond(state)).toBe('playful')
    // 隨時可以回到名實相符
    setAffinity(state, m, 0)
    setBond(state, m, 'strict')
    expect(contractOf(state.party[0]!)?.style).toBeUndefined()
  })

  it('starts over with a new master', () => {
    const state = bound()
    const m = masterId(state)
    setAffinity(state, m, 80)
    setBond(state, m, 'lovers')
    const next = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 5, location: 'rhineburg' }, 'nm'))
    changeMaster(state, next, { schema_version: '0.1', report_id: 'x', kind: 'event', time: { start: state.time, end: state.time }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {} }, '測試')
    expect(contractOf(state.party[0]!)?.style).toBeUndefined()
    expect(pcBond(state)).toBe('strict')
  })

  it('works the other way round with your own slave', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, rules.unlock_affinity)
    setBond(state, slave, 'intense')
    expect(bondOf(state, slave)).toBe('intense')
    // 不是主僕的人沒有這回事
    expect(bondStatus(state, 'nobody')).toBeUndefined()
  })
})

describe('what the AI is told', () => {
  it('adds the bond and the personality reminder to the relationships, and a tag in the party', () => {
    const state = bound()
    const m = masterId(state)
    const ctx = () => formatContext(state, selectContext(state, { participants: ['pc', m], location: state.location }))
    expect(ctx()).not.toContain('主僕關係')
    setAffinity(state, m, 70)
    setBond(state, m, 'partner')
    expect(ctx()).toContain(`主僕關係：${rules.styles.partner.name}（對方是主角的主人）`)
    expect(ctx()).toContain(rules.personality_rule)
    expect(partyLines(state)).toContain(`主僕關係：${rules.styles.partner.name}`)
  })

  it('tells the judge about the bond when answering the master in your own words', () => {
    const state = bound()
    const m = masterId(state)
    setAffinity(state, m, 70)
    setBond(state, m, 'intense')
    state.pendingMasterEvent = { id: 'bad_mood', text: '主人心情很差。' }
    const p = prepareAction(state, { kind: 'master_event', text: '跪下來' })
    expect(p.scene).toContain('激烈主奴')
    expect(buildActionPrompt(state, p, '').user).toContain('對象（主角的主人）')
  })

  it('describes your own slave too', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, 70)
    setBond(state, slave, 'lovers')
    const text = formatContext(state, selectContext(state, { participants: ['pc', slave], location: state.location }))
    expect(text).toContain(`主僕關係：${rules.styles.lovers.name}（對方是主角的奴隸）`)
  })
})

describe('events under each bond', () => {
  it('weights events by the bond and keeps exclusive events to their bond', () => {
    const lend = masterEventPool('master').find((e) => e.id === 'lend_out')!
    expect(bondWeight(lend, 'lovers')).toBe(0)
    expect(bondWeight(lend, 'strict')).toBe(lend.weight)
    const exclusive = masterEventPool('master').find((e) => e.id === 'bond_lovers_gift')!
    expect(bondWeight(exclusive, 'strict')).toBe(0)
    expect(bondWeight(exclusive, 'lovers')).toBe(exclusive.weight)
  })

  it('draws the exclusive events only under that bond', () => {
    const state = bound()
    const m = masterId(state)
    setAffinity(state, m, 70)
    const exclusive = (ids: Map<string, number>) => [...ids.keys()].filter((id) => id.startsWith('bond_'))
    expect(exclusive(sample(state))).toEqual([])
    setBond(state, m, 'partner')
    const partner = exclusive(sample(state))
    expect(partner.length).toBeGreaterThan(0)
    expect(partner.every((id) => id.startsWith('bond_partner_'))).toBe(true)
  })

  it('lets the consensual exclusive events through the unwilling filter', () => {
    const state = bound()
    const m = masterId(state)
    setAffinity(state, m, 70)
    setBond(state, m, 'playful')
    setContentFilters({ pc_unwilling: false })
    try {
      const ids = [...sample(state).keys()]
      expect(ids.some((id) => id.startsWith('bond_playful_'))).toBe(true)
      expect(ids).not.toContain('proposition')
    } finally {
      setContentFilters({ pc_unwilling: true })
    }
  })

  it('lists the exclusive ask events only under that bond', () => {
    const state = bound()
    const m = masterId(state)
    setAffinity(state, m, 70)
    expect(askableEvents(state).map((o) => o.id)).not.toContain('bond_lovers_night')
    setBond(state, m, 'lovers')
    expect(askableEvents(state).map((o) => o.id)).toContain('bond_lovers_night')
  })

  it('adds the bond to the narration of a training event and can draw the exclusive one', () => {
    const { state, slave } = owner()
    setAffinity(state, slave, 70)
    setBond(state, slave, 'intense')
    const ids = new Set<string>()
    for (let i = 0; i < 40; i++) {
      state.rngState = i + 1
      ids.add(startTraining(state, slave, 'pain').id)
      delete state.pendingMasterEvent
    }
    expect(ids).toContain('own_bond_intense')
    startTraining(state, slave, 'pain')
    const r = answerMasterEvent(state, 0)
    expect(r.narration?.focus?.join('\n')).toContain('激烈主奴')
    setBond(state, slave, 'strict')
    for (let i = 0; i < 40; i++) {
      state.rngState = i + 1
      expect(startTraining(state, slave, 'pain').id).not.toBe('own_bond_intense')
      delete state.pendingMasterEvent
    }
  })
})
