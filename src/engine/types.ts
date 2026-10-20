import type { ActionPending } from './actions'
import type { CombatState } from './combat'
import type { AffinityMap, AttrId, Attrs, Bond, DealCost, Mods, NpcDef } from './data'
import type { RewardEffect } from './effects'
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
  gender?: string
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
  /** 入隊、離隊、獲釋、成為奴隸、逃亡、被抓回 */
  companions?: CompanionChange[]
  /** 非戰鬥狀態（奴隸印記、逃亡、受罰）的增減 */
  conditions?: { actor: string; condition: string; added: boolean }[]
  /** 短休花費／長休回復的生命骰 */
  hit_dice?: { actor: string; spent?: number; regained?: number; healed?: number }[]
  /** 奴隸契約「收益歸屬」被主人拿走的金錢 */
  master_share_cc?: number
  /** 法術環、生命骰、每次休息可用次數的增減 */
  resources?: ResourceChange[]
}

export interface ResourceChange {
  actor: string
  kind: 'slot' | 'hit_dice' | 'ability_use'
  delta: number
  detail?: string
}

export interface CompanionChange {
  npc: string
  name: string
  change: 'joined' | 'left' | 'freed' | 'enslaved' | 'escaped' | 'recaptured' | 'transferred'
  bond?: Bond
  reason?: string
}

/** 主動行動的檢定：程式擲骰，AI（或規則）決定屬性與 DC */
export interface CheckInfo {
  action: string
  attr: AttrId
  /** 程式算出的參考 DC */
  base_dc: number
  /** 實際使用的 DC（AI 可在 ±dc_adjust 內調整） */
  dc: number
  natural: number
  modifier: number
  total: number
  /** 實際的成功程度（AI 判定時由 AI 決定） */
  degree: 'critical' | 'success' | 'partial' | 'fail' | 'fumble'
  /** 骰值對 DC 算出的參考成功程度；只在與實際結果不同時記錄 */
  reference_degree?: 'critical' | 'success' | 'partial' | 'fail' | 'fumble'
  source: 'ai' | 'rules'
  rationale?: string
  /** AI 讓結果出乎預料時的說明 */
  twist?: string
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
  check?: CheckInfo
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

/** 裝備欄位（gear.json 的 slots） */
export type GearSlot = 'main_hand' | 'off_hand' | 'head' | 'body' | 'legs' | 'wrists' | 'feet' | 'belt' | 'accessory' | 'neck_1' | 'neck_2'

/** 一件裝備的組成：底材 × 材料（＋稀有度與附魔） */
export interface GearSpec {
  base: string
  material: string
  /** 沒有時用材料的稀有度 */
  rarity?: string
  enchants?: { mods?: Mods; resist?: AffinityMap; offense?: AffinityMap }
}

/** 穿在身上的裝備：物品名稱與組成（自帶組成，不必回頭查存檔） */
export interface EquippedGear {
  name: string
  spec: GearSpec
}

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
  /** 武器與上身防具的基本類型（equipment.json）；有裝備欄位時由主手與上身的裝備決定 */
  weapon: string
  armor: string
  /** 裝備欄位 */
  gear?: Partial<Record<GearSlot, EquippedGear>>
  status: string[]
  personality?: string
  faction?: string
  /** 升級時待選的能力選項（每組三選一） */
  pendingAbilityChoices?: string[][]
  /** 目前這組選項已經重抽的次數 */
  abilityRerollsUsed?: number
  /** 只有 NPC 隊友有；-100 ~ 100。來源是人際關係條目，這裡是同步副本 */
  affinity?: number
  isPlayer?: boolean
  /** 入隊方式；主角沒有（除非加入了別人的隊伍，見 GameState） */
  bond?: Bond
  /** 隊長的 id：跟著別人的隊伍一起行動的成員（bond = leader / ally） */
  group?: string
  /** 奴隸契約；主角也可能有（主人是 NPC） */
  contract?: ContractRef
  /** 已花掉的生命骰（總數 = 等級） */
  hitDiceUsed?: number
  /** 性別：主角是自由輸入的文字；NPC 是性別 id（見 npc_pool.json） */
  gender?: string
  appearance?: string
  background?: string
  birthplace?: string
}

export interface ContractRef {
  /** 印記的模板 id（data/rules/slavery.json 的 contracts），自訂的印記為 custom */
  kind: string
  /** 主人的 id；主角為 pc；無主為空字串 */
  master: string
  masterName: string
  /** 目前的服從懲罰（受罰可能加重） */
  obedience: number
  since: GameTime
  /** 這枚印記的條款（自訂的印記，或刻印時決定的版本）；沒有時用模板的值 */
  terms?: MarkTerms
}

/** 契約印記的條款：名稱、描述與各項數值（描述會給 AI 判定與寫正文） */
export interface MarkTerms {
  name: string
  /** 印記的外觀與感覺 */
  mark: string
  /** 收益歸屬：主角賺到的錢歸主人的比例（0～1） */
  income_share: number
  negotiate_dc: number
  escape_dc: number
  /** 出城、旅行時向主人請求同意的檢定難度 */
  exit_dc: number
  /** 逃亡時每次休息被找到的機率（0～1） */
  recapture_chance: number
  /** 逃離時的反噬：失去最大生命值的比例 */
  escape_hp_ratio: number
  /** 對主人的檢定懲罰（初始值） */
  obedience_penalty: number
  side_effects: string[]
  functions: string[]
  /** 魔力封印：最多能施放的法術環 */
  spell_cap?: number
}

/** 遊戲中登場的 NPC（含程式生成的）；不在隊伍時保存角色資料，再次入隊時沿用 */
export interface NpcRecord extends NpcDef {
  generated?: boolean
  background?: string
  /** 平常待的設施（格子種類，例如 tavern、shop、inn）；沒有時在整個聚落都找得到 */
  spot?: string
  /** 被攻擊後敵對（不再接受雇用與一般互動） */
  hostile?: boolean
  /** 已經死亡（不再出現） */
  dead?: boolean
  /** 暫時待在某一格（野外與地下城遇到的人、重逢的熟人）；until 之後失效 */
  at?: { area: string; x: number; y: number; until: number }
  /** 同行的隊伍（一起遭遇） */
  group?: string
  character?: Character
}

export interface PendingMasterEvent {
  /** slavery.json master_events.events 的 id */
  id: string
  /** 已經代入主人名字的事件描述 */
  text: string
}

export interface PendingMark {
  /** 主人原本打算刻的印記模板 */
  intended: string
  /** 刻印檢定之後可以選的印記模板（還沒擲骰時為空） */
  allowed?: string[]
  /** 可以自訂印記（大成功） */
  custom?: boolean
  /** 刻印的檢定擲過了 */
  rolled?: boolean
  /** AI 依行為提議的印記描述 */
  suggestion?: { name?: string; mark?: string }
}

export interface Standoff {
  /** 對方（一個人或一支隊伍） */
  npcs: string[]
  area: string
  /** 被對方發現了 */
  detected: boolean
  /** 主角主動現身（應對檢定 +2） */
  revealed?: boolean
  /** 對方開的過路費 */
  demand_cc: number
  day: number
}

export interface Roster {
  /** 名單上的 NPC id（不含店主、公會職員等職員） */
  members: string[]
  /** 建立的日期 */
  day: number
  /** AI 已經潤飾過名字、外貌與性格 */
  flavored?: boolean
  /** 上次檢查名單變動的日期 */
  updated?: number
}

export interface TavernCandidate {
  npc: string
  asking_cc: number
  /** 今天拒絕了 */
  declined?: boolean
  /** 部分成功時對方的還價 */
  counter_cc?: number
}

export interface SlaveListing {
  npc: string
  price_cc: number
  contract: string
  haggled?: boolean
}

export interface PartyOffer {
  id: string
  leader: string
  members: string[]
  pay_cc: number
  location: string
  day: number
}

export interface RelationSuggestion {
  id: string
  npc: string
  text: string
  report?: string
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
  /** 任務旗標（談判、事件的結果），例如 lead：委託檢定 +5 */
  flags?: Record<string, unknown>
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
  /** 登場過的 NPC（含生成的） */
  npcs?: Record<string, NpcRecord>
  /** 各地點的 NPC 名單（第一次進入時建立，見 engine/population.ts） */
  rosters?: Record<string, Roster>
  /** 各城鎮酒館今天的候選人 */
  taverns?: Record<string, { day: number; candidates: TavernCandidate[]; flavored?: boolean }>
  /** 奴隸市場今天的商品；鍵為 城鎮/public 或 城鎮/black */
  markets?: Record<string, { day: number; stock: SlaveListing[] }>
  /** 其他隊伍的入隊邀請 */
  partyOffers?: PartyOffer[]
  /** 主角打算離開目前所在的別人隊伍：下次休息時進行 */
  pendingLeave?: { mode: 'sneak' | 'formal' }
  /** 已擲骰、等待判定的主動行動 */
  pendingAction?: ActionPending
  /** 剛成為奴隸、等待刻印的檢定與選擇（見 engine/slavery.ts） */
  pendingMark?: PendingMark
  /** 主人的突發事件，等待主角回應（三選一或自己輸入） */
  pendingMasterEvent?: PendingMasterEvent
  /** 身為奴隸時，今天主人已經同意出城的地點 → 日期；被拒絕的地點 → 日期 */
  masterPass?: Record<string, number>
  masterRefuse?: Record<string, number>
  /** 上一次主人突發事件的時間（小時數，避免太頻繁） */
  lastMasterEvent?: number
  /** 和敵對冒險者的對峙（見 engine/encounters.ts） */
  standoff?: Standoff
  /** 今天已經避開或談妥的敵對 NPC：id → 日期 */
  avoided?: Record<string, number>
  /** 各地點的衛兵警戒：等級與最後一次犯案的日期 */
  alerts?: Record<string, { level: number; day: number }>
  /** 被通緝的勢力 */
  wanted?: Record<string, { day: number }>
  /** 今天通過城門盤查的地點 → 日期 */
  gatePass?: Record<string, number>
  /** 今天被城門擋下的地點 → 日期 */
  gateBlock?: Record<string, number>
  /** 上次長休結束的時間 */
  lastLongRest?: GameTime
  /** AI 提議的人際關係文字更新，等待玩家確認 */
  suggestions?: RelationSuggestion[]
  /** 各商店今天的交易清單；鍵為 城鎮/商店類型 */
  shops?: Record<string, ShopState>
  /** AI 自創的物品（可以再賣回商店） */
  customItems?: Record<string, { category: string; price_cc: number; desc?: string; gear?: GearSpec }>
  /** 進行中與結束的談判 */
  negotiations?: Negotiation[]
}

export interface Deal {
  id: string
  title: string
  desc?: string
  gives: DealCost[]
  gets: RewardEffect[]
  /** 今天還能交易幾次 */
  stock: number
  haggled?: boolean
}

export interface ShopState {
  day: number
  /** 店主（NPC id） */
  keeper: string
  deals: Deal[]
  source: 'ai' | 'rules'
  /** 今天已經請 AI 生成過（不論成功與否） */
  aiTried?: boolean
}

export interface NegotiationOption {
  id: string
  label: string
  attr: AttrId
  dc: number
  cost_cc?: number
}

export interface Negotiation {
  id: string
  template: string
  title: string
  goal: string
  /** 談判對象（NPC id） */
  counterpart: string
  location: string
  base_dc: number
  options: NegotiationOption[]
  outcomes: Record<'critical' | 'success' | 'partial' | 'fail' | 'fumble', { text: string; effects: RewardEffect[] }>
  attempts: number
  status: 'open' | 'done'
  /** 相關的委託或商店 */
  quest?: string
  shop?: string
  result?: 'critical' | 'success' | 'partial' | 'fail' | 'fumble'
  /** 談判方式由 AI 生成 */
  ai?: boolean
}
