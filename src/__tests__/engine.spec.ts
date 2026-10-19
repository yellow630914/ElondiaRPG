import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { startCombat } from '@/engine/combat'
import { fightToEnd } from './helpers/fight'
import { formatMoney } from '@/engine/money'
import { Rng, roll } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { acceptQuest, canAcceptRank, doTownQuest, guildQuests, recruit, rest, turnInQuest } from '@/engine/town'
import { travel } from '@/engine/travel'
import type { GameState, Quest, QuestKind, Report } from '@/engine/types'
import { shortestPath } from '@/engine/world'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function expectValid(report: Report) {
  const ok = validate(report)
  expect(validate.errors ?? [], JSON.stringify(validate.errors, null, 2)).toEqual([])
  expect(ok).toBe(true)
}

/** 每天公會會重新發委託；換日直到出現指定類型的委託為止 */
function findQuest(state: GameState, match: (q: Quest) => boolean): Quest {
  for (let day = state.time.day; day < state.time.day + 60; day++) {
    state.quests = state.quests.filter((q) => q.status !== 'available')
    state.time.day = day
    const quest = guildQuests(state).find((q) => q.status === 'available' && match(q))
    if (quest) return quest
  }
  throw new Error('no matching quest generated')
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

  it('levels up and offers skill choices', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    state.location = 'snake_creek'
    state.party[0]!.xp = 99
    startCombat(state, [['giant_rat', 1]])
    const report = fightToEnd(state)
    expect(report.outcome.result).toBe('victory')
    expect(report.changes.level_up?.[0]).toMatchObject({ actor: 'pc', from: 1, to: 2 })
    expect(state.party[0]!.pendingAbilityChoices?.[0]?.length).toBeGreaterThan(0)
  })
})

describe('quests', () => {
  it('offers F-rank quests in town and only E or higher for dungeons', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 8 })
    const quests = guildQuests(state)
    const townQuests = quests.filter((q) => q.area !== 'dungeon')
    const dungeonQuests = quests.filter((q) => q.area === 'dungeon')
    expect(townQuests.length).toBe(3)
    expect(townQuests.every((q) => q.rank === 'F' && q.target === 'soriel')).toBe(true)
    expect(dungeonQuests.length).toBeGreaterThan(0)
    expect(dungeonQuests.every((q) => q.rank !== 'F')).toBe(true)
  })

  it('completes a combat quest in the outskirts and pays out', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'barbarian', seed: 12 })
    const quest = findQuest(state, (q) => q.kind === 'hunt' || q.kind === 'pest')
    expectValid(acceptQuest(state, quest.id))
    for (let tries = 0; quest.status === 'accepted' && tries < 10; tries++) {
      state.party[0]!.hp = state.party[0]!.maxHp
      doTownQuest(state, quest.id)
      expect(state.combat?.questId).toBe(quest.id)
      const report = fightToEnd(state)
      expectValid(report)
      expect(report.location.scene).toContain('索里耶爾')
    }
    expect(quest.status).toBe('ready')
    const money = state.money_cc
    expectValid(turnInQuest(state, quest.id))
    expect(state.money_cc).toBe(money + quest.reward_cc)
  })

  it('completes check-based quests, retrying and fighting off ambushes', () => {
    const kinds: QuestKind[] = ['search', 'gather', 'patrol', 'delivery']
    for (const kind of kinds) {
      const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 20 })
      const quest = findQuest(state, (q) => q.kind === kind)
      acceptQuest(state, quest.id)
      for (let tries = 0; quest.status === 'accepted' && tries < 30; tries++) {
        state.party[0]!.hp = state.party[0]!.maxHp
        const result = doTownQuest(state, quest.id)
        if (state.combat) fightToEnd(state)
        else expectValid(result as Report)
      }
      expect(quest.status, kind).toBe('ready')
      expectValid(turnInQuest(state, quest.id))
      if (kind === 'gather') expect(state.inventory.find((i) => i.name === '藥草')).toBeUndefined()
    }
  })

  it('requires a party for E-rank dungeon quests at level 1', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 11 })
    state.location = 'albena'
    const quest = findQuest(state, (q) => q.area === 'dungeon' && q.target === 'snake_creek' && q.rank === 'E')
    expect(canAcceptRank(state, quest.rank)).toBe(false)
    state.location = 'soriel'
    recruit(state, 'npc_lina')
    state.location = 'albena'
    expectValid(acceptQuest(state, quest.id))
    state.location = 'snake_creek'
    for (let fights = 0; quest.progress < quest.goal && fights < 20; fights++) {
      for (const m of state.party) m.hp = m.maxHp
      startCombat(state, [['giant_rat', 1]])
      fightToEnd(state)
    }
    expect(quest.status).toBe('ready')
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

  it('rests at the inn and restores HP', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6 })
    state.party[0]!.hp = 1
    expectValid(rest(state))
    expect(state.party[0]!.hp).toBe(state.party[0]!.maxHp)
    expect(state.time).toMatchObject({ day: 2, hour: 8 })
  })
})
