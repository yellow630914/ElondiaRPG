import { describe, expect, it } from 'vitest'
import { companionRules } from '@/engine/data'
import { questDeadlineDays } from '@/engine/deadlines'
import { applyEffects } from '@/engine/effects'
import { DEFAULT_DIFFICULTY, DIFFICULTY_DEFS, DIFFICULTY_IDS, difficultyFor, difficultyOf, difficultyRule, gameRule, RULE_DEFS, rewardMoney, sanitizeRules } from '@/engine/gameRules'
import { startCombat } from '@/engine/combat'
import { enterLocation, goOutskirts } from '@/engine/grid'
import { ambushChance, shortRest } from '@/engine/rest'
import { alertLevel, securityRules } from '@/engine/security'
import { dungeonEncounters, enemies, isLayerBoss, MINION_TIERS, minionTier } from '@/engine/data'
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

  it('leaves difficulty on normal by default and keeps it when other rules change', () => {
    expect(DEFAULT_DIFFICULTY).toBe('normal')
    expect(difficultyOf(game())).toBe('normal')
    // 舊存檔沒有這個欄位、寫壞了的也算普通
    expect(difficultyOf(migrate(game()))).toBe('normal')
    expect(difficultyOf({ options: { defeatLoot: 'half', difficulty: 'nope' as never } })).toBe('normal')
    expect(difficultyRule({ options: { defeatLoot: 'half', difficulty: 'epic' } })).toBe(DIFFICULTY_DEFS.epic)
    // 難度不是數值規則：不會被 sanitizeRules 當成一項吃掉
    expect(Object.keys(RULE_DEFS)).not.toContain('difficulty')
    expect(sanitizeRules({ difficulty: 'epic' } as never)).toEqual({})
  })

  it('curves monster hp and damage by difficulty, with normal as the baseline', () => {
    // 普通 = 1：和沒有這個規則時完全一樣
    expect(DIFFICULTY_DEFS.normal.hp).toBe(1)
    expect(DIFFICULTY_DEFS.normal.damage).toBe(1)
    for (const t of MINION_TIERS) expect(DIFFICULTY_DEFS.normal.minions[t]).toEqual({ hp: 1, damage: 1 })
    // 五個難度都在；怪物的生命隨難度上升，小怪的輸出也是
    expect(DIFFICULTY_IDS).toEqual(['story', 'easy', 'normal', 'hard', 'epic'])
    for (let i = 1; i < DIFFICULTY_IDS.length; i++) {
      const prev = DIFFICULTY_DEFS[DIFFICULTY_IDS[i - 1]!]
      const cur = DIFFICULTY_DEFS[DIFFICULTY_IDS[i]!]
      expect(cur.hp).toBeGreaterThan(prev.hp)
      for (const t of MINION_TIERS) {
        expect(cur.minions[t].hp).toBeGreaterThan(prev.minions[t].hp)
        expect(cur.minions[t].damage).toBeGreaterThanOrEqual(prev.minions[t].damage)
      }
    }
    // 頭目變難靠生命（戰鬥變長），輸出不超過普通：不要讓層主一拳打倒一個隊員
    expect(DIFFICULTY_DEFS.hard.damage).toBeLessThanOrEqual(1)
    expect(DIFFICULTY_DEFS.epic.damage).toBeLessThanOrEqual(1)
  })

  it('uses the boss coefficients for bosses and the area coefficients for minions', () => {
    const epic = DIFFICULTY_DEFS.epic
    expect(minionTier('goblin')).toBe('wild')
    expect(difficultyFor(epic, 'goblin')).toEqual(epic.minions.wild)
    const boss = Object.values(dungeonEncounters)[0]!.bosses!.shallow![0]![0]
    expect(difficultyFor(epic, boss)).toBe(epic)
    const storyBoss = Object.values(enemies).find((e) => Object.keys(e.ability_hp_below ?? {}).length && !isLayerBoss(e.id))!
    expect(difficultyFor(epic, storyBoss.id)).toBe(epic)
    expect(minionTier('rhine_royal_guard')).toBe('deep')
    expect(difficultyFor(epic, 'rhine_royal_guard')).toEqual(epic.minions.deep)
  })

  it('applies the difficulty coefficients to monsters in combat', () => {
    const base = enemies.goblin!
    for (const id of DIFFICULTY_IDS) {
      const state = game({ defeatLoot: 'half', difficulty: id })
      const combat = startCombat(state, [['goblin', 1]])
      const foe = combat.combatants.find((c) => c.side === 'enemy')!
      const d = difficultyFor(DIFFICULTY_DEFS[id], 'goblin')
      // 特徵也會改生命：只有沒擲到特徵時才對得上基礎值
      if (!foe.traits?.length) expect(foe.maxHp).toBe(Math.max(1, Math.round(base.hp * d.hp)))
      expect(foe.dmgMult ?? 1).toBe(d.damage)
      // 開戰時把難度記進戰鬥狀態（普通不記）
      expect(combat.difficulty).toBe(id === 'normal' ? undefined : id)
      delete state.combat
    }
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
