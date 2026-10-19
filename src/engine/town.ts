// 城鎮行動：旅店休息、酒館招募、公會委託、補給、升級選技能。

import { createNpc, guildRankFor, proficiency, snapshot } from './character'
import { startCombat, type CombatState } from './combat'
import {
  combatRules, economy, encounterTables, locationById, npcs, progression, regionById, skills,
  townQuestsPerTown, townQuestTemplates, type NpcDef, type TownQuestTemplate,
} from './data'
import { roll, withBonus } from './rng'
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

/** 冒險區域只發 E 級以上的委託。難度範圍如 "E-D"：只需清剿一次的取下限，兩次以上取上限。 */
function questRank(dungeonId: string, goal: number): GuildRank {
  const [low, high] = (locationById(dungeonId).rank ?? 'E').split('-')
  const rank = goal > 1 ? (high ?? low) : low
  const index = RANK_ORDER.indexOf(rank as GuildRank)
  return RANK_ORDER[Math.max(index, RANK_ORDER.indexOf('E'))]!
}

function townText(text: string, townId: string): string {
  return text.split('{town}').join(locationById(townId).name)
}

export function questTemplate(quest: Quest): TownQuestTemplate | undefined {
  return quest.template ? townQuestTemplates[quest.template] : undefined
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

/**
 * 公會委託列表；若這座城鎮沒有可接的委託就產生新的：
 * F 級城內／近郊委託若干個，加上附近每個冒險區域各一個 E 級以上的清剿委託。
 */
export function guildQuests(state: GameState): Quest[] {
  if (locationById(state.location).type === 'dungeon') return []
  const here = state.quests.filter((q) => q.giver === state.location && q.status !== 'completed')
  if (here.some((q) => q.status === 'available')) return here
  withRng(state, (rng) => {
    const pool = Object.values(townQuestTemplates)
    for (let i = 0; i < townQuestsPerTown && pool.length > 0; i++) {
      const tpl = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
      state.quests.push({
        id: `q-${state.location}-${state.time.day}-${tpl.id}`,
        title: townText(tpl.title, state.location),
        rank: 'F', kind: tpl.kind, area: tpl.area, template: tpl.id,
        giver: state.location, target: state.location, goal: 1, progress: 0,
        reward_cc: rng.int(tpl.reward_cc[0], tpl.reward_cc[1]),
        status: 'available',
      })
    }
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
        rank, kind: 'clear_dungeon', area: 'dungeon',
        giver: state.location, target, goal, progress: 0,
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

/**
 * 執行城內／近郊委託。戰鬥類委託（或檢定前遭遇敵人）會開始戰鬥並回傳戰鬥狀態，
 * 戰報在戰鬥結束後產生；其餘直接產生委託報告。
 */
export function doTownQuest(state: GameState, questId: string, intent?: string): Report | CombatState {
  const quest = state.quests.find((q) => q.id === questId && q.status === 'accepted')
  const tpl = quest && questTemplate(quest)
  if (!quest || !tpl) throw new Error('找不到這個委託')
  if (quest.giver !== state.location) throw new Error(`這是${locationById(quest.giver).name}的委託`)
  const scene = townText(tpl.scene, state.location)

  if (tpl.kind === 'pest' || tpl.kind === 'hunt') {
    return startCombat(state, tpl.encounter, { questId: quest.id, scene, ...(intent ? { intent } : {}) })
  }
  const ambushed = tpl.encounter && withRng(state, (rng) => rng.chance(tpl.encounter_chance ?? 0))
  if (ambushed) {
    // 遭遇戰不推進委託；打完可以再試一次
    return startCombat(state, tpl.encounter, { scene, ...(intent ? { intent } : {}) })
  }

  const report = baseReport(state, 'quest', tpl.hours)
  report.location.scene = scene
  report.quest = { id: quest.id, title: quest.title, rank: quest.rank, status: 'progress' }
  report.narration = { pov: 'second_person', length: 'short', ...(intent ? { player_intent: intent } : {}) }
  let success = true
  if (tpl.dc !== undefined) {
    const pc = player(state)
    const dice = withBonus('1d20', proficiency(pc.level))
    const r = withRng(state, (rng) => roll(rng, dice))
    success = r.total >= tpl.dc
    report.timeline = [{
      seq: 1, time: report.time.start, actor: pc.id, action: quest.title,
      roll: { dice, value: r.total, dc: tpl.dc }, result: success ? 'success' : 'fail',
    }]
  }
  if (success) {
    quest.progress = quest.goal
    quest.status = 'ready'
    if (tpl.item) report.changes.items_gained = [{ name: tpl.item, qty: tpl.qty ?? 1, owner: 'pc' }]
    report.outcome = { result: 'success', summary: `完成「${quest.title}」，可以回公會交付了。` }
  } else {
    report.outcome = { result: 'failure', summary: `「${quest.title}」這次沒有進展，花了 ${tpl.hours} 小時，可以再試一次。` }
  }
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
  const tpl = questTemplate(quest)
  report.changes = {
    money_cc: quest.reward_cc,
    reputation: [{ faction: 'guild', delta: RANK_ORDER.indexOf(quest.rank) + 1 }],
    ...(tpl?.item ? { items_lost: [{ name: tpl.item, qty: tpl.qty ?? 1 }] } : {}),
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
