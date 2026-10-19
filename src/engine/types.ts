import type { CombatState } from './combat'

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
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  skills: string[]
  status: string[]
  personality?: string
  faction?: string
  /** 升級時待選的技能選項（每組三選一） */
  pendingSkillChoices?: string[][]
  /** 只有 NPC 隊友有；-100 ~ 100，隱性數值 */
  affinity?: number
  isPlayer?: boolean
}

export interface Quest {
  id: string
  title: string
  rank: GuildRank
  /** 發布委託的城鎮，也是交付地點 */
  giver: string
  target: string
  /** 需要在目標地點獲勝的次數 */
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
}
