// 逐回合戰鬥。規則說明見 docs/COMBAT_SYSTEM.md，數值在 data/rules/。
//
// - 每位角色有行動點（AP）。輪到自己時可以連續行動直到 AP 用完或選擇結束回合；剩下的 AP 累積到下回合。
// - 武器攻擊與技能花 AP；法術花 AP 與一個法術環；戲法不花 AP 但每回合限一次。
// - 命中：命中骰（1d20 + 熟練 + 屬性）對上目標的迴避骰（1d20，靈巧提高下限）。
// - 幸運一擊：命中骰的自然骰 ≥ 閾值（靈巧、魅力越高越低）時必中且傷害骰加倍。
// - 傷害 = 擲骰 × 攻擊加成 × 受傷倍率（各屬性以 1 為基礎值），物理傷害再扣防具減傷。
//
// 戰鬥狀態存在 GameState.combat，可隨存檔保存；結束後由 finishCombat 產生戰報。

import {
  apMaxFor, apRegenFor, castingAttr, evadeFloor, gearAffinities, luckyThreshold, mod, proficiency,
  slotMaxFor, slotsLeft, snapshot, weaponFor,
} from './character'
import {
  abilityDef, armorDef, classDef, combatRules, companionRules, contractDef, damageType, damageTypeName, damageTypes, dungeonEncounters, enemies, itemDef,
  locationById, monsterTraits, population, regionById, statusDef, wildEncounters, type EnemyDef,
  type AbilityDef, type AffinityMap, type ApplyDef, type AttrId, type Attrs, type DamagePart, type EncounterGroup,
  type ItemDef, type LuckRoll, type Mods, type MonsterAi, type WeaponDef,
} from './data'
import { characterFor, npcRecord, registerNpc, weightedPick } from './npcs'
import { safeText } from './content'
import { gearBonuses, gearRules, randomGear, registerGear } from './gear'
import { rollDefeatEvent } from './defeat'
import { addCondition, isNoncombatant } from './party'
import { contractTerms } from './slavery'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type {
  ActorState, Character, Effect, GameState, GameTime, ItemDelta, NpcRecord, Report, RollResult, TimelineEntry,
} from './types'

export interface StatusInstance {
  id: string
  /** 剩餘回合，在擁有者回合開始時 -1 */
  turns: number
  charges?: number
  /** 狀態的數值（例如偏轉可減去的傷害） */
  value?: number
  /** 施加者 */
  source: string
  /** 專注法術的標記：`${施法者}:${能力}` */
  conc?: string
}

export interface Combatant {
  id: string
  name: string
  side: 'party' | 'enemy'
  level: number
  attrs: Attrs
  prof: number
  hp: number
  maxHp: number
  tempHp: number
  ap: number
  apMax: number
  apRegen: number
  /** 剩餘法術環（索引 0 = 1 環） */
  slots: number[]
  /** 法術環上限 */
  slotMax: number[]
  abilities: string[]
  weapon: WeaponDef
  armorEvade: number
  armorDr: number
  resist: AffinityMap
  offense: AffinityMap
  baseMods: Mods
  castingAttr: AttrId
  statuses: StatusInstance[]
  initiative: number
  usedTurn: Record<string, number>
  usedCombat: Record<string, number>
  usedRest: Record<string, number>
  /** 正在維持專注的能力 */
  concentration?: string
  fled?: boolean
  /** 敵人的資料 id */
  defId?: string
  /** 敵對的 NPC（冒險者）的 id */
  npcId?: string
  /** 仇恨值：越高越容易被敵人選為目標（見 combat.json 的 threat） */
  threat: number
  /** 仇恨累積倍率的固定部分：職業 × (1 + 防具 + 武器)；天賦與狀態的 mods.threat 在累積時另外算 */
  threatMult: number
  /** 怪物的特徵與狀態（monster_traits.json） */
  traits?: string[]
  /** 戰鬥行為（特徵合成） */
  ai?: MonsterAi
  /** 經驗倍率（特徵） */
  xpMult?: number
}

export type CombatAction =
  | { type: 'attack'; target: string }
  | { type: 'ability'; ability: string; target?: string }
  | { type: 'defend' }
  | { type: 'flee' }
  | { type: 'end_turn' }
  /** 使用行囊裡的道具（藥劑等），目標是隊友（可以救起倒下的隊友） */
  | { type: 'item'; item: string; target: string }

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
  affinity: Record<string, { delta: number; reasons: string[] }>
  /** 戰鬥中用掉的道具：戰鬥結束時從行囊扣除（報告的 items_lost） */
  itemsUsed?: Record<string, number>
  intent?: string
  /** 由委託觸發的戰鬥；獲勝時推進這個委託 */
  questId?: string
  /** 細部場景，例如「索里耶爾近郊的農田」 */
  scene?: string
  /** 由格子觸發的戰鬥：獲勝時清除這一格 */
  cell?: { area: string; x: number; y: number }
}

export interface CombatOptions {
  intent?: string
  questId?: string
  scene?: string
  cell?: CombatState['cell']
  /** 和 NPC（冒險者）戰鬥：他們的 id */
  npcs?: string[]
  /** 先手：party = 主角偷襲成功，enemy = 對方先手 */
  surprise?: 'party' | 'enemy'
}

const COMBAT_MINUTES_PER_ROUND = 1
const CANTRIP_KEY = '__cantrip'

// ---- 開始戰鬥 ----

/** 冒險區域某一層的遭遇組合；沒有分層資料時退回荒野遭遇表。 */
export function encounterFor(locationId: string, rng: Rng, layer: 'outskirts' | 'shallow' | 'middle' | 'deep' = 'shallow'): EncounterGroup {
  const table = dungeonEncounters[locationId]?.[layer]
  if (table?.length) return rng.pick(table)
  return rng.pick(wildEncounters(locationById(locationId).region))
}

export function startCombat(state: GameState, group?: EncounterGroup, opts: CombatOptions = {}): CombatState {
  if (state.combat) throw new Error('戰鬥進行中')
  return withRng(state, (rng) => {
    const npcs = (opts.npcs ?? []).map((id) => npcRecord(state, id)).filter((r): r is NpcRecord => !!r)
    // 玩家刪掉的自建怪物（舊地圖上可能還有）略過
    const enemyGroup = (group ?? (npcs.length ? [] : encounterFor(state.location, rng))).filter(([id]) => !!enemies[id])
    // 無法戰鬥的隊員（普通人）不上場
    const fighters: Combatant[] = state.party.filter((c) => c.hp > 0 && !isNoncombatant(c)).map((c) => fromCharacter(c, rng))
    if (fighters.length === 0) throw new Error('隊伍沒有能戰鬥的成員')
    const counts: Record<string, number> = {}
    for (const [id, n] of enemyGroup) counts[id] = (counts[id] ?? 0) + n
    const seen: Record<string, number> = {}
    const bonus = traitBonus(state, opts)
    let idx = 1
    for (const [defId, n] of enemyGroup) {
      for (let i = 0; i < n; i++) {
        seen[defId] = (seen[defId] ?? 0) + 1
        const suffix = counts[defId]! > 1 ? ` ${String.fromCharCode(64 + seen[defId]!)}` : ''
        fighters.push(fromEnemy(`e${idx++}`, defId, suffix, rng, bonus))
      }
    }
    for (const rec of npcs) {
      fighters.push({ ...fromCharacter(characterFor(state, rec), rng), side: 'enemy', npcId: rec.id })
    }
    // 先手：被偷襲的一方排在最後
    if (opts.surprise) for (const f of fighters) if (f.side !== opts.surprise) f.initiative -= 100
    const order = [...fighters]
      .sort((a, b) => b.initiative - a.initiative || (a.side === 'party' ? -1 : 1))
      .map((f) => f.id)
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
      affinity: {},
      ...(opts.intent ? { intent: opts.intent } : {}),
      ...(opts.questId ? { questId: opts.questId } : {}),
      ...(opts.scene ? { scene: opts.scene } : {}),
      ...(opts.cell ? { cell: opts.cell } : {}),
    }
    state.combat = combat
    if (!beginTurn(combat, rng)) endTurn(combat, rng)
    runEnemyTurns(combat, rng)
    return combat
  })
}

function spellCap(c: Character): number {
  const cap = c.contract ? contractTerms(c.contract).spell_cap : undefined
  return cap ?? 9
}

function fromCharacter(c: Character, rng: Rng): Combatant {
  const gear = gearAffinities(c)
  const armor = armorDef(c.armor)
  const apMax = apMaxFor(c.level, c.attrs)
  const cls = classDef(c.class).threat ?? { start: 0, mult: 1 }
  // 防具與武器的類型、其他裝備（盾牌等）的仇恨加減
  const threatMult = cls.mult * (1 + (armor.threat ?? 0) + (weaponFor(c).threat ?? 0) + gearBonuses(c).threat)
  return {
    threat: Math.round(cls.start * threatMult * (1 + (gear.mods.threat ?? 0))), threatMult,
    id: c.id, name: c.name, side: 'party', level: c.level, attrs: { ...c.attrs }, prof: proficiency(c.level),
    hp: c.hp, maxHp: c.maxHp, tempHp: 0,
    ap: apMax, apMax, apRegen: apRegenFor(c.level),
    // 魔導束縛契約：只能施放 spell_cap 環以下的法術
    slots: slotsLeft(c).slice(0, spellCap(c)),
    slotMax: slotMaxFor(c.class, c.level, c.attrs).slice(0, spellCap(c)),
    abilities: [...c.abilities],
    weapon: weaponFor(c), armorEvade: armor.evade, armorDr: armor.dr,
    resist: gear.resist, offense: gear.offense, baseMods: gear.mods,
    castingAttr: castingAttr(c.class),
    statuses: [],
    initiative: roll(rng, '1d20').total + mod(c.attrs.dex),
    usedTurn: {}, usedCombat: {}, usedRest: { ...c.usesPerRest },
  }
}

function fromEnemy(id: string, defId: string, suffix: string, rng: Rng, bonus = 0): Combatant {
  const def = enemies[defId]
  if (!def) throw new Error(`unknown enemy: ${defId}`)
  const c: Combatant = {
    id, name: def.name + suffix, side: 'enemy', level: def.level, attrs: { ...def.attrs }, prof: proficiency(def.level),
    hp: def.hp, maxHp: def.hp, tempHp: 0,
    ap: def.ap, apMax: def.ap, apRegen: combatRules.ap.regen,
    slots: [], slotMax: [], abilities: [...(def.abilities ?? [])],
    weapon: { name: '攻擊', ...def.weapon }, armorEvade: def.evade, armorDr: def.dr,
    resist: { ...(def.resist ?? {}) }, offense: { ...(def.offense ?? {}) }, baseMods: {},
    castingAttr: 'fai',
    statuses: [],
    initiative: roll(rng, '1d20').total + mod(def.attrs.dex),
    usedTurn: {}, usedCombat: {}, usedRest: {},
    defId, threat: 0, threatMult: 1,
  }
  applyTraits(c, rollTraits(rng, def, bonus))
  return c
}

// ---- 怪物的特徵與狀態 ----

/** 開戰的位置讓特徵比較容易出現：冒險區域越深越容易，層主最容易 */
function traitBonus(state: GameState, opts: CombatOptions): number {
  const b = monsterTraits.roll.bonus
  const p = state.position
  const area = p ? state.areas?.[p.area] : undefined
  if (!area) return b.wild ?? 0
  const cell = opts.cell ? area.cells[opts.cell.y * area.width + opts.cell.x] : undefined
  if (cell?.kind === 'boss') return b.boss ?? 0
  if (area.kind === 'dungeon') return b[(['outskirts', 'shallow', 'middle', 'deep'] as const)[area.layer ?? 0] ?? 'deep'] ?? 0
  return b.wild ?? 0
}

/** 擲出怪物的特徵：資料上固定的特徵，加上 0～max 個隨機特徵（互斥的不會同時出現；發情要怪物有 rut 旗標） */
export function rollTraits(rng: Rng, def: Pick<EnemyDef, 'traits' | 'rut'>, bonus = 0): string[] {
  const r = monsterTraits.roll
  const out = [...(def.traits ?? [])]
  for (let i = 0; i < r.max; i++) {
    if (!rng.chance(r.chance + bonus)) break
    const pool = Object.entries(monsterTraits.traits).filter(([id, t]) =>
      !out.includes(id)
      && !(t.excludes ?? []).some((x) => out.includes(x))
      && !out.some((o) => monsterTraits.traits[o]?.excludes?.includes(id))
      && (!t.requires || !!def[t.requires]))
    if (!pool.length) break
    out.push(weightedPick(rng, Object.fromEntries(pool.map(([id, t]) => [id, t.weight]))))
  }
  return out
}

/** 把特徵套到戰鬥中的怪物上：能力值、行為與名稱 */
export function applyTraits(c: Combatant, traits: string[]) {
  if (!traits.length) return
  const ai: MonsterAi = { ...(c.ai ?? {}) }
  let hpRatio = 1
  for (const id of traits) {
    const t = monsterTraits.traits[id]
    if (!t) continue
    if (t.hp_mult) c.maxHp = Math.max(1, Math.round(c.maxHp * t.hp_mult))
    if (t.hp_ratio) hpRatio = Math.min(hpRatio, t.hp_ratio)
    for (const [k, v] of Object.entries(t.mods ?? {})) c.baseMods[k as keyof Mods] = (c.baseMods[k as keyof Mods] ?? 0) + (v ?? 0)
    if (t.ap) {
      c.apMax += t.ap
      c.ap += t.ap
    }
    if (t.initiative) c.initiative += t.initiative
    for (const [k, v] of Object.entries(t.resist ?? {})) c.resist[k] = (c.resist[k] ?? 0) + (v ?? 0)
    for (const [k, v] of Object.entries(t.offense ?? {})) c.offense[k] = (c.offense[k] ?? 0) + (v ?? 0)
    if (t.xp_mult) c.xpMult = (c.xpMult ?? 1) * t.xp_mult
    if (t.ai?.focus !== undefined) ai.focus = (ai.focus ?? 1) * t.ai.focus
    if (t.ai?.prefer) ai.prefer = t.ai.prefer
    if (t.ai?.flee_below) ai.flee_below = Math.max(ai.flee_below ?? 0, t.ai.flee_below)
    if (t.ai?.never_flee) ai.never_flee = true
  }
  if (ai.never_flee) delete ai.flee_below
  c.hp = Math.max(1, Math.round(c.maxHp * hpRatio))
  c.ai = ai
  c.traits = traits
  c.name = `${traits.map((id) => safeText(monsterTraits.traits[id]?.name ?? id)).join('・')}的${c.name}`
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

function foesOf(combat: CombatState, c: Combatant) {
  return combat.combatants.filter((x) => x.side !== c.side && isActive(x))
}

function alliesOf(combat: CombatState, c: Combatant) {
  return combat.combatants.filter((x) => x.side === c.side && isActive(x))
}

export function abilityApCost(a: AbilityDef): number {
  if (a.ap !== undefined) return a.ap
  if (a.type === 'cantrip') return 0
  if (a.type === 'spell') return combatRules.action_costs.spell_by_circle[(a.circle ?? 1) - 1] ?? 3
  return combatRules.action_costs.weapon_attack
}

export function validTargets(combat: CombatState, actorId: string, a?: AbilityDef): Combatant[] {
  const actor = combatant(combat, actorId)
  switch (a?.target ?? 'enemy') {
    case 'enemy': return foesOf(combat, actor)
    case 'ally': return alliesOf(combat, actor)
    case 'ally_or_downed': return combat.combatants.filter((x) => x.side === actor.side && !x.fled)
    default: return []
  }
}

/** 能力無法使用的原因；可以使用時回傳 null。 */
export function unusableReason(combat: CombatState, actor: Combatant, abilityId: string): string | null {
  const a = abilityDef(abilityId)
  if (!actor.abilities.includes(a.id)) return '尚未學會'
  const control = controls(actor)
  if ((a.type === 'spell' || a.type === 'cantrip') && (control.has('silence') || control.has('no_cast'))) return '無法施法'
  if (a.type === 'cantrip' && actor.usedTurn[CANTRIP_KEY]) return '本回合已用過戲法'
  if (a.uses?.per_turn !== undefined && (actor.usedTurn[a.id] ?? 0) >= a.uses.per_turn) return '本回合已使用'
  if (a.uses?.per_combat !== undefined && (actor.usedCombat[a.id] ?? 0) >= a.uses.per_combat) return '本場戰鬥已使用'
  if (a.uses?.per_rest !== undefined && (actor.usedRest[a.id] ?? 0) >= a.uses.per_rest) return '需要休息'
  if (abilityApCost(a) > actor.ap) return '行動點不足'
  if (a.type === 'spell' && slotFor(actor, a.circle ?? 1) === null) return '沒有法術環'
  if (a.recover_slot && recoverableSlot(actor) === null) return '沒有可回復的法術環'
  if ((a.target === 'enemy' || a.target === 'all_enemies' || a.target === 'random_enemies') && foesOf(combat, actor).length === 0) return '沒有目標'
  return null
}

export function usableAbilities(combat: CombatState, actorId: string): AbilityDef[] {
  const actor = combatant(combat, actorId)
  return actor.abilities.map(abilityDef).filter((a) => unusableReason(combat, actor, a.id) === null)
}

function hasAnyAction(combat: CombatState, actor: Combatant): boolean {
  if (actor.ap >= combatRules.action_costs.defend) return true
  return usableAbilities(combat, actor.id).length > 0
}

/** 可用的最低法術環（≥ 指定環數）；沒有時回傳 null。 */
function slotFor(actor: Combatant, circle: number): number | null {
  for (let c = circle; c <= actor.slots.length; c++) if ((actor.slots[c - 1] ?? 0) > 0) return c
  return null
}

// ---- 狀態與修正 ----

function controls(c: Combatant): Set<string> {
  return new Set(c.statuses.map((s) => statusDef(s.id).control).filter((x): x is NonNullable<typeof x> => !!x))
}

function hasSpecial(c: Combatant, special: string) {
  return c.statuses.find((s) => statusDef(s.id).special === special)
}

function modsOf(c: Combatant): Required<Mods> {
  const total: Required<Mods> = { hit: 0, evade: 0, save: 0, damage: 0, dr: 0, ap_regen: 0, crit: 0, threat: 0 }
  const add = (m?: Mods) => {
    for (const [k, v] of Object.entries(m ?? {})) total[k as keyof Mods] += v ?? 0
  }
  add(c.baseMods)
  for (const s of c.statuses) add(statusDef(s.id).mods)
  return total
}

/** 擲骰的優勢、劣勢與幸運骰；回傳會被消耗的狀態，擲完後再扣次數。 */
function rollFactors(c: Combatant, kind: LuckRoll) {
  let adv = 0
  let dis = 0
  const luck: string[] = []
  const used: StatusInstance[] = []
  for (const s of c.statuses) {
    const def = statusDef(s.id)
    let touched = false
    if (def.advantage?.includes(kind)) { adv++; touched = true }
    if (def.disadvantage?.includes(kind)) { dis++; touched = true }
    if (def.luck && def.luck_on?.includes(kind)) { luck.push(def.luck); touched = true }
    if (touched && def.charges !== undefined) used.push(s)
  }
  return { adv, dis, luck, used }
}

function consume(c: Combatant, used: StatusInstance[]) {
  for (const s of used) {
    if (s.charges === undefined) continue
    s.charges -= 1
    if (s.charges <= 0) c.statuses = c.statuses.filter((x) => x !== s)
  }
}

function rollLuck(rng: Rng, luck: string[]): number {
  return luck.reduce((sum, l) => {
    const negative = l.startsWith('-')
    const value = roll(rng, negative ? l.slice(1) : l).total
    return sum + (negative ? -value : value)
  }, 0)
}

/** 擲 1d20：adv > 0 取高、< 0 取低。 */
function d20(rng: Rng, adv: number): number {
  const a = rng.int(1, 20)
  if (adv === 0) return a
  const b = rng.int(1, 20)
  return adv > 0 ? Math.max(a, b) : Math.min(a, b)
}

function affinity(map: AffinityMap, statusMaps: (AffinityMap | undefined)[], type: string): number {
  const group = damageType(type).group
  let sum = 0
  for (const m of [map, ...statusMaps]) {
    if (!m) continue
    sum += (m[type] ?? 0) + (m[group] ?? 0) + (m.all ?? 0)
  }
  return sum
}

export function offenseMult(c: Combatant, type: string): number {
  return Math.max(0, 1 + affinity(c.offense, c.statuses.map((s) => statusDef(s.id).offense), type))
}

export function defenseMult(c: Combatant, type: string): number {
  return Math.max(0, 1 + affinity(c.resist, c.statuses.map((s) => statusDef(s.id).resist), type))
}

export function multLabel(m: number): string {
  return damageTypes.labels.find((l) => m <= l.max)?.name ?? ''
}

function addStatus(c: Combatant, inst: StatusInstance) {
  const existing = c.statuses.find((s) => s.id === inst.id)
  if (existing) {
    existing.turns = Math.max(existing.turns, inst.turns)
    if (inst.charges !== undefined) existing.charges = inst.charges
    if (inst.value !== undefined) existing.value = inst.value
    existing.source = inst.source
    if (inst.conc) existing.conc = inst.conc
    else delete existing.conc
  } else {
    c.statuses.push(inst)
  }
}

function dropConcentration(combat: CombatState, caster: Combatant, effects?: Effect[]) {
  if (!caster.concentration) return
  const tag = `${caster.id}:${caster.concentration}`
  for (const c of combat.combatants) {
    const before = c.statuses.length
    c.statuses = c.statuses.filter((s) => s.conc !== tag)
    if (effects && c.statuses.length < before) effects.push({ type: 'status_remove', target: c.id, text: '專注中斷' })
  }
  delete caster.concentration
}

// ---- 行動 ----

/** 玩家為目前行動的隊員選擇行動。行動後若沒有可做的事會自動結束回合，並進行敵人回合。 */
export function act(state: GameState, action: CombatAction): CombatState {
  const combat = state.combat
  if (!combat || combat.status !== 'ongoing') throw new Error('目前沒有進行中的戰鬥')
  const actor = currentActor(combat)
  if (!actor || actor.side !== 'party') throw new Error('現在不是隊員的回合')
  if (action.type === 'item' && combatItems(state).every((i) => i.name !== action.item)) throw new Error(`沒有${action.item}了`)
  withRng(state, (rng) => {
    if (action.type === 'end_turn') {
      endTurn(combat, rng)
    } else {
      if (action.type === 'item') useItem(combat, rng, actor, action.item, action.target)
      else perform(combat, actor, action, rng)
      checkEnd(combat)
      if (combat.status === 'ongoing' && (!isActive(actor) || !hasAnyAction(combat, actor) || action.type === 'flee')) {
        endTurn(combat, rng)
      }
    }
    runEnemyTurns(combat, rng)
  })
  return combat
}

function perform(combat: CombatState, actor: Combatant, action: CombatAction, rng: Rng) {
  const costs = combatRules.action_costs
  switch (action.type) {
    case 'attack': {
      if (actor.ap < costs.weapon_attack) throw new Error('行動點不足')
      actor.ap -= costs.weapon_attack
      const target = combatant(combat, action.target)
      weaponAttack(combat, rng, actor, target, actor.weapon.name || '攻擊')
      return
    }
    case 'defend': {
      if (actor.ap < costs.defend) throw new Error('行動點不足')
      actor.ap -= costs.defend
      addStatus(actor, { id: 'defending', turns: 1, source: actor.id })
      push(combat, { actor: actor.id, action: '防禦', result: 'none', effects: [{ type: 'status_add', target: actor.id, status: '防禦' }] })
      return
    }
    case 'flee': {
      if (actor.ap < costs.flee) throw new Error('行動點不足')
      actor.ap -= costs.flee
      const dice = withBonus('1d20', proficiency(actor.level) + mod(actor.attrs.dex))
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
      return
    }
    case 'ability': {
      const reason = unusableReason(combat, actor, action.ability)
      if (reason) throw new Error(reason)
      useAbility(combat, rng, actor, abilityDef(action.ability), action.target)
      return
    }
  }
}

// ---- 道具 ----

/** 戰鬥中可以用的道具（行囊數量扣掉這場已用掉的） */
export function combatItems(state: GameState): { name: string; qty: number; def: ItemDef }[] {
  const used = state.combat?.itemsUsed ?? {}
  return state.inventory
    .map((i) => ({ name: i.name, qty: i.qty - (used[i.name] ?? 0), def: itemDef(i.name)! }))
    .filter((i) => i.qty > 0 && i.def?.use)
}

/** 道具是對敵人用的（投擲傷害或施加負面狀態） */
export function itemHitsEnemies(use: ItemDef['use']): boolean {
  return !!use?.damage || !!use?.apply
}

/**
 * 道具的目標：治療類可以給倒下的隊友，回復法術環的要有用掉的法術環，復甦只能給倒下的隊友，
 * 解除狀態要身上有那些狀態；投擲類以敵人為目標（範圍為全體時選任何一個敵人都會波及全部）。
 */
export function itemTargets(combat: CombatState, name: string): Combatant[] {
  const use = itemDef(name)?.use
  if (!use) return []
  if (use.escape) return combat.combatants.filter((c) => c.side === 'party' && isActive(c))
  if (itemHitsEnemies(use)) return combat.combatants.filter((c) => c.side === 'enemy' && isActive(c))
  const allies = combat.combatants.filter((c) => c.side === 'party' && !c.fled)
  if (use.revive) return allies.filter((c) => c.hp === 0)
  if (use.heal) return allies.filter((c) => c.hp < c.maxHp)
  if (use.slot) return allies.filter((c) => isActive(c) && restorableCircle(c, use.slot!) !== null)
  if (use.cleanse && !use.status && !use.temp_hp && !use.ap) return allies.filter((c) => isActive(c) && c.statuses.some((x) => use.cleanse!.includes(x.id)))
  if (use.status || use.temp_hp || use.ap || use.cleanse) return allies.filter(isActive)
  return []
}

function restorableCircle(c: Combatant, maxCircle: number): number | null {
  for (let i = Math.min(maxCircle, c.slotMax.length) - 1; i >= 0; i--) if ((c.slots[i] ?? 0) < (c.slotMax[i] ?? 0)) return i
  return null
}

function useItem(combat: CombatState, rng: Rng, actor: Combatant, name: string, targetId: string) {
  const cost = combatRules.action_costs.item
  if (actor.ap < cost) throw new Error('行動點不足')
  const use = itemDef(name)?.use
  const target = itemTargets(combat, name).find((t) => t.id === targetId)
  if (!use || !target) throw new Error('不能對這個目標使用')
  actor.ap -= cost
  const effects: Effect[] = []
  if (use.escape) {
    combat.status = 'fled'
    effects.push({ type: 'move', target: actor.id, text: '全隊被傳送出戰場' })
  } else if (itemHitsEnemies(use)) {
    // 投擲：傷害與狀態；範圍為全體時波及所有敵人。傷害骰只擲一次
    const hit = use.area === 'all' ? combat.combatants.filter((c) => c.side === 'enemy' && isActive(c)) : [target]
    const dmg = use.damage ? rollDice(rng, use.damage.dice, 1) : 0
    for (const t of hit) {
      let saved = false
      const save = use.save ?? (use.apply?.save && use.apply.dc ? { attr: use.apply.save, dc: use.apply.dc } : undefined)
      if (save) saved = savingThrow(rng, t, save.attr, save.dc).success
      if (use.damage) dealDamage(combat, rng, null, t, [{ amount: dmg, type: use.damage.type, weapon: false }], effects, { half: saved })
      if (use.apply && !saved && isActive(t)) {
        addStatus(t, { id: use.apply.status, turns: use.apply.turns, source: actor.id })
        effects.push({ type: 'status_add', target: t.id, status: statusDef(use.apply.status).name })
      } else if (saved) {
        effects.push({ type: 'note', target: t.id, text: '豁免成功' })
      }
    }
  } else {
    if (use.revive && target.hp === 0) heal(target, Math.max(1, Math.round(target.maxHp * use.revive)), effects)
    if (use.heal) heal(target, roll(rng, use.heal).total, effects)
    if (use.slot) {
      const i = restorableCircle(target, use.slot)!
      target.slots[i] = (target.slots[i] ?? 0) + 1
      effects.push({ type: 'note', target: target.id, text: `回復一個 ${i + 1} 環法術環` })
    }
    if (use.cleanse) {
      const removed = target.statuses.filter((x) => use.cleanse!.includes(x.id))
      target.statuses = target.statuses.filter((x) => !use.cleanse!.includes(x.id))
      for (const x of removed) effects.push({ type: 'status_remove', target: target.id, status: statusDef(x.id).name })
    }
    if (use.status) {
      addStatus(target, { id: use.status.id, turns: use.status.turns, source: actor.id })
      effects.push({ type: 'status_add', target: target.id, status: statusDef(use.status.id).name })
    }
    if (use.temp_hp) {
      target.tempHp = Math.max(target.tempHp, use.temp_hp)
      effects.push({ type: 'note', target: target.id, text: `暫時生命 ${use.temp_hp}` })
    }
    if (use.ap) {
      const before = target.ap
      target.ap = Math.min(target.apMax, target.ap + use.ap)
      effects.push({ type: 'note', target: target.id, text: `行動點 +${target.ap - before}` })
    }
  }
  combat.itemsUsed = { ...combat.itemsUsed, [name]: (combat.itemsUsed?.[name] ?? 0) + 1 }
  push(combat, { actor: actor.id, action: `使用${name}`, target: target.id, result: 'success', effects })
}

function push(combat: CombatState, entry: Omit<TimelineEntry, 'seq' | 'round'>) {
  combat.timeline.push({ seq: combat.timeline.length + 1, round: combat.round, ...entry })
  accrueThreat(combat, entry)
}

// ---- 仇恨值 ----

/** 這位角色的仇恨累積倍率：職業與裝備的固定部分，乘上天賦與狀態的加減 */
export function threatMultOf(c: Combatant): number {
  return Math.max(0, (c.threatMult ?? 1) * (1 + modsOf(c).threat))
}

/** 加減仇恨值：增加時乘上倍率，減少（隱匿等）直接扣，最低 0 */
export function addThreat(c: Combatant, amount: number) {
  c.threat = Math.max(0, (c.threat ?? 0) + (amount > 0 ? amount * threatMultOf(c) : amount))
}

/** 每筆行動依效果累積仇恨：對敵人的傷害、治療隊友、對別人施加狀態、防禦、沒命中、用道具 */
function accrueThreat(combat: CombatState, entry: Omit<TimelineEntry, 'seq' | 'round'>) {
  const actor = combat.combatants.find((c) => c.id === entry.actor)
  if (!actor) return
  const g = combatRules.threat.gains
  const sideOf = (id?: string) => combat.combatants.find((c) => c.id === id)?.side
  let gain = 0
  for (const e of entry.effects ?? []) {
    if (e.type === 'damage' && sideOf(e.target) && sideOf(e.target) !== actor.side) gain += (e.amount ?? 0) * g.damage
    if (e.type === 'heal' && e.target !== actor.id && sideOf(e.target) === actor.side) gain += (e.amount ?? 0) * g.heal
    if (e.type === 'status_add' && e.target !== actor.id && e.status !== '倒下') gain += g.status
  }
  if (entry.action === '防禦') gain += g.defend
  if (entry.result === 'fail' && entry.roll && !entry.effects?.some((e) => e.type === 'damage')) gain += g.miss
  if (entry.action.startsWith('使用')) gain += g.item
  if (gain > 0) addThreat(actor, gain)
}

/** 每回合結束，仇恨逐漸淡去 */
function decayThreat(combat: CombatState) {
  for (const c of combat.combatants) c.threat = Math.round((c.threat ?? 0) * combatRules.threat.decay * 10) / 10
}

/** 敵人選目標的權重：floor + 仇恨值（不是絕對的，只影響機率） */
export function targetWeight(c: Combatant): number {
  return combatRules.threat.floor + (c.threat ?? 0)
}

/**
 * 某個敵人眼中，這個目標的權重：floor + 仇恨 × 對仇恨的在意程度（特徵的 focus），
 * 再依偏好調整（飢餓、嗜血挑虛弱的；狡猾挑施法者）。
 */
export function targetWeightFor(actor: Combatant | undefined, c: Combatant): number {
  const ai = actor?.ai
  let w = combatRules.threat.floor + (c.threat ?? 0) * (ai?.focus ?? 1)
  if (ai?.prefer === 'weakest') w *= 1 + 2 * (1 - c.hp / Math.max(1, c.maxHp))
  if (ai?.prefer === 'caster' && c.slotMax.length > 0) w *= 2
  return Math.max(0.1, w)
}

/** 依仇恨值（與攻擊者的偏好）加權抽一個目標 */
export function pickByThreat(rng: Rng, foes: Combatant[], actor?: Combatant): Combatant {
  const total = foes.reduce((s, f) => s + targetWeightFor(actor, f), 0)
  let r = rng.next() * total
  for (const f of foes) {
    r -= targetWeightFor(actor, f)
    if (r < 0) return f
  }
  return foes[foes.length - 1]!
}

/** 在敵人眼中，每位隊員被選為目標的機率（給畫面顯示） */
export function threatShares(combat: CombatState): Record<string, number> {
  const party = combat.combatants.filter((c) => c.side === 'party' && isActive(c))
  const total = party.reduce((s, c) => s + targetWeight(c), 0)
  return Object.fromEntries(party.map((c) => [c.id, total ? targetWeight(c) / total : 0]))
}

function noteAffinity(combat: CombatState, id: string, delta: number, reason: string) {
  if (id === 'pc') return
  const a = (combat.affinity[id] ??= { delta: 0, reasons: [] })
  a.delta += delta
  if (!a.reasons.includes(reason)) a.reasons.push(reason)
}

// ---- 傷害 ----

interface DamageRoll { amount: number; type: string; weapon: boolean }

function parseDice(dice: string) {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(dice.replace(/\s+/g, ''))
  if (!m) throw new Error(`bad dice: ${dice}`)
  return { count: Number(m[1]) || 1, sides: Number(m[2]), flat: Number(m[3] ?? 0) }
}

function rollDice(rng: Rng, dice: string, multiplier: number): number {
  const { count, sides, flat } = parseDice(dice)
  let total = flat
  for (let i = 0; i < count * multiplier; i++) total += rng.int(1, sides)
  return total
}

function cantripTier(level: number): number {
  return 1 + combatRules.cantrip.scale_levels.filter((l) => level >= l).length
}

function attrFor(actor: Combatant, a?: AbilityDef): AttrId {
  if (!a?.attr) return actor.weapon.attr
  return a.attr === 'casting' ? actor.castingAttr : a.attr
}

function rollParts(rng: Rng, actor: Combatant, a: AbilityDef | undefined, parts: DamagePart[], lucky: boolean): DamageRoll[] {
  const diceMult = (lucky ? 2 : 1) * (a?.type === 'cantrip' ? cantripTier(actor.level) : 1)
  const attrMod = mod(actor.attrs[attrFor(actor, a)])
  const flatDamage = modsOf(actor).damage
  return parts.map((p) => {
    if (p.weapon) {
      const amount = rollDice(rng, actor.weapon.dice, diceMult) + mod(actor.attrs[actor.weapon.attr]) + flatDamage
      return { amount, type: actor.weapon.type, weapon: true }
    }
    let amount = rollDice(rng, p.dice ?? '1d4', diceMult)
    if (p.scale) {
      const extra = Math.floor((actor.level - 1) / p.scale.per)
      for (let i = 0; i < extra; i++) amount += rollDice(rng, p.scale.dice, lucky ? 2 : 1)
    }
    if (p.mod) amount += attrMod
    return { amount, type: p.type ?? actor.weapon.type, weapon: false }
  })
}

/**
 * 套用加成、減傷與特殊狀態後扣血。回傳實際造成的傷害。
 * mult 為技能倍率，half 為豁免成功減半。
 */
function dealDamage(
  combat: CombatState, rng: Rng, attacker: Combatant | null, target: Combatant, rolls: DamageRoll[],
  effects: Effect[], opts: { mult?: number; half?: boolean } = {},
): number {
  let physical = 0
  let other = 0
  for (const r of rolls) {
    const off = attacker ? offenseMult(attacker, r.type) : 1
    const def = defenseMult(target, r.type)
    let amount = Math.max(0, Math.floor(r.amount * (opts.mult ?? 1) * off * def))
    if (opts.half) amount = Math.floor(amount / 2)
    const isPhysical = damageType(r.type).group === 'physical'
    if (isPhysical) physical += amount
    else other += amount
    const m = off * def
    effects.push({
      type: 'damage', target: target.id, amount, element: damageTypeName(r.type),
      ...(Math.abs(m - 1) > 0.001 ? { text: `${multLabel(def) || '加成'} ×${Math.round(m * 100) / 100}` } : {}),
    })
  }
  const deflect = hasSpecial(target, 'reduce_next')
  if (deflect && physical > 0) {
    const reduced = Math.min(physical, deflect.value ?? 0)
    physical -= reduced
    consume(target, [deflect])
    effects.push({ type: 'note', target: target.id, text: `偏轉 -${reduced}` })
  }
  physical = Math.max(0, physical - target.armorDr)
  let total = Math.max(0, physical + other - modsOf(target).dr)
  const uncanny = hasSpecial(target, 'halve_next')
  if (uncanny && total > 0) {
    total = Math.floor(total / 2)
    consume(target, [uncanny])
    effects.push({ type: 'note', target: target.id, text: '閃避本能：傷害減半' })
  }
  applyHpLoss(combat, rng, target, total, effects)
  return total
}

function applyHpLoss(combat: CombatState, rng: Rng, target: Combatant, amount: number, effects: Effect[]) {
  if (amount <= 0) return
  const absorbed = Math.min(target.tempHp, amount)
  target.tempHp -= absorbed
  target.hp = Math.max(0, target.hp - (amount - absorbed))
  if (target.hp === 0) {
    const undying = hasSpecial(target, 'undying')
    if (undying) {
      target.hp = 1
      consume(target, [undying])
      effects.push({ type: 'note', target: target.id, text: '不倒：保留 1 HP' })
    } else {
      effects.push({ type: 'status_add', target: target.id, status: target.side === 'enemy' ? '死亡' : '倒下' })
      dropConcentration(combat, target, effects)
      if (target.side === 'party') noteAffinity(combat, target.id, -1, '在戰鬥中倒下')
      return
    }
  }
  if (target.concentration) {
    const dc = Math.max(combatRules.concentration.min_dc, Math.floor(amount / 2))
    const save = d20(rng, 0) + mod(target.attrs[combatRules.concentration.attr])
    if (save < dc) dropConcentration(combat, target, effects)
  }
}

function heal(target: Combatant, amount: number, effects: Effect[]) {
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + Math.max(0, amount))
  effects.push({ type: 'heal', target: target.id, amount: target.hp - before })
  if (before === 0 && target.hp > 0) effects.push({ type: 'status_remove', target: target.id, status: '倒下' })
}

// ---- 命中與豁免 ----

interface AttackResult { hit: boolean; lucky: boolean; result: RollResult; roll: TimelineEntry['roll'] }

function attackRoll(rng: Rng, actor: Combatant, target: Combatant, a?: AbilityDef): AttackResult {
  const atk = rollFactors(actor, 'attack')
  const tgt = target.statuses.map((s) => ({ s, def: statusDef(s.id) }))
  let adv = atk.adv - atk.dis + (a?.adv ? 1 : 0)
  const consumedOnTarget: StatusInstance[] = []
  for (const { s, def } of tgt) {
    if (def.attacked_advantage) { adv += 1; if (def.charges !== undefined) consumedOnTarget.push(s) }
    if (def.attacked_disadvantage) adv -= 1
  }
  const natural = d20(rng, Math.sign(adv))
  const mods = modsOf(actor)
  const bonus = actor.prof + mod(actor.attrs[attrFor(actor, a)]) + mods.hit + (a?.hit ?? 0)
  const total = natural + bonus + rollLuck(rng, atk.luck)
  consume(actor, atk.used)
  consume(target, consumedOnTarget)

  const lucky = natural >= luckyThreshold(actor.attrs, mods.crit + (a?.crit ?? 0))
  let evade: number
  if (controls(target).has('stun')) {
    evade = 0
  } else {
    const ev = rollFactors(target, 'evade')
    const evNatural = Math.max(evadeFloor(target.attrs), d20(rng, Math.sign(ev.adv - ev.dis)))
    evade = evNatural + Math.floor(mod(target.attrs.dex) / 2) + target.armorEvade + modsOf(target).evade + rollLuck(rng, ev.luck)
    consume(target, ev.used)
  }
  const hit = lucky || (natural !== 1 && total >= evade)
  const result: RollResult = lucky ? 'critical' : natural === 1 ? 'fumble' : hit ? 'success' : 'fail'
  return { hit, lucky, result, roll: { dice: withBonus('1d20', bonus), value: total, dc: evade } }
}

function saveDc(actor: Combatant, a: AbilityDef): number {
  return combatRules.save.dc_base + actor.prof + mod(actor.attrs[attrFor(actor, a)])
}

function savingThrow(rng: Rng, target: Combatant, attr: AttrId, dc: number) {
  const f = rollFactors(target, 'save')
  const natural = d20(rng, Math.sign(f.adv - f.dis))
  const bonus = mod(target.attrs[attr]) + modsOf(target).save
  const total = natural + bonus + rollLuck(rng, f.luck)
  consume(target, f.used)
  return { success: total >= dc, roll: { dice: withBonus('1d20', bonus), value: total, dc } }
}

// ---- 武器攻擊與能力 ----

/** 攻擊方狀態的命中附加效果（毒刃、聖戰斗篷等），回傳額外傷害。 */
function onHitExtras(actor: Combatant, target: Combatant, rng: Rng, effects: Effect[]): DamageRoll[] {
  const extra: DamageRoll[] = []
  const used: StatusInstance[] = []
  for (const s of actor.statuses) {
    const hit = statusDef(s.id).on_hit
    if (!hit) continue
    if (hit.dice && hit.type) extra.push({ amount: rollDice(rng, hit.dice, 1), type: hit.type, weapon: false })
    if (hit.status) {
      addStatus(target, { id: hit.status, turns: hit.turns ?? 1, source: actor.id })
      effects.push({ type: 'status_add', target: target.id, status: statusDef(hit.status).name })
    }
    if (statusDef(s.id).charges !== undefined) used.push(s)
  }
  consume(actor, used)
  return extra
}

function weaponAttack(combat: CombatState, rng: Rng, actor: Combatant, target: Combatant, action: string) {
  const r = attackRoll(rng, actor, target)
  const effects: Effect[] = []
  if (r.hit) {
    const rolls = rollParts(rng, actor, undefined, [{ weapon: true }], r.lucky)
    rolls.push(...onHitExtras(actor, target, rng, effects))
    dealDamage(combat, rng, actor, target, rolls, effects)
  }
  push(combat, { actor: actor.id, action, target: target.id, roll: r.roll, result: r.result, effects })
}

function pickTargets(combat: CombatState, rng: Rng, actor: Combatant, a: AbilityDef, targetId?: string): Combatant[] {
  switch (a.target) {
    case 'self': return [actor]
    case 'all_enemies': return foesOf(combat, actor)
    case 'all_allies': return alliesOf(combat, actor)
    case 'random_enemies': {
      const foes = foesOf(combat, actor)
      return Array.from({ length: a.count ?? 1 }, () => rng.pick(foes))
    }
    default: {
      const valid = validTargets(combat, actor.id, a)
      const target = targetId ? valid.find((t) => t.id === targetId) : valid[0]
      if (!target) throw new Error('無效的目標')
      return [target]
    }
  }
}

function applyValue(rng: Rng, actor: Combatant, a: AbilityDef, v?: ApplyDef['value']): number | undefined {
  if (!v) return undefined
  return (v.flat ?? 0) + (v.dice ? rollDice(rng, v.dice, 1) : 0) + (v.mod ? mod(actor.attrs[attrFor(actor, a)]) : 0) + (v.level ? actor.level : 0)
}

function applyStatuses(
  combat: CombatState, rng: Rng, actor: Combatant, a: AbilityDef, target: Combatant | null,
  when: 'hit' | 'fail' | 'always', effects: Effect[],
) {
  const defaultOn = a.resolve === 'attack' ? 'hit' : a.resolve === 'save' ? 'fail' : 'always'
  for (const ap of a.apply ?? []) {
    const on = ap.on ?? defaultOn
    if (on !== 'always' && on !== when) continue
    const to = ap.to ?? 'target'
    const recipients =
      to === 'self' ? [actor]
      : to === 'allies' ? alliesOf(combat, actor)
      : to === 'enemies' ? foesOf(combat, actor)
      : target && isActive(target) ? [target] : []
    // 對全隊或全體敵人的狀態，在多目標能力中只套用一次
    if ((to === 'allies' || to === 'enemies' || to === 'self') && effects.some((e) => e.status === statusDef(ap.status).name && e.type === 'status_add')) continue
    for (const r of recipients) {
      if (a.hp_limit !== undefined && r.hp > a.hp_limit) {
        effects.push({ type: 'note', target: r.id, text: '生命值過高，無效' })
        continue
      }
      if (ap.save) {
        const s = savingThrow(rng, r, ap.save, saveDc(actor, a))
        if (s.success) {
          effects.push({ type: 'note', target: r.id, text: `${statusDef(ap.status).name}：豁免成功` })
          continue
        }
      }
      const def = statusDef(ap.status)
      addStatus(r, {
        id: ap.status, turns: ap.turns, source: actor.id,
        ...(def.charges !== undefined ? { charges: def.charges } : {}),
        ...(ap.value ? { value: applyValue(rng, actor, a, ap.value) } : {}),
        ...(a.concentration ? { conc: `${actor.id}:${a.id}` } : {}),
      })
      effects.push({ type: 'status_add', target: r.id, status: def.name })
    }
  }
}

function useAbility(combat: CombatState, rng: Rng, actor: Combatant, a: AbilityDef, targetId?: string) {
  // 支付代價
  actor.ap -= abilityApCost(a)
  let label = a.name
  if (a.type === 'spell') {
    const circle = slotFor(actor, a.circle ?? 1)!
    actor.slots[circle - 1]! -= 1
    label = `${a.name}（${circle} 環）`
  }
  if (a.type === 'cantrip') actor.usedTurn[CANTRIP_KEY] = 1
  if (a.uses?.per_turn !== undefined) actor.usedTurn[a.id] = (actor.usedTurn[a.id] ?? 0) + 1
  if (a.uses?.per_combat !== undefined) actor.usedCombat[a.id] = (actor.usedCombat[a.id] ?? 0) + 1
  if (a.uses?.per_rest !== undefined) actor.usedRest[a.id] = (actor.usedRest[a.id] ?? 0) + 1
  if (a.concentration) dropConcentration(combat, actor)

  const targets = pickTargets(combat, rng, actor, a, targetId)
  if (a.concentration) actor.concentration = a.id
  let anyHit = false
  let dealt = 0

  for (const target of targets) {
    for (let h = 0; h < (a.hits ?? 1); h++) {
      if (!isActive(target) && a.target !== 'ally_or_downed') break
      const effects: Effect[] = []
      let rollInfo: TimelineEntry['roll']
      let result: RollResult = 'success'

      if (a.resolve === 'attack') {
        const r = attackRoll(rng, actor, target, a)
        rollInfo = r.roll
        result = r.result
        if (r.hit) {
          anyHit = true
          if (a.damage?.length) {
            const rolls = rollParts(rng, actor, a, a.damage, r.lucky)
            if (a.damage.some((p) => p.weapon)) rolls.push(...onHitExtras(actor, target, rng, effects))
            dealt += dealDamage(combat, rng, actor, target, rolls, effects, { mult: a.mult ?? 1 })
          }
          applyStatuses(combat, rng, actor, a, target, 'hit', effects)
        }
      } else if (a.resolve === 'save') {
        const s = savingThrow(rng, target, a.save ?? 'dex', saveDc(actor, a))
        rollInfo = s.roll
        result = s.success ? 'fail' : 'success'
        if (a.damage?.length && !(s.success && a.on_save === 'none')) {
          const rolls = rollParts(rng, actor, a, a.damage, false)
          dealt += dealDamage(combat, rng, actor, target, rolls, effects, { mult: a.mult ?? 1, half: s.success })
        }
        if (!s.success) applyStatuses(combat, rng, actor, a, target, 'fail', effects)
      } else {
        resolveAuto(combat, rng, actor, a, target, effects)
        dealt += effects.filter((e) => e.type === 'damage').reduce((sum, e) => sum + (e.amount ?? 0), 0)
        applyStatuses(combat, rng, actor, a, target, 'always', effects)
      }
      // 只對自己生效的狀態（例如魯莽猛擊的破綻）在第一次結算時套用
      if (a.resolve !== 'auto' && h === 0 && target === targets[0]) {
        applyStatuses(combat, rng, actor, { ...a, apply: (a.apply ?? []).filter((x) => x.on === 'always') }, null, 'always', effects)
      }
      push(combat, {
        actor: actor.id, action: label, target: target.id,
        ...(rollInfo ? { roll: rollInfo } : {}),
        result, effects,
      })
    }
  }

  // 能力本身的仇恨（堅守 +、隱匿 -）
  if (a.threat) addThreat(actor, a.threat)
  if (a.lifesteal && dealt > 0) {
    const effects: Effect[] = []
    heal(actor, Math.floor(dealt * a.lifesteal), effects)
    push(combat, { actor: actor.id, action: `${a.name}・吸取`, result: 'success', effects })
  }
  const gain = (a.ap_gain ?? 0) + (anyHit ? (a.ap_gain_on_hit ?? 0) : 0)
  if (gain > 0) {
    actor.ap += gain
    push(combat, { actor: actor.id, action: `${a.name}・行動點 +${gain}`, result: 'none' })
  }
}

function resolveAuto(combat: CombatState, rng: Rng, actor: Combatant, a: AbilityDef, target: Combatant, effects: Effect[]) {
  if (a.kill && a.hp_limit !== undefined) {
    if (target.hp <= a.hp_limit) applyHpLoss(combat, rng, target, target.hp + target.tempHp, effects)
    else effects.push({ type: 'note', target: target.id, text: '生命值過高，無效' })
    return
  }
  if (a.damage?.length) {
    dealDamage(combat, rng, actor, target, rollParts(rng, actor, a, a.damage, false), effects, { mult: a.mult ?? 1 })
  }
  if (a.heal) {
    const h = a.heal
    const amount = h.full
      ? target.maxHp
      : (h.flat ?? 0) + (h.dice ? rollDice(rng, h.dice, 1) : 0) + (h.mod ? mod(actor.attrs[attrFor(actor, a)]) : 0) + (h.level ? actor.level : 0)
    heal(target, amount, effects)
    if (actor.id === 'pc' && target.id !== 'pc') noteAffinity(combat, target.id, 1, '主角在戰鬥中為其治療')
  }
  if (a.shield) {
    const amount = (a.shield.flat ?? 0) + (a.shield.level ?? 0) * actor.level
    target.tempHp = Math.max(target.tempHp, amount)
    effects.push({ type: 'note', target: target.id, text: `臨時生命值 ${amount}` })
  }
  if (a.cleanse) {
    const before = target.statuses.length
    target.statuses = target.statuses.filter((s) => statusDef(s.id).kind !== 'debuff')
    if (target.statuses.length < before) effects.push({ type: 'status_remove', target: target.id, text: '移除負面狀態' })
  }
  if (a.recover_slot) {
    const circle = recoverableSlot(actor)
    if (circle !== null) {
      actor.slots[circle - 1]! += 1
      effects.push({ type: 'note', target: actor.id, text: `回復一個 ${circle} 環法術環` })
    }
  }
}

/** 可回復的最高法術環：已用掉、且不超過等級一半的環數。 */
function recoverableSlot(actor: Combatant): number | null {
  const limit = Math.ceil(actor.level / 2)
  for (let c = Math.min(limit, actor.slotMax.length); c >= 1; c--) {
    if ((actor.slots[c - 1] ?? 0) < (actor.slotMax[c - 1] ?? 0)) return c
  }
  return null
}

// ---- 回合流程 ----

function checkEnd(combat: CombatState) {
  if (combat.status !== 'ongoing') return
  const alive = (side: Combatant['side']) => combat.combatants.some((c) => c.side === side && isActive(c))
  if (!alive('enemy')) combat.status = 'victory'
  else if (!alive('party')) combat.status = 'defeat'
}

function endTurn(combat: CombatState, rng: Rng) {
  const actor = currentActor(combat)
  if (actor) actor.ap = Math.min(actor.ap, actor.apMax)
  if (combat.status !== 'ongoing') return
  for (let guard = 0; guard < combat.order.length * 2; guard++) {
    combat.turn += 1
    if (combat.turn >= combat.order.length) {
      combat.turn = 0
      combat.round += 1
      decayThreat(combat)
    }
    if (beginTurn(combat, rng)) return
    if (combat.status !== 'ongoing') return
  }
}

/** 回合開始：回復行動點、處理持續效果與控制；回傳這位角色本回合能否行動。 */
function beginTurn(combat: CombatState, rng: Rng): boolean {
  const actor = currentActor(combat)
  if (!actor || !isActive(actor)) return false
  actor.usedTurn = {}
  actor.ap = Math.min(actor.apMax, actor.ap + Math.max(0, actor.apRegen + modsOf(actor).ap_regen))
  let canAct = true
  for (const s of [...actor.statuses]) {
    const def = statusDef(s.id)
    const source = combat.combatants.find((c) => c.id === s.source) ?? null
    if (def.dot) {
      const effects: Effect[] = []
      dealDamage(combat, rng, source, actor, [{ amount: rollDice(rng, def.dot.dice, 1), type: def.dot.type, weapon: false }], effects)
      push(combat, { actor: actor.id, action: `${def.name}發作`, result: 'none', effects })
    }
    if (def.hot && isActive(actor)) {
      const effects: Effect[] = []
      heal(actor, rollDice(rng, def.hot, 1), effects)
      push(combat, { actor: actor.id, action: def.name, result: 'none', effects })
    }
    if (def.pulse && isActive(actor)) {
      const foes = foesOf(combat, actor)
      if (foes.length > 0) {
        const target = rng.pick(foes)
        const effects: Effect[] = []
        const amount = rollDice(rng, def.pulse.dice, 1) + (def.pulse.mod ? mod(actor.attrs[actor.castingAttr]) : 0)
        dealDamage(combat, rng, actor, target, [{ amount, type: def.pulse.type, weapon: false }], effects)
        push(combat, { actor: actor.id, action: def.name, target: target.id, result: 'success', effects })
      }
    }
    if (def.control === 'stun' && isActive(actor)) {
      canAct = false
      push(combat, { actor: actor.id, action: `${def.name}・無法行動`, result: 'none' })
    }
    if (s.turns > 0) s.turns -= 1
  }
  actor.statuses = actor.statuses.filter((s) => s.turns > 0)
  checkEnd(combat)
  if (canAct && isActive(actor) && combat.status === 'ongoing' && controls(actor).has('confuse')) {
    // 困惑：隨機攻擊任何一個人，然後結束回合
    const anyone = combat.combatants.filter((c) => isActive(c) && c !== actor)
    if (anyone.length > 0) weaponAttack(combat, rng, actor, rng.pick(anyone), '困惑中胡亂攻擊')
    checkEnd(combat)
    return false
  }
  return canAct && isActive(actor) && combat.status === 'ongoing'
}

function runEnemyTurns(combat: CombatState, rng: Rng) {
  for (let guard = 0; combat.status === 'ongoing' && guard < 200; guard++) {
    const actor = currentActor(combat)
    if (!actor || actor.side === 'party') return
    enemyTurn(combat, actor, rng)
    checkEnd(combat)
    endTurn(combat, rng)
  }
}

/**
 * 敵人 AI（怪物與敵對的冒險者）：
 * - 選目標：被嘲諷時只打嘲諷者；否則依仇恨加權（特徵改變在意程度與偏好）。
 * - 選行動：替每個能用的技能打分數（治療給最需要的隊友、不重複上增益與減益、範圍技能看人數），
 *   武器攻擊是基準分；依分數加權抽選，保留一點不可預測。
 * - 想逃：生命低於特徵的 flee_below 時嘗試撤退。
 */
function enemyTurn(combat: CombatState, actor: Combatant, rng: Rng) {
  for (let step = 0; step < 6 && combat.status === 'ongoing' && isActive(actor); step++) {
    const foes = foesOf(combat, actor)
    if (foes.length === 0) return
    if (wantsToFlee(actor) && actor.ap >= combatRules.action_costs.flee) {
      perform(combat, actor, { type: 'flee' }, rng)
      checkEnd(combat)
      if (actor.fled) return
      continue
    }
    const taunt = actor.statuses.find((s) => statusDef(s.id).control === 'taunt')
    const taunter = taunt && foes.find((f) => f.id === taunt.source)
    const target = taunter ?? pickByThreat(rng, foes, actor)
    const plan = chooseAction(combat, rng, actor, target, !!taunter)
    if (plan) {
      useAbility(combat, rng, actor, plan.ability, plan.target)
    } else if (actor.ap >= combatRules.action_costs.weapon_attack) {
      actor.ap -= combatRules.action_costs.weapon_attack
      weaponAttack(combat, rng, actor, target, '攻擊')
    } else {
      return
    }
    checkEnd(combat)
  }
}

export function wantsToFlee(actor: Combatant): boolean {
  const below = actor.ai?.flee_below
  return !!below && !actor.ai?.never_flee && actor.hp / Math.max(1, actor.maxHp) < below
}

const hpRatio = (c: Combatant) => c.hp / Math.max(1, c.maxHp)

/** 能力會不會對某人施加這些狀態（已經有的不算） */
function freshStatuses(a: AbilityDef, who: Combatant, to: ApplyDef['to'][]): boolean {
  const list = (a.apply ?? []).filter((x) => to.includes(x.to ?? 'target'))
  return list.length > 0 && list.some((x) => !who.statuses.some((s) => s.id === x.status))
}

/** 替能用的技能打分數，挑一個（或回傳 null 表示用武器攻擊） */
export function chooseAction(combat: CombatState, rng: Rng, actor: Combatant, target: Combatant, taunted: boolean): { ability: AbilityDef; target?: string } | null {
  const foes = foesOf(combat, actor)
  const allies = alliesOf(combat, actor)
  const options: { ability: AbilityDef; target?: string; score: number }[] = []
  for (const a of usableAbilities(combat, actor.id)) {
    const limited = a.uses?.per_combat !== undefined || a.uses?.per_rest !== undefined || a.type === 'spell' ? 0.3 : 0
    // 治療：只在有人受傷時，給最需要的人
    if (a.heal) {
      const pool = a.target === 'self' ? [actor] : a.target === 'all_allies' ? allies
        : combat.combatants.filter((x) => x.side === actor.side && !x.fled && (a.target === 'ally_or_downed' || x.hp > 0))
      const hurt = pool.filter((x) => hpRatio(x) < 0.6).sort((x, y) => hpRatio(x) - hpRatio(y))
      if (!hurt.length) continue
      options.push({ ability: a, target: a.target === 'ally' || a.target === 'ally_or_downed' ? hurt[0]!.id : undefined, score: 3 + (1 - hpRatio(hurt[0]!)) * 4 })
      continue
    }
    // 淨化：有隊友身上有減益時
    if (a.cleanse && !a.damage?.length) {
      const dirty = allies.find((x) => x.statuses.some((s) => statusDef(s.id).kind === 'debuff'))
      if (dirty) options.push({ ability: a, target: a.target === 'ally' ? dirty.id : undefined, score: 2.5 })
      continue
    }
    const harmful = !!a.damage?.length || a.target === 'enemy' || a.target === 'all_enemies' || a.target === 'random_enemies'
    if (!harmful) {
      // 增益：已經有的不再上；第一、二回合比較想先上
      const who = a.target === 'self' ? [actor] : a.target === 'all_allies' ? allies : [actor]
      if (!who.some((w) => freshStatuses(a, w, ['self', 'allies', 'target']) || a.shield)) continue
      if (a.target === 'self' && taunted) continue
      options.push({ ability: a, target: a.target === 'ally' ? actor.id : undefined, score: 1.6 + (combat.round <= 2 ? 0.8 : 0) - limited })
      continue
    }
    if (a.target === 'enemy') {
      // 純減益：對方已經有就不用
      if (!a.damage?.length && !freshStatuses(a, target, ['target'])) continue
      options.push({ ability: a, target: target.id, score: (a.damage?.length ? 2.4 : 2) + limited })
      continue
    }
    // 範圍或隨機目標：人越多越划算
    options.push({ ability: a, score: (foes.length >= 2 ? 2 + 0.7 * (foes.length - 1) : 1) + limited })
  }
  if (!options.length) return null
  // 武器攻擊是基準分 2；依分數平方加權抽選
  const weaponScore = actor.ap >= combatRules.action_costs.weapon_attack ? 2 : 0
  const total = options.reduce((s, o) => s + o.score ** 2, 0) + weaponScore ** 2
  let r = rng.next() * total
  for (const o of options) {
    r -= o.score ** 2
    if (r < 0) return { ability: o.ability, ...(o.target ? { target: o.target } : {}) }
  }
  return null
}

// ---- 結束戰鬥與戰報 ----

/** 戰鬥結束後產生戰報、結算獎勵、把 HP 與法術環寫回角色，並清除戰鬥狀態。 */
export function finishCombat(state: GameState): Report {
  const combat = state.combat
  if (!combat || combat.status === 'ongoing') throw new Error('戰鬥尚未結束')
  const pc = player(state)
  const loc = locationById(combat.location)
  const foes = combat.combatants.filter((c) => c.side === 'enemy')
  const defeated = foes.filter((f) => f.hp === 0)
  const victory = combat.status === 'victory'

  // 戰敗時，無法戰鬥的隊員依親密度檢定：救助（逃開去搬救兵）或逃跑（回到安全的地方等你）
  const nc = companionRules.noncombatant
  const bystanders = combat.status === 'defeat' ? state.party.filter((m) => isNoncombatant(m) && !m.status.includes('away')) : []
  const fates = withRng(state, (rng) => bystanders.map((m) => {
    const aff = m.affinity ?? state.relationships?.[m.id]?.affinity ?? 0
    const natural = rng.int(1, 20)
    const total = natural + Math.floor(aff / nc.defeat_check.affinity_step)
    return { id: m.id, name: m.name, natural, total, rescue: total >= nc.defeat_check.dc }
  }))
  const rescued = fates.some((f) => f.rescue)

  const party: ActorState[] = state.party.map((member) => {
    const f = combat.combatants.find((c) => c.id === member.id)
    const before = { ...member, hp: combat.startHp[member.id] ?? member.hp }
    // 倒下的隊員在戰後被救起，以 1 HP 狀態歸隊（戰敗時是被路人所救）；無法戰鬥的隊員以一半生命值歸隊
    const fled = fates.some((x) => x.id === member.id)
    const hp = fled ? Math.max(1, Math.ceil(member.maxHp * nc.return_hp_ratio)) : Math.max(1, f?.hp ?? member.hp)
    const after = { ...member, hp }
    const snap = snapshot(after, before, pc)
    snap.status = f ? f.statuses.map((s) => statusDef(s.id).name).concat(f.hp === 0 ? ['倒下'] : []) : []
    return snap
  })
  // 法術環與每次休息的使用次數寫回角色
  for (const member of state.party) {
    const f = combat.combatants.find((c) => c.id === member.id)
    if (!f) continue
    member.slotsUsed = f.slotMax.map((n, i) => Math.max(0, n - (f.slots[i] ?? 0)))
    member.usesPerRest = { ...f.usedRest }
  }

  const others: ActorState[] = foes.map((f) => ({
    id: f.id, name: f.name, level: f.level,
    hp: [combat.startHp[f.id] ?? f.maxHp, f.hp, f.maxHp],
    status: f.hp === 0 ? ['死亡'] : f.fled ? ['逃走'] : f.statuses.map((s) => statusDef(s.id).name),
  }))

  let money = 0
  const items: ItemDelta[] = []
  const h = population.hostility
  const xpOf = (f: Combatant) => Math.round((f.npcId ? h.xp_per_level * f.level : enemies[f.defId!]?.xp ?? 0) * (f.xpMult ?? 1))
  const xpTotal = victory ? defeated.reduce((sum, f) => sum + xpOf(f), 0) : 0
  const gain = (name: string, qty = 1) => {
    const existing = items.find((i) => i.name === name)
    if (existing) existing.qty += qty
    else items.push({ name, qty, owner: 'pc' })
  }
  const drops = gearRules.drops
  withRng(state, (rng) => {
    if (!victory) return
    for (const f of defeated) {
      if (f.npcId) {
        money += rng.int(h.money_per_level[0], h.money_per_level[1]) * f.level
        // 敵對冒險者：身上的裝備有機會留下來
        const rec = npcRecord(state, f.npcId)
        const worn = rec ? Object.values(characterFor(state, rec).gear ?? {}).filter((g) => !!g) : []
        let n = 0
        while (worn.length && n < drops.adventurer.max) {
          const g = worn.splice(rng.int(0, worn.length - 1), 1)[0]!
          if (!rng.chance(drops.adventurer.chance)) continue
          gain(registerGear(state, g.spec, itemDef(g.name) ? undefined : g.name))
          n++
        }
        continue
      }
      const def = enemies[f.defId!]
      if (!def) continue
      if (def.money_cc) money += rng.int(def.money_cc[0], def.money_cc[1])
      for (const l of def.loot ?? []) {
        if (rng.chance(l.chance)) gain(l.item, l.qty ?? 1)
      }
      // 持有裝備的人形怪物：有機會掉一件依等級生成的裝備
      if (def.armed && rng.chance(Math.min(drops.armed.max_chance, drops.armed.chance + drops.armed.per_level * def.level))) {
        gain(registerGear(state, randomGear(rng, def.level)))
      }
    }
  })
  // 戰敗：損失一成的錢；有人搬來救兵時不損失
  if (combat.status === 'defeat' && !rescued) money = -Math.floor(state.money_cc * 0.1)
  settleNpcFoes(state, foes, victory)

  for (const member of state.party) {
    if (!member.isPlayer && victory && !isNoncombatant(member)) noteAffinity(combat, member.id, 2, '並肩作戰獲勝')
  }
  const affinity = Object.entries(combat.affinity)
    .map(([npc, a]) => {
      const m = state.party.find((p) => p.id === npc)
      if (!m || m.affinity === undefined || a.delta === 0) return null
      const after = Math.max(-100, Math.min(100, m.affinity + a.delta))
      return { npc, delta: after - m.affinity, after, reason: a.reasons.join('、') }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // 經驗只分給上場的隊員
  const fighters = state.party.filter((m) => !isNoncombatant(m))
  const share = fighters.length > 0 ? Math.floor(xpTotal / fighters.length) : 0
  const quest = victory ? advanceQuest(state, combat) : undefined
  const resultName = { victory: '勝利', defeat: '戰敗', fled: '撤退', ongoing: '' }[combat.status]
  const end = addHours(combat.startTime, (combat.round * COMBAT_MINUTES_PER_ROUND) / 60 + (rescued ? nc.rescue_hours : 0))
  const scene = combat.scene ?? loc.name

  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'combat',
    time: { start: combat.startTime, end },
    location: { at: combat.location, region: loc.region, scene },
    party,
    others,
    ...(quest ? { quest } : {}),
    timeline: combat.timeline,
    outcome: {
      result: combat.status,
      summary: `在${scene}與${foes.map((f) => f.name).join('、')}交戰，${resultName}（${combat.round} 回合）。${fates.map((x) => x.rescue
        ? `${x.name}先逃開去搬救兵，${nc.rescue_hours} 小時後帶人回來救了你們。`
        : `${x.name}逃到安全的地方等你。`).join('')}`,
      tags: [...tagsFor(combat), ...(rescued ? ['搬救兵'] : [])],
    },
    changes: {
      ...(money ? { money_cc: money } : {}),
      ...(share > 0 ? { xp: fighters.map((m) => ({ actor: m.id, amount: share })) } : {}),
      ...(items.length ? { items_gained: items } : {}),
      ...(combat.itemsUsed ? { items_lost: Object.entries(combat.itemsUsed).map(([name, qty]) => ({ name, qty })) } : {}),
      ...(affinity.length ? { affinity } : {}),
      ...(victory && combat.cell ? { flags: { [`cleared:${combat.cell.area}:${combat.cell.x},${combat.cell.y}`]: true } } : {}),
    },
    narration: {
      pov: 'second_person', length: 'medium',
      ...(combat.intent ? { player_intent: combat.intent } : {}),
    },
    lore_keys: [loc.name, regionById(loc.region).name, ...new Set(foes.map((f) => enemies[f.defId!]?.name ?? f.name))],
  }
  // 逃跑的人暫時離隊：回到聚落或安全房時歸隊
  for (const x of fates) {
    const m = state.party.find((p) => p.id === x.id)
    if (m && !x.rescue) addCondition(m, 'away', report)
    report.timeline = [...(report.timeline ?? []), {
      seq: (report.timeline?.length ?? 0) + 1, time: combat.startTime, actor: x.id,
      action: `${x.name}：救助或逃跑（親密度）`, roll: { dice: '1d20', value: x.total, dc: nc.defeat_check.dc }, result: x.rescue ? 'success' : 'fail',
    }]
  }
  // 成人向的戰敗事件：沒有人搬來救兵時，起意的敵人圍上來（敘事停在動手前，等玩家回應）
  if (combat.status === 'defeat' && !rescued) withRng(state, (rng) => rollDefeatEvent(state, rng, report, foes))
  delete state.combat
  return commitReport(state, report)
}

/** 和 NPC 戰鬥後：倒下的人死亡（從名單移除），還活著的人敵對 */
function settleNpcFoes(state: GameState, foes: Combatant[], victory: boolean) {
  for (const f of foes) {
    if (!f.npcId) continue
    const rec = npcRecord(state, f.npcId)
    if (!rec) continue
    // 具名 NPC 第一次有變化時複製進存檔
    const stored = state.npcs?.[rec.id] ?? registerNpc(state, { ...rec })
    if (f.hp === 0) {
      stored.dead = true
      delete stored.at
      for (const r of Object.values(state.rosters ?? {})) r.members = r.members.filter((id) => id !== rec.id)
    } else {
      stored.hostile = true
      // 撤退或戰敗：今天不會馬上又打起來
      if (!victory) (state.avoided ??= {})[rec.id] = state.time.day
    }
  }
}

function tagsFor(combat: CombatState): string[] {
  const tags = new Set<string>()
  for (const t of combat.timeline) {
    if (t.result === 'critical') tags.add('幸運一擊')
    if (t.result === 'fumble') tags.add('大失敗')
    if (t.effects?.some((e) => e.status === '倒下')) tags.add('隊員倒下')
    if (t.effects?.some((e) => e.type === 'move' && t.actor.startsWith('e'))) tags.add('敵人逃走')
    if (t.effects?.some((e) => e.text?.startsWith('弱點'))) tags.add('擊中弱點')
    if (t.effects?.some((e) => e.text?.startsWith('免疫'))) tags.add('攻擊被免疫')
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
