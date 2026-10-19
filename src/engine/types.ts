import type { CombatState } from './combat'
import type { Attrs } from './data'
import type { Area, Position } from './grid'
import type { Memory, Relationship } from './social'

// 報告型別對應 schemas/report.schema.json，修改時兩邊要同步。

export type ReportKind = 'travel' | 'combat' | 'action' | 'event' | 'quest' | 'rest' | 'trade' | 'social'
export type RollResult = 'success' | 'critical' | 'fail' | 'fumble' | 'partial' | 'none'
export type OutcomeResult =
  | 'victory' | 'defeat' | 'fled' | 'arrived' | 'interrupted' | 'success' | 'failure' | 'neutral'
export type SkillQuality = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type SkillSource = 'level_up' | 'study' | 'insight' | 'bloodline' | 'race_change'
export type GuildRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export interface GameTime {
  day: number
  hour?: number
  minute?: number
}

export interface ActorState {
  id: string
  name: string
  race?: string
  class?: string
  level?: number
  rank?: string
  /** [事件前, 事件後, 上限] */
  hp?: [number, number, number]
  mp?: [number, number, number]
  status?: string[]
  equipment?: string[]
  personality?: string
  attitude?: string
}

export interface Effect {
  type: 'damage' | 'heal' | 'status_add' | 'status_remove' | 'move' | 'item' | 'flag' | 'note'
  target?: string
  amount?: number
  element?: string
  status?: string
  text?: string
}

export interface TimelineEntry {
  seq: number
  round?: number
  time?: GameTime
  actor: string
  action: string
  target?: string
  roll?: { dice?: string; value?: number; dc?: number }
  result: RollResult
  effects?: Effect[]
}

export interface ActorDelta {
  actor: string
  amount?: number
  from?: number
  to?: number
}

export interface ItemDelta {
  name: string
  qty: number
  quality?: string
  owner?: string
}

export interface Changes {
  money_cc?: number
  xp?: ActorDelta[]
  level_up?: ActorDelta[]
  skills_gained?: { actor: string; skill: string; quality: SkillQuality; source: SkillSource }[]
  items_gained?: ItemDelta[]
  items_lost?: ItemDelta[]
  affinity?: { npc: string; delta: number; after: number; reason?: string }[]
  reputation?: { faction: string; delta: number }[]
  flags?: Record<string, unknown>
}

export interface Report {
  schema_version: '0.1'
  report_id: string
  kind: ReportKind
  time: { start: GameTime; end: GameTime }
  location: { at: string; to?: string; region?: string; scene?: string; weather?: string }
  party: ActorState[]
  others?: ActorState[]
  quest?: { id?: string; title?: string; rank?: GuildRank; status?: 'accepted' | 'progress' | 'completed' | 'failed' | 'abandoned' }
  timeline?: TimelineEntry[]
  outcome: { result: OutcomeResult; summary?: string; tags?: string[] }
  changes: Changes
  narration?: {
    pov?: 'second_person' | 'third_person'
    length?: 'short' | 'medium' | 'long'
    tone?: string
    focus?: string[]
    player_intent?: string
  }
  lore_keys?: string[]
}

// ---- 遊戲狀態 ----

export interface Character {
  id: string
  name: string
  race: string
  class: string
  level: number
  xp: number
  /** 五屬性：力量、靈巧、智力、信仰、魅力 */
  attrs: Attrs
  /** 尚未分配的屬性點 */
  attrPoints: number
  hp: number
  /** 由等級與屬性推導，見 character.ts 的 recalc */
  maxHp: number
  /** 各環已使用的法術環數量（索引 0 = 1 環） */
  slotsUsed: number[]
  /** 每次休息可用 N 次的能力已使用次數 */
  usesPerRest: Record<string, number>
  /** 已學會的技能、法術、戲法 id */
  abilities: string[]
  weapon: string
  armor: string
  status: string[]
  personality?: string
  faction?: string
  /** 升級時待選的能力選項（每組三選一） */
  pendingAbilityChoices?: string[][]
  /** 只有 NPC 隊友有；-100 ~ 100。來源是人際關係條目，這裡是同步副本 */
  affinity?: number
  isPlayer?: boolean
}

/**
 * clear_dungeon：到冒險區域獲勝 goal 次（E 級以上）。
 * 其餘為 F 級城內／近郊委託：pest、hunt 是戰鬥；search、gather、patrol 是檢定；delivery 花時間即可。
 */
export type QuestKind = 'clear_dungeon' | 'pest' | 'hunt' | 'search' | 'gather' | 'patrol' | 'delivery'

export interface Quest {
  id: string
  title: string
  rank: GuildRank
  kind: QuestKind
  area: 'town' | 'outskirts' | 'dungeon'
  /** 城內／近郊委託的範本 id（data/rules/town_quests.json） */
  template?: string
  /** 發布委託的城鎮，也是交付地點 */
  giver: string
  /** 執行地點；城內／近郊委託就是發布的城鎮 */
  target: string
  /** 需要完成的次數 */
  goal: number
  progress: number
  reward_cc: number
  status: 'available' | 'accepted' | 'ready' | 'completed'
}

export interface InventoryItem {
  name: string
  qty: number
  quality?: string
}

export interface GameState {
  version: 1
  seed: number
  rngState: number
  time: Required<GameTime>
  location: string
  money_cc: number
  party: Character[]
  inventory: InventoryItem[]
  quests: Quest[]
  /** 已招募或已離隊的 NPC id */
  recruited: string[]
  reputation: Record<string, number>
  flags: Record<string, unknown>
  reports: Report[]
  nextReportNo: number
  /** 進行中的戰鬥 */
  combat?: CombatState
  /** 在格子地圖上的位置 */
  position?: Position
  /** 隨機生成的區域（近郊、冒險區域各層） */
  areas?: Record<string, Area>
  /** 人際關係：角色 id → 條目 */
  relationships?: Record<string, Relationship>
  /** 共同記憶 */
  memories?: Memory[]
}
