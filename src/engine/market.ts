import marketJson from '@data/rules/market.json'
import { contentRevision, geography, itemDef } from './data'
import { gearRules, monsterLootItems } from './gear'
import type { ItemUse } from './data'
import type { GameState, GearSpec } from './types'

// 貿易（docs/TRADE.md 3.1 節）：商品的貿易類別、城鎮的固定標籤，以及兩者合起來的類別倍率

export type TradeCategory = keyof typeof marketJson.categories
export interface TradeTagDef { name: string; desc: string; mult: Partial<Record<TradeCategory, number>> }

export const marketRules = marketJson as unknown as {
  mult_range: [number, number]
  categories: Record<TradeCategory, string>
  tags: Record<string, TradeTagDef>
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

export interface MarketPart { label: string; x: number; kind: 'tag' }
export interface MarketMult { category?: TradeCategory; x: number; parts: MarketPart[] }

/** 這類商品在這座聚落的類別倍率：固定標籤相乘，夾在 mult_range 之間 */
export function categoryMult(locationId: string | undefined, category: TradeCategory | undefined): MarketMult {
  if (!locationId || !category) return { category, x: 1, parts: [] }
  const parts: MarketPart[] = []
  for (const t of townTags(locationId)) {
    const x = t.def.mult[category]
    if (x !== undefined && x !== 1) parts.push({ label: t.def.name, x, kind: 'tag' })
  }
  const [lo, hi] = marketRules.mult_range
  const raw = parts.reduce((a, p) => a * p.x, 1)
  return { category, x: Math.max(lo, Math.min(hi, raw)), parts }
}

/** 一件商品在這座聚落的類別倍率（買入與賣出都乘這個） */
export function marketMult(state: Pick<GameState, 'customItems'>, locationId: string | undefined, name: string): MarketMult {
  return categoryMult(locationId, tradeCategory(state, name))
}

/** 標籤效果的文字：「礦石與金屬 −50%」 */
export function tagEffectText(def: TradeTagDef): string {
  return Object.entries(def.mult).map(([c, x]) => `${tradeCategoryName(c)} ${pctText(x!)}`).join('、')
}

export function pctText(x: number): string {
  const p = Math.round((x - 1) * 100)
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`
}
