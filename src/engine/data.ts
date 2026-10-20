// 讀入 data/ 底下的 JSON，並提供型別。

import geographyJson from '@data/world/geography.json'
import npcsJson from '@data/world/npcs.json'
import progressionJson from '@data/rules/progression.json'
import economyJson from '@data/rules/economy.json'
import attributesJson from '@data/rules/attributes.json'
import classesJson from '@data/rules/classes.json'
import combatJson from '@data/rules/combat.json'
import damageTypesJson from '@data/rules/damage_types.json'
import statusesJson from '@data/rules/statuses.json'
import abilitiesJson from '@data/rules/abilities.json'
import equipmentJson from '@data/rules/equipment.json'
import enemiesJson from '@data/rules/enemies.json'
import townQuestsJson from '@data/rules/town_quests.json'
import companionsJson from '@data/rules/companions.json'
import slaveryJson from '@data/rules/slavery.json'
import actionsJson from '@data/rules/actions.json'
import npcPoolJson from '@data/world/npc_pool.json'
import npcTagsJson from '@data/rules/npc_tags.json'
import populationJson from '@data/rules/npc_population.json'
import itemsJson from '@data/rules/items.json'
import shopsJson from '@data/rules/shops.json'
import negotiationsJson from '@data/rules/negotiations.json'
import type { RewardEffect } from './effects'
import type { GuildRank, QuestKind, SkillQuality } from './types'

// ---- 地理 ----

export type RouteMode = 'road' | 'trail' | 'wild' | 'sea' | 'dive' | 'underground'
export type LocationType =
  | 'capital' | 'city' | 'town' | 'village' | 'port' | 'outpost' | 'fortress' | 'dungeon'

export interface Region { id: string; name: string; climate: string; dominant: string; danger: number }
export interface Location {
  id: string
  name: string
  region: string
  type: LocationType
  faction?: string | null
  rank?: string
  note?: string
}
export interface Route {
  a: string
  b: string
  days: [number, number] | null
  mode: RouteMode
  estimated?: boolean
  note?: string
}

export interface Faction { id: string; name: string }
export const geography = geographyJson as unknown as {
  factions: Faction[]
  regions: Region[]
  locations: Location[]
  routes: Route[]
}

export interface NpcDef {
  id: string
  name: string
  /** 性別 id（見 npc_pool.json 的 genders） */
  gender?: string
  race: string
  class: string
  level: number
  location: string
  hire_cc: number
  personality: string
  faction?: string
  appearance?: string
  /** 與其他角色的關係：角色 id → 文字 */
  relations?: Record<string, string>
  /** 普通人或冒險者；沒寫時有職業的算冒險者 */
  kind?: NpcKind
  /** 標籤（見 data/rules/npc_tags.json） */
  tags?: string[]
  /** 活躍地點：每天依權重決定出現在哪個地點的哪個地區 */
  haunts?: Haunt[]
  /** 普通人的職業描述（麵包師、修女……） */
  occupation?: string
  /** 血統、部族、氏族或出身派系（例如「沙痕部落」「魅魔（赤翼宮廷）」） */
  lineage?: string
}

export type NpcKind = 'commoner' | 'adventurer'

export interface Haunt {
  location: string
  /** 地區：town、noble、palace、temple、outskirts、dungeon（見 grid.ts 的 Zone） */
  zone: string
  weight: number
}
export const npcs = (npcsJson as unknown as { npcs: NpcDef[] }).npcs

export const progression = progressionJson as unknown as {
  life_tiers: { tier: number; levels: [number, number]; max_skill_quality: SkillQuality }[]
  guild_ranks: { rank: GuildRank; levels: [number, number]; desc: string }[]
  classes: { id: string; name: string; power: string[] }[]
  races: { id: string; name: string; home: string }[]
  affinity: { min: number; max: number; initial: number; stages: { range: [number, number]; name: string }[] }
  power_gap_attitude: { by_diff: Record<string, string>; clamp: [number, number] }
  ability_rerolls: number
}
export const economy = economyJson as unknown as {
  /** 一般人每天的生活費（罰金、禮物價值的基準） */
  commoner_living_cc_per_day: number
  quest_rewards_cc: Record<string, { range: [number, number]; party: string; duration_days: [number, number] }>
  lodging_cc_per_night: Record<string, [number, number]>
  meals_cc: Record<string, number | [number, number]>
}

// ---- 屬性、種族、職業 ----

export type AttrId = 'str' | 'dex' | 'int' | 'fai' | 'cha'
export const ATTR_IDS: AttrId[] = ['str', 'dex', 'int', 'fai', 'cha']
export type Attrs = Record<AttrId, number>

/** 傷害屬性或群組（physical / elemental / divine / arcane / all）→ 倍率加減 */
export type AffinityMap = Partial<Record<string, number>>

/** 戰鬥修正，欄位同 statuses.json 的 mods */
export interface Mods {
  hit?: number
  evade?: number
  save?: number
  damage?: number
  dr?: number
  ap_regen?: number
  crit?: number
}

export interface RaceDef {
  name: string
  emoji: string
  bonus: Partial<Attrs>
  talent: { name: string; desc: string; resist?: AffinityMap; offense?: AffinityMap; mods?: Mods }
}

export const attributeRules = attributesJson as unknown as {
  attributes: { id: AttrId; name: string; short: string; desc: string }[]
  score: { min: number; max: number }
  creation: { array: number[]; bonus_points: number; max_score: number }
  level_up_points: number
  races: Record<string, RaceDef>
}

export type CasterType = 'full' | 'half' | 'none'
export interface ClassDef {
  name: string
  priority: AttrId[]
  caster: CasterType
  casting?: AttrId
  weapon: string
  armor: string
  start: string[]
  role: string
  emoji: string
  /** 生命骰面數（短休時花費） */
  hit_die: number
}
export const classes = (classesJson as unknown as { classes: Record<string, ClassDef> }).classes

export function classDef(id: string): ClassDef {
  const c = classes[id]
  if (!c) throw new Error(`unknown class: ${id}`)
  return c
}

// ---- 戰鬥規則 ----

export const combatRules = combatJson as unknown as {
  proficiency: { base: number; every_levels: number }
  xp_to_next_level_per_level: number
  party_max: number
  hp: { base: number; per_level: number; min_per_level: number }
  ap: { base: number; every_levels: number; min: number; regen: number; regen_every_levels: number }
  action_costs: { weapon_attack: number; defend: number; flee: number; item: number; spell_by_circle: number[] }
  defend: { evade: number }
  flee_dc: number
  hit: { evade_floor_base: number }
  lucky: { base: number; attr_floor: number; floor: number }
  save: { dc_base: number }
  concentration: { attr: AttrId; min_dc: number }
  spell_slots: { full: Record<string, number[]>; half_max_circle: number; bonus_max_circle: number }
  cantrip: { scale_levels: number[]; known_base: number; known_every_levels: number }
  quality_by_level: { levels: [number, number]; quality: SkillQuality }[]
  quality_by_circle: SkillQuality[]
}

export interface DamageTypeDef { id: string; name: string; group: string }
export const damageTypes = damageTypesJson as unknown as {
  types: DamageTypeDef[]
  groups: Record<string, string>
  labels: { max: number; name: string }[]
}
const damageTypeIndex = new Map(damageTypes.types.map((t) => [t.id, t]))

export function damageType(id: string): DamageTypeDef {
  const t = damageTypeIndex.get(id)
  if (!t) throw new Error(`unknown damage type: ${id}`)
  return t
}

export function damageTypeName(id: string): string {
  return damageTypeIndex.get(id)?.name ?? damageTypes.groups[id] ?? id
}

export type LuckRoll = 'attack' | 'evade' | 'save'
export type Control = 'stun' | 'silence' | 'no_cast' | 'taunt' | 'confuse'
export interface StatusDef {
  name: string
  kind: 'buff' | 'debuff'
  mods?: Mods
  luck?: string
  luck_on?: LuckRoll[]
  advantage?: LuckRoll[]
  disadvantage?: LuckRoll[]
  attacked_advantage?: boolean
  attacked_disadvantage?: boolean
  resist?: AffinityMap
  offense?: AffinityMap
  dot?: { dice: string; type: string }
  hot?: string
  pulse?: { dice: string; type: string; mod?: boolean }
  on_hit?: { status?: string; turns?: number; dice?: string; type?: string }
  control?: Control
  special?: 'undying' | 'halve_next' | 'reduce_next'
  charges?: number
}
export const statuses = (statusesJson as unknown as { statuses: Record<string, StatusDef> }).statuses

export function statusDef(id: string): StatusDef {
  const s = statuses[id]
  if (!s) throw new Error(`unknown status: ${id}`)
  return s
}

// ---- 技能、法術、戲法 ----

export type AbilityType = 'skill' | 'spell' | 'cantrip'
export type AbilityTarget =
  | 'enemy' | 'ally' | 'ally_or_downed' | 'self' | 'all_enemies' | 'all_allies' | 'random_enemies'
export interface DamagePart {
  dice?: string
  type?: string
  mod?: boolean
  weapon?: boolean
  scale?: { dice: string; per: number }
}
export interface ApplyDef {
  status: string
  turns: number
  to?: 'target' | 'self' | 'allies' | 'enemies'
  on?: 'hit' | 'fail' | 'always'
  save?: AttrId
  value?: { dice?: string; mod?: boolean; level?: boolean; flat?: number }
}
export interface AbilityDef {
  id: string
  name: string
  type: AbilityType
  classes: string[]
  unlock?: number
  circle?: number
  ap?: number
  attr?: AttrId | 'casting'
  target: AbilityTarget
  count?: number
  resolve: 'attack' | 'save' | 'auto'
  save?: AttrId
  on_save?: 'half' | 'none'
  damage?: DamagePart[]
  mult?: number
  hits?: number
  hit?: number
  adv?: boolean
  crit?: number
  heal?: { dice?: string; mod?: boolean; level?: boolean; flat?: number; full?: boolean }
  shield?: { flat?: number; level?: number }
  apply?: ApplyDef[]
  ap_gain?: number
  ap_gain_on_hit?: number
  uses?: { per_turn?: number; per_combat?: number; per_rest?: number }
  concentration?: boolean
  cleanse?: boolean
  lifesteal?: number
  recover_slot?: boolean
  hp_limit?: number
  kill?: boolean
  desc: string
}
const abilityList = (abilitiesJson as unknown as { abilities: AbilityDef[] }).abilities
export const abilities: Record<string, AbilityDef> = Object.fromEntries(abilityList.map((a) => [a.id, a]))

export function abilityDef(id: string): AbilityDef {
  const a = abilities[id]
  if (!a) throw new Error(`unknown ability: ${id}`)
  return a
}

export function classAbilities(classId: string): AbilityDef[] {
  return abilityList.filter((a) => a.classes.includes(classId))
}

// ---- 裝備 ----

export interface WeaponDef { name: string; dice: string; type: string; attr: AttrId; scale?: Record<string, string> }
export interface ArmorDef { name: string; evade: number; dr: number; resist?: AffinityMap; offense?: AffinityMap }
export const equipment = equipmentJson as unknown as {
  weapons: Record<string, WeaponDef>
  armors: Record<string, ArmorDef>
}

export function weaponDef(id: string): WeaponDef {
  return equipment.weapons[id] ?? equipment.weapons.unarmed!
}

export function armorDef(id: string): ArmorDef {
  return equipment.armors[id] ?? equipment.armors.none!
}

// ---- 敵人 ----

export interface EnemyDef {
  id: string
  name: string
  level: number
  attrs: Attrs
  hp: number
  ap: number
  weapon: { dice: string; type: string; attr: AttrId }
  evade: number
  dr: number
  resist?: AffinityMap
  offense?: AffinityMap
  abilities?: string[]
  xp: number
  habitats?: string[]
  money_cc?: [number, number]
  loot?: { item: string; chance: number }[]
}
export type EncounterGroup = [string, number][]
export type DungeonLayerId = 'outskirts' | 'shallow' | 'middle' | 'deep'
export interface DungeonEncounters {
  outskirts: EncounterGroup[]
  shallow: EncounterGroup[]
  middle: EncounterGroup[]
  deep: EncounterGroup[]
  boss: EncounterGroup
}
const enemiesData = enemiesJson as unknown as {
  enemies: EnemyDef[]
  encounters: Record<string, DungeonEncounters>
  wild_encounters: Record<string, EncounterGroup[] | string>
}
export const enemies: Record<string, EnemyDef> = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]))
export const dungeonEncounters = enemiesData.encounters

export function wildEncounters(region: string): EncounterGroup[] {
  const table = enemiesData.wild_encounters[region] ?? enemiesData.wild_encounters.default
  return Array.isArray(table) ? table : []
}

// ---- 委託 ----

export interface TownQuestTemplate {
  id: string
  kind: Exclude<QuestKind, 'clear_dungeon'>
  area: 'town' | 'outskirts'
  title: string
  scene: string
  /** 城內委託的執行地點（設施種類） */
  spot?: string
  hours: number
  dc?: number
  item?: string
  qty?: number
  encounter?: EncounterGroup
  encounter_chance?: number
  reward_cc: [number, number]
  /** 交付時的額外報酬（報酬模板，見 effects.ts） */
  rewards?: RewardEffect[]
}
const townQuestsData = townQuestsJson as unknown as { per_town: number; refresh_days: number; templates: TownQuestTemplate[] }
export const townQuestsPerTown = townQuestsData.per_town
export const townQuestsRefreshDays = townQuestsData.refresh_days
export const townQuestTemplates: Record<string, TownQuestTemplate> = Object.fromEntries(
  townQuestsData.templates.map((t) => [t.id, t]),
)

// ---- 夥伴、奴隸契約、主動行動 ----

export type Bond = 'hired' | 'voluntary' | 'slave' | 'leader' | 'ally'
export interface ConditionDef { name: string; desc: string; check_penalty?: number; clears?: 'long_rest' }
export const companionRules = companionsJson as unknown as {
  bonds: Record<Bond, string>
  leave_threshold: number
  initial_affinity: Record<Bond, number>
  tavern: {
    asking: { a: number; b: number; c: number }; asking_variance: number
    hire: { base: number; fee_weight: number; level_gap: number; min: number; max: number }
  }
  wait_party: {
    hours: number; base: number; per_cha_mod: number; per_level: number; max: number
    pay_chance: number; pay_chance_per_cha_mod: number; pay_per_level: number; leader_level: [number, number]
  }
  invite: { min_affinity: number; base: number; affinity_step: number; level_gap: number }
  leave_party: { sneak_base: number; affinity: { formal: number; sneak_success: number; sneak_fail: number } }
  rest: { short_hours: number; long_hours: number; long_rest_gap_hours: number; ambush: Record<'settlement' | 'wild' | 'dungeon', number> }
  conditions: Record<string, ConditionDef>
}

export function conditionName(id: string): string {
  return companionRules.conditions[id]?.name ?? statuses[id]?.name ?? id
}

export type ContractFunction = 'identity' | 'obedience' | 'income' | 'tether' | 'tracking' | 'spell_seal'
export interface ContractDef {
  name: string
  mark: string
  functions: ContractFunction[]
  obedience_penalty: number
  income_share: number
  spell_cap?: number
  negotiate_dc: number
  escape_dc: number
  recapture_chance: number
  exit_dc: number
  side_effects: string[]
  escape_effects: { hp_ratio: number }
}
export interface MarketDef { name: string; price_mult: number; stock: [number, number]; races: Record<string, number> }
export type Degree = 'critical' | 'success' | 'partial' | 'fail' | 'fumble'
export const slaveryRules = slaveryJson as unknown as {
  prices_cc: Record<'1' | '2' | '3', Record<'human' | 'demon' | 'elf', [number, number]>> & {
    beyond_tier3_mult: number; variance: number
    race_group: Record<string, 'human' | 'demon' | 'elf'>; race_mult: Record<string, number>; class_mult: Record<string, number>
  }
  black_market_only: string[]
  markets: Record<string, { public?: MarketDef; black?: MarketDef }>
  black_market_search: { attr: AttrId; dc: number; hours: number }
  haggle: { attr: AttrId; base: number; black_market_bonus: number; price_factor: Record<Degree, number> }
  self_sale: { hours: number; base: number; per_cha_mod: number; per_level: number; max: number; share: number; contract_weights: Record<string, number> }
  contracts: Record<string, ContractDef>
  functions: Record<ContractFunction, string>
  freedom: {
    negotiate: { attr: AttrId; hours: number; affinity_step: number }
    escape: { attr: AttrId; hours: number }
    punishment: Record<'light' | 'heavy', { hp_ratio: number; affinity: number; obedience?: number }>
    obedience_max: number
    fugitive: { inn_mult: number; inn_recapture_mult: number }
  }
  release_affinity: number
  custom_mark: Record<'income_share' | 'negotiate_dc' | 'escape_dc' | 'exit_dc' | 'recapture_chance' | 'escape_hp_ratio' | 'obedience_penalty', [number, number]> & {
    name_chars: number; mark_chars: number; side_effect_chars: number; side_effects: number
  }
  master_permit: { attr: AttrId; hours: number; affinity_step: number }
  safe_spots: string[]
  marking: { attr: AttrId; base: number; severity: string[] }
  master_events: {
    step_chance: number; travel_chance: number; cooldown_hours: number
    events: MasterEventDef[]
  }
}

export interface MasterEventDef {
  id: string
  weight: number
  /** {master} 會換成主人的名字 */
  text: string
  hours: number
  effects?: RewardEffect[]
  check?: { attr: AttrId; dc: number; success: string }
  effects_success?: RewardEffect[]
  fail_effects?: RewardEffect[]
}

export function contractDef(id: string): ContractDef {
  const c = slaveryRules.contracts[id]
  if (!c) throw new Error(`unknown contract: ${id}`)
  return c
}

export type ActionKind = 'free' | 'hire' | 'haggle' | 'invite' | 'black_market' | 'negotiate' | 'escape' | 'bargain' | 'negotiation' | 'rest_talk'
  | 'chat' | 'gift' | 'flatter' | 'bluff' | 'intimidate' | 'steal' | 'attack' | 'master_permit' | 'marking'
export type EffectKind = 'affinity' | 'relationship_text' | 'flag' | 'reputation' | 'money' | 'item' | 'xp' | 'meet' | 'ability' | 'hp' | 'mark'
export const actionRules = actionsJson as unknown as {
  dc_adjust: number
  degrees: { critical_margin: number; partial_margin: number; fumble_margin: number }
  caps: {
    affinity: number; reputation: number; money_cc_per_level: number; xp_per_level: number
    item_qty: number; items: number; flags: number; relationship_text_chars: number; summary_chars: number; narrative_chars: number; meet_affinity: number; hp_loss_ratio: number; hp_gain_ratio: number
  }
  kinds: Record<ActionKind, {
    name: string; attr: AttrId; base?: number; hours: number; effects: EffectKind[]
    /** 社交互動：各成功程度的親密度變化 */
    affinity?: Record<Degree, number>
    value_steps?: number[]
    wealth_scale?: number[]
    status_dc?: number
  }>
}

export interface GenderDef { name: string; color: string; weight: number; names: 'm' | 'f' | 'any' }
export const npcPool = npcPoolJson as unknown as {
  genders: Record<string, GenderDef>
  outfits: string[]
  slave_backgrounds: string[]
  commoner_outfits: Record<string, string[]>
}

export interface NpcTagDef {
  name: string
  emoji: string
  kinds: NpcKind[]
  commoner_weight?: number
  adventurer_chance?: number
  extra_chance?: number
  location_types?: string[]
  zone_weights?: Record<string, number>
  haunt_extra?: [number, number]
  haunt_extra_weight?: [number, number]
  wealth: number
  occupations?: string[]
  ai_hint: string
}
export const npcTags = npcTagsJson as unknown as {
  kinds: Record<NpcKind, { name: string; zone_weights: Record<string, number>; level?: [number, number]; dungeon_haunts?: [number, number] }>
  neighbor_weight: number
  tags: Record<string, NpcTagDef>
}
export const population = populationJson as unknown as {
  roster: Record<string, { adventurer: number; commoner: number }>
  adventurer_level: Record<string, [number, number]>
  known_weight: number
  turnover: { period_days: number; chance: number }
  visitors: {
    outskirts: { chance: number; adventurer: number; reunion_chance: number }
    dungeon: { chance: number; party_chance: number; party_size: [number, number]; villain_chance: number; reunion_chance: number }
  }
  hostility: { affinity: number; sight: number; toll_per_level: number; xp_per_level: number; money_per_level: [number, number] }
}

export function tagDef(id: string): NpcTagDef | undefined {
  return npcTags.tags[id]
}

// ---- 物品、商店、談判 ----

export type ItemCategory = 'food' | 'consumable' | 'gear' | 'material' | 'valuable' | 'scroll' | 'equipment' | 'info'
export interface ItemDef {
  name: string
  category: ItemCategory
  price_cc: number
  tags: string[]
  desc?: string
  use?: { heal?: string; slot?: number }
  equip?: { weapon?: string; armor?: string }
  /** 最低要在哪種規模的聚落才買得到 */
  min_location?: string
}
export const itemRules = itemsJson as unknown as {
  sell_ratio: number
  material_sell_ratio: number
  custom_price_ranges: Record<string, [number, number]>
  categories: Record<ItemCategory, string>
  items: ItemDef[]
}
const itemIndex = new Map(itemRules.items.map((i) => [i.name, i]))
export function itemDef(name: string): ItemDef | undefined {
  return itemIndex.get(name)
}

export type ShopType = 'general' | 'temple' | 'tavern'
export interface DealCost { type: 'money' | 'item' | 'hours'; amount?: number; name?: string; qty?: number }
export interface ShopSpecial { id: string; title: string; desc?: string; gives: DealCost[]; gets: RewardEffect[]; stock: number }
export interface ShopTypeDef {
  name: string
  cell: string
  keeper: { classes: string[]; title: string }
  catalog_tag: string
  buys: ItemCategory[]
  ai_effects: RewardEffect['type'][]
  specials: ShopSpecial[]
}
export const shopRules = shopsJson as unknown as {
  location_price_mult: Record<string, number>
  location_rank: Record<string, number>
  affinity_discount_per_point: number
  max_affinity_discount: number
  max_deals: number
  ai_caps: { affinity: number; reputation: number; price_floor_ratio: number; deals: number; stock: number }
  bargain: { base: number; price_factor: Record<Degree, number> }
  types: Record<ShopType, ShopTypeDef>
}

export interface NegotiationOutcome { text: string; effects: RewardEffect[] }
export interface NegotiationTemplate {
  title: string
  goal: string
  counterpart: 'guild_clerk' | 'informant' | 'keeper'
  base: number
  rank_dc: number
  options: { label: string; attr: AttrId; dc: number; cost_cc?: number; cost_ratio?: number }[]
  outcomes: Record<Degree, NegotiationOutcome>
}
export const negotiationRules = negotiationsJson as unknown as {
  max_attempts: number
  templates: Record<string, NegotiationTemplate>
}

// ---- 性別、種族與職業的顯示 ----

export const GENDER_IDS = Object.keys(npcPool.genders).filter((k) => !k.startsWith('$'))

/** 性別：NPC 用 id；主角是自由輸入的文字，能對應到已知性別時沿用其顏色 */
export function genderDef(g?: string): (GenderDef & { id: string }) | undefined {
  if (!g) return undefined
  const byId = npcPool.genders[g]
  if (byId && !g.startsWith('$')) return { ...byId, id: g }
  const text = g.trim().toLowerCase()
  const alias: Record<string, string> = {
    男: 'male', 男性: 'male', male: 'male', m: 'male', 女: 'female', 女性: 'female', female: 'female', f: 'female',
    偽娘: 'femboy', 伪娘: 'femboy', ts: 'ts', 扶她: 'futa', 未知: 'unknown', 不明: 'unknown',
  }
  const id = alias[text]
  return id ? { ...npcPool.genders[id]!, id } : undefined
}

export function genderName(g?: string): string {
  return genderDef(g)?.name ?? g ?? ''
}

export function raceEmoji(id: string): string {
  return attributeRules.races[id]?.emoji ?? ''
}

export function classEmoji(id: string): string {
  return classes[id]?.emoji ?? ''
}

// ---- 查詢 ----

const locationIndex = new Map(geography.locations.map((l) => [l.id, l]))
const regionIndex = new Map(geography.regions.map((r) => [r.id, r]))

export function locationById(id: string): Location {
  const loc = locationIndex.get(id)
  if (!loc) throw new Error(`unknown location: ${id}`)
  return loc
}

export function regionById(id: string): Region {
  const region = regionIndex.get(id)
  if (!region) throw new Error(`unknown region: ${id}`)
  return region
}

export function className(id: string): string {
  return classes[id]?.name ?? id
}

export function raceName(id: string): string {
  return attributeRules.races[id]?.name ?? id
}

export function attrName(id: AttrId): string {
  return attributeRules.attributes.find((a) => a.id === id)?.name ?? id
}

/** 有公會、旅店、酒館的聚落 */
export function isSettlement(loc: Location): boolean {
  return loc.type !== 'dungeon'
}
