// 城鎮行動：旅店休息、酒館招募、公會委託、補給、升級選技能。

import { createNpc, guildRankFor, snapshot } from './character'
import { combatRules, economy, encounterTables, locationById, npcs, progression, regionById, skills, type NpcDef } from './data'
import { formatMoney } from './money'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type { GameState, GuildRank, Quest, Report } from './types'
import { shortestPath } from './world'

export const INN_CC_PER_PERSON = 15
export const RATION_CC = 5
/** 公會只發布這個天數內可到達的冒險區域委託 */
export const QUEST_RANGE_DAYS = 7

const RANK_ORDER: GuildRank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S']

function baseReport(state: GameState, kind: Report['kind'], hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = player(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind,
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: loc.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

// ---- 旅店 ----

export function restCost(state: GameState): number {
  return INN_CC_PER_PERSON * state.party.length
}

/** 在旅店住一晚：全員 HP/MP 回滿，時間推進到隔天早上 8 點。 */
export function rest(state: GameState): Report {
  const cost = restCost(state)
  if (state.money_cc < cost) throw new Error('旅費不足')
  const hours = (24 - state.time.hour + 8) % 24 || 24
  const report = baseReport(state, 'rest', hours)
  report.location.scene = `${locationById(state.location).name}的旅店`
  report.party = state.party.map((m) => {
    const snap = snapshot(m, undefined, player(state))
    snap.hp = [m.hp, m.maxHp, m.maxHp]
    snap.mp = [m.mp, m.maxMp, m.maxMp]
    return snap
  })
  report.outcome.summary = `在旅店休息一晚，花費 ${formatMoney(cost)}。`
  report.changes.money_cc = -cost
  return commitReport(state, report)
}

// ---- 補給 ----

export function buyRations(state: GameState, qty: number): Report {
  const cost = RATION_CC * qty
  if (qty <= 0) throw new Error('數量錯誤')
  if (state.money_cc < cost) throw new Error('金錢不足')
  const report = baseReport(state, 'trade', 0.5)
  report.outcome.summary = `購買乾糧 ${qty} 份，花費 ${formatMoney(cost)}。`
  report.changes = { money_cc: -cost, items_gained: [{ name: '乾糧', qty }] }
  report.narration = { length: 'short' }
  return commitReport(state, report)
}

// ---- 酒館招募 ----

export function recruitableHere(state: GameState): NpcDef[] {
  return npcs.filter((n) => n.location === state.location && !state.recruited.includes(n.id))
}

export function recruit(state: GameState, npcId: string): Report {
  const def = recruitableHere(state).find((n) => n.id === npcId)
  if (!def) throw new Error('這裡沒有這位角色')
  if (state.party.length >= combatRules.party_max) throw new Error(`隊伍最多 ${combatRules.party_max} 人`)
  if (state.money_cc < def.hire_cc) throw new Error('招募費用不足')
  const npc = createNpc(def)
  state.party.push(npc)
  state.recruited.push(npc.id)
  const report = baseReport(state, 'social', 1)
  report.location.scene = `${locationById(state.location).name}的酒館`
  report.outcome.summary = `在酒館招募了${npc.name}加入隊伍，支付 ${formatMoney(def.hire_cc)}。`
  report.changes.money_cc = -def.hire_cc
  report.changes.affinity = [{ npc: npc.id, delta: 0, after: npc.affinity ?? 0, reason: '初次結識' }]
  report.narration = { pov: 'second_person', length: 'short', focus: [`${npc.name}的第一印象與性格`] }
  report.lore_keys!.push(progression.races.find((r) => r.id === npc.race)?.name ?? npc.race)
  return commitReport(state, report)
}

export function dismiss(state: GameState, npcId: string): Report {
  const i = state.party.findIndex((m) => m.id === npcId && !m.isPlayer)
  if (i < 0) throw new Error('隊伍中沒有這位角色')
  const report = baseReport(state, 'social', 0.5)
  const npc = state.party[i]!
  report.outcome.summary = `${npc.name}離開了隊伍。`
  report.outcome.tags = ['離隊']
  state.party.splice(i, 1)
  return commitReport(state, report)
}

// ---- 冒險者公會 ----

/** 冒險區域的難度範圍如 "F-E"：只需清剿一次的委託取下限，兩次以上取上限。 */
function questRank(dungeonId: string, goal: number): GuildRank {
  const [low, high] = (locationById(dungeonId).rank ?? 'E').split('-')
  const rank = goal > 1 ? (high ?? low) : low
  return (RANK_ORDER as string[]).includes(rank ?? '') ? (rank as GuildRank) : 'E'
}

function rewardRange(rank: GuildRank): [number, number] {
  const table = economy.quest_rewards_cc
  const entry = table[rank] ?? table[`${rank}_solo`]
  return entry?.range ?? [30, 50]
}

export function canAcceptRank(state: GameState, rank: GuildRank): boolean {
  const mine = RANK_ORDER.indexOf(guildRankFor(player(state).level))
  const target = RANK_ORDER.indexOf(rank)
  // 只能接同級或更低；組隊時可接高一級
  return target <= mine || (state.party.length > 1 && target === mine + 1)
}

/** 公會委託列表；若這座城鎮還沒有委託，就依附近的冒險區域產生。 */
export function guildQuests(state: GameState): Quest[] {
  if (locationById(state.location).type === 'dungeon') return []
  const here = state.quests.filter((q) => q.giver === state.location && q.status !== 'completed')
  if (here.some((q) => q.status === 'available')) return here
  withRng(state, (rng) => {
    const targets = Object.keys(encounterTables).filter((id) => {
      const path = shortestPath(state.location, id)
      return path !== null && path.days[1] <= QUEST_RANGE_DAYS
    })
    for (const target of targets) {
      const goal = rng.int(1, 3)
      const rank = questRank(target, goal)
      const [lo, hi] = rewardRange(rank)
      state.quests.push({
        id: `q-${state.location}-${state.time.day}-${target}`,
        title: `清剿${locationById(target).name}的魔物（${goal} 次）`,
        rank, giver: state.location, target, goal, progress: 0,
        reward_cc: Math.round(rng.int(lo, hi) * (1 + (goal - 1) * 0.5)),
        status: 'available',
      })
    }
  })
  return state.quests.filter((q) => q.giver === state.location && q.status !== 'completed')
}

export function acceptQuest(state: GameState, questId: string): Report {
  const quest = state.quests.find((q) => q.id === questId && q.status === 'available')
  if (!quest) throw new Error('找不到這個委託')
  if (!canAcceptRank(state, quest.rank)) throw new Error('公會階級不足，無法接取')
  quest.status = 'accepted'
  const report = baseReport(state, 'quest', 0.5)
  report.location.scene = `${locationById(state.location).name}的冒險者公會`
  report.quest = { id: quest.id, title: quest.title, rank: quest.rank, status: 'accepted' }
  report.outcome.summary = `接下 ${quest.rank} 級委託「${quest.title}」，報酬 ${formatMoney(quest.reward_cc)}。`
  report.lore_keys!.push(locationById(quest.target).name, '冒險者公會')
  return commitReport(state, report)
}

export function turnInQuest(state: GameState, questId: string): Report {
  const quest = state.quests.find((q) => q.id === questId && q.status === 'ready')
  if (!quest) throw new Error('委託尚未完成')
  if (quest.giver !== state.location) throw new Error(`請回到${locationById(quest.giver).name}交付`)
  quest.status = 'completed'
  const report = baseReport(state, 'quest', 0.5)
  report.location.scene = `${locationById(state.location).name}的冒險者公會`
  report.quest = { id: quest.id, title: quest.title, rank: quest.rank, status: 'completed' }
  report.outcome.summary = `交付委託「${quest.title}」，獲得報酬 ${formatMoney(quest.reward_cc)}。`
  report.changes = {
    money_cc: quest.reward_cc,
    reputation: [{ faction: 'guild', delta: RANK_ORDER.indexOf(quest.rank) + 1 }],
  }
  report.lore_keys!.push('冒險者公會')
  return commitReport(state, report)
}

// ---- 升級技能 ----

export function chooseSkill(state: GameState, memberId: string, skillId: string): Report {
  const member = state.party.find((m) => m.id === memberId)
  const choices = member?.pendingSkillChoices?.[0]
  if (!member || !choices?.includes(skillId)) throw new Error('沒有這個技能選項')
  member.pendingSkillChoices!.shift()
  if (member.pendingSkillChoices!.length === 0) delete member.pendingSkillChoices
  member.skills.push(skillId)
  const skill = skills[skillId]!
  const report = baseReport(state, 'action', 0)
  report.outcome.summary = `${member.name}領悟了${skill.name}。`
  report.changes.skills_gained = [{ actor: member.id, skill: skill.name, quality: skill.quality, source: 'level_up' }]
  report.narration = { length: 'short' }
  return commitReport(state, report)
}
