import type { ActionPending } from './actions'
import type { CombatState } from './combat'
import type { CheckFilter, AffinityMap, AttrId, Attrs, Bond, CraftId, DealCost, DungeonLayerId, HomeDistrict, ItemDef, Mods, NpcDef, PerkDef } from './data'
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
  /** save：value 是目標的豁免、dc 是施放者的豁免難度（其他時候 value 是行動者的骰值） */
  roll?: { dice?: string; value?: number; dc?: number; save?: boolean }
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
  /** 特質的增減 */
  perks?: { actor: string; perk: string; name: string; added: boolean }[]
  /** 刺上或洗掉的刺青（奴隸印記另外記在 companions 的 enslaved / freed） */
  tattoos?: { actor: string; place: TattooPlace; kind: TattooKind; name: string; added: boolean }[]
  /** 短休花費／長休回復的生命骰 */
  hit_dice?: { actor: string; spent?: number; regained?: number; healed?: number }[]
  /** 奴隸契約「收益歸屬」被主人拿走的金錢 */
  master_share_cc?: number
  /** 法術環、生命骰、每次休息可用次數的增減 */
  resources?: ResourceChange[]
  /** 主角得到的公會功績點 */
  merit?: number
  /** 通過晉升考核 */
  rank_up?: { from: GuildRank; to: GuildRank }
  /** 工藝經驗（level：升到幾級） */
  craft_xp?: { actor: string; craft: CraftId; amount: number; level?: number }[]
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
  /** 屬性調整加上情境修正 */
  modifier: number
  /** 情境修正（已經算在 modifier 裡），例如「瑟琳的好感（45）+4」 */
  situational?: { label: string; value: number }[]
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
  quest?: { id?: string; title?: string; rank?: GuildRank; status?: 'accepted' | 'progress' | 'completed' | 'failed' | 'abandoned' | 'expired' }
  /** 特殊任務：哪個任務、哪個任務點 */
  story?: { id: string; title: string; node?: string; status: 'started' | 'progress' | 'completed' | 'failed' }
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
    /** 戰敗事件：前半段停在對方動手前（defeat_cliffhanger），後半段是玩家回應之後（defeat_event） */
    mode?: 'defeat_cliffhanger' | 'defeat_event'
    /** 成人向的親密場景（只在開啟成人向時）：這段經過是什麼，敘事會附上成人場景規則、在正文詳細描寫 */
    adult_scene?: string
  }
  lore_keys?: string[]
}

// ---- 遊戲狀態 ----

/** 裝備欄位（gear.json 的 slots） */
export type GearSlot = 'main_hand' | 'off_hand' | 'head' | 'body' | 'legs' | 'wrists' | 'feet' | 'belt' | 'accessory' | 'ring_1' | 'ring_2'
  | 'piercing_1' | 'piercing_2' | 'leg_accessory' | 'underwear_top' | 'underwear_bottom'

/** 一件裝備的組成：底材 × 材料（＋稀有度與附魔） */
export interface GearSpec {
  base: string
  material: string
  /** 沒有時用材料的稀有度 */
  rarity?: string
  enchants?: { mods?: Mods; resist?: AffinityMap; offense?: AffinityMap }
  /**
   * 獨特物品的檢定加值（和附魔分開，一件只有一種，可以疊加）：只寫在內容資料裡的獨特物品，
   * 不能打造、不能購買，只能從特殊事件或寶箱得到（見 docs/ITEMS.md 第 3.1 節）
   */
  unique?: { check: CheckFilter; bonus: number }
  /** 屬性的加減（每項 ±1～±3；只有內容資料裡的裝備會有，不能打造、不在商店上架；見 docs/ITEMS.md 第 3.2 節） */
  attrs?: Partial<Record<'str' | 'dex' | 'int' | 'fai' | 'cha', number>>
}

/** 穿在身上的裝備：物品名稱與組成（自帶組成，不必回頭查存檔） */
export interface EquippedGear {
  name: string
  spec: GearSpec
  /** 主人強制裝上的（主人的 id）：契約還在時不能卸下，也不能在這個欄位換別的 */
  locked?: string
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
  /** 整隊邀請入隊的小隊（隊長的 id）：離隊、遣散時整隊一起走 */
  squad?: string
  /** 身上的刺青（每個部位一個；奴隸印記也是其中一種，契約掛在它上面，見 engine/tattoos.ts） */
  tattoos?: Tattoo[]
  /** 已花掉的生命骰（總數 = 等級） */
  hitDiceUsed?: number
  /** 體型（主角建角時選的；沒有時依種族與性別，見 look.ts） */
  body?: 'masc' | 'fem' | 'andro'
  /** 性別：主角是自由輸入的文字；NPC 是性別 id（見 npc_pool.json） */
  gender?: string
  appearance?: string
  background?: string
  birthplace?: string
  /** 工藝的等級與經驗（沒有的工藝視為 1 級、0 經驗；見 engine/crafting.ts） */
  crafts?: Partial<Record<CraftId, CraftSkill>>
  /** 入隊的時間（入隊沒多久就遣散有懲罰） */
  joined?: GameTime
  /** 特質（data/rules/perks.json 的 id） */
  perks?: string[]
  /** 自訂或 AI 設計的特質（不在清單裡，id 以 c- 開頭） */
  customPerks?: PerkDef[]
  /** 等著選的特質（升級、事件、特殊任務、訓練、物品） */
  perkOffers?: PerkOffer[]
}

/** 一次取得特質的機會：從 options 選一個，或寫一段說法交給 AI 判斷（pitch） */
export interface PerkOffer {
  id: string
  /** 從哪裡來（升到 6 級、特殊任務「…」、在公會受訓、讀了「…」） */
  source: string
  options: string[]
  /** 可以寫說法交給 AI（只在開啟 AI 判定時）；已經試過一次時 pitched */
  pitch?: boolean
  pitched?: boolean
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
  /** 這枚印記的條款：刻印時存一份（模板或自訂），之後改模板不影響 */
  terms: MarkTerms
  /** 主人的家在哪座城（第一次需要時決定） */
  home?: string
  /** 上次待在主人的家裡的時間（離家期限從這裡算；沒有時從 since 算） */
  homeAt?: GameTime
  /** 嚴加看管：逃亡被找到、逾期被帶回家時加重，讓出門與出城更難；since 起每隔幾天減一點 */
  strict?: { points: number; since: GameTime }
}

export type TattooPlace = 'neck' | 'left_arm' | 'right_arm' | 'chest' | 'back' | 'belly' | 'hips' | 'left_thigh' | 'right_thigh' | 'left_calf' | 'right_calf'
/** 奴隸印記、誓約印記、普通刺青 */
export type TattooKind = 'slave' | 'oath' | 'plain'

/** 身上的一個刺青 */
export interface Tattoo {
  kind: TattooKind
  place: TattooPlace
  /** 普通刺青與誓約印記：名稱與外觀（刺上時存一份）；奴隸印記看契約的條款 */
  name?: string
  desc?: string
  /** 從哪個圖樣刺的（tattoos.json 的 templates）；自己描述的沒有 */
  template?: string
  /** 誓約印記：屬性的加減（加總為 0） */
  attrs?: Partial<Record<'str' | 'dex' | 'int' | 'fai' | 'cha', number>>
  /** 奴隸印記：契約 */
  contract?: ContractRef
  since: GameTime
  /** 誰刺的（主人、刺青師、事件的說明） */
  by?: string
}

/** 契約印記的條款：名稱、描述與各項數值（描述會給 AI 判定與寫正文） */
export interface MarkTerms {
  name: string
  /** 印記的外觀與感覺 */
  mark: string
  /** 刻在哪個部位 */
  place: TattooPlace
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
  /** 程式生成的文字已經請 AI 潤飾過（名單的潤飾，每個人一次） */
  flavored?: boolean
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
  /** 目前套用的「依劇情旗標改變出沒」（stages 的索引） */
  stage?: number
  /** 名字、背景、性格、標籤目前用的是階段的身分（條件不再成立時換回預設的） */
  stagedIdentity?: boolean
  /** 不在隊伍裡的 NPC（店主）的工藝等級；隊友的在 character.crafts */
  crafts?: Partial<Record<CraftId, CraftSkill>>
  /** 不在隊上、等主角回來帶的夥伴（角色資料在 character，羈絆與契約照舊）：留在家裡時是房子的 id，寄放在酒館時是「tavern:地點 id」（見 away.ts） */
  staying?: string
  /** 開始留守或寄放的時間 */
  stayingSince?: GameTime
}

/** 等主角決定的入隊：kind join＝加入主角的隊伍（npcs 第一位是本人，其餘是一起來的小隊隊員）；follow＝主角跟著 npcs[0] 的隊伍 */
export interface PendingJoin {
  id: string
  kind: 'join' | 'follow'
  npcs: string[]
  /** join：入隊方式 */
  mode?: 'voluntary' | 'hired' | 'slave'
  /** 奴隸的印記（模板 id） */
  contract?: string
  /** 小隊：隊長的 id（入隊後記在 squad） */
  squad?: string
  /** follow：對方付給主角的錢 */
  pay_cc?: number
  /** 哪件事讓他們想加入（報告的摘要） */
  source?: string
  time: GameTime
}

/** 情報（冒險筆記）：事件點（在近郊或地下城的某一層放一個事件）或特殊任務的消息 */
export interface Intel {
  id: string
  kind: 'point' | 'story'
  title: string
  text: string
  /** 從哪座城鎮的情報商買到、什麼時候 */
  from: string
  time: GameTime
  /** point：哪個地點、哪一層（沒有時是近郊）、什麼事件 */
  location?: string
  layer?: DungeonLayerId
  event?: 'combat' | 'chest' | 'merchant'
  /** combat：要打的怪物；chest、combat：寶物的等級 */
  group?: [string, number][]
  level?: number
  /** 有效到第幾天（之後事件點消失） */
  until?: number
  /** story：特殊任務的 id */
  story?: string
  /** 解讀情報物品得到的：物品名稱（沒有時是向情報商買的） */
  source?: string
  status: 'active' | 'done' | 'expired'
}

export interface RoadState {
  from: string
  to: string
  start: GameTime
  /** 各段路的交通方式 */
  modes: string[]
  /** 已經走了幾小時 */
  hours: number
  /** 累計的花費（抵達時寫進旅行報告） */
  money: number
  timeline: TimelineEntry[]
  /** 出發時的生命值（旅行報告的前後對照） */
  hpBefore: Record<string, number>
  intent?: string
  /** 主人的事件允許成人向 */
  adult?: boolean
}

export interface StoryProgress {
  id: string
  status: 'active' | 'completed' | 'failed'
  started: GameTime
  ended?: GameTime
  /** 已經結束的任務點 */
  done: string[]
  /** 冒險筆記上的經過 */
  log: { time: GameTime; text: string; node?: string }[]
  /** 這個任務帶來的任務同行夥伴（任務結束時離隊） */
  guests?: string[]
}

export interface PendingDefeat {
  /** 圍上來的敵人（名字與 NPC id） */
  foes: { name: string; npc?: string }[]
  /** 戰敗的地點與場景 */
  location: string
  scene: string
  /** 戰報 id（敘事停在動手前的那一份） */
  report: string
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

/** 和冒險者打贏之後被制伏的人：等主角處置（處決、放過、收為奴隸，或自己寫主動行動）；見 engine/captives.ts */
export interface Captives {
  npcs: string[]
  /** 誰先動手：party = 主角這邊（偷襲）、npc = 對方（敵對冒險者攔路） */
  aggressor: 'party' | 'npc'
  /** 在哪個地點、哪一區被制伏（後果依這裡算：有衛兵的聚落才加警戒） */
  location: string
  area: string
  day: number
  /** 主角偷襲時沒有人看到：處置不加警戒（聲望照扣） */
  unseen?: boolean
}

export interface Roster {
  /** 名單上的 NPC id（不含店主、公會職員等職員） */
  members: string[]
  /** 建立的日期 */
  day: number
  /** 舊存檔：整份名單潤飾過（讀檔時改記在每個人的 flavored） */
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

/** 黑市的珍品：獨特裝備（物品名稱）與今天的價格 */
export interface CurioListing {
  item: string
  price_cc: number
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
 * pest、hunt、search、gather、patrol、delivery：F 級城內／近郊委託的範本（pest、hunt 是戰鬥；search、gather、patrol 是檢定；delivery 花時間即可）。
 * 材料委託（交付 goal 份，最多 max 份，報酬依交付的份數）：
 * - gather_wild：近郊採集點的材料（F 級）；gather_dungeon：地下城周邊採集點的材料（E 級）
 * - drop_wild：近郊怪物掉落的材料（F～E 級）；drop_dungeon：地下城怪物掉落的材料（F～A 級，依怪物等級）
 * boss_hunt：討伐地下城的層主 goal 次，最多 max 次（F～A 級，依層主等級）。
 */
export type QuestKind =
  | 'clear_dungeon' | 'pest' | 'hunt' | 'search' | 'gather' | 'patrol' | 'delivery'
  | 'gather_wild' | 'gather_dungeon' | 'drop_wild' | 'drop_dungeon' | 'boss_hunt'

export interface Quest {
  id: string
  title: string
  rank: GuildRank
  kind: QuestKind
  area: 'town' | 'outskirts' | 'dungeon'
  /** 城內／近郊委託的範本 id（data/rules/town_quests.json） */
  template?: string
  /** 以地標為標的的城內委託：哪個地標（執行地點） */
  landmark?: string
  /** 發布委託的城鎮，也是交付地點 */
  giver: string
  /** 執行地點；城內／近郊委託就是發布的城鎮 */
  target: string
  /** 需要完成的次數 */
  goal: number
  progress: number
  reward_cc: number
  /** 材料委託：要交的材料；討伐、掉落委託：目標怪物（enemies 的 id）與牠出現的那一層 */
  item?: string
  monster?: string
  layer?: DungeonLayerId
  /** 可以過量交付：最多交付（或討伐）的數量；報酬依實際數量比例增加 */
  max?: number
  /** 交付時實際交了多少（完成後記錄） */
  delivered?: number
  status: 'available' | 'accepted' | 'ready' | 'completed'
  /** 期限（接下時決定）：過了還沒完成目標就逾期失敗；目標達成（ready）之後不會逾期 */
  deadline?: GameTime
  /** 任務旗標（談判、事件的結果），例如 lead：委託檢定 +5 */
  flags?: Record<string, unknown>
}

export interface InventoryItem {
  name: string
  qty: number
  quality?: string
}

/** 玩家買下的房子（見 engine/homes.ts） */
export interface Home {
  id: string
  name: string
  location: string
  district: HomeDistrict
  /** 空地：城鎮區塊、格子，以及門口的街道 */
  lot: { area: string; x: number; y: number; street: { x: number; y: number } }
  bought: GameTime
  price_cc: number
  /** 各層地圖的 key，從下到上（地下室、一樓、二樓……） */
  floors: string[]
  /** 各層的地圖（不放在 state.areas：那裡每次旅行都會清空） */
  areas: Record<string, Area>
  /** 主人的家（主角是奴隸時，不在 state.homes，由 masterHome.ts 即時產生）：主人的 id；不能擺家具、留守、改名 */
  master?: string
  /** 主人的家裡的人（伴侶、子女、僕人、奴隸）的 NPC id */
  household?: string[]
}

/** 一種工藝的等級與累積的經驗 */
export interface CraftSkill {
  level: number
  xp: number
}

/** 冒險者公會的階級與功績（只有主角；隊友的階級依等級換算） */
export interface GuildState {
  rank: GuildRank
  /** 累積的功績點（晉升後不歸零） */
  merit: number
  /** 已發出的晉升考核委託 id */
  exam?: string
}

/** 戰敗時這趟探索撿到的東西：保留、失去一半、全部失去 */
export type DefeatLoot = 'keep' | 'half' | 'all'

/** 這個存檔的規則（開新遊戲時選，之後可以在設定裡改） */
export interface GameOptions {
  defeatLoot: DefeatLoot
  /** 以下見 gameRules.ts：沒有時用預設 */
  xpMult?: number
  moneyMult?: number
  ambushMult?: number
  travelEventMult?: number
  /** 0 = 委託不限期限 */
  deadlineMult?: number
  shortRestHours?: number
  longRestHours?: number
  alertDecayDays?: number
  /** 戰鬥撤退與地下城緊急撤退的 DC 加減 */
  escapeDc?: number
  /** 黑市每天刷新幾件珍品（獨特裝備） */
  blackMarketGear?: number
}

/** 這一趟地下城探索（進入地下城時開始，離開時結束） */
export interface Expedition {
  location: string
  started: GameTime
  /** 到過最深的層（0 = 周邊） */
  deepest: number
  /** 這趟撿到、還沒帶出地下城的物品與錢（戰敗時依規則失去） */
  loot: InventoryItem[]
  money_cc: number
}

/** 正在燒的光源：物品名稱與還能照亮幾格 */
export interface LightState {
  item: string
  left: number
}

/** 封存的日誌：完整的報告（隊伍快照、經過、變化）拿掉，只留看得懂發生什麼事的部分 */
export interface LogArchiveEntry {
  id: string
  kind: Report['kind']
  time: GameTime
  /** 地點與場景 */
  scene: string
  summary: string
  /** AI 寫的經過（有寫過時） */
  story?: string
  /** 這則日誌用掉的 token（輸入＋輸出；用量本身合計在封存的用量裡） */
  tokens?: number
}

export interface GameState {
  version: 1
  /** 存檔格式的版本（見 state.ts 的 SAVE_SCHEMA；舊存檔沒有，視為 1） */
  schema?: number
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
  /** 封存的舊日誌：只留簡述與 AI 寫的經過（見 docs/SAVES.md 第 6 節） */
  logArchive?: LogArchiveEntry[]
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
  /** 共同記憶的規則版本（見 social.ts 的 MEMORY_RULES_VERSION；舊存檔沒有） */
  memoryRules?: number
  /** 主角在冒險者公會的階級與功績 */
  guild?: GuildState
  /** 這個存檔的規則 */
  options?: GameOptions
  /** 進行中的地下城探索 */
  expedition?: Expedition
  /** 正在燒的光源 */
  light?: LightState
  /** 緊急撤退被追上的戰鬥：獲勝後撤出地下城 */
  retreating?: boolean
  /** 買下的房子：id → 房子 */
  homes?: Record<string, Home>
  /**
   * 主人的家（主角有主人時）：主人是誰、在哪座城、家裡的人。房子是那座城固定地圖上的民宅（manor），
   * 地圖依聚落規模固定生成，不存進存檔（見 engine/masterHome.ts）。
   */
  masterHome?: {
    master: string
    location: string
    household: string[]
    /** 房子的規格：決定主人的家時記下（舊存檔沿用舊的房子的規格），之後主人的標籤變了也不換格局 */
    district?: HomeDistrict
  }
  /** 登場過的 NPC（含生成的） */
  npcs?: Record<string, NpcRecord>
  /** 各地點的 NPC 名單（第一次進入時建立，見 engine/population.ts） */
  rosters?: Record<string, Roster>
  /** 各城鎮酒館今天的候選人 */
  taverns?: Record<string, { day: number; candidates: TavernCandidate[]; flavored?: boolean }>
  /** 奴隸市場今天的商品；鍵為 城鎮/public 或 城鎮/black */
  markets?: Record<string, { day: number; stock: SlaveListing[] }>
  /** 黑市每天刷新的珍品（地點 → 當天的貨） */
  curios?: Record<string, { day: number; stock: CurioListing[] }>
  /** 其他隊伍的入隊邀請 */
  partyOffers?: PartyOffer[]
  /** 事件或 AI 讓人入隊時隊伍滿了：等主角騰出位子或放棄（見 away.ts） */
  pendingJoins?: PendingJoin[]
  /** 主角打算離開目前所在的別人隊伍：下次休息時進行 */
  pendingLeave?: { mode: 'sneak' | 'formal' }
  /** 已擲骰、等待判定的主動行動 */
  pendingAction?: ActionPending
  /** 剛成為奴隸、等待刻印的檢定與選擇（見 engine/slavery.ts） */
  pendingMark?: PendingMark
  /** 主人的突發事件，等待主角回應（三選一或自己輸入） */
  pendingMasterEvent?: PendingMasterEvent
  /** 成人向的戰敗事件：等待玩家回應（回應後才回到入口或城門） */
  pendingDefeat?: PendingDefeat
  /** 特殊任務的進度（story.ts） */
  stories?: Record<string, StoryProgress>
  /** 旅途中（road.ts）：走在單行道的臨時地圖上，抵達時才產生旅行報告 */
  road?: RoadState
  /** 旅途上等待回應的事件（選擇、高階事件） */
  roadEvent?: { x: number; template: string }
  /** 城鎮裡等待回應的事件（townEvents.ts） */
  townEvent?: { template: string }
  /** 城鎮事件的紀錄：上一次的時間（絕對小時）、每個事件上次出現的日子、最近的種類 */
  townEvents?: { last?: number; seen: Record<string, number>; recent: string[] }
  /** 地下城與近郊等待回應的事件（dungeonEvents.ts）：模板與觸發點 */
  dungeonEvent?: { template: string; trigger: string }
  /** 地下城事件的紀錄：上一次的時間（絕對小時）、每個事件上次出現的日子 */
  dungeonEvents?: { last?: number; seen: Record<string, number> }
  /** 在臨時地圖裡：離開時回到的位置 */
  side?: { area: string; back: { area: string; x: number; y: number }; /** 特殊任務帶進來的臨時地圖：離開就放棄這個任務 */ story?: string }
  /** 在特殊地圖裡：從外面進來前的位置與地點（從出口離開時回到那裡），走過的需要刷新的地圖 */
  special?: { back?: { area: string; x: number; y: number }; location: string; visited: string[] }
  /** 冒險筆記的情報 */
  intel?: Intel[]
  /** 事件結果要求的移動（進入臨時地圖、改去別的地點），在報告提交之後執行 */
  pendingMove?: { side_map?: string; special_map?: string; travel_to?: string; /** 特殊任務的結果帶進臨時地圖 */ story?: string }
  /** 特殊任務按了「稍候」的任務點：任務點 → 當時的地方（離開那裡之後再來會再觸發） */
  storyWaits?: Record<string, string>
  /** 身為奴隸時，今天主人已經同意出城的地點 → 日期；被拒絕的地點 → 日期 */
  masterPass?: Record<string, number>
  masterRefuse?: Record<string, number>
  /** 在主人的家裡：主人今天同意出門／拒絕的日子 */
  masterHousePass?: number
  masterHouseRefuse?: number
  /** 上一次主人突發事件的時間（小時數，避免太頻繁） */
  lastMasterEvent?: number
  /** 和敵對冒險者的對峙（見 engine/encounters.ts） */
  standoff?: Standoff
  /** 打贏冒險者後被制伏、等主角處置的人（見 engine/captives.ts） */
  captives?: Captives
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
  /** 城鎮的特色地標：上次參訪、探索是第幾天（見 landmarks.ts） */
  landmarks?: Record<string, { visited?: number; explored?: number; scene?: number; scenes?: Record<string, number> }>
  /** AI 自創的物品（可以再賣回商店） */
  customItems?: Record<string, { category: string; price_cc: number; desc?: string; gear?: GearSpec }>
  /** 這個存檔用的世界（自訂內容的一套，見 stores/content.ts）；開新遊戲時決定，之後不能換 */
  world?: { id: string; name: string }
  /** 這個存檔自創的物品（自創配方，見 invention.ts）：完整的物品定義，配方在 recipe */
  inventions?: Record<string, ItemDef>
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
  /** 氛圍性的交易：給 AI 的提示（見 shops.json 的 flavor） */
  flavor?: string
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
