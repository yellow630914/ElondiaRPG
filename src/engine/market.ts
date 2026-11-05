import marketJson from '@data/rules/market.json'
import { contentRevision, geography, itemDef, type Location } from './data'
import { Rng } from './rng'
import { gearRules, monsterLootItems } from './gear'
import type { ItemUse } from './data'
import type { GameState, GearSpec } from './types'

// 貿易（docs/TRADE.md 3.1 節）：商品的貿易類別、城鎮的固定標籤，以及兩者合起來的類別倍率

export type TradeCategory = keyof typeof marketJson.categories
export interface TradeTagDef { name: string; desc: string; mult: Partial<Record<TradeCategory, number>> }

/** 動態狀態（商路不安全、豐收……）：會隨時間換掉，見 docs/TRADE.md 3.2 節 */
export interface TradeStateDef {
  name: string
  desc: string
  mult: Partial<Record<TradeCategory, number>>
  /** 持續天數範圍（不超過一期） */
  days: [number, number]
  weight: number
  /** 只在這些地區、這些聚落類型 */
  regions?: string[]
  types?: string[]
  /** 要有其中一個固定標籤／不能有這些標籤 */
  tags?: string[]
  not_tags?: string[]
  /** 同一組的不會同時出現（豐收與歉收） */
  group?: string
}

export const marketRules = marketJson as unknown as {
  mult_range: [number, number]
  categories: Record<TradeCategory, string>
  tags: Record<string, TradeTagDef>
  state_rules: { period_days: number; max: number; count_weights: number[] }
  states: Record<string, TradeStateDef>
}

export const TRADE_CATEGORIES = Object.keys(marketRules.categories) as TradeCategory[]

export function tradeCategoryName(c: string | undefined): string {
  return c ? marketRules.categories[c as TradeCategory] ?? c : '其他'
}

export function isTradeCategory(c: unknown): c is TradeCategory {
  return typeof c === 'string' && c in marketRules.categories
}

/** 打造材料的種類 → 貿易類別 */
const FORGE_KIND: Record<string, TradeCategory> = { metal: 'metal', wood: 'wood', leather: 'leather', cloth: 'cloth', jewel: 'luxury' }
/** 珠寶類的打造材料裡算金屬的（銅、銀、金的錠與碎料）；其他珠寶材料（寶石原石）是奢侈品 */
const PRECIOUS_METALS = new Set(['copper', 'silver', 'gold'])
/** 飾品的欄位（戒指、護符、穿環、腳鍊）算奢侈品 */
const JEWELRY_SLOTS = new Set(['ring', 'accessory', 'piercing', 'leg_accessory'])

let lootCache: { rev: number; set: Set<string> } | undefined
function lootItems(): Set<string> {
  if (lootCache?.rev !== contentRevision()) lootCache = { rev: contentRevision(), set: monsterLootItems() }
  return lootCache.set
}

/**
 * 這件東西的貿易類別：物品寫了 trade_category 就照寫的，否則照現有欄位推
 * （打造材料照材料種類、怪物會掉的材料是怪物素材、裝備照底材的欄位……）。推不出來的沒有類別，不受標籤影響。
 */
export function tradeCategory(state: Pick<GameState, 'customItems'> | undefined, name: string): TradeCategory | undefined {
  const def = itemDef(name)
  const own = def?.trade_category
  if (isTradeCategory(own)) return own
  const custom = state?.customItems?.[name]
  return inferTradeCategory({ name, category: def?.category ?? custom?.category, gear: def?.gear ?? custom?.gear, forge: def?.forge, use: def?.use })
}

/** 沒寫貿易類別時照現有欄位推（內容編輯器也用這個顯示「沒填時算哪一類」） */
export function inferTradeCategory(i: { name: string; category?: string; gear?: GearSpec; forge?: { materials: string[] }; use?: ItemUse }): TradeCategory | undefined {
  if (i.gear) {
    const b = gearRules.bases[i.gear.base]
    if (!b) return undefined
    if (b.outfit || b.restraint) return 'clothing'
    if (b.slot === 'main_hand') return 'weapon'
    if (b.slot === 'off_hand') return b.type === '法器' ? 'magic' : b.type === '副手武器' ? 'weapon' : 'armor'
    if (JEWELRY_SLOTS.has(b.slot)) return 'luxury'
    if (b.slot === 'underwear_top' || b.slot === 'underwear_bottom') return 'clothing'
    return 'armor'
  }
  switch (i.category) {
    case 'material': {
      const mats = i.forge?.materials ?? []
      if (mats.some((m) => PRECIOUS_METALS.has(m))) return 'metal'
      const kind = mats.map((m) => gearRules.materials[m]?.kind).find(Boolean)
      if (kind && FORGE_KIND[kind]) return FORGE_KIND[kind]
      return lootItems().has(i.name) ? 'monster' : undefined
    }
    case 'food': return i.name.endsWith('酒') ? 'liquor' : 'grain'
    // 書（學特質、技能）不算貿易商品
    case 'consumable': return i.use?.perks?.length || i.use?.abilities?.length ? undefined : 'herb'
    case 'scroll': return 'magic'
    case 'furniture': return 'luxury'
    case 'gear': return 'goods'
    default: return undefined
  }
}

/** 這座聚落的固定標籤（驛站、地下城沒有） */
export function townTags(locationId: string): { id: string; def: TradeTagDef }[] {
  const loc = geography.locations.find((l) => l.id === locationId)
  return (loc?.trade_tags ?? []).flatMap((id) => (marketRules.tags[id] ? [{ id, def: marketRules.tags[id]! }] : []))
}

// ---- 動態狀態 ----

export interface ActiveTradeState {
  id: string
  def: TradeStateDef
  /** 從第幾天開始、到第幾天之前（不含）結束 */
  start: number
  end: number
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function stateFits(def: TradeStateDef, loc: Location): boolean {
  const tags = loc.trade_tags ?? []
  if (def.regions?.length && !def.regions.includes(loc.region)) return false
  if (def.types?.length && !def.types.includes(loc.type)) return false
  if (def.tags?.length && !def.tags.some((t) => tags.includes(t))) return false
  if (def.not_tags?.some((t) => tags.includes(t))) return false
  return def.weight > 0
}

function pickWeighted<T>(rng: Rng, list: T[], weight: (x: T) => number): T | undefined {
  const total = list.reduce((a, x) => a + Math.max(0, weight(x)), 0)
  if (total <= 0) return undefined
  let r = rng.next() * total
  for (const x of list) {
    r -= Math.max(0, weight(x))
    if (r < 0) return x
  }
  return list[list.length - 1]
}

const drawCache = new Map<string, ActiveTradeState[]>()

/**
 * 這座聚落這一期抽到的狀態：每 period_days 天一期（各聚落照 id 錯開開始的那天），
 * 期初抽 0～max 個，各自持續幾天。亂數只看世界的種子、聚落與第幾期，讀檔重來也一樣。
 */
function periodStates(seed: number, loc: Location, period: number, start: number): ActiveTradeState[] {
  const key = `${contentRevision()}|${seed}|${loc.id}|${period}`
  const hit = drawCache.get(key)
  if (hit) return hit
  const r = marketRules.state_rules
  const rng = new Rng(hash(key.slice(key.indexOf('|') + 1)))
  const counts = r.count_weights.slice(0, r.max + 1)
  const n = pickWeighted(rng, counts.map((_, i) => i), (i) => counts[i]!) ?? 0
  const out: ActiveTradeState[] = []
  for (let i = 0; i < n; i++) {
    const pool = Object.entries(marketRules.states).filter(([id, def]) => stateFits(def, loc)
      && !out.some((x) => x.id === id || (!!def.group && x.def.group === def.group)))
    const got = pickWeighted(rng, pool, ([, def]) => def.weight)
    if (!got) break
    const [id, def] = got
    const days = Math.max(1, Math.min(r.period_days, rng.int(def.days[0], def.days[1])))
    out.push({ id, def, start, end: start + days })
  }
  if (drawCache.size > 500) drawCache.clear()
  drawCache.set(key, out)
  return out
}

/** 這座聚落今天的動態狀態（驛站、地下城沒有） */
export function townStates(state: Pick<GameState, 'seed' | 'time'>, locationId: string): ActiveTradeState[] {
  const loc = geography.locations.find((l) => l.id === locationId)
  if (!loc || loc.type === 'dungeon') return []
  const len = marketRules.state_rules.period_days
  const day = state.time.day
  const offset = hash(loc.id) % len
  const period = Math.floor((day + offset) / len)
  return periodStates(state.seed, loc, period, period * len - offset).filter((x) => day >= x.start && day < x.end)
}

// ---- 類別倍率 ----

export interface MarketPart { label: string; x: number; kind: 'tag' | 'state'; desc: string; daysLeft?: number }
export interface MarketMult { category?: TradeCategory; x: number; parts: MarketPart[] }

/** 這類商品在這座聚落的類別倍率：固定標籤與今天的動態狀態相乘，夾在 mult_range 之間 */
export function categoryMult(state: Pick<GameState, 'seed' | 'time'>, locationId: string | undefined, category: TradeCategory | undefined): MarketMult {
  if (!locationId || !category) return { category, x: 1, parts: [] }
  const parts: MarketPart[] = []
  for (const t of townTags(locationId)) {
    const x = t.def.mult[category]
    if (x !== undefined && x !== 1) parts.push({ label: t.def.name, x, kind: 'tag', desc: t.def.desc })
  }
  for (const st of townStates(state, locationId)) {
    const x = st.def.mult[category]
    if (x !== undefined && x !== 1) parts.push({ label: st.def.name, x, kind: 'state', desc: st.def.desc, daysLeft: st.end - state.time.day })
  }
  const [lo, hi] = marketRules.mult_range
  const raw = parts.reduce((a, p) => a * p.x, 1)
  return { category, x: Math.max(lo, Math.min(hi, raw)), parts }
}

/** 一件商品在這座聚落的類別倍率（買入與賣出都乘這個） */
export function marketMult(state: Pick<GameState, 'customItems' | 'seed' | 'time'>, locationId: string | undefined, name: string): MarketMult {
  return categoryMult(state, locationId, tradeCategory(state, name))
}

/** 標籤效果的文字：「礦石與金屬 −50%」 */
export function tagEffectText(def: Pick<TradeTagDef, 'mult'>): string {
  return Object.entries(def.mult).map(([c, x]) => `${tradeCategoryName(c)} ${pctText(x!)}`).join('、')
}

export function pctText(x: number): string {
  const p = Math.round((x - 1) * 100)
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`
}
