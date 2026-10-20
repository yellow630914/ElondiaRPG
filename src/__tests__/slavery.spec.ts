import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { buySlave, marketStock, offerSelf } from '@/engine/companions'
import { slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, goOutskirts, move, standOn } from '@/engine/grid'
import { isBound, isEnslaved, leaderOf } from '@/engine/party'
import {
  chooseMark, contractTerms, markSummary, masterCandidates, maybeMasterEvent, permitDc, sanitizeTerms, startAsSlave,
} from '@/engine/slavery'
import { commitReport, newGame } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 3, location = 'rhineburg'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  return state
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('mark terms', () => {
  it('clamps custom marks and derives their functions', () => {
    const t = sanitizeTerms({ name: '月下的鎖鏈紋樣很長很長很長很長', mark: '鎖骨上一圈銀色的月紋', income_share: 3, negotiate_dc: 99, escape_dc: 2, exit_dc: 14, recapture_chance: 0, escape_hp_ratio: 0.5, side_effects: ['月圓時發燙'] })
    expect(t.name.length).toBeLessThanOrEqual(slaveryRules.custom_mark.name_chars)
    expect(t).toMatchObject({ income_share: 1, negotiate_dc: 30, escape_dc: 8, exit_dc: 14, recapture_chance: 0 })
    expect(t.functions).toContain('tether')
    expect(t.functions).not.toContain('tracking')
  })
})

describe('starting as a slave', () => {
  it('serves a chosen master with a chosen mark', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    expect(rec!.kind).toBe('adventurer')
    const r = startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'combat' })
    expect(validate(r)).toBe(true)
    expect(leaderOf(state)?.id).toBe(rec!.id)
    expect(isBound(state)).toBe(true)
    expect(state.party[0]!.contract).toMatchObject({ kind: 'combat', master: rec!.id })
    expect(markSummary(state.party[0]!.contract!)).toContain('出城 DC 14')
  })

  it('can design the master and the mark', () => {
    const state = game()
    startAsSlave(state, {
      master: { type: 'custom', spec: { name: '維克多', race: 'demon', class: 'wizard', level: 6, personality: '冷酷而講究規矩' } },
      mark: { name: '黑薔薇印', mark: '左胸上一朵黑色的薔薇', income_share: 0.3, negotiate_dc: 15, escape_dc: 16, exit_dc: 10, recapture_chance: 0.15, escape_hp_ratio: 0.2 },
    })
    const master = leaderOf(state)!
    expect(master).toMatchObject({ name: '維克多', race: 'demon', class: 'wizard', level: 6 })
    expect(contractTerms(state.party[0]!.contract!)).toMatchObject({ name: '黑薔薇印', exit_dc: 10, income_share: 0.3 })
  })

  it('may have no master: the mark stays but nobody holds the leash', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    expect(isEnslaved(state)).toBe(true)
    expect(isBound(state)).toBe(false)
    expect(leaderOf(state)).toBeUndefined()
    const money = state.money_cc
    const r = blank(state)
    applyEffects(state, r, [{ type: 'money', amount: 100 }])
    commitReport(state, r)
    expect(state.money_cc).toBe(money + 100)
    standOn(state, 'gate')
    goOutskirts(state)
  })
})

describe('the master holds the leash', () => {
  function bound(mark = 'labor') {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark })
    standOn(state, 'gate')
    return state
  }

  it('needs the master’s permission to leave town, harder with heavier marks', () => {
    const labor = bound('labor')
    const arcane = bound('arcane')
    expect(permitDc(arcane) - permitDc(labor)).toBe(16 - 12 + (5 - 2))
    expect(() => goOutskirts(labor)).toThrow('請求')
    act(labor, { kind: 'master_permit', text: '說要去近郊替主人採藥' }, 20)
    goOutskirts(labor)

    act(arcane, { kind: 'master_permit', text: '' }, 1)
    expect(() => goOutskirts(arcane)).toThrow('不准')
    expect(() => prepareAction(arcane, { kind: 'master_permit', text: '' })).toThrow('拒絕')
  })

  it('springs master events while moving, with a cooldown', () => {
    const state = bound()
    const r = maybeMasterEvent(state, 1)!
    expect(validate(r)).toBe(true)
    expect(r.outcome.tags).toContain('主人')
    expect(maybeMasterEvent(state, 1)).toBeUndefined()
    state.time.day += 1
    expect(maybeMasterEvent(state, 1)).toBeTruthy()
  })
})

describe('marking when enslaved', () => {
  function sold(): GameState {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      state.party[0]!.attrs.cha = 16
      offerSelf(state, 'public')
      if (state.pendingMark) return state
    }
    throw new Error('nobody bought')
  }

  it('holds everything until the mark is chosen; a great showing lets you design it', () => {
    const state = sold()
    expect(() => move(state, 0, -1)).toThrow('刻印')
    act(state, { kind: 'marking', text: '低頭順從，懇求用最輕的印記' }, 20)
    expect(state.pendingMark?.custom).toBe(true)
    chooseMark(state, { name: '細鏈', mark: '手腕上一圈細細的銀鏈紋', exit_dc: 8 })
    expect(state.pendingMark).toBeUndefined()
    expect(contractTerms(state.party[0]!.contract!)).toMatchObject({ name: '細鏈', exit_dc: 8 })
  })

  it('a fumble brings the heaviest mark; the AI may describe it from your behaviour', () => {
    const state = sold()
    const p = prepareAction(state, { kind: 'marking', text: '咬了刻印師一口' })
    state.pendingAction!.natural = 1
    const j = sanitizeJudgment(state, p, { degree: 'fumble', effects: [{ type: 'mark', name: '咬痕之印', text: '頸側一道帶著齒痕形狀的紫色法陣' }] })
    resolveAction(state, j)
    expect(state.pendingMark?.allowed).toEqual(['arcane'])
    expect(() => chooseMark(state, 'labor')).toThrow('不能選')
    chooseMark(state, 'arcane')
    const c = state.party[0]!.contract!
    expect(contractTerms(c)).toMatchObject({ name: '咬痕之印', mark: '頸側一道帶著齒痕形狀的紫色法陣', exit_dc: 16 })
    expect(c.obedience).toBe(slaveryRules.contracts.arcane!.obedience_penalty + 1)
  })
})

describe('slave companions', () => {
  it('buys a slave with a chosen mark, and rolls with advantage against your own slave', () => {
    const state = game(4)
    state.money_cc = 100000
    const l = marketStock(state, 'public')[0]!
    buySlave(state, 'public', l.npc, { name: '家紋', mark: '肩上一枚主角家的紋章', income_share: 0, exit_dc: 5 })
    const slave = state.party.find((m) => m.id === l.npc)!
    expect(contractTerms(slave.contract!)).toMatchObject({ name: '家紋', income_share: 0 })
    const p = prepareAction(state, { kind: 'free', target: slave.id, text: '要他老實交代來歷' })
    expect(p.rolls).toHaveLength(2)
    expect(p.natural).toBe(Math.max(...p.rolls!))
    resolveAction(state, null)
  })
})
