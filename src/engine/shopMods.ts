// 商店的自訂內容（docs/CONTENT_EDITOR.md 3.8 節）：內建的店只能改圖示、描述、AI 特別商品、店主設定、固定清單、
// 收購類別與工作（受訓存在特質上）；店名、店種、上架的物品類型與店的專屬功能不能改。

import { itemDef, itemRules, npcTags, shopRules, workRules, type ItemCategory, type JobDef, type ShopFixedDeal, type ShopType, type ShopTypeDef } from './data'
import { CELL_ICON, type CellKind } from './grid'
import { notForSale } from './trade'

/** 內建商店可以改的欄位 */
export interface ShopMod {
  emoji?: string
  desc?: string
  ai?: boolean
  keeper?: { title?: string; tags?: string[] }
  /** 固定清單：每天一定上架的物品（加在目錄的商品之外） */
  fixed?: ShopFixedDeal[]
  /** 收購的類別（整份取代） */
  buys?: ItemCategory[]
  /** 在這種店打工：DC、時薪、描述 */
  work?: { dc?: number; rate_cc?: number; desc?: string }
}

export const SHOP_LIMITS = { fixed: 20, stock: [1, 99], price: [1, 1_000_000], work_dc: [5, 30], rate_cc: [0, 100], desc_chars: 200 } as const

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const int = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n))) : fallback
}

/** 內建商店的快照（模組載入時），以及各店的工作 */
const snapshot = clone(shopRules.types)
const jobSnapshot = clone(workRules.jobs)

export function builtinJob(id: string): JobDef | undefined {
  const cell = snapshot[id as ShopType]?.cell
  return cell && jobSnapshot[cell] ? clone(jobSnapshot[cell]) : undefined
}

/** 收購類別的選項（物品的類別） */
export function buyCategories(): [ItemCategory, string][] {
  return Object.entries(itemRules.categories) as [ItemCategory, string][]
}

/** 可以放進固定清單的物品：目錄裡、商店能賣的 */
export function canListItem(name: string): boolean {
  const def = itemDef(name)
  return !!def && !notForSale(def)
}

export function builtinShop(id: string): ShopTypeDef | undefined {
  return snapshot[id as ShopType] ? clone(snapshot[id as ShopType]) : undefined
}

/** 整理商店的修改：只留可以改的欄位，和內建一樣的不存 */
export function sanitizeShopMod(id: string, raw: Partial<ShopMod>, listable: (name: string) => boolean = canListItem): ShopMod {
  const base = builtinShop(id)
  if (!base) throw new Error('沒有這家店')
  const out: ShopMod = {}
  const emoji = str(raw.emoji, 8)
  if (emoji && emoji !== base.emoji) out.emoji = emoji
  const desc = str(raw.desc, 200)
  if (desc && desc !== base.desc) out.desc = desc
  if (typeof raw.ai === 'boolean' && raw.ai !== base.ai) out.ai = raw.ai
  const title = str(raw.keeper?.title, 8)
  const tags = [...new Set((raw.keeper?.tags ?? []).filter((t) => !!npcTags.tags[t]))]
  const keeper: NonNullable<ShopMod['keeper']> = {}
  if (title && title !== base.keeper.title) keeper.title = title
  if (raw.keeper?.tags && tags.length && JSON.stringify(tags) !== JSON.stringify(base.keeper.tags ?? [])) keeper.tags = tags
  if (Object.keys(keeper).length) out.keeper = keeper
  const L = SHOP_LIMITS
  if (Array.isArray(raw.fixed)) {
    const seen = new Set<string>()
    const fixed: ShopFixedDeal[] = []
    for (const f of raw.fixed) {
      const item = str(f?.item, 40)
      if (!item || seen.has(item) || !listable(item) || fixed.length >= L.fixed) continue
      seen.add(item)
      const deal: ShopFixedDeal = { item, stock: int(f.stock, L.stock, 1) }
      if (f.price_cc !== undefined && f.price_cc !== null && String(f.price_cc) !== '') deal.price_cc = int(f.price_cc, L.price, 1)
      fixed.push(deal)
    }
    if (fixed.length) out.fixed = fixed
  }
  if (Array.isArray(raw.buys)) {
    const known = new Set(Object.keys(itemRules.categories))
    const buys = [...new Set(raw.buys.filter((c) => known.has(c)))]
    if (JSON.stringify([...buys].sort()) !== JSON.stringify([...base.buys].sort())) out.buys = buys
  }
  const job = builtinJob(id)
  if (job && raw.work) {
    const work: NonNullable<ShopMod['work']> = {}
    const dc = int(raw.work.dc, L.work_dc, job.dc)
    if (dc !== job.dc) work.dc = dc
    const rate = int(raw.work.rate_cc, L.rate_cc, job.rate_cc)
    if (rate !== job.rate_cc) work.rate_cc = rate
    const wdesc = str(raw.work.desc, L.desc_chars)
    if (wdesc && wdesc !== job.desc) work.desc = wdesc
    if (Object.keys(work).length) out.work = work
  }
  return out
}

/** 把商店還原成內建的樣子（圖示也一起） */
export function restoreShops() {
  for (const [id, def] of Object.entries(snapshot)) {
    shopRules.types[id as ShopType] = clone(def)
    CELL_ICON[def.cell as CellKind] = def.emoji
    if (jobSnapshot[def.cell]) workRules.jobs[def.cell] = clone(jobSnapshot[def.cell]!)
  }
}

/** 套用一家店的修改 */
export function applyShopMod(id: string, m: ShopMod) {
  const def = shopRules.types[id as ShopType]
  if (!def) throw new Error('沒有這家店')
  if (m.emoji) def.emoji = m.emoji
  if (m.desc) def.desc = m.desc
  if (m.ai !== undefined) def.ai = m.ai
  if (m.keeper?.title) def.keeper.title = m.keeper.title
  if (m.keeper?.tags) def.keeper.tags = [...m.keeper.tags]
  if (m.fixed?.length) def.fixed = m.fixed.map((f) => ({ ...f }))
  if (m.buys) def.buys = [...m.buys]
  const job = workRules.jobs[def.cell]
  if (job && m.work) {
    if (m.work.dc !== undefined) job.dc = m.work.dc
    if (m.work.rate_cc !== undefined) job.rate_cc = m.work.rate_cc
    if (m.work.desc) job.desc = m.work.desc
  }
  CELL_ICON[def.cell as CellKind] = def.emoji
}
