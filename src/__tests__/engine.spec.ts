import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { act, currentActor, finishCombat, startCombat, validTargets } from '@/engine/combat'
import { formatMoney } from '@/engine/money'
import { Rng, roll } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { acceptQuest, guildQuests, recruit, rest, turnInQuest } from '@/engine/town'
import { travel } from '@/engine/travel'
import type { GameState, Report } from '@/engine/types'
import { shortestPath } from '@/engine/world'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function expectValid(report: Report) {
  const ok = validate(report)
  expect(validate.errors ?? [], JSON.stringify(validate.errors, null, 2)).toEqual([])
  expect(ok).toBe(true)
}

/** 每回合都用普通攻擊打第一個敵人，直到戰鬥結束 */
function fightToEnd(state: GameState) {
  for (let i = 0; i < 200 && state.combat?.status === 'ongoing'; i++) {
    const actor = currentActor(state.combat)!
    const target = validTargets(state.combat, actor.id)[0]!
    act(state, { type: 'attack', target: target.id })
  }
  expect(state.combat?.status).not.toBe('ongoing')
  return finishCombat(state)
}

describe('world', () => {
  it('matches the worldbook baseline travel times', () => {
    expect(shortestPath('soriel', 'ironforge')?.days).toEqual([7, 7])
    expect(shortestPath('soriel', 'bloodplume')?.days).toEqual([9, 10])
    expect(shortestPath('soriel', 'silvermoon')?.days).toEqual([8, 9])
    expect(shortestPath('dawnlight', 'tidehaven')?.days).toEqual([4, 4])
  })

  it('returns null for unreachable places', () => {
    expect(shortestPath('soriel', 'canglue')).toBeNull()
  })
})

describe('money and dice', () => {
  it('formats copper into larger units', () => {
    expect(formatMoney(1234)).toBe('1 白金 2 金 3 銀 4 銅')
    expect(formatMoney(-15)).toBe('-1 銀 5 銅')
    expect(formatMoney(0)).toBe('0 銅')
  })

  it('rolls deterministically from a seed', () => {
    const a = roll(new Rng(42), '2d6+3')
    const b = roll(new Rng(42), '2d6+3')
    expect(a).toEqual(b)
    expect(a.total).toBeGreaterThanOrEqual(5)
    expect(a.total).toBeLessThanOrEqual(15)
  })
})

describe('travel', () => {
  it('moves the party, spends money and produces a valid report', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 })
    const report = travel(state, 'rivervale')
    expectValid(report)
    expect(state.location).toBe('rivervale')
    expect(state.time.day).toBe(3)
    expect(state.money_cc).toBeLessThan(500)
    expect(report.outcome.result).toBe('arrived')
  })

  it('eats rations on trails', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'ranger', seed: 2 })
    travel(state, 'rivervale')
    const before = state.inventory.find((i) => i.name === '乾糧')!.qty
    const report = travel(state, 'snowridge')
    expectValid(report)
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty ?? 0).toBeLessThan(before)
  })
})

describe('combat', () => {
  it('runs a full fight and produces a valid combat report', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'barbarian', seed: 7 })
    state.location = 'snake_creek'
    startCombat(state, [['giant_rat', 1]])
    expect(state.combat).toBeDefined()
    const report = fightToEnd(state)
    expectValid(report)
    expect(state.combat).toBeUndefined()
    expect(report.kind).toBe('combat')
    expect(report.timeline!.length).toBeGreaterThan(0)
    expect(state.party[0]!.hp).toBeGreaterThan(0)
  })

  it('advances quests and pays out on turn-in', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 11 })
    state.location = 'albena'
    // 公會每次會為附近每個冒險區域各發一個委託；找到蛇溪洞窟的 F 級委託為止
    let quest = guildQuests(state).find((q) => q.target === 'snake_creek' && q.rank === 'F')
    for (let day = 2; !quest && day < 50; day++) {
      state.quests = []
      state.time.day = day
      quest = guildQuests(state).find((q) => q.target === 'snake_creek' && q.rank === 'F')
    }
    if (!quest) throw new Error('no F-rank quest generated')
    expectValid(acceptQuest(state, quest.id))
    state.location = 'snake_creek'
    for (let fights = 0; quest.progress < quest.goal && fights < 20; fights++) {
      state.party[0]!.hp = state.party[0]!.maxHp
      startCombat(state, [['giant_rat', 1]])
      fightToEnd(state)
    }
    expect(quest.status).toBe('ready')
    state.location = 'albena'
    const money = state.money_cc
    expectValid(turnInQuest(state, quest.id))
    expect(state.money_cc).toBe(money + quest.reward_cc)
  })

  it('levels up and offers skill choices', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    state.location = 'snake_creek'
    state.party[0]!.xp = 99
    startCombat(state, [['giant_rat', 1]])
    const report = fightToEnd(state)
    expect(report.outcome.result).toBe('victory')
    expect(report.changes.level_up?.[0]).toMatchObject({ actor: 'pc', from: 1, to: 2 })
    expect(state.party[0]!.pendingSkillChoices?.[0]?.length).toBeGreaterThan(0)
  })
})

describe('town', () => {
  it('recruits NPCs and includes them in combat', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5 })
    expectValid(recruit(state, 'npc_lina'))
    expect(state.party.map((m) => m.id)).toEqual(['pc', 'npc_lina'])
    state.location = 'snake_creek'
    startCombat(state, [['goblin', 2]])
    expect(state.combat!.combatants.filter((c) => c.side === 'party')).toHaveLength(2)
    const report = fightToEnd(state)
    expectValid(report)
    const lina = report.party.find((p) => p.id === 'npc_lina')!
    expect(lina.attitude).toBeTruthy()
  })

  it('offers quests in the starting town', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 8 })
    expect(guildQuests(state).length).toBeGreaterThan(0)
  })

  it('rests at the inn and restores HP', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6 })
    state.party[0]!.hp = 1
    expectValid(rest(state))
    expect(state.party[0]!.hp).toBe(state.party[0]!.maxHp)
    expect(state.time).toMatchObject({ day: 2, hour: 8 })
  })
})
