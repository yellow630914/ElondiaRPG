import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { enemies } from '@/engine/data'
import { customFrom, difficultyRule, difficultySummary, DIFFICULTY_DEFS, sanitizeCustomDifficulty } from '@/engine/gameRules'
import { newGame } from '@/engine/state'
import type { Difficulty, GameOptions } from '@/engine/types'

function foe(options: Partial<GameOptions>, id = 'goblin') {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 3, options: { defeatLoot: 'half', ...options } })
  return startCombat(state, [[id, 1]]).combatants.find((c) => c.side === 'enemy')!
}

describe('難度：慾望上限係數', () => {
  it('小怪的慾望上限乘上難度的係數（和生命係數一樣），普通是 1', () => {
    const normal = foe({})
    const epic = foe({ difficulty: 'epic' })
    expect(DIFFICULTY_DEFS.epic.minions.wild.lust).toBe(DIFFICULTY_DEFS.epic.minions.wild.hp)
    expect(epic.lustMax).toBe(Math.round(normal.lustMax! * DIFFICULTY_DEFS.epic.minions.wild.lust))
    expect(DIFFICULTY_DEFS.normal.lust).toBe(1)
    expect(DIFFICULTY_DEFS.epic.lust).toBe(1)
  })
  it('說明只在慾望上限不是 1 時寫出來', () => {
    expect(difficultySummary(DIFFICULTY_DEFS.normal)).toBe('怪物生命 ×1、傷害 ×1')
    expect(difficultySummary(DIFFICULTY_DEFS.epic)).toContain('慾望上限 ×1.3')
  })
})

describe('自訂難度', () => {
  it('照存檔填的係數；沒填的格子用普通的', () => {
    const c = customFrom('normal')
    c.minions.wild = { hp: 2, damage: 1.5, lust: 0.5 }
    const rule = difficultyRule({ options: { defeatLoot: 'half', difficulty: 'custom', customDifficulty: c } })
    expect(rule.id).toBe('custom')
    expect(rule.minions.wild).toEqual({ hp: 2, damage: 1.5, lust: 0.5 })
    const f = foe({ difficulty: 'custom', customDifficulty: c })
    const base = foe({})
    expect(f.maxHp).toBe(Math.round(enemies.goblin!.hp * 2))
    expect(f.lustMax).toBe(Math.round(base.lustMax! * 0.5))
    // 沒有係數的自訂難度等於普通
    expect(difficultyRule({ options: { defeatLoot: 'half', difficulty: 'custom' } }).minions).toEqual(DIFFICULTY_DEFS.normal.minions)
  })
  it('每一格夾在 0.25～5、取到小數兩位；寫壞的用普通的', () => {
    const c = sanitizeCustomDifficulty({ hp: 9, damage: 0, lust: 'x', minions: { wild: { hp: 1.234 } } })
    expect(c.hp).toBe(5)
    expect(c.damage).toBe(0.25)
    expect(c.lust).toBe(1)
    expect(c.minions.wild.hp).toBe(1.23)
    expect(c.minions.deep).toEqual({ hp: 1, damage: 1, lust: 1 })
  })
  it('從現有的難度複製', () => {
    for (const id of ['story', 'easy', 'hard', 'epic'] as Difficulty[]) {
      const c = customFrom(id)
      expect(difficultyRule({ options: { defeatLoot: 'half', difficulty: 'custom', customDifficulty: c } }).minions).toEqual(DIFFICULTY_DEFS[id].minions)
    }
  })
})
