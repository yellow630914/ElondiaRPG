import { describe, expect, it } from 'vitest'
import { companionRules } from '@/engine/data'
import { questDeadlineDays } from '@/engine/deadlines'
import { applyEffects } from '@/engine/effects'
import { gameRule, RULE_DEFS, rewardMoney, sanitizeRules } from '@/engine/gameRules'
import { enterLocation, goOutskirts } from '@/engine/grid'
import { ambushChance, shortRest } from '@/engine/rest'
import { alertLevel, securityRules } from '@/engine/security'
import { commitReport, migrate, newGame } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

function game(rules: GameState['options'] = { defeatLoot: 'half' }): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, options: rules })
  enterLocation(state)
  return state
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('per-save rules', () => {
  it('reads defaults, clamps out-of-range values and keeps only changed ones', () => {
    const state = game()
    for (const k of Object.keys(RULE_DEFS) as (keyof typeof RULE_DEFS)[]) expect(gameRule(state, k)).toBe(RULE_DEFS[k].default)
    expect(gameRule({ options: { defeatLoot: 'half', xpMult: 99 } }, 'xpMult')).toBe(RULE_DEFS.xpMult.max)
    expect(sanitizeRules({ xpMult: 2, moneyMult: 1, escapeDc: '', longRestHours: '6' })).toEqual({ xpMult: 2, longRestHours: 6 })
    // 舊存檔沒有這些欄位：照預設
    expect(gameRule(migrate(game()), 'deadlineMult')).toBe(1)
  })

  it('scales experience and reward money, but not spending', () => {
    const state = game({ defeatLoot: 'half', xpMult: 2, moneyMult: 1.5 })
    const pc = state.party[0]!
    const r = blank(state)
    r.changes.xp = [{ actor: pc.id, amount: 30 }]
    commitReport(state, r)
    expect(pc.xp).toBe(60)
    expect(r.changes.xp[0]!.amount).toBe(60)
    expect(rewardMoney(state, 100)).toBe(150)
    expect(rewardMoney(state, -100)).toBe(-100)
    const e = blank(state)
    applyEffects(state, e, [{ type: 'money', amount: 40 }])
    expect(e.changes.money_cc).toBe(60)
  })

  it('changes rest ambush chance and rest hours', () => {
    const state = game({ defeatLoot: 'half', ambushMult: 0, shortRestHours: 2 })
    expect(ambushChance(state)).toBe(0)
    const before = state.time.hour
    const r = shortRest(state)
    expect('report_id' in r).toBe(true)
    expect((state.time.hour - before + 24) % 24).toBe(2)
    expect(gameRule(game(), 'longRestHours')).toBe(companionRules.rest.long_hours)
  })

  it('scales the ambush chance outside town', () => {
    for (const [mult, want] of [[0, 0], [1, companionRules.rest.ambush.wild], [2, companionRules.rest.ambush.wild * 2]] as const) {
      const state = game({ defeatLoot: 'half', ambushMult: mult })
      goOutskirts(state)
      expect(ambushChance(state)).toBeCloseTo(want)
    }
  })

  it('scales quest deadlines, or removes them', () => {
    const q = { area: 'town' as const, giver: 'soriel', target: 'soriel' }
    const base = questDeadlineDays(q)!
    expect(questDeadlineDays(q, game({ defeatLoot: 'half', deadlineMult: 2 }))).toBe(base * 2)
    expect(questDeadlineDays(q, game({ defeatLoot: 'half', deadlineMult: 0 }))).toBeUndefined()
  })

  it('changes how fast guard alert decays', () => {
    const state = game({ defeatLoot: 'half', alertDecayDays: 2 })
    state.alerts = { [state.location]: { level: 3, day: state.time.day } }
    state.time.day += 4
    expect(alertLevel(state)).toBe(1)
    const normal = game()
    normal.alerts = { [normal.location]: { level: 3, day: normal.time.day } }
    normal.time.day += 4
    expect(alertLevel(normal)).toBe(3 - Math.floor(4 / securityRules.alert.decay_days))
  })
})
