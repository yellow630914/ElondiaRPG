// 逐回合戰鬥。玩家在 UI 上為每位隊員選擇行動，敵人由簡單 AI 控制；
// 戰鬥結束後呼叫 finishCombat 產生戰報。戰鬥中的狀態存在 GameState.combat，可隨存檔保存。

import { armorClass, attackBonus, damageDice, proficiency, snapshot } from './character'
import {
  combatRules, encounterTables, enemies, locationById, regionById, skills, statuses,
  type EncounterGroup, type SkillDef,
} from './data'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type {
  ActorState, Character, Effect, GameState, GameTime, ItemDelta, Report, RollResult, TimelineEntry,
} from './types'

export interface CombatStatus {
  name: string
  /** 剩餘回合；-1 表示持續到戰鬥結束 */
  turns: number
}

export interface Combatant {
  id: string
  name: string
  side: 'party' | 'enemy'
  level: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  ac: number
  attack: number
  damage: string
  skills: string[]
  statuses: CombatStatus[]
  initiative: number
  fled?: boolean
  /** 敵人的資料 id */
  defId?: string
}

export type CombatAction =
  | { type: 'attack'; target: string }
  | { type: 'skill'; skill: string; target?: string }
  | { type: 'defend' }
  | { type: 'flee' }

export interface CombatState {
  id: string
  location: string
  startTime: Required<GameTime>
  round: number
  order: string[]
  turn: number
  combatants: Combatant[]
  timeline: TimelineEntry[]
  status: 'ongoing' | 'victory' | 'defeat' | 'fled'
  startHp: Record<string, number>
  startMp: Record<string, number>
  affinity: Record<string, { delta: number; reasons: string[] }>
  intent?: string
  /** 由委託觸發的戰鬥；獲勝時推進這個委託 */
  questId?: string
  /** 細部場景，例如「索里耶爾近郊的農田」 */
  scene?: string
}

export interface CombatOptions {
  intent?: string
  questId?: string
  scene?: string
}

const COMBAT_MINUTES_PER_ROUND = 1

// ---- 開始戰鬥 ----

export function encounterFor(locationId: string, rng: Rng): EncounterGroup {
  const table = encounterTables[locationId]
  if (table?.length) return rng.pick(table)
  const fallback = Object.values(enemies).filter((e) => e.habitats.includes(locationId))
  if (fallback.length === 0) throw new Error(`${locationId} 沒有可遭遇的敵人`)
  return [[rng.pick(fallback).id, rng.int(1, 2)]]
}

export function startCombat(state: GameState, group?: EncounterGroup, opts: CombatOptions = {}): CombatState {
  if (state.combat) throw new Error('戰鬥進行中')
  return withRng(state, (rng) => {
    const enemyGroup = group ?? encounterFor(state.location, rng)
    const fighters: Combatant[] = state.party
      .filter((c) => c.hp > 0)
      .map((c) => fromCharacter(c, rng))
    if (fighters.length === 0) throw new Error('隊伍沒有能戰鬥的成員')
    const counts: Record<string, number> = {}
    for (const [id, n] of enemyGroup) counts[id] = (counts[id] ?? 0) + n
    let idx = 1
    const seen: Record<string, number> = {}
    for (const [defId, n] of enemyGroup) {
      for (let i = 0; i < n; i++) {
        const def = enemies[defId]
        if (!def) throw new Error(`unknown enemy: ${defId}`)
        seen[defId] = (seen[defId] ?? 0) + 1
        const suffix = counts[defId]! > 1 ? ` ${String.fromCharCode(64 + seen[defId]!)}` : ''
        fighters.push({
          id: `e${idx++}`, name: def.name + suffix, side: 'enemy', level: def.level,
          hp: def.hp, maxHp: def.hp, mp: 0, maxMp: 0, ac: def.ac, attack: def.attack, damage: def.damage,
          skills: def.skills ?? [], statuses: [], initiative: roll(rng, '1d20').total, defId,
        })
      }
    }
    const order = [...fighters].sort((a, b) => b.initiative - a.initiative || (a.side === 'party' ? -1 : 1)).map((f) => f.id)
    const combat: CombatState = {
      id: `c-${state.nextReportNo}`,
      location: state.location,
      startTime: { ...state.time },
      round: 1,
      order,
      turn: 0,
      combatants: fighters,
      timeline: [],
      status: 'ongoing',
      startHp: Object.fromEntries(fighters.map((f) => [f.id, f.hp])),
      startMp: Object.fromEntries(fighters.map((f) => [f.id, f.mp])),
      affinity: {},
      ...(opts.intent ? { intent: opts.intent } : {}),
      ...(opts.questId ? { questId: opts.questId } : {}),
      ...(opts.scene ? { scene: opts.scene } : {}),
    }
    state.combat = combat
    if (!beginTurn(combat, rng)) endTurn(combat, rng)
    runEnemyTurns(combat, rng)
    return combat
  })
}

function fromCharacter(c: Character, rng: Rng): Combatant {
  return {
    id: c.id, name: c.name, side: 'party', level: c.level,
    hp: c.hp, maxHp: c.maxHp, mp: c.mp, maxMp: c.maxMp,
    ac: armorClass(c), attack: attackBonus(c), damage: damageDice(c),
    skills: [...c.skills], statuses: [],
    initiative: roll(rng, withBonus('1d20', proficiency(c.level))).total,
  }
}

// ---- 查詢 ----

export function combatant(combat: CombatState, id: string): Combatant {
  const c = combat.combatants.find((x) => x.id === id)
  if (!c) throw new Error(`unknown combatant: ${id}`)
  return c
}

export function isActive(c: Combatant): boolean {
  return c.hp > 0 && !c.fled
}

export function currentActor(combat: CombatState): Combatant | null {
  if (combat.status !== 'ongoing') return null
  const id = combat.order[combat.turn]
  return id ? combatant(combat, id) : null
}

export function validTargets(combat: CombatState, actorId: string, skill?: SkillDef): Combatant[] {
  const actor = combatant(combat, actorId)
  const foes = combat.combatants.filter((c) => c.side !== actor.side && isActive(c))
  const allies = combat.combatants.filter((c) => c.side === actor.side && isActive(c))
  switch (skill?.target ?? 'enemy') {
    case 'enemy': return foes
    case 'ally': return allies
    default: return []
  }
}

export function usableSkills(combat: CombatState, actorId: string): SkillDef[] {
  const actor = combatant(combat, actorId)
  return actor.skills.map((id) => skills[id]).filter((s): s is SkillDef => !!s && s.mp <= actor.mp)
}

// ---- 行動 ----

/** 玩家為目前行動的隊員選擇行動，結算後自動進行敵人回合，直到下一位隊員或戰鬥結束。 */
export function act(state: GameState, action: CombatAction): CombatState {
  const combat = state.combat
  if (!combat || combat.status !== 'ongoing') throw new Error('目前沒有進行中的戰鬥')
  const actor = currentActor(combat)
  if (!actor || actor.side !== 'party') throw new Error('現在不是隊員的回合')
  withRng(state, (rng) => {
    resolve(combat, actor, action, rng)
    endTurn(combat, rng)
    runEnemyTurns(combat, rng)
  })
  return combat
}

function runEnemyTurns(combat: CombatState, rng: Rng) {
  let guard = 0
  while (combat.status === 'ongoing' && guard++ < 200) {
    const actor = currentActor(combat)
    if (!actor || actor.side === 'party') return
    resolve(combat, actor, enemyChoice(combat, actor, rng), rng)
    endTurn(combat, rng)
  }
}

function enemyChoice(combat: CombatState, actor: Combatant, rng: Rng): CombatAction {
  if (actor.hp <= actor.maxHp / 4 && rng.chance(0.25)) return { type: 'flee' }
  const targets = validTargets(combat, actor.id)
  const target = rng.pick(targets)
  const skill = actor.skills.map((s) => skills[s]).find((s) => s && s.mp <= actor.mp)
  if (skill && rng.chance(0.4)) return { type: 'skill', skill: skill.id, target: target.id }
  return { type: 'attack', target: target.id }
}

function push(combat: CombatState, entry: Omit<TimelineEntry, 'seq' | 'round'>) {
  combat.timeline.push({ seq: combat.timeline.length + 1, round: combat.round, ...entry })
}

function statusOf(c: Combatant, name: string) {
  return c.statuses.find((s) => s.name === name)
}

function addStatus(c: Combatant, name: string, turns: number) {
  const existing = statusOf(c, name)
  if (existing) existing.turns = Math.max(existing.turns, turns)
  else c.statuses.push({ name, turns })
}

function effectiveAc(c: Combatant): number {
  let ac = c.ac
  for (const s of c.statuses) ac += (statuses[s.name]?.ac_bonus ?? 0) - (statuses[s.name]?.ac_penalty ?? 0)
  return ac
}

function attackMod(c: Combatant): number {
  return c.statuses.reduce((sum, s) => sum + (statuses[s.name]?.attack_bonus ?? 0), 0)
}

function dealDamage(combat: CombatState, target: Combatant, amount: number, effects: Effect[], element?: string) {
  target.hp = Math.max(0, target.hp - amount)
  effects.push({ type: 'damage', target: target.id, amount, ...(element ? { element } : {}) })
  if (target.hp === 0) {
    effects.push({ type: 'status_add', target: target.id, status: target.side === 'enemy' ? '死亡' : '倒下' })
    if (target.side === 'party') noteAffinity(combat, target.id, -1, '在戰鬥中倒下')
  }
}

function noteAffinity(combat: CombatState, id: string, delta: number, reason: string) {
  if (id === 'pc') return
  const a = (combat.affinity[id] ??= { delta: 0, reasons: [] })
  a.delta += delta
  if (!a.reasons.includes(reason)) a.reasons.push(reason)
}

function attackRoll(
  combat: CombatState, rng: Rng, actor: Combatant, target: Combatant, action: string,
  opts: { mult?: number; hitMod?: number; bonusDice?: string; status?: string; turns?: number },
) {
  const bonus = actor.attack + attackMod(actor) + (opts.hitMod ?? 0)
  const dice = withBonus('1d20', bonus)
  const r = roll(rng, dice)
  const natural = r.rolls[0]!
  const dc = effectiveAc(target)
  const critical = natural === 20
  const hit = critical || (natural !== 1 && r.total >= dc)
  const result: RollResult = critical ? 'critical' : natural === 1 ? 'fumble' : hit ? 'success' : 'fail'
  const effects: Effect[] = []
  if (hit) {
    let dmg = Math.max(1, Math.floor(roll(rng, actor.damage, critical).total * (opts.mult ?? 1)))
    if (opts.bonusDice) dmg += roll(rng, opts.bonusDice, critical).total
    dealDamage(combat, target, dmg, effects)
    if (opts.status && target.hp > 0) {
      addStatus(target, opts.status, opts.turns ?? 1)
      effects.push({ type: 'status_add', target: target.id, status: opts.status })
    }
  }
  push(combat, { actor: actor.id, action, target: target.id, roll: { dice, value: r.total, dc }, result, effects })
}

function resolve(combat: CombatState, actor: Combatant, action: CombatAction, rng: Rng) {
  switch (action.type) {
    case 'attack': {
      attackRoll(combat, rng, actor, combatant(combat, action.target), '攻擊', {})
      break
    }
    case 'defend': {
      addStatus(actor, '防禦', 1)
      push(combat, { actor: actor.id, action: '防禦', result: 'none', effects: [{ type: 'status_add', target: actor.id, status: '防禦' }] })
      break
    }
    case 'flee': {
      const dice = withBonus('1d20', proficiency(actor.level))
      const r = roll(rng, dice)
      const ok = r.total >= combatRules.flee_dc
      push(combat, {
        actor: actor.id, action: '撤退', roll: { dice, value: r.total, dc: combatRules.flee_dc },
        result: ok ? 'success' : 'fail',
        effects: ok ? [{ type: 'move', target: actor.id, text: actor.side === 'party' ? '全隊脫離戰鬥' : '逃離戰場' }] : [],
      })
      if (ok) {
        if (actor.side === 'party') combat.status = 'fled'
        else actor.fled = true
      }
      break
    }
    case 'skill': {
      const skill = skills[action.skill]
      if (!skill || !actor.skills.includes(skill.id)) throw new Error(`無法使用技能 ${action.skill}`)
      if (skill.mp > actor.mp) throw new Error('魔力不足')
      actor.mp -= skill.mp
      useSkill(combat, rng, actor, skill, action.target)
      break
    }
  }
  checkEnd(combat)
}

function useSkill(combat: CombatState, rng: Rng, actor: Combatant, skill: SkillDef, targetId?: string) {
  const e = skill.effect
  const pickTarget = () => {
    if (skill.target === 'self') return actor
    const target = targetId ? combatant(combat, targetId) : validTargets(combat, actor.id, skill)[0]
    if (!target || !isActive(target)) throw new Error('無效的目標')
    return target
  }
  const groupTargets = () =>
    combat.combatants.filter((c) => isActive(c) && (skill.target === 'all_allies' ? c.side === actor.side : c.side !== actor.side))

  switch (e.kind) {
    case 'attack': {
      const target = pickTarget()
      for (let i = 0; i < (e.hits ?? 1) && isActive(target); i++) {
        attackRoll(combat, rng, actor, target, skill.name, {
          mult: e.damage_mult, hitMod: e.hit_mod, bonusDice: e.bonus_dice, status: e.status, turns: e.turns,
        })
      }
      if (e.self_status) addStatus(actor, e.self_status, statuses[e.self_status]?.turns ?? 1)
      return
    }
    case 'damage': {
      const targets = skill.target === 'all_enemies' ? groupTargets() : [pickTarget()]
      const effects: Effect[] = []
      for (const t of targets) {
        const dmg = Math.max(1, roll(rng, e.dice!).total + (e.add_level ? actor.level : 0))
        dealDamage(combat, t, dmg, effects, e.element)
        if (e.status && t.hp > 0) {
          addStatus(t, e.status, e.turns ?? 1)
          effects.push({ type: 'status_add', target: t.id, status: e.status })
        }
      }
      push(combat, { actor: actor.id, action: skill.name, ...(targets.length === 1 ? { target: targets[0]!.id } : {}), result: 'success', effects })
      return
    }
    case 'heal': {
      const target = pickTarget()
      const amount = Math.min(target.maxHp - target.hp, roll(rng, e.dice!).total + (e.add_level ? actor.level : 0))
      target.hp += amount
      if (actor.id === 'pc' && target.id !== 'pc') noteAffinity(combat, target.id, 1, '主角在戰鬥中為其治療')
      push(combat, { actor: actor.id, action: skill.name, target: target.id, result: 'success', effects: [{ type: 'heal', target: target.id, amount }] })
      return
    }
    case 'buff': {
      const targets = skill.target === 'all_allies' ? groupTargets() : [pickTarget()]
      for (const t of targets) addStatus(t, e.status!, e.turns ?? 1)
      push(combat, {
        actor: actor.id, action: skill.name, result: 'success',
        effects: targets.map((t) => ({ type: 'status_add' as const, target: t.id, status: e.status! })),
      })
      return
    }
  }
}

function checkEnd(combat: CombatState) {
  if (combat.status !== 'ongoing') return
  const alive = (side: Combatant['side']) => combat.combatants.some((c) => c.side === side && isActive(c))
  if (!alive('enemy')) combat.status = 'victory'
  else if (!alive('party')) combat.status = 'defeat'
}

function endTurn(combat: CombatState, rng: Rng) {
  if (combat.status !== 'ongoing') return
  for (let guard = 0; guard < combat.order.length * 2; guard++) {
    combat.turn += 1
    if (combat.turn >= combat.order.length) {
      combat.turn = 0
      combat.round += 1
    }
    if (beginTurn(combat, rng)) return
    if (combat.status !== 'ongoing') return
  }
}

/** 處理回合開始的狀態效果；回傳這位角色本回合能否行動。 */
function beginTurn(combat: CombatState, rng: Rng): boolean {
  const actor = currentActor(combat)
  if (!actor || !isActive(actor)) return false
  let canAct = true
  for (const s of [...actor.statuses]) {
    const def = statuses[s.name]
    if (def?.dot) {
      const effects: Effect[] = []
      dealDamage(combat, actor, roll(rng, def.dot).total, effects)
      push(combat, { actor: actor.id, action: `${s.name}發作`, result: 'none', effects })
    }
    if (def?.skip_turn && actor.hp > 0) {
      canAct = false
      push(combat, { actor: actor.id, action: `${s.name}・無法行動`, result: 'none' })
    }
    if (s.turns > 0) s.turns -= 1
  }
  actor.statuses = actor.statuses.filter((s) => s.turns !== 0)
  checkEnd(combat)
  return canAct && isActive(actor) && combat.status === 'ongoing'
}

// ---- 結束戰鬥與戰報 ----

/** 戰鬥結束後產生戰報、結算獎勵並清除戰鬥狀態。 */
export function finishCombat(state: GameState): Report {
  const combat = state.combat
  if (!combat || combat.status === 'ongoing') throw new Error('戰鬥尚未結束')
  const pc = player(state)
  const loc = locationById(combat.location)
  const foes = combat.combatants.filter((c) => c.side === 'enemy')
  const defeated = foes.filter((f) => f.hp === 0)
  const victory = combat.status === 'victory'

  const party: ActorState[] = state.party.map((member) => {
    const f = combat.combatants.find((c) => c.id === member.id)
    const before = { ...member, hp: combat.startHp[member.id] ?? member.hp, mp: combat.startMp[member.id] ?? member.mp }
    const after = { ...member, hp: f?.hp ?? member.hp, mp: f?.mp ?? member.mp }
    // 倒下的隊員在戰後被救起，以 1 HP 狀態歸隊（戰敗時是被路人所救）
    after.hp = Math.max(1, after.hp)
    const snap = snapshot(after, before, pc)
    snap.status = f ? f.statuses.map((s) => s.name).concat(f.hp === 0 ? ['倒下'] : []) : []
    return snap
  })

  const others: ActorState[] = foes.map((f) => ({
    id: f.id, name: f.name, level: f.level,
    hp: [combat.startHp[f.id] ?? f.maxHp, f.hp, f.maxHp],
    status: f.hp === 0 ? ['死亡'] : f.fled ? ['逃走'] : f.statuses.map((s) => s.name),
  }))

  let money = 0
  const items: ItemDelta[] = []
  const xpTotal = victory ? defeated.reduce((sum, f) => sum + (enemies[f.defId!]?.xp ?? 0), 0) : 0
  withRng(state, (rng) => {
    if (!victory) return
    for (const f of defeated) {
      const def = enemies[f.defId!]
      if (!def) continue
      if (def.money_cc) money += rng.int(def.money_cc[0], def.money_cc[1])
      for (const l of def.loot ?? []) {
        if (!rng.chance(l.chance)) continue
        const existing = items.find((i) => i.name === l.item)
        if (existing) existing.qty += 1
        else items.push({ name: l.item, qty: 1, owner: 'pc' })
      }
    }
  })
  if (combat.status === 'defeat') money = -Math.floor(state.money_cc * 0.1)

  for (const member of state.party) {
    if (member.isPlayer) continue
    if (victory) noteAffinity(combat, member.id, 2, '並肩作戰獲勝')
  }
  const affinity = Object.entries(combat.affinity)
    .map(([npc, a]) => {
      const m = state.party.find((p) => p.id === npc)
      if (!m || m.affinity === undefined || a.delta === 0) return null
      const after = Math.max(-100, Math.min(100, m.affinity + a.delta))
      return { npc, delta: after - m.affinity, after, reason: a.reasons.join('、') }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const share = state.party.length > 0 ? Math.floor(xpTotal / state.party.length) : 0
  const quest = victory ? advanceQuest(state, combat) : undefined
  const resultName = { victory: '勝利', defeat: '戰敗', fled: '撤退', ongoing: '' }[combat.status]
  const end = addHours(combat.startTime, (combat.round * COMBAT_MINUTES_PER_ROUND) / 60)

  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'combat',
    time: { start: combat.startTime, end },
    location: { at: combat.location, region: loc.region, scene: combat.scene ?? loc.name },
    party,
    others,
    ...(quest ? { quest } : {}),
    timeline: combat.timeline,
    outcome: {
      result: combat.status,
      summary: `在${combat.scene ?? loc.name}與${foes.map((f) => f.name).join('、')}交戰，${resultName}（${combat.round} 回合）。`,
      tags: tagsFor(combat),
    },
    changes: {
      ...(money ? { money_cc: money } : {}),
      ...(share > 0 ? { xp: state.party.map((m) => ({ actor: m.id, amount: share })) } : {}),
      ...(items.length ? { items_gained: items } : {}),
      ...(affinity.length ? { affinity } : {}),
    },
    narration: {
      pov: 'second_person', length: 'medium',
      ...(combat.intent ? { player_intent: combat.intent } : {}),
    },
    lore_keys: [loc.name, regionById(loc.region).name, ...new Set(foes.map((f) => enemies[f.defId!]?.name ?? f.name))],
  }
  delete state.combat
  return commitReport(state, report)
}

function tagsFor(combat: CombatState): string[] {
  const tags = new Set<string>()
  for (const t of combat.timeline) {
    if (t.result === 'critical') tags.add('爆擊')
    if (t.result === 'fumble') tags.add('大失敗')
    if (t.effects?.some((e) => e.status === '倒下')) tags.add('隊員倒下')
    if (t.effects?.some((e) => e.type === 'move' && t.actor.startsWith('e'))) tags.add('敵人逃走')
  }
  return [...tags]
}

function advanceQuest(state: GameState, combat: CombatState): Report['quest'] | undefined {
  const quest = combat.questId
    ? state.quests.find((q) => q.id === combat.questId && q.status === 'accepted')
    : state.quests.find((q) => q.status === 'accepted' && q.kind === 'clear_dungeon' && q.target === combat.location)
  if (!quest) return undefined
  quest.progress += 1
  if (quest.progress >= quest.goal) quest.status = 'ready'
  return { id: quest.id, title: quest.title, rank: quest.rank, status: 'progress' }
}
