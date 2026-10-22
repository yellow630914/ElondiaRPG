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
import monsterTraitsJson from '@data/rules/monster_traits.json'
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
import workJson from '@data/rules/work.json'
import storiesJson from '@data/rules/stories.json'
import craftsJson from '@data/rules/crafts.json'
import homesJson from '@data/rules/homes.json'
import perksJson from '@data/rules/perks.json'
import { adultContent, safeText } from './content'
import type { RewardEffect } from './effects'
import type { GearSlot, GearSpec, GuildRank, QuestKind, SkillQuality } from './types'

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
  /** 這個地點生成 NPC 的種族權重；沒寫時用所屬地區的預設 */
  races?: Record<string, number>
  note?: string
}
export interface Route {
  a: string
  b: string
  days: [number, number] | null
  mode: RouteMode
  estimated?: boolean
  /** 這段路每人收的船資（白鸛）；沒寫時海路每段 SEA_FARE_CC、其他路不收 */
  fare?: number
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
  // ---- 固定 NPC（內容頁籤可以編輯）：不寫時依職業與等級生成 ----
  background?: string
  /** 屬性（升級之後的最終值） */
  attrs?: Partial<Attrs>
  /** 會的能力（取代依職業隨機學的能力） */
  abilities?: string[]
  /** 特質（data/rules/perks.json 的 id；生成的 NPC 隨機抽，固定 NPC 可以在內容頁籤指定） */
  perks?: string[]
  /** 初始裝備（取代依等級隨機生成的裝備；沒寫的欄位空著） */
  gear?: Partial<Record<GearSlot, GearSpec>>
  /** 固定站在聚落的某一格（區塊 key 與座標）；有這個欄位時不看活躍地點 */
  fixed?: { area: string; x: number; y: number }
  /** 只在劇情旗標符合時出現（特殊任務用，見 story.ts） */
  requires?: StoryCond
  /** 依劇情旗標改變出沒：由上往下第一組條件成立的設定取代上面的所屬地點、活躍地點與固定格子 */
  stages?: NpcStage[]
}

export interface NpcStage {
  requires: StoryCond
  location: string
  haunts?: Haunt[]
  fixed?: { area: string; x: number; y: number }
}

/** 劇情旗標的條件：flags 全部成立、flags_none 全部不成立 */
export interface StoryCond {
  flags?: string[]
  flags_none?: string[]
}

// ---- 特殊任務（人工編寫的任務鏈，data/rules/stories.json，說明見 docs/STORY_QUESTS.md） ----

/** 任務從哪裡開始 */
export type StoryStartKind = 'guild' | 'npc' | 'travel' | 'informant' | 'manual'
export interface StoryStart {
  kind: StoryStartKind
  /** guild：哪座城鎮的公會；informant：哪座城鎮的情報商（沒有時任何情報商） */
  location?: string
  /** npc：跟這位固定 NPC 說話 */
  npc?: string
  /** travel：旅途中遇到的機率（每段旅程），只在前往這些地區時（沒有時任何地區） */
  chance?: number
  regions?: string[]
  /** informant：情報的價格 */
  price?: number
  /** 主角至少要幾級 */
  min_level?: number
  /** npc：這位角色對主角的親密度至少要多少（沒見過面算 0） */
  min_affinity?: number
  /** 劇情旗標的條件 */
  requires?: StoryCond
  /** 開頭的事件描述（旅途、情報商的開頭；沒有時用任務的簡介） */
  text?: string
}

/** 任務點在哪裡觸發 */
export type StoryWhere = 'settlement' | 'cell' | 'npc' | 'outskirts' | 'dungeon' | 'road' | 'side'
export interface StoryPlace {
  where: StoryWhere
  /** 地點 id（npc 時可以不寫：跟著角色走） */
  location?: string
  /** cell：站在這種設施上 */
  cell?: string
  /** dungeon：放在第幾層（outskirts / shallow / middle / deep） */
  layer?: DungeonLayerId
  /** npc：這位固定 NPC 在身邊時 */
  npc?: string
  /** side：哪一種臨時地圖（沒有時任何一種） */
  side_map?: string
}

export interface StoryCheck { attr: AttrId; dc: number }

/** 任務點的結果：旗標、效果、同行的夥伴、任務完成或失敗 */
export interface StoryOutcome {
  text?: string
  set_flags?: string[]
  clear_flags?: string[]
  effects?: RewardEffect[]
  /** 固定 NPC 以「任務同行」加入、離開 */
  join?: string
  leave?: string
  complete?: boolean
  fail_quest?: boolean
  /** 這個任務點可以再來一次（沒有時觸發過就結束） */
  retry?: boolean
  /** 進入臨時地圖（travel_events.json 的 side_maps），出口回到原本的地方 */
  side_map?: string
  /** 改去別的地點：旅途中直接抵達那裡，不在旅途時被帶到那裡 */
  travel_to?: string
}

export interface StoryOption {
  label: string
  check?: StoryCheck
  success?: StoryOutcome
  fail?: StoryOutcome
}

/** 任務點：劇情（直接發生）、判定（檢定）、戰鬥、選擇（多個選項，各自可以有檢定） */
export type StoryNodeKind = 'story' | 'check' | 'combat' | 'choice'
export interface StoryNode {
  id: string
  /** 冒險筆記上的目標 */
  title: string
  /** 觸發時的事件描述（給玩家與 AI） */
  text: string
  at: StoryPlace
  /** 解鎖的條件；沒有時任務一開始就解鎖 */
  requires?: StoryCond
  kind: StoryNodeKind
  check?: StoryCheck
  /** 戰鬥：怪物（遭遇表的格式）與固定 NPC */
  enemies?: EncounterGroup
  foes?: string[]
  /** 在場的友方固定 NPC：站在任務點旁邊、戰鬥時站在隊伍這邊、判定與敘事時列為在場的人 */
  allies?: string[]
  options?: StoryOption[]
  /** 劇情、判定成功、戰鬥勝利 */
  success?: StoryOutcome
  /** 判定失敗、戰鬥落敗或撤退 */
  fail?: StoryOutcome
}

export interface StoryDef {
  id: string
  title: string
  summary: string
  /** 建議的公會等級（顯示用；公會接取時檢查） */
  rank?: GuildRank
  start: StoryStart
  /** 開始時成立的旗標（任務鏈的第一個旗標） */
  start_flags?: string[]
  nodes: StoryNode[]
  /** 完成時的報酬 */
  rewards?: RewardEffect[]
  /** 完成時的公會功績（沒有時用 progression.json 的 guild_merit.story） */
  merit?: number
}

/** 內建的特殊任務；內容頁籤的修改套用在這份清單上 */
export const stories = (storiesJson as unknown as { stories: StoryDef[] }).stories

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
  guild_ranks: { rank: GuildRank; levels: [number, number]; merit: number; desc: string }[]
  guild_merit: { quest: number[]; boss: number; story: number; exam_clears: number }
  classes: { id: string; name: string; power: string[] }[]
  races: { id: string; name: string; home: string }[]
  affinity: { min: number; max: number; initial: number; stages: { range: [number, number]; name: string }[] }
  power_gap_attitude: { by_diff: Record<string, string>; clamp: [number, number] }
  ability_rerolls: number
}
/** 一個公會階級的委託報酬（economy.json 的 quest_rewards_cc） */
export interface QuestReward {
  solo: [number, number]
  /** 團隊任務的合計 */
  team?: [number, number]
  /** S 級：單人主導、帶領麾下勢力 */
  leader?: [number, number]
  /** 公會發的委託用哪一種 */
  use: 'solo' | 'team' | 'leader'
  duration_days: [number, number]
  alt_reward?: string
}

export const economy = economyJson as unknown as {
  /** 一般人每天的生活費（罰金、禮物價值的基準） */
  commoner_living_cc_per_day: number
  quest_rewards_cc: { team_size: number; team_mult: number } & Record<string, QuestReward>
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
  /** 仇恨倍率的加減（0.1 = +10%） */
  threat?: number
}

export interface RaceDef {
  name: string
  emoji: string
  bonus: Partial<Attrs>
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
  /** 仇恨值：開戰時的初始值與累積倍率（combat.json 的 threat） */
  threat?: { start: number; mult: number }
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
  /** 無法戰鬥：同行但不參與戰鬥、不分經驗（普通人入隊時用） */
  noncombat?: boolean
}
export const classes = (classesJson as unknown as { classes: Record<string, ClassDef> }).classes
/** 普通人入隊時的職業 */
export const NONCOMBAT_CLASS = 'noncombatant'
/** 可以選、可以隨機抽到的職業（不含「無法戰鬥」） */
export const combatClasses: Record<string, ClassDef> = Object.fromEntries(Object.entries(classes).filter(([, c]) => !c.noncombat))

export function classDef(id: string): ClassDef {
  const c = classes[id]
  if (!c) throw new Error(`unknown class: ${id}`)
  return c
}

// ---- 戰鬥規則 ----

export const combatRules = combatJson as unknown as {
  threat: { floor: number; decay: number; gains: Record<'damage' | 'heal' | 'status' | 'defend' | 'miss' | 'item', number> }
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
  defeat_event: {
    npc_tags: string[]; monster_traits: string[]; exclude_traits: string[]
    check: { attr: AttrId; dc: number }
    options: { label: string; attr: AttrId; dc: number }[]
    free_dc: number
    money_loss: Record<Degree, number>
    shaken_on: Degree[]
  }
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
  /** 使用時另外加減的仇恨值（例如堅守 +20、隱匿 -10） */
  threat?: number
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
/** 所有能力（玩家自訂的內容會改這份：見 mods.ts） */
export const abilities: Record<string, AbilityDef> = Object.fromEntries(abilityList.map((a) => [a.id, a]))

export function abilityDef(id: string): AbilityDef {
  const a = abilities[id]
  if (!a) throw new Error(`unknown ability: ${id}`)
  return a
}

export function classAbilities(classId: string): AbilityDef[] {
  return Object.values(abilities).filter((a) => a.classes.includes(classId))
}

// ---- 裝備 ----

export interface WeaponDef { name: string; dice: string; type: string; attr: AttrId; scale?: Record<string, string>; threat?: number; natural?: boolean }
export interface ArmorDef { name: string; evade: number; dr: number; resist?: AffinityMap; offense?: AffinityMap; threat?: number }
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
  /** 掉落物：機率與數量（預設 1） */
  loot?: { item: string; chance: number; qty?: number }[]
  /** 種類：beast、humanoid、undead、spirit、construct、plant、demon、elemental、fey */
  kind?: string
  /** 持有裝備的人形怪物：打倒時有機會掉落裝備（gear.json 的 drops.armed） */
  armed?: boolean
  /** 可以擲到「發情」特徵（monster_traits.json 的 requires） */
  rut?: boolean
  /** 一定帶著的特徵（例如層主天生巨大） */
  traits?: string[]
  /** 給 AI 的一句描述（外觀與習性） */
  desc?: string
}
export type EncounterGroup = [string, number][]
export type DungeonLayerId = 'outskirts' | 'shallow' | 'middle' | 'deep'
export interface DungeonEncounters {
  outskirts: EncounterGroup[]
  shallow: EncounterGroup[]
  middle: EncounterGroup[]
  deep: EncounterGroup[]
  /** 深層的層主（舊資料） */
  boss: EncounterGroup
  /** 各層的層主：淺層、中層守著往下的階梯，深層是最終層主 */
  bosses?: Partial<Record<'shallow' | 'middle' | 'deep', EncounterGroup>>
}
const enemiesData = enemiesJson as unknown as {
  enemies: EnemyDef[]
  encounters: Record<string, DungeonEncounters>
  wild_encounters: Record<string, EncounterGroup[] | string>
}
export const enemies: Record<string, EnemyDef> = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]))
export const dungeonEncounters = enemiesData.encounters
/** 城郊遭遇表（玩家自訂內容會直接修改） */
export const wildEncounterTables = enemiesData.wild_encounters

export function wildEncounters(region: string): EncounterGroup[] {
  const table = enemiesData.wild_encounters[region] ?? enemiesData.wild_encounters.default
  return Array.isArray(table) ? table : []
}

// ---- 怪物的特徵與狀態 ----

export interface MonsterTraitDef {
  name: string
  weight: number
  desc: string
  hp_mult?: number
  hp_ratio?: number
  mods?: Mods
  ap?: number
  initiative?: number
  resist?: AffinityMap
  offense?: AffinityMap
  xp_mult?: number
  ai?: MonsterAi
  excludes?: string[]
  /** 怪物資料上要有這個旗標才會擲到 */
  requires?: 'rut'
}

export interface MonsterAi {
  /** 對仇恨的在意程度：選目標的權重 = floor + 仇恨 × focus（預設 1） */
  focus?: number
  prefer?: 'weakest' | 'caster'
  flee_below?: number
  never_flee?: boolean
}

export const monsterTraits = monsterTraitsJson as unknown as {
  roll: { chance: number; max: number; bonus: Record<string, number> }
  traits: Record<string, MonsterTraitDef>
}

// ---- 委託 ----

export interface TownQuestTemplate {
  id: string
  kind: Exclude<QuestKind, 'clear_dungeon' | MaterialQuestKind>
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
export type MaterialQuestKind = 'gather_wild' | 'gather_dungeon' | 'drop_wild' | 'drop_dungeon' | 'boss_hunt'
export interface MaterialQuestDef {
  /** 固定的等級 */
  rank?: GuildRank
  /** 依怪物等級浮動的範圍 [最低, 最高] */
  ranks?: [GuildRank, GuildRank]
  /** 只在這一層（gather_dungeon：周邊） */
  layer?: DungeonLayerId
  qty: [number, number]
  reward_mult?: number
}
export interface MaterialQuestRules {
  max_multiplier: number
  max_cells: number
  item_value_mult: number
  per_town: number
  dungeon_quests: number
  dungeon_kinds: Partial<Record<MaterialQuestKind, number>>
  gather_wild: MaterialQuestDef
  gather_dungeon: MaterialQuestDef
  drop_wild: MaterialQuestDef
  drop_dungeon: MaterialQuestDef
  boss_hunt: MaterialQuestDef
}
const townQuestsData = townQuestsJson as unknown as { per_town: number; refresh_days: number; templates: TownQuestTemplate[]; material_quests: MaterialQuestRules }
export const materialQuestRules = townQuestsData.material_quests
export const townQuestsPerTown = townQuestsData.per_town
export const townQuestsRefreshDays = townQuestsData.refresh_days
export const townQuestTemplates: Record<string, TownQuestTemplate> = Object.fromEntries(
  townQuestsData.templates.map((t) => [t.id, t]),
)

// ---- 夥伴、奴隸契約、主動行動 ----

export type Bond = 'hired' | 'voluntary' | 'slave' | 'leader' | 'ally' | 'guest'
export interface ConditionDef {
  name: string
  desc: string
  /** 主動行動檢定的減值（負數是加值） */
  check_penalty?: number
  /** 只影響這些屬性的檢定（沒有時所有檢定） */
  check_attrs?: AttrId[]
  clears?: 'long_rest'
  /** 每場戰鬥的加減 */
  combat_mods?: Mods
  /** 每場戰鬥開始時的暫時生命 */
  combat_temp_hp?: number
  /** 同一組只留一個：rank 高的取代低的，低的蓋不掉高的（用餐） */
  group?: string
  rank?: number
  /** 已經有這個狀態時再獲得一次，改成這個狀態（喝酒：興致高昂 → 微醺） */
  stacks_to?: string
  /** 獲得時拿掉這些狀態 */
  replaces?: string[]
}
export const companionRules = companionsJson as unknown as {
  bonds: Record<Bond, string>
  /** 任務同行的夥伴最多幾人（不佔隊伍名額） */
  guest_max: number
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
  rest: { short_hours: number; long_hours: number; long_rest_gap_hours: number; ambush: Record<'settlement' | 'home' | 'wild' | 'dungeon' | 'road' | 'side', number> }
  noncombatant: { defeat_check: { dc: number; affinity_step: number }; rescue_hours: number; return_hp_ratio: number }
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
  /** 逃亡時在不同地方休息，被契約印記追蹤到的機率倍率（沒列的地方 1） */
  track_place_mult: Partial<Record<string, number>>
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
  master_home: {
    days: { pivot_exit_dc: number; per_dc: number; min: number; max: number; affinity_step: number }
    tag_days: Record<string, number>
    tag_mult: Record<string, number>
    leave: { attr: AttrId; base: number; hours: number; affinity_step: number }
    strict: { found: number; overdue: number; decay_days: number; max: number }
    overdue: { base: number; per_day: number; max: number }
    district: Record<string, HomeDistrict>
    household: {
      patterns: Record<HomeDistrict, HouseholdPattern[]>
      spouse_same_race: number
      spouse_inherits: string[]
      servant_jobs: string[]
      slave_jobs: string[]
    }
  }
  fugitive_master: { return: { attr: AttrId; base: number; affinity_step: number }; negotiate_dc_bonus: number }
  seek_master: { attr: AttrId; base: number; affinity_step: number }
  master_tags: {
    kinds: Record<'adventurer' | 'commoner', { dc: number; market: number }>
    tags: Record<string, { dc: number; chance: number; public: number; black: number; negotiate?: number }>
  }
  unmark: { hours: number; fee_ratio: Record<Degree, number>; services: Record<'temple' | 'black' | 'mage', UnmarkServiceDef> }
  safe_spots: string[]
  marking: { attr: AttrId; base: number; severity: string[] }
  master_events: {
    step_chance: number; travel_chance: number; cooldown_hours: number
    free_dc: number; free_outcomes: Record<Degree, RewardEffect[]>
    events: MasterEventDef[]
  }
}

/** 主人家裡的人的一種組成：spouse 是伴侶出現的機率，其他是人數範圍 */
export interface HouseholdPattern {
  weight: number
  spouse?: number
  children?: [number, number]
  servants?: [number, number]
  slaves?: [number, number]
}

export interface MasterEventDef {
  id: string
  weight: number
  /** {master} 會換成主人的名字 */
  text: string
  hours: number
  /** 給玩家選的三種回應 */
  options: MasterEventOption[]
  /** 自己輸入回應時的參考 DC（沒有時用 free_dc） */
  free_dc?: number
  /** 成人向：設定開啟「成人向」時才會發生 */
  adult?: boolean
  /** 只在經過這種設施（同一格或相鄰）時發生，機率為 chance，不在一般事件的抽選裡 */
  cell?: string
  chance?: number
  /** 成人向的親密場景是什麼（{master} 換成主人的名字）：回應帶 adult_scene 時，敘事要詳細描寫 */
  scene?: string
  /** 只在主人的親密度在這個範圍時發生（含） */
  affinity_min?: number
  affinity_max?: number
  /** 主人有其中一個標籤時才發生 */
  tags?: string[]
  /** 主人有其中一個標籤時不發生 */
  tags_none?: string[]
  /** 只在主人的家裡（at_home: true）或不在家時（false）發生 */
  at_home?: boolean
  /** 離家逾期時的「主人要回家」事件：不在一般事件的抽選裡 */
  overdue?: boolean
}

export interface UnmarkServiceDef {
  name: string
  desc: string
  /** cell：站在設施上；black_market：知道這裡的黑市，在酒館；caster：身邊或隊伍裡有這些職業的人 */
  where: 'cell' | 'black_market' | 'caster'
  cell?: string
  classes?: string[]
  attr: AttrId
  dc_offset: number
  /** 對魔力封印的印記，DC 再降低 */
  arcane_bonus?: number
  /** 逃亡奴隸的 DC 增加 */
  fugitive_dc?: number
  price_per_point: number
  fumble: 'backlash' | 'betray'
  backlash_hp_ratio?: number
}

export interface MasterEventOption {
  label: string
  /** 沒有檢定時的結果文字 */
  result?: string
  check?: { attr: AttrId; dc: number }
  success?: string
  fail?: string
  effects?: RewardEffect[]
  effects_success?: RewardEffect[]
  fail_effects?: RewardEffect[]
  /** 覆蓋事件的耗時 */
  hours?: number
  /** 這個回應會進入親密場景（事件的 scene）：always 一定、success / fail 檢定成功或失敗時；只在開啟成人向時 */
  adult_scene?: 'always' | 'success' | 'fail'
}

export function contractDef(id: string): ContractDef {
  const c = slaveryRules.contracts[id]
  if (!c) throw new Error(`unknown contract: ${id}`)
  // 關閉成人向時，娼妓契約顯示為技師契約
  return adultContent() ? c : { ...c, name: safeText(c.name), mark: safeText(c.mark), side_effects: c.side_effects.map(safeText) }
}

export type ActionKind = 'free' | 'hire' | 'haggle' | 'invite' | 'black_market' | 'negotiate' | 'escape' | 'bargain' | 'negotiation' | 'rest_talk'
  | 'chat' | 'gift' | 'flatter' | 'bluff' | 'intimidate' | 'steal' | 'attack' | 'master_permit' | 'master_leave' | 'marking' | 'master_event'
  | 'master_return' | 'seek_master' | 'unmark' | 'work' | 'patron' | 'craft' | 'make' | 'produce' | 'invent' | 'defeat_event' | 'story'
  | 'train' | 'perk_pitch'
export type EffectKind = 'affinity' | 'relationship_text' | 'flag' | 'reputation' | 'money' | 'item' | 'xp' | 'meet' | 'ability' | 'hp' | 'mark'
  | 'release' | 'change_master' | 'gear'
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
  /** 只出現在有這個地區的聚落（例如娼妓只在有娼館的城鎮） */
  requires_zone?: string
  zone_weights?: Record<string, number>
  haunt_extra?: [number, number]
  haunt_extra_weight?: [number, number]
  wealth: number
  occupations?: string[]
  ai_hint: string
  /** 互斥的標籤（不會同時擁有） */
  exclusive?: string[]
  /** 和帶這個標籤的人互動時的參考 DC 修正 */
  dc_mods?: Partial<Record<'chat' | 'gift' | 'flatter' | 'hire' | 'invite', number>>
  /** 不會因關係差而在野外動手（被攻擊過才會） */
  never_hostile?: boolean
  /** 對他犯罪被發現時，額外的聲望變化 */
  crime_reputation?: number
}

/** 標籤的 DC 修正：所有標籤相加 */
export function tagDcMod(rec: { tags?: string[] }, key: keyof NonNullable<NpcTagDef['dc_mods']>): number {
  return (rec.tags ?? []).reduce((sum, t) => sum + (npcTags.tags[t]?.dc_mods?.[key] ?? 0), 0)
}

/** 兩個標籤互斥嗎（任何一方寫了就算） */
export function tagsExclusive(a: string, b: string): boolean {
  return !!npcTags.tags[a]?.exclusive?.includes(b) || !!npcTags.tags[b]?.exclusive?.includes(a)
}
export const npcTags = npcTagsJson as unknown as {
  kinds: Record<NpcKind, { name: string; zone_weights: Record<string, number>; level?: [number, number]; dungeon_haunts?: [number, number] }>
  neighbor_weight: number
  tags: Record<string, NpcTagDef>
}
export const population = populationJson as unknown as {
  /** 有娼館的城鎮，名單上至少有幾位娼妓 */
  brothel_workers: number
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
  const t = npcTags.tags[id]
  // 關閉成人向時，娼妓顯示為技師
  return !t || adultContent() ? t : { ...t, name: safeText(t.name), ai_hint: safeText(t.ai_hint) }
}

// ---- 工作與娼館 ----

export interface JobDef {
  name: string
  attr: AttrId
  dc: number
  /** 每小時的基本工資 */
  rate_cc: number
  desc: string
  /** 官方機構：逃亡奴隸不能在這裡工作 */
  official?: boolean
}

export const workRules = workJson as unknown as {
  safe_names: [string, string][]
  hours: number[]
  degree_pay: Record<Degree, number>
  fumble_affinity: number
  jobs: Record<string, JobDef>
  brothel: {
    patron: {
      attr: AttrId; dc: number; hours: number; price_cc: number; race_mult: Record<string, number>
      discount: number; overcharge: number; pickpocket_ratio: number; affinity: Record<Degree, number>
    }
  }
}

// ---- 物品、商店、談判 ----

export type ItemCategory = 'food' | 'consumable' | 'gear' | 'material' | 'scroll' | 'equipment' | 'info' | 'furniture'
/**
 * 消耗品的效果（都是可以量化的數值）：
 * heal 回復生命（骰子）、slot 回復一個 N 環以下的法術環、cleanse 解除狀態、status 給自己或隊友一個狀態、
 * temp_hp 臨時生命值、ap 立刻獲得行動點、revive 以最大生命的比例救起倒下的隊友、
 * damage 對敵人造成傷害、apply 對敵人施加狀態、save 豁免（成功時傷害減半、不受狀態），area 為投擲的範圍（one 單體、all 全體）；
 * escape 傳送脫離戰鬥。戰鬥以外只能用 heal 與 slot。
 */
export interface ItemUse {
  /** 吃喝：得到這個非戰鬥狀態（companions.json 的 conditions），只能在戰鬥以外使用 */
  condition?: string
  /** 書籍：讀了之後有機會學會其中一個特質（perks.json 的 id；也可以寫說法交給 AI） */
  perks?: string[]
  heal?: string
  slot?: number
  cleanse?: string[]
  status?: { id: string; turns: number }
  temp_hp?: number
  ap?: number
  revive?: number
  /** 投擲：對敵人造成傷害（area 為 all 時波及所有敵人） */
  damage?: { dice: string; type: string }
  /** 投擲：對敵人施加狀態，save 與 dc 為豁免（成功時不受狀態、傷害減半） */
  apply?: { status: string; turns: number; save?: AttrId; dc?: number }
  /** 投擲的豁免（沒有 apply 也能用）：成功時傷害減半、不受狀態 */
  save?: { attr: AttrId; dc: number }
  area?: 'one' | 'all'
  /** 傳送：全隊立刻脫離戰鬥 */
  escape?: boolean
  combat_only?: boolean
}

export interface ItemDef {
  name: string
  category: ItemCategory
  price_cc: number
  tags: string[]
  desc?: string
  use?: ItemUse
  /** 光源與燃料：每一份在黑暗中能照亮幾格（火把一捆、一瓶燈油） */
  burns?: number
  /** 家具：能放的地方、功能（床、高階工作台）、舒適度（見 docs/HOMES.md） */
  furniture?: FurnitureSpec
  /** 裝備：底材 × 材料（gear.json） */
  gear?: GearSpec
  /** 打造材料：可以做成哪些材料（gear.json 的 materials） */
  forge?: { materials: string[] }
  /** 最低要在哪種規模的聚落才買得到 */
  min_location?: string
  /** 事件可能出現：AI 判定主動行動時可以把它當成報酬 */
  event?: boolean
  /** 雜物的工具模板（items.json 的 tools） */
  tool?: ItemTool
  /** 情報：解讀之後得到什麼（沒有時是附近隨機的事件點） */
  intel?: ItemIntel
  /** 配方：怎麼做出這件物品（見 docs/CRAFTING.md 第 6 節） */
  recipe?: RecipeSpec
  /** 種子：種在房子的苗圃會長出什麼（見 docs/HOMES.md） */
  seed?: SeedSpec
}

/** 配方：用哪種工藝的幾級、哪些材料，做出幾份這件物品 */
export interface RecipeSpec {
  craft: CraftId
  /** 需要的工藝等級（1～5）；也決定 DC 與工具階級 */
  level: number
  inputs: { name: string; qty: number }[]
  /** 一批做出幾份（預設 1） */
  qty?: number
  /** 一批另外要買的東西（瓶子、溶劑、基本食材……），乘地點物價 */
  cost_cc?: number
  /** 一批花幾小時（預設 2） */
  hours?: number
}

/** 種子：種在苗圃（place）上，days 天後收成 yields，數量在 qty 之間；yields 有好幾種時隨機一種 */
export interface SeedSpec {
  yields: string[]
  qty: [number, number]
  days: number
  place: FurniturePlace
}

/**
 * 情報物品解讀之後的內容：
 * point 事件點（event 沒寫時隨機；location 沒寫時在解讀的地方附近；地下城可以指定 layer）、
 * story 特殊任務的消息（開始 story）、lead 進行中委託的線索（委託檢定 +5）。
 */
export interface ItemIntel {
  kind: 'point' | 'story' | 'lead'
  event?: 'combat' | 'chest' | 'merchant'
  location?: string
  layer?: DungeonLayerId
  /** 事件點有效幾天（預設 5） */
  days?: number
  story?: string
}

export type ToolKind = 'lockpick' | 'trap' | 'light' | 'travel' | 'camp' | 'hone' | 'craft'
export interface ItemTool {
  kind: ToolKind
  bonus?: number
  /** 工藝工具：哪種工藝、第幾階（1 低階隨身、2 中階工坊、3 高階工作台） */
  craft?: CraftId
  tier?: 1 | 2 | 3
  /** 照明：燒的是哪種物品（油燈的燈油）；沒有時燒工具本身（有 burns 時）或不會燒掉 */
  fuel?: string
}
export interface ToolDef { name: string; desc: string; bonus?: number; max?: number; condition?: string }
export interface MealDef { id: string; name: string; condition: string; min_location?: string }
export const itemRules = itemsJson as unknown as {
  sell_ratio: number
  material_sell_ratio: number
  custom_price_ranges: Record<string, [number, number]>
  categories: Record<ItemCategory, string>
  meals: { hours: number; menu: MealDef[] }
  tools: Record<ToolKind, ToolDef>
  items: ItemDef[]
}
const itemIndex = new Map(itemRules.items.map((i) => [i.name, i]))
/** 物品清單改變後（玩家自訂內容）重建索引 */
export function reindexItems() {
  itemIndex.clear()
  for (const i of itemRules.items) itemIndex.set(i.name, i)
}
export function itemDef(name: string): ItemDef | undefined {
  return itemIndex.get(name) ?? saveItemIndex.get(name)
}

// 這個存檔自創的物品（自創配方，見 invention.ts）：不在物品目錄裡，讀檔、開新遊戲時換成那個存檔的
const saveItemIndex = new Map<string, ItemDef>()
export function setSaveItems(items: ItemDef[]) {
  saveItemIndex.clear()
  for (const i of items) saveItemIndex.set(i.name, i)
}
export function saveItems(): ItemDef[] {
  return [...saveItemIndex.values()]
}

export type ShopType = 'general' | 'temple' | 'tavern' | 'smithy' | 'tailor' | 'jeweler' | 'magic' | 'informant' | 'wanderer'
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
  /** 每天隨機上架：目錄裡任何商店的消耗品與材料（材料的售價 = 收購價 × material_markup） */
  random?: { consumables?: number; materials?: number; material_markup?: number; max_material_price?: number[] }
  /** 情報商：事件點的情報（依層數的價格：近郊、周邊、淺層、中層、深層）、特殊任務的消息、委託的線索 */
  info?: { point_prices: number[]; points_per_day: number; valid_days: number; quest_price: number }
  /** 流浪商人：每天幾件隨機的優良裝備 */
  rare_gear?: number
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


// ---- 工藝（crafts.json，見 docs/CRAFTING.md） ----

export type CraftId = 'smithing' | 'woodworking' | 'leatherwork' | 'tailoring' | 'jewelcraft' | 'alchemy' | 'cooking'

export interface CraftSkillDef {
  name: string
  /** 處理的材料種類（gear.json 的 materials.kind）；煉金、烹飪沒有，只走配方 */
  kinds: string[]
  attr: AttrId
  /** 可以租工坊、委託打造的店 */
  shop: string
}

export const craftRules = craftsJson as unknown as {
  skills: Record<CraftId, CraftSkillDef>
  max_level: number
  level_bonus: number
  xp_to_next: number[]
  xp: Record<Degree, number>
  tool_tier: number[]
  tool_tier_names: string[]
  safe_points: string[]
  workshop_rent: { per_hour_cc: number }
  self: { hours: number; tier1_cost_ratio: number }
  shop_levels: Record<string, [number, number]>
  companion: { min_affinity: number }
  recipe: { dc: number[]; max_batches: number; critical_bonus: number; partial_ratio: number; lost_on_fail: number }
  invention: { categories: Record<CraftId, ItemCategory[]>; dc_bonus: number; hours: number; max_effects: number; max_inputs: number }
  dismiss_penalty: { days: number; affinity: number; price_mult: number; notoriety_days: number }
}

export const CRAFT_IDS = Object.keys(craftRules.skills) as CraftId[]

// ---- 房屋（homes.json，見 docs/HOMES.md） ----

export type FurniturePlace = 'indoor' | 'yard' | 'basement'

export interface FurnitureSpec {
  places: FurniturePlace[]
  /** bed：在家長休；workbench：高階工作台（craft）；garden：可以播種的苗圃 */
  function?: 'bed' | 'workbench' | 'garden'
  craft?: CraftId
  comfort?: number
  icon?: string
}

export type HomeDistrict = 'cottage' | 'townhouse' | 'house' | 'manor'

export interface HomeDistrictDef {
  name: string
  price_cc: number
  floors: number
  basement: boolean
  size: [number, number]
  yard: number
  rooms: [number, number]
}

export const homeRules = homesJson as unknown as {
  districts: Record<HomeDistrict, HomeDistrictDef>
  by_location: Record<string, HomeDistrict>
  noble: HomeDistrict
  lots: Record<string, number>
  comfort_rested: number
}

// ---- 特質（被動，data/rules/perks.json，見 docs/PERKS.md） ----

/** 檢定的情境：主動行動以外的檢定各有一種 */
export type CheckContext =
  | 'action' | 'negotiation' | 'master_event' | 'gate' | 'trap' | 'lock' | 'travel' | 'road' | 'quest' | 'retreat' | 'stealth'
  | 'initiative' | 'save'

/** 檢定加值適用的範圍：同一欄位是「或」，不同欄位是「且」；沒寫的欄位不限 */
export interface CheckFilter {
  attrs?: AttrId[]
  contexts?: CheckContext[]
  kinds?: ActionKind[]
  vs_tags?: string[]
}

export type PerkEffect =
  | { check: CheckFilter; bonus: number }
  | { combat: Mods }
  | { resist: AffinityMap }
  | { offense: AffinityMap }

export interface PerkDef {
  id: string
  name: string
  desc: string
  effects: PerkEffect[]
  /** 缺陷（保留：目前沒有缺陷，效果可以是負的） */
  flaw?: boolean
  /** 種族特質（原本的種族天賦）：這個種族的角色自動擁有，不寫進存檔；不能選、不能學、不會失去 */
  race?: string
  requires?: { races?: string[]; classes?: string[] }
  /** 和這些特質互斥 */
  exclusive?: string[]
  /** 可以在這些設施花錢學 */
  train?: { cells: string[]; price_cc: number; hours: number; attr: AttrId; dc: number }
  /** NPC 生成時抽到的權重與更容易抽到的標籤、職業 */
  npc?: { weight?: number; tags?: string[]; classes?: string[] }
  /** 玩家自訂或 AI 設計的（不在清單裡） */
  custom?: boolean
}

export const perkRules = perksJson as unknown as {
  contexts: Record<CheckContext, string>
  levelup: { levels: number[]; choices: number }
  npc: { chances: number[]; tag_mult: number; class_mult: number }
  pitch: { attr: AttrId; dc: number; hours: number; power_delta: Partial<Record<Degree, number>> }
  custom: { name_chars: number; desc_chars: number; effects: number; check_bonus: [number, number]; combat: [number, number]; resist: [number, number] }
  perks: PerkDef[]
}

/** 清單裡的特質 */
export function perkDef(id: string): PerkDef | undefined {
  return perkRules.perks.find((p) => p.id === id)
}

/** 可以取得的特質（建角、升級、事件、訓練、書籍、NPC 的特質清單）：種族特質除外 */
export function choosablePerks(): PerkDef[] {
  return perkRules.perks.filter((p) => !p.race)
}

/** 可以取得的特質 id（種族特質與不存在的回傳 false） */
export function isChoosablePerk(id: string): boolean {
  const p = perkDef(id)
  return !!p && !p.race
}

