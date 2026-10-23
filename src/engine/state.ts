// 遊戲狀態、時間與報告提交。

import { fitCreationPerks, sanitizePerk } from './perks'
import { baseAttrs, createPlayer, gainXp, guildRankFor, recalc } from './character'
import { abilities, attributeRules, classDef, isChoosablePerk, locationById, perkDef, setSaveItems, statuses, type Attrs, type PerkDef } from './data'
import { noteLoot } from './expedition'
import { creationGear, gearRules, syncGear, type CreationGear } from './gear'
import { addMerit, applyRankUp } from './guild'
import { contractTerms, termsFromTemplate, type SlaveStart } from './slavery'
import { backfillEventMemories, ensureRelationship, MEMORY_RULES_VERSION, recordMemory, setAffinity } from './social'
import { Rng } from './rng'
import type { Character, ContractRef, EquippedGear, GameOptions, GameState, GameTime, InventoryItem, MarkTerms, Report } from './types'
import { contractOf, setContract } from './tattoos'

export const START_LOCATION = 'soriel'
export const START_MONEY_CC = 500

export interface NewGameOptions {
  name: string
  race: string
  classId: string
  bonus?: Partial<Attrs>
  seed?: number
  /** 出生地（聚落的 location id），也是冒險的起點 */
  birthplace?: string
  gender?: string
  appearance?: string
  background?: string
  /** 以奴隸身分開始（主人與印記，見 engine/slavery.ts） */
  slave?: SlaveStart
  /** 建立角色時選的特質（perks.json 的 id）與自訂的特質（docs/PERKS.md） */
  perks?: string[]
  customPerks?: unknown[]
  /** 這個存檔的規則（沒有時用預設） */
  options?: Partial<GameOptions>
  /** 建角時挑的裝備（沒有時用職業的起始裝備）與預算（材料等級點數，見 gear.ts 的 creationGear） */
  gear?: CreationGear
  gearBudget?: number
}

/** 各種族的預設出生地 */
export const DEFAULT_BIRTHPLACE: Record<string, string> = {
  human: 'soriel', elf: 'silvermoon', dwarf: 'ironforge', demon: 'bloodplume', catfolk: 'sandcastle', yulin: 'canglue',
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31)
  const birthplace = opts.birthplace ?? START_LOCATION
  const loc = locationById(birthplace)
  if (loc.type === 'dungeon') throw new Error('出生地必須是聚落')
  const pc = createPlayer(opts.name, opts.race, opts.classId, opts.bonus)
  pc.birthplace = birthplace
  if (loc.faction) pc.faction = loc.faction
  const clip = (s: string | undefined, n: number) => s?.trim().slice(0, n) || undefined
  const gender = clip(opts.gender, 20)
  const appearance = clip(opts.appearance, 400)
  const background = clip(opts.background, 800)
  // 建角時挑的裝備：不合法時（例如預算不夠）丟錯，畫面上會先擋下來
  if (opts.gear) {
    pc.gear = creationGear(opts.classId, opts.gear, Math.max(0, opts.gearBudget ?? gearRules.creation.default_budget), opts.race)
    syncGear(pc, classDef(opts.classId).weapon)
  }
  if (gender) pc.gender = gender
  if (appearance) pc.appearance = appearance
  if (background) pc.background = background
  // 特質：清單裡的照選，自訂的整理過才收
  // 缺陷最多兩個、每個換一個一般特質的名額（perks.json 的 creation），多的從後面拿掉
  const listed = [...new Set(opts.perks ?? [])].filter(isChoosablePerk).map((id) => perkDef(id)!)
  const created = (opts.customPerks ?? []).map((raw, i) => sanitizePerk(raw, `c-start-${i + 1}`, undefined, true)).filter((p): p is PerkDef => !!p)
  const fitted = fitCreationPerks([...listed, ...created])
  const picked = listed.filter((p) => fitted.includes(p)).map((p) => p.id)
  if (picked.length) pc.perks = picked
  const custom = created.filter((p) => fitted.includes(p))
  if (custom.length) pc.customPerks = custom
  // 換成新存檔：沒有自創的物品
  setSaveItems([])
  return {
    version: 1,
    seed,
    rngState: seed,
    time: { day: 1, hour: 8, minute: 0 },
    location: birthplace,
    money_cc: START_MONEY_CC,
    party: [pc],
    inventory: [{ name: '乾糧', qty: 5 }],
    quests: [],
    recruited: [],
    reputation: {},
    flags: {},
    reports: [],
    nextReportNo: 1,
    relationships: {},
    memories: [],
    memoryRules: MEMORY_RULES_VERSION,
    schema: SAVE_SCHEMA,
    guild: { rank: 'F', merit: 0 },
    homes: {},
    options: { ...defaultOptions(), ...opts.options },
  }
}

/** 讀入舊版存檔時補上新欄位。 */
/**
 * 舊的飾品欄位：首飾放戒指、兩條項鍊放項鍊與護符。改成首飾放項鍊、兩枚戒指：
 * 原本的首飾（戒指）移到第一枚戒指，第一條項鍊移到首飾，第二條項鍊放回行囊（沒有行囊的 NPC 直接拿掉）。
 */
function migrateJewelry(gear: Record<string, EquippedGear | undefined> | undefined, pack?: GameState['inventory']) {
  if (!gear || (!('neck_1' in gear) && !('neck_2' in gear))) return
  const ring = gear.accessory
  const neck1 = gear.neck_1
  const neck2 = gear.neck_2
  delete gear.accessory
  delete gear.neck_1
  delete gear.neck_2
  if (ring) gear.ring_1 = ring
  if (neck1) gear.accessory = neck1
  if (neck2 && pack) {
    const it = pack.find((i) => i.name === neck2.name)
    if (it) it.qty++
    else pack.push({ name: neck2.name, qty: 1 })
  }
}

/**
 * 存檔格式的版本。改了存檔的結構時：版本加一，並在 SCHEMA_STEPS 加一個轉換步驟（舊存檔讀入時依序執行）。
 * 1：這個機制之前的所有存檔（由 migrate 前半的各項檢查補齊）
 * 2：公會階級與功績（guild）、存檔規則（options）
 * 3：房屋（homes；留守的夥伴記在 NPC 登錄的 staying）
 * 4：主人的家改成固定設施（民宅）：從 homes 拿掉 m- 開頭的那棟，改記在 masterHome（主人、城市、家裡的人）
 * 5：名單的潤飾記在每個人身上（flavored）
 * 6：刺青：奴隸契約搬進刺青清單（tattoos 的奴隸印記），條款一律存一份、加上部位
 * 7：金屬腰帶的底材改名（鐵腰帶 → 護腰，免得變成「鐵鐵腰帶」）：行囊、裝備、商店裡的舊名稱跟著改
 * 8：金屬靴子的底材改名（鐵靴 → 戰靴，免得變成「鐵鐵靴」）：同上
 */
export const SAVE_SCHEMA = 8

const SCHEMA_STEPS: [number, (state: GameState) => void][] = [
  [2, (s) => {
    // 以前的階級由等級換算：沿用換算出來的階級，功績從 0 開始
    s.guild ??= { rank: guildRankFor(player(s).level), merit: 0 }
    s.options ??= defaultOptions()
    // 正在地下城裡：從現在開始記這趟探索
    if (locationById(s.location).type === 'dungeon' && !s.road) s.expedition ??= { location: s.location, started: { ...s.time }, deepest: 0, loot: [], money_cc: 0 }
  }],
  [3, (s) => {
    s.homes ??= {}
  }],
  [4, (s) => {
    // 主人的家以前疊在一塊空地上、地圖存在 homes：改成那座城的民宅，家裡的人照舊（站的位置在讀檔後的 syncMasterHome 對齊）
    for (const [id, home] of Object.entries(s.homes ?? {})) {
      if (!home.master && !id.startsWith('m-')) continue
      // 沿用舊房子的規格：主角、家裡的人站的位置都是照那個格局記的（例如首都的貴族宅邸有三樓）
      if (home.master && !s.masterHome) s.masterHome = { master: home.master, location: home.location, household: home.household ?? [], ...(home.district ? { district: home.district } : {}) }
      delete s.homes![id]
    }
  }],
  [5, (s) => {
    // 名單的潤飾改成記在每個人身上：整份潤飾過的名單，上面的人都算潤飾過
    for (const roster of Object.values(s.rosters ?? {})) {
      if (!roster.flavored) continue
      for (const id of roster.members) {
        const rec = s.npcs?.[id]
        if (rec?.generated) rec.flavored = true
      }
      delete roster.flavored
    }
  }],
  [6, (s) => {
    for (const c of [...s.party, ...Object.values(s.npcs ?? {}).map((r) => r.character)]) migrateContract(c)
  }],
  [7, (s) => {
    renameValues(s, { 鐵鐵腰帶: '鐵護腰', 鋼鐵腰帶: '鋼護腰', 秘銀鐵腰帶: '秘銀護腰', 精金鐵腰帶: '精金護腰', 星隕鐵鐵腰帶: '星隕鐵護腰' })
  }],
  [8, (s) => {
    renameValues(s, { 鐵鐵靴: '鐵戰靴', 鋼鐵靴: '鋼戰靴', 秘銀鐵靴: '秘銀戰靴', 精金鐵靴: '精金戰靴', 星隕鐵鐵靴: '星隕鐵戰靴' })
  }],
]

/** 把存檔裡剛好等於舊名稱的字串換成新名稱（物品名稱散在行囊、裝備、商店與戰利品裡） */
function renameValues(node: unknown, names: Record<string, string>) {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && names[v]) obj[k] = names[v]
    else renameValues(v, names)
  }
}

/** 舊的契約（角色身上的 contract）改成刺青清單裡的奴隸印記 */
function migrateContract(c: Character | undefined) {
  const old = (c as (Character & { contract?: ContractRef & { terms?: MarkTerms } }) | undefined)?.contract
  if (!c || !old) return
  delete (c as { contract?: unknown }).contract
  const base = termsFromTemplate(old.kind)
  const terms: MarkTerms = old.terms ? { ...base, ...old.terms, place: old.terms.place ?? base.place } : base
  setContract(c, { ...old, terms })
}

export function defaultOptions(): GameOptions {
  return { defeatLoot: 'half' }
}

/** 存檔來自比較新的遊戲版本時丟出錯誤（不要硬讀，避免把存檔弄壞） */
export function assertSchema(state: Pick<GameState, 'schema'>) {
  const v = state.schema ?? 1
  if (v > SAVE_SCHEMA) throw new Error(`這個存檔來自比較新版本的遊戲（存檔格式 ${v}，目前支援到 ${SAVE_SCHEMA}），請更新遊戲後再讀取`)
}

export function migrate(state: GameState): GameState {
  assertSchema(state)
  // 「飾品」類別已經拿掉（併入裝備）：AI 自創的飾品改成雜物
  for (const c of Object.values(state.customItems ?? {})) if (c.category === 'valuable') c.category = 'gear'
  for (const m of state.party) migrateJewelry(m.gear as Record<string, EquippedGear | undefined>, state.inventory)
  for (const r of Object.values(state.npcs ?? {})) migrateJewelry(r.character?.gear as Record<string, EquippedGear | undefined> | undefined)
  for (const q of state.quests) {
    q.kind ??= 'clear_dungeon'
    q.area ??= 'dungeon'
  }
  // v1 的角色沒有五屬性與能力清單：依職業與種族重建，已升的等級換成屬性點
  for (const c of state.party as (typeof state.party[number] & { skills?: string[]; mp?: number; maxMp?: number; pendingSkillChoices?: unknown })[]) {
    if (c.attrs) continue
    const cls = classDef(c.class)
    c.attrs = baseAttrs(c.class, c.race)
    c.attrPoints = (c.level - 1) * attributeRules.level_up_points
    c.abilities = [...new Set([...cls.start, ...(c.skills ?? []).filter((id) => abilities[id]?.classes.includes(c.class))])]
    c.weapon = cls.weapon
    c.armor = cls.armor
    c.slotsUsed = []
    c.usesPerRest = {}
    delete c.skills
    delete c.mp
    delete c.maxMp
    delete c.pendingSkillChoices
    c.maxHp = 0
    recalc(c)
    c.hp = c.maxHp
  }
  // v2 之前沒有人際關係與共同記憶：由隊友與過去的報告補建
  if (!state.relationships) {
    state.relationships = {}
    for (const m of state.party) {
      if (m.isPlayer) continue
      ensureRelationship(state, { id: m.id, name: m.name })
      setAffinity(state, m.id, m.affinity ?? 0)
    }
  }
  if (!state.memories) {
    state.memories = []
    for (const r of state.reports) recordMemory(state, r)
    state.memoryRules = MEMORY_RULES_VERSION
  }
  backfillEventMemories(state)
  // v3 之前沒有夥伴系統：原本的隊友都是雇傭的
  for (const m of state.party) {
    m.hitDiceUsed ??= 0
    if (!m.isPlayer) m.bond ??= 'hired'
  }
  state.npcs ??= {}
  state.suggestions ??= []
  pruneStatuses(state)
  pruneAbilities(state)
  prunePerks(state)
  // 依存檔格式的版本依序轉換
  for (const [v, step] of SCHEMA_STEPS) {
    if ((state.schema ?? 1) >= v) continue
    step(state)
    state.schema = v
  }
  // 這個存檔自創的物品
  setSaveItems(Object.values(state.inventions ?? {}))
  return state
}

/** 自訂內容刪掉的狀態：從進行中的戰鬥拿掉（讀檔時，以及自訂內容改變之後） */
export function pruneStatuses(state: GameState) {
  for (const x of state.combat?.combatants ?? []) if (x.statuses.some((s) => !statuses[s.id])) x.statuses = x.statuses.filter((s) => !!statuses[s.id])
}

/** 自訂內容刪掉的能力：從角色身上拿掉（讀檔時，以及自訂內容改變之後） */
export function pruneAbilities(state: GameState) {
  const known = (id: string) => !!abilities[id]
  for (const c of [...state.party, ...Object.values(state.npcs ?? {}).map((r) => r.character).filter((x): x is Character => !!x)]) {
    if (c.abilities?.some((id) => !known(id))) c.abilities = c.abilities.filter(known)
    // 升級時還沒選的能力：拿掉不存在的選項，整組都沒了就不用選
    if (c.pendingAbilityChoices?.length) {
      c.pendingAbilityChoices = c.pendingAbilityChoices.map((set) => set.filter(known)).filter((set) => set.length)
      if (!c.pendingAbilityChoices.length) delete c.pendingAbilityChoices
    }
  }
  // 進行中的戰鬥
  for (const x of state.combat?.combatants ?? []) if (x.abilities.some((id) => !known(id))) x.abilities = x.abilities.filter(known)
}

/**
 * 自訂內容刪掉的特質：從角色身上、學特質的機會與登場過的人身上拿掉（讀檔時，以及自訂內容改變之後）。
 * 種族特質依種族計算、自訂特質寫在角色身上，都不受影響。
 */
export function prunePerks(state: GameState) {
  for (const c of [...state.party, ...Object.values(state.npcs ?? {}).map((r) => r.character).filter((x): x is Character => !!x)]) {
    if (c.perks?.some((id) => !isChoosablePerk(id))) c.perks = c.perks.filter(isChoosablePerk)
    if (c.perkOffers?.length) {
      // 機會裡不存在的選項拿掉；沒有選項又不能寫說法的機會整個拿掉
      c.perkOffers = c.perkOffers.map((o) => ({ ...o, options: o.options.filter(isChoosablePerk) })).filter((o) => o.options.length || o.pitch)
      if (!c.perkOffers.length) delete c.perkOffers
    }
  }
  for (const r of Object.values(state.npcs ?? {})) if (r.perks?.some((id) => !isChoosablePerk(id))) r.perks = r.perks.filter(isChoosablePerk)
}

/** 主角賺到 amount 時，依奴隸契約的「收益歸屬」被主人拿走多少（逃亡中、沒有主人、契約沒有這項功能時是 0） */
export function masterTake(state: GameState, amount: number): number {
  const pc = state.party.find((m) => m.isPlayer)
  const contract = contractOf(pc)
  if (!pc || !contract?.master || pc.status.includes('fugitive') || amount <= 0) return 0
  const def = contractTerms(contract)
  return def.functions.includes('income') ? Math.floor(amount * def.income_share) : 0
}

export function player(state: GameState) {
  const pc = state.party.find((c) => c.isPlayer)
  if (!pc) throw new Error('no player character')
  return pc
}

/** 用狀態裡的亂數種子執行一段邏輯，結束後寫回種子。 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rngState)
  try {
    return fn(rng)
  } finally {
    state.rngState = rng.state
  }
}

export function addHours(time: GameTime, hours: number): Required<GameTime> {
  const totalMinutes =
    ((time.day - 1) * 24 + (time.hour ?? 0)) * 60 + (time.minute ?? 0) + Math.round(hours * 60)
  return {
    day: Math.floor(totalMinutes / 1440) + 1,
    hour: Math.floor((totalMinutes % 1440) / 60),
    minute: totalMinutes % 60,
  }
}

export function formatTime(time: GameTime): string {
  const hh = String(time.hour ?? 0).padStart(2, '0')
  const mm = String(time.minute ?? 0).padStart(2, '0')
  return `第 ${time.day} 天 ${hh}:${mm}`
}

export function newReportId(state: GameState): string {
  return `r-${String(state.nextReportNo++).padStart(6, '0')}`
}

export function addItem(inv: InventoryItem[], name: string, qty: number, quality?: string) {
  const item = inv.find((i) => i.name === name)
  if (item) item.qty += qty
  else inv.push(quality ? { name, qty, quality } : { name, qty })
}

/** 扣除物品，回傳實際扣掉的數量。 */
export function removeItem(inv: InventoryItem[], name: string, qty: number): number {
  const i = inv.findIndex((it) => it.name === name)
  if (i < 0) return 0
  const item = inv[i]!
  const taken = Math.min(item.qty, qty)
  item.qty -= taken
  if (item.qty <= 0) inv.splice(i, 1)
  return taken
}

/**
 * 把報告的結果套用到遊戲狀態，並把報告加進事件紀錄。
 * 經驗值造成的升級在這裡結算，結果會補寫進 report.changes.level_up。
 * 隊伍的 HP 以報告 party 快照的「事件後」數值為準。
 */
export function commitReport(state: GameState, report: Report): Report {
  const c = report.changes
  state.time = { day: report.time.end.day, hour: report.time.end.hour ?? 0, minute: report.time.end.minute ?? 0 }
  if (report.kind === 'travel' && report.outcome.result === 'arrived' && report.location.to) {
    locationById(report.location.to)
    state.location = report.location.to
  }
  for (const snap of report.party) {
    const member = state.party.find((m) => m.id === snap.id)
    if (!member) continue
    if (snap.hp) member.hp = Math.max(0, Math.min(member.maxHp, snap.hp[1]))
  }
  // 奴隸契約「收益歸屬」：主角賺到的錢有一部分歸主人（成為奴隸的那份報告除外）
  if ((c.money_cc ?? 0) > 0 && !c.companions?.some((x) => x.npc === 'pc' && x.change === 'enslaved')) {
    const taken = masterTake(state, c.money_cc!)
    if (taken > 0) {
      c.money_cc! -= taken
      c.master_share_cc = taken
    }
  }
  if (c.money_cc) state.money_cc += c.money_cc
  for (const item of c.items_gained ?? []) addItem(state.inventory, item.name, item.qty, item.quality)
  for (const item of c.items_lost ?? []) removeItem(state.inventory, item.name, item.qty)
  for (const a of c.affinity ?? []) setAffinity(state, a.npc, a.after)
  for (const r of c.reputation ?? []) state.reputation[r.faction] = (state.reputation[r.faction] ?? 0) + r.delta
  if (c.flags) Object.assign(state.flags, c.flags)
  // 地下城探索：這趟撿到的東西記下來（戰敗時依規則失去）
  noteLoot(state, report)
  if (c.merit) addMerit(state, c.merit)
  if (c.rank_up) applyRankUp(state, c.rank_up.to)
  // 主角的階級是公會給的（隊友依等級換算）
  const pcSnap = report.party.find((p) => p.id === player(state).id)
  if (pcSnap && state.guild) pcSnap.rank = state.guild.rank

  if (c.xp?.length) {
    withRng(state, (rng) => {
      for (const x of c.xp!) {
        const member = state.party.find((m) => m.id === x.actor)
        if (!member || !x.amount) continue
        const from = member.level
        if (gainXp(member, x.amount, rng) > 0) {
          ;(c.level_up ??= []).push({ actor: member.id, from, to: member.level })
        }
      }
    })
  }

  state.reports.push(report)
  recordMemory(state, report)
  return report
}
