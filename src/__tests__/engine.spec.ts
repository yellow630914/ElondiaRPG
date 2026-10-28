import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { xpToNext } from '@/engine/character'
import { startCombat } from '@/engine/combat'
import { enterLocation, generateLayer, standOn, storeArea } from '@/engine/grid'
import { fightToEnd } from './helpers/fight'
import { formatMoney } from '@/engine/money'
import { Rng, roll } from '@/engine/rng'
import { newGame, withRng } from '@/engine/state'
import { acceptQuest, canAcceptRank, doTownQuest, guildQuests, recruit, rest, turnInQuest } from '@/engine/town'
import { walkTo } from './helpers/travel'
import type { GameState, Quest, QuestKind, Report } from '@/engine/types'
import { reachable, shortestPath } from '@/engine/world'
import { lotsOf } from '@/engine/homes'
import { ensureRoster } from '@/engine/population'
import { npcRecord } from '@/engine/npcs'
import { clearCounts, layerName, layerRank, rankForLevel } from '@/engine/materialQuests'
import { geography, locationById, townQuestsPerTown, townQuestTemplates } from '@/engine/data'

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

  it('adds the windhammer and rotmarsh villages with a lot, a roster and local races', () => {
    for (const id of ['windhammer', 'rotmarsh']) {
      expect(lotsOf(id), id).toHaveLength(1)
      const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3, birthplace: id })
      const roster = ensureRoster(state, id)!
      expect(roster.members.length, id).toBeGreaterThan(0)
      if (id === 'windhammer') {
        const races = roster.members.map((m) => npcRecord(state, m)!.race)
        expect(races.filter((r) => r === 'human').length).toBeGreaterThan(races.length / 2)
      }
    }
    expect(shortestPath('greyrock', 'windspeak')?.legs.map((l) => l.to)).toEqual(['windhammer', 'windspeak'])
    expect(shortestPath('bloodplume', 'rotmarsh')?.days).toEqual([3, 3])
  })

  it('connects every place on the map', () => {
    for (const l of geography.locations) expect(shortestPath('soriel', l.id), l.id).not.toBeNull()
    expect(shortestPath('canglue', 'tidehaven')?.legs[0]?.fare).toBe(80)
    expect(shortestPath('coral_bay', 'canglue')?.legs[0]?.fare).toBe(0)
    expect(shortestPath('ashport', 'coral_bay')?.days).toEqual([3, 4])
  })
})

describe('money and dice', () => {
  it('formats copper into larger units', () => {
    expect(formatMoney(1234)).toBe('1,234 白鸛')
    expect(formatMoney(-15)).toBe('-15 白鸛')
    expect(formatMoney(0)).toBe('0 白鸛')
    expect(formatMoney(1234567)).toBe('1,234,567 白鸛')
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
    const report = walkTo(state, 'rivervale')
    expectValid(report)
    expect(state.location).toBe('rivervale')
    expect(state.time.day).toBe(3)
    expect(state.money_cc).toBeLessThan(500)
    expect(report.outcome.result).toBe('arrived')
  })

  it('does not eat rations on trails any more', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'ranger', seed: 2 })
    walkTo(state, 'rivervale')
    const before = state.inventory.find((i) => i.name === '乾糧')!.qty
    const report = walkTo(state, 'snowridge')
    expectValid(report)
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty).toBe(before)
    expect(report.outcome.tags).not.toContain('糧食耗盡')
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
    state.party[0]!.xp = xpToNext(1) - 1
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
    const townQuests = quests.filter((q) => q.template)
    const dungeonQuests = quests.filter((q) => q.kind === 'clear_dungeon')
    expect(townQuests.length).toBe(townQuestsPerTown)
    expect(townQuests.every((q) => q.rank === 'F' && q.target === 'soriel')).toBe(true)
    expect(dungeonQuests.length).toBeGreaterThan(0)
    expect(dungeonQuests.every((q) => q.rank !== 'F')).toBe(true)
  })

  it('ranks clear quests by the layer they target, like boss hunts on the same layer', () => {
    for (const target of ['skull_isle', 'giants_spine']) {
      const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 8, birthplace: target === 'skull_isle' ? 'tidehaven' : 'greyrock' })
      let seen = 0
      for (let day = 1; day < 60; day++) {
        state.time.day = day
        state.quests = state.quests.filter((q) => q.status !== 'available')
        for (const q of guildQuests(state).filter((x) => x.target === target)) {
          if (q.kind !== 'clear_dungeon') continue
          expect(q.layer, q.title).toBeDefined()
          expect(q.title).toContain(layerName(q.layer!))
          expect(q.rank).toBe(layerRank(target, q.layer!))
          // 和同一層的層主討伐換算方式一致：淺層到深層是 E～C，底層才是 A 級
          expect(q.layer === 'abyss' ? ['A'] : ['E', 'D', 'C']).toContain(q.rank)
          seen++
        }
      }
      expect(seen, target).toBeGreaterThan(0)
    }
    expect(layerRank('skull_isle', 'deep')).toBe(rankForLevel(7, ['E', 'S']))
    expect(layerRank('snake_creek', 'shallow')).toBe('E')
  })

  it('counts clear wins on the target layer or deeper; old quests without a layer count anywhere', () => {
    expect(clearCounts({ layer: 'middle' }, 'shallow')).toBe(false)
    expect(clearCounts({ layer: 'middle' }, 'middle')).toBe(true)
    expect(clearCounts({ layer: 'middle' }, 'deep')).toBe(true)
    expect(clearCounts({ layer: 'middle' }, undefined)).toBe(false)
    expect(clearCounts({}, 'outskirts')).toBe(true)
    expect(clearCounts({}, undefined)).toBe(true)
  })

  it('lets a yulin born in canglue travel and take dungeon quests', () => {
    const state = newGame({ name: '測試者', race: 'yulin', classId: 'fighter', seed: 8, birthplace: 'canglue' })
    expect(reachable('canglue').length).toBeGreaterThan(10)
    expect(guildQuests(state).some((q) => q.kind === 'clear_dungeon')).toBe(true)
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
    const done = turnInQuest(state, quest.id)
    expectValid(done)
    expect(state.money_cc).toBe(money + quest.reward_cc)
    // 打怪的委託只有戰鬥經驗，交付不另外給
    expect(done.changes.xp).toBeUndefined()
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
      const done = turnInQuest(state, quest.id)
      expectValid(done)
      // 不用打怪的委託交付時給經驗：20 × F 級的等級下限 1
      expect(done.changes.xp?.map((x) => x.amount), kind).toEqual(state.party.map(() => 20))
      if (kind === 'gather') expect(state.inventory.find((i) => i.name === '藥草')).toBeUndefined()
    }
  })

  it('completes a check-based quest by winning the ambush, and fails a check at most once', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'barbarian', seed: 20 })
    const quest = findQuest(state, (q) => q.kind === 'gather')
    const tpl = townQuestTemplates[quest.template!]!
    const saved = { encounter_chance: tpl.encounter_chance, dc: tpl.dc }
    try {
      // 遇到的怪打贏就算完成，採集的東西也一起拿到
      acceptQuest(state, quest.id)
      tpl.encounter_chance = 1
      for (let tries = 0; quest.status === 'accepted' && tries < 10; tries++) {
        state.party[0]!.hp = state.party[0]!.maxHp
        doTownQuest(state, quest.id)
        expect(state.combat?.questId).toBe(quest.id)
        const report = fightToEnd(state)
        expectValid(report)
        if (report.outcome.result === 'victory') {
          expect(report.outcome.summary).toContain('可以回公會交付了')
          expect(report.changes.items_gained).toContainEqual({ name: tpl.item, qty: tpl.qty, owner: 'pc' })
        }
      }
      expect(quest.status).toBe('ready')
      expectValid(turnInQuest(state, quest.id))

      // 檢定再難也只會失敗一次
      const next = findQuest(state, (q) => q.kind === 'gather')
      acceptQuest(state, next.id)
      tpl.encounter_chance = 0
      tpl.dc = 99
      const first = doTownQuest(state, next.id) as Report
      expect(first.outcome.result).toBe('failure')
      expect(next.status).toBe('accepted')
      const second = doTownQuest(state, next.id) as Report
      expectValid(second)
      expect(second.outcome.result).toBe('success')
      expect(next.status).toBe('ready')
    } finally {
      Object.assign(tpl, saved)
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
    enterLocation(state)
    // 清剿委託指定一層：站到那一層才算
    const layer = ['outskirts', 'shallow', 'middle', 'deep'].indexOf(quest.layer!)
    const area = withRng(state, (rng) => generateLayer(state, locationById('snake_creek'), layer, rng))
    storeArea(state, area)
    state.position = { ...state.position!, area: area.key }
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
    enterLocation(state)
    expect(() => rest(state)).toThrow('要在旅店')
    standOn(state, 'inn')
    state.party[0]!.hp = 1
    expectValid(rest(state))
    expect(state.party[0]!.hp).toBe(state.party[0]!.maxHp)
    expect(state.time).toMatchObject({ day: 2, hour: 8 })
  })
})
