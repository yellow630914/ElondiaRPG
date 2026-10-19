// 角色：屬性、三資源（生命值、行動點、法術環）的推導、升級與能力學習。
// 公式說明見 docs/COMBAT_SYSTEM.md，數值在 data/rules/combat.json。

import {
  ATTR_IDS, armorDef, attributeRules, classAbilities, classDef, combatRules, progression, weaponDef,
  type AbilityDef, type AffinityMap, type AttrId, type Attrs, type Mods, type NpcDef, type WeaponDef,
} from './data'
import type { Rng } from './rng'
import type { ActorState, Character, GuildRank, SkillQuality } from './types'

const QUALITY_ORDER: SkillQuality[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

// ---- 基本換算 ----

/** 屬性調整值 = floor((屬性值 - 10) / 2) */
export function mod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function proficiency(level: number): number {
  const { base, every_levels } = combatRules.proficiency
  return base + Math.floor((level - 1) / every_levels)
}

export function lifeTier(level: number): number {
  return progression.life_tiers.find((t) => level >= t.levels[0] && level <= t.levels[1])?.tier ?? 1
}

export function maxSkillQuality(level: number): SkillQuality {
  return progression.life_tiers.find((t) => t.tier === lifeTier(level))?.max_skill_quality ?? 'common'
}

export function guildRankFor(level: number): GuildRank {
  const ranks = progression.guild_ranks
  return ranks.find((r) => level >= r.levels[0] && level <= r.levels[1])?.rank ?? ranks[ranks.length - 1]!.rank
}

export function xpToNext(level: number): number {
  return combatRules.xp_to_next_level_per_level * level
}

export function affinityStage(value: number): string {
  return progression.affinity.stages.find((s) => value >= s.range[0] && value <= s.range[1])?.name ?? ''
}

/** 角色扮演指導第一層：觀察者對目標的基準態度（以生命層級差計算）。 */
export function powerGapAttitude(observerLevel: number, targetLevel: number): string {
  const { by_diff, clamp } = progression.power_gap_attitude
  const diff = Math.max(clamp[0], Math.min(clamp[1], lifeTier(observerLevel) - lifeTier(targetLevel)))
  return by_diff[String(diff)] ?? '對等'
}

// ---- 三資源 ----

/** 生命值 = base + 等級 × max(下限, per_level + mod(力量) + mod(信仰)) */
export function maxHpFor(level: number, attrs: Attrs): number {
  const r = combatRules.hp
  return r.base + level * Math.max(r.min_per_level, r.per_level + mod(attrs.str) + mod(attrs.fai))
}

/** 行動點上限 = base + floor(等級 / 5) + floor((mod(靈巧) + mod(魅力)) / 2)，至少 min */
export function apMaxFor(level: number, attrs: Attrs): number {
  const r = combatRules.ap
  return Math.max(r.min, r.base + Math.floor(level / r.every_levels) + Math.floor((mod(attrs.dex) + mod(attrs.cha)) / 2))
}

/** 每回合回復的行動點 */
export function apRegenFor(level: number): number {
  const r = combatRules.ap
  return r.regen + Math.floor(level / r.regen_every_levels)
}

/** 法術環上限（索引 0 = 1 環）。依職業的施法者類型查表，再加上智力與信仰帶來的額外法術環。 */
export function slotMaxFor(classId: string, level: number, attrs: Attrs): number[] {
  const cls = classDef(classId)
  if (cls.caster === 'none') return []
  const table = combatRules.spell_slots
  const casterLevel = cls.caster === 'full' ? level : Math.ceil(level / 2)
  let slots = [...(table.full[String(Math.max(1, Math.min(20, casterLevel)))] ?? [])]
  if (cls.caster === 'half') slots = slots.slice(0, table.half_max_circle)
  const s = mod(attrs.int) + mod(attrs.fai)
  for (let c = 1; c <= table.bonus_max_circle; c++) {
    if ((slots[c - 1] ?? 0) > 0 && s >= 2 * c) slots[c - 1]! += 1
  }
  return slots
}

export function maxCircle(c: Pick<Character, 'class' | 'level' | 'attrs'>): number {
  return slotMaxFor(c.class, c.level, c.attrs).length
}

export function slotsLeft(c: Character): number[] {
  return slotMaxFor(c.class, c.level, c.attrs).map((n, i) => Math.max(0, n - (c.slotsUsed[i] ?? 0)))
}

export function maxCantrips(level: number): number {
  const r = combatRules.cantrip
  return r.known_base + Math.floor(level / r.known_every_levels)
}

// ---- 戰鬥屬性 ----

export function castingAttr(classId: string): AttrId {
  return classDef(classId).casting ?? classDef(classId).priority[0]!
}

/** 幸運一擊閾值（自然骰 ≥ 此值）。屬性造成的下限為 attr_floor；crit 修正另外扣除，最低到 floor。 */
export function luckyThreshold(attrs: Attrs, critBonus = 0): number {
  const r = combatRules.lucky
  const fromAttrs = Math.max(r.attr_floor, r.base - Math.floor((mod(attrs.dex) + mod(attrs.cha)) / 3))
  return Math.max(r.floor, fromAttrs - critBonus)
}

/** 迴避骰的下限：1 + max(0, mod(靈巧)) */
export function evadeFloor(attrs: Attrs): number {
  return combatRules.hit.evade_floor_base + Math.max(0, mod(attrs.dex))
}

export function weaponFor(c: Pick<Character, 'weapon' | 'level'>): WeaponDef {
  const w = weaponDef(c.weapon)
  if (!w.scale) return w
  let dice = w.dice
  for (const [lvl, d] of Object.entries(w.scale)) if (c.level >= Number(lvl)) dice = d
  return { ...w, dice }
}

/** 種族天賦 + 防具帶來的傷害倍率加減與戰鬥修正 */
export function gearAffinities(c: Pick<Character, 'race' | 'armor'>): { resist: AffinityMap; offense: AffinityMap; mods: Mods } {
  const talent = attributeRules.races[c.race]?.talent
  const armor = armorDef(c.armor)
  const resist: AffinityMap = {}
  const offense: AffinityMap = {}
  for (const src of [talent?.resist, armor.resist]) {
    for (const [k, v] of Object.entries(src ?? {})) resist[k] = (resist[k] ?? 0) + (v ?? 0)
  }
  for (const src of [talent?.offense, armor.offense]) {
    for (const [k, v] of Object.entries(src ?? {})) offense[k] = (offense[k] ?? 0) + (v ?? 0)
  }
  return { resist, offense, mods: { ...(talent?.mods ?? {}) } }
}

// ---- 建立角色 ----

/** 職業基礎陣列依優先順序分配，再加種族加值。 */
export function baseAttrs(classId: string, race: string): Attrs {
  const array = attributeRules.creation.array
  const attrs = Object.fromEntries(ATTR_IDS.map((a) => [a, 10])) as Attrs
  classDef(classId).priority.forEach((a, i) => (attrs[a] = array[i] ?? 10))
  for (const [a, v] of Object.entries(attributeRules.races[race]?.bonus ?? {})) attrs[a as AttrId] += v ?? 0
  return attrs
}

/** 依等級與屬性重算推導值（目前只有最大生命值），生命值不超過上限。 */
export function recalc(c: Character): Character {
  const before = c.maxHp
  c.maxHp = maxHpFor(c.level, c.attrs)
  if (c.maxHp > before) c.hp += c.maxHp - before
  c.hp = Math.min(c.hp, c.maxHp)
  return c
}

function baseCharacter(id: string, name: string, race: string, classId: string, attrs: Attrs): Character {
  const cls = classDef(classId)
  const maxHp = maxHpFor(1, attrs)
  return {
    id, name, race, class: classId, level: 1, xp: 0,
    attrs, attrPoints: 0,
    hp: maxHp, maxHp,
    slotsUsed: [], usesPerRest: {},
    abilities: [...cls.start],
    weapon: cls.weapon, armor: cls.armor,
    status: [],
  }
}

/** bonus：建角時自由分配的屬性點（合計不超過 creation.bonus_points，單項不超過 max_score）。 */
export function createPlayer(name: string, race: string, classId: string, bonus: Partial<Attrs> = {}): Character {
  const attrs = baseAttrs(classId, race)
  const { bonus_points, max_score } = attributeRules.creation
  let budget = bonus_points
  for (const a of ATTR_IDS) {
    const add = Math.max(0, Math.min(bonus[a] ?? 0, budget, max_score - attrs[a]))
    attrs[a] += add
    budget -= add
  }
  return { ...baseCharacter('pc', name, race, classId, attrs), isPlayer: true }
}

/** NPC 依等級自動成長：屬性點加在主屬性，能力依名字決定的固定順序挑選。 */
export function createNpc(def: NpcDef, rng: Rng): Character {
  const c: Character = {
    ...baseCharacter(def.id, def.name, def.race, def.class, baseAttrs(def.class, def.race)),
    personality: def.personality,
    ...(def.faction ? { faction: def.faction } : {}),
    affinity: progression.affinity.initial,
  }
  while (c.level < def.level) {
    c.level += 1
    c.attrs[classDef(c.class).priority[0]!] += attributeRules.level_up_points
    const choice = abilityChoices(c, rng)[0]
    if (choice) c.abilities.push(choice)
  }
  recalc(c)
  c.hp = c.maxHp
  return c
}

// ---- 能力學習 ----

export function abilityQuality(a: AbilityDef): SkillQuality {
  if (a.type === 'cantrip') return 'common'
  if (a.type === 'spell') return combatRules.quality_by_circle[(a.circle ?? 1) - 1] ?? 'legendary'
  const lvl = a.unlock ?? 1
  return combatRules.quality_by_level.find((q) => lvl >= q.levels[0] && lvl <= q.levels[1])?.quality ?? 'legendary'
}

/** 目前可以學的能力：技能看解鎖等級、法術看是否擁有該環、戲法看可學數量；品質不超過生命層級上限。 */
export function learnable(c: Character): AbilityDef[] {
  const cap = QUALITY_ORDER.indexOf(maxSkillQuality(c.level))
  const circles = maxCircle(c)
  const cantripsKnown = c.abilities.filter((id) => classAbilities(c.class).find((a) => a.id === id)?.type === 'cantrip').length
  return classAbilities(c.class).filter((a) => {
    if (c.abilities.includes(a.id)) return false
    if (QUALITY_ORDER.indexOf(abilityQuality(a)) > cap) return false
    if (a.type === 'skill') return (a.unlock ?? 1) <= c.level
    if (a.type === 'spell') return (a.circle ?? 1) <= circles
    return cantripsKnown < maxCantrips(c.level)
  })
}

/** 升級時的能力三選一 */
export function abilityChoices(c: Character, rng: Rng, count = 3): string[] {
  const pool = learnable(c)
  const picked: string[] = []
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!.id)
  }
  return picked
}

/** 加經驗值並處理升級；回傳升了幾級。會直接修改角色。 */
export function gainXp(c: Character, amount: number, rng: Rng): number {
  c.xp += amount
  let gained = 0
  while (c.level < 20 && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level)
    c.level += 1
    gained += 1
    c.attrPoints += attributeRules.level_up_points
    recalc(c)
    const choices = abilityChoices(c, rng)
    if (choices.length > 0) c.pendingAbilityChoices = [...(c.pendingAbilityChoices ?? []), choices]
  }
  return gained
}

/** 分配一點屬性點 */
export function spendAttrPoint(c: Character, attr: AttrId): void {
  if (c.attrPoints <= 0) throw new Error('沒有可分配的屬性點')
  if (c.attrs[attr] >= attributeRules.score.max) throw new Error('屬性已達上限')
  c.attrs[attr] += 1
  c.attrPoints -= 1
  recalc(c)
}

// ---- 報告 ----

/**
 * 報告用的角色快照。player 傳入時，NPC 隊友會附上對主角的態度
 * （角色扮演指導：實力差 → 親密值；立場與性格交給 AI 依 personality 演繹）。
 */
export function snapshot(c: Character, before?: Character, player?: Character): ActorState {
  const b = before ?? c
  const state: ActorState = {
    id: c.id,
    name: c.name,
    race: c.race,
    class: c.class,
    level: c.level,
    rank: guildRankFor(c.level),
    hp: [b.hp, c.hp, c.maxHp],
    status: [...c.status],
    equipment: [weaponDef(c.weapon).name, armorDef(c.armor).name],
  }
  if (c.personality) state.personality = c.personality
  if (player && !c.isPlayer && c.affinity !== undefined) {
    state.attitude = `${powerGapAttitude(c.level, player.level)} / ${affinityStage(c.affinity)}`
  }
  return state
}

/** 主角的設定（性別、出身、外貌、背景），交給 AI 參考。 */
export function protagonistText(c: Character, birthplaceName?: string): string {
  const lines = [
    `${c.name}｜${c.gender ? `${c.gender}｜` : ''}${attributeRules.races[c.race]?.name ?? c.race}・${classDef(c.class).name} Lv.${c.level}${birthplaceName ? `｜出身：${birthplaceName}` : ''}`,
    c.appearance ? `外貌：${c.appearance}` : '',
    c.background ? `背景：${c.background}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

export type ProfilePatch = Partial<Pick<Character, 'gender' | 'appearance' | 'background'>>

/** 修改主角設定（名字以外的文字欄位） */
export function editProfile(c: Character, patch: ProfilePatch) {
  for (const k of ['gender', 'appearance', 'background'] as const) {
    const v = patch[k]
    if (v === undefined) continue
    const t = v.trim().slice(0, k === 'background' ? 800 : k === 'appearance' ? 400 : 20)
    if (t) c[k] = t
    else delete c[k]
  }
}
