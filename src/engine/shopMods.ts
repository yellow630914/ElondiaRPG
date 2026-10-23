// 商店的自訂內容（docs/CONTENT_EDITOR.md 3.8 節）。
// 內建的店只能改圖示、描述、AI 特別商品、店主設定、固定清單、收購類別、工作（受訓存在特質上）與位置（只能移動）；
// 店名、店種、上架的物品類型與店的專屬功能不能改。
// 自建的店（id 是 shop_ 開頭，地圖格子的種類就是 id）每一項都可以改，擺在聚落的格子上；沒有專屬功能。

import {
  ATTR_IDS, geography, isCustomShopId, itemDef, itemRules, npcs as namedNpcs, npcTags, shopRules, specialMaps, workRules,
  type AttrId, type ItemCategory, type JobDef, type ShopFixedDeal, type ShopType, type ShopTypeDef,
} from './data'
import { blockKeys, CELL_ICON, setCellOverrides, settlementArea, type CellKind } from './grid'
import { notForSale } from './trade'
import { isLotCell } from './homes'

export interface CellRef { area: string; x: number; y: number }

/** 商店的修改：內建的只存跟內建不同的欄位；自建的存整份 */
export interface ShopMod {
  emoji?: string
  desc?: string
  ai?: boolean
  keeper?: { title?: string; tags?: string[] }
  /** 固定清單：每天一定上架的物品（加在目錄的商品之外） */
  fixed?: ShopFixedDeal[]
  /** 收購的類別（整份取代） */
  buys?: ItemCategory[]
  /** 在這種店打工：DC、時薪、描述（自建的店另外選屬性；沒有 work 就沒有打工） */
  work?: { attr?: AttrId; dc?: number; rate_cc?: number; desc?: string }
  /** 內建的店：移動位置（同一個聚落裡，從原本的格子搬到另一格空地） */
  moves?: { from: CellRef; to: CellRef }[]
  /** 自建的店 */
  custom?: boolean
  name?: string
  /** 上架哪種店的目錄（內建商店的 catalog_tag）；空字串＝只賣固定清單 */
  catalog?: string
  /** 接哪些材料類型的打造委託 */
  craft?: string[]
  /** 擺在哪些格子 */
  places?: CellRef[]
}

export const SHOP_LIMITS = {
  fixed: 20, stock: [1, 99], price: [1, 1_000_000], work_dc: [5, 30], rate_cc: [0, 100], desc_chars: 200, name_chars: 12, places: 20,
} as const
export const CRAFT_KINDS: [string, string][] = [['metal', '金屬'], ['wood', '木材'], ['leather', '皮革'], ['cloth', '布料'], ['jewel', '珠寶']]
/** 自建商店的店主職業（給 AI 參考）與 AI 特別商品能用的效果 */
const CUSTOM_KEEPER_CLASSES = ['rogue', 'fighter', 'bard']
const CUSTOM_AI_EFFECTS: ShopTypeDef['ai_effects'] = ['item', 'affinity', 'flag', 'memory']

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const int = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n))) : fallback
}

/** 內建商店的快照（模組載入時），以及各店的工作 */
const snapshot = clone(shopRules.types)
const jobSnapshot = clone(workRules.jobs)

export function builtinShop(id: string): ShopTypeDef | undefined {
  return snapshot[id as ShopType] ? clone(snapshot[id as ShopType]!) : undefined
}

export function builtinJob(id: string): JobDef | undefined {
  const cell = snapshot[id as ShopType]?.cell
  return cell && jobSnapshot[cell] ? clone(jobSnapshot[cell]) : undefined
}

/** 收購類別的選項（物品的類別） */
export function buyCategories(): [ItemCategory, string][] {
  return Object.entries(itemRules.categories) as [ItemCategory, string][]
}

/** 自建商店可以選的目錄：內建商店的目錄（顯示用那種店的名字） */
export function catalogOptions(): [string, string][] {
  const seen = new Map<string, string>()
  for (const d of Object.values(snapshot)) if (!seen.has(d.catalog_tag)) seen.set(d.catalog_tag, d.name)
  return [...seen]
}

/** 可以放進固定清單的物品：目錄裡、商店能賣的 */
export function canListItem(name: string): boolean {
  const def = itemDef(name)
  return !!def && !notForSale(def)
}

export function newShopId(): string {
  return `shop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function newShop(): ShopMod {
  return {
    custom: true, name: '新的商店', emoji: '🏪', desc: '', ai: true, keeper: { title: '店主', tags: ['merchant'] },
    catalog: 'general', buys: ['food', 'gear', 'material'], craft: [], places: [],
  }
}

/** 以內建或自建的店為範本，做一份自建商店的設定（位置不複製） */
export function shopAsCustom(id: string): ShopMod {
  const d = shopRules.types[id as ShopType]
  if (!d) throw new Error('沒有這家店')
  const job = workRules.jobs[d.cell]
  return {
    custom: true, name: `${d.name}2`.slice(0, SHOP_LIMITS.name_chars), emoji: d.emoji, desc: d.desc, ai: d.ai,
    keeper: { title: d.keeper.title, tags: [...(d.keeper.tags ?? [])] }, catalog: d.catalog_tag, buys: [...d.buys],
    ...(d.fixed?.length ? { fixed: clone(d.fixed) } : {}),
    ...(job ? { work: { attr: job.attr, dc: job.dc, rate_cc: job.rate_cc, desc: job.desc } } : {}),
    craft: [...(d.craft ?? BUILTIN_CRAFT[id] ?? [])], places: [],
  }
}
const BUILTIN_CRAFT: Record<string, string[]> = { smithy: ['metal', 'wood'], tailor: ['leather', 'cloth'], jeweler: ['jewel'] }

/** 聚落區塊的格子（區塊存在、座標在範圍內） */
function cleanRef(v: unknown): CellRef | undefined {
  const r = v as Partial<CellRef> | undefined
  if (!r || typeof r.area !== 'string') return undefined
  const area = settlementArea(r.area, false)
  if (!area) return undefined
  const x = Number(r.x)
  const y = Number(r.y)
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= area.width || y >= area.height) return undefined
  return { area: area.key, x, y }
}
const sameRef = (a: CellRef, b: CellRef) => a.area === b.area && a.x === b.x && a.y === b.y
const locationOf = (area: string) => area.split('/')[0]!

function cleanFixed(raw: unknown, listable: (name: string) => boolean): ShopFixedDeal[] {
  const L = SHOP_LIMITS
  const seen = new Set<string>()
  const fixed: ShopFixedDeal[] = []
  for (const f of Array.isArray(raw) ? (raw as Partial<ShopFixedDeal>[]) : []) {
    const item = str(f?.item, 40)
    if (!item || seen.has(item) || !listable(item) || fixed.length >= L.fixed) continue
    seen.add(item)
    const deal: ShopFixedDeal = { item, stock: int(f.stock, L.stock, 1) }
    if (f.price_cc !== undefined && f.price_cc !== null && String(f.price_cc) !== '') deal.price_cc = int(f.price_cc, L.price, 1)
    fixed.push(deal)
  }
  return fixed
}

function cleanBuys(raw: unknown): ItemCategory[] {
  const known = new Set(Object.keys(itemRules.categories))
  return [...new Set((Array.isArray(raw) ? raw : []).filter((c): c is ItemCategory => known.has(c)))]
}

function cleanTags(raw: unknown): string[] {
  return [...new Set((Array.isArray(raw) ? raw : []).filter((t): t is string => typeof t === 'string' && !!npcTags.tags[t]))]
}

/** 整理商店的修改：內建的只留可以改、而且和內建不同的欄位；自建的整理成完整的一份 */
export function sanitizeShopMod(id: string, raw: Partial<ShopMod>, listable: (name: string) => boolean = canListItem): ShopMod {
  const base = builtinShop(id)
  if (!base) {
    if (!isCustomShopId(id)) throw new Error('沒有這家店')
    return sanitizeCustomShop(raw, listable)
  }
  const L = SHOP_LIMITS
  const out: ShopMod = {}
  const emoji = str(raw.emoji, 8)
  if (emoji && emoji !== base.emoji) out.emoji = emoji
  const desc = str(raw.desc, L.desc_chars)
  if (desc && desc !== base.desc) out.desc = desc
  if (typeof raw.ai === 'boolean' && raw.ai !== base.ai) out.ai = raw.ai
  const title = str(raw.keeper?.title, 8)
  const tags = cleanTags(raw.keeper?.tags)
  const keeper: NonNullable<ShopMod['keeper']> = {}
  if (title && title !== base.keeper.title) keeper.title = title
  if (raw.keeper?.tags && tags.length && JSON.stringify(tags) !== JSON.stringify(base.keeper.tags ?? [])) keeper.tags = tags
  if (Object.keys(keeper).length) out.keeper = keeper
  const fixed = cleanFixed(raw.fixed, listable)
  if (fixed.length) out.fixed = fixed
  if (Array.isArray(raw.buys)) {
    const buys = cleanBuys(raw.buys)
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
  // 移動：從這種店原本的格子搬到同一個聚落的另一格（是不是空地在套用時檢查）
  const moves: NonNullable<ShopMod['moves']> = []
  for (const m of Array.isArray(raw.moves) ? raw.moves : []) {
    const from = cleanRef(m?.from)
    const to = cleanRef(m?.to)
    if (!from || !to || sameRef(from, to) || locationOf(from.area) !== locationOf(to.area)) continue
    if (settlementArea(from.area, false)!.cells[from.y * settlementArea(from.area, false)!.width + from.x]?.kind !== base.cell) continue
    if (moves.some((x) => sameRef(x.from, from))) continue
    moves.push({ from, to })
  }
  if (moves.length) out.moves = moves
  return out
}

function sanitizeCustomShop(raw: Partial<ShopMod>, listable: (name: string) => boolean): ShopMod {
  const L = SHOP_LIMITS
  const catalogs = new Set(catalogOptions().map(([t]) => t))
  const out: ShopMod = {
    custom: true,
    name: str(raw.name, L.name_chars) || '新的商店',
    emoji: str(raw.emoji, 8) || '🏪',
    desc: str(raw.desc, L.desc_chars),
    ai: raw.ai !== false,
    keeper: { title: str(raw.keeper?.title, 8) || '店主', tags: cleanTags(raw.keeper?.tags) },
    catalog: typeof raw.catalog === 'string' && catalogs.has(raw.catalog) ? raw.catalog : '',
    buys: cleanBuys(raw.buys),
    craft: [...new Set((Array.isArray(raw.craft) ? raw.craft : []).filter((k) => CRAFT_KINDS.some(([x]) => x === k)))],
    places: [],
  }
  const fixed = cleanFixed(raw.fixed, listable)
  if (fixed.length) out.fixed = fixed
  if (raw.work) {
    out.work = {
      attr: ATTR_IDS.includes(raw.work.attr as AttrId) ? raw.work.attr : 'cha',
      dc: int(raw.work.dc, L.work_dc, 12),
      rate_cc: int(raw.work.rate_cc, L.rate_cc, 3),
      desc: str(raw.work.desc, L.desc_chars) || '在店裡幫忙。',
    }
  }
  for (const p of Array.isArray(raw.places) ? raw.places : []) {
    const ref = cleanRef(p)
    if (ref && out.places!.length < L.places && !out.places!.some((x) => sameRef(x, ref))) out.places!.push(ref)
  }
  return out
}

/** 把商店還原成內建的樣子（圖示、工作與位置也一起；自建的店拿掉） */
export function restoreShops() {
  for (const [id, def] of Object.entries(shopRules.types)) {
    if (snapshot[id as ShopType]) continue
    delete shopRules.types[id as ShopType]
    delete CELL_ICON[def.cell as CellKind]
    delete workRules.jobs[def.cell]
  }
  for (const [id, def] of Object.entries(snapshot)) {
    shopRules.types[id as ShopType] = clone(def)
    CELL_ICON[def.cell as CellKind] = def.emoji
    if (jobSnapshot[def.cell]) workRules.jobs[def.cell] = clone(jobSnapshot[def.cell]!)
  }
  setCellOverrides({})
}

/** 套用一家店的修改（位置另外由 applyShopPlacements 一起算） */
export function applyShopMod(id: string, m: ShopMod) {
  if (m.custom) {
    if (!isCustomShopId(id)) throw new Error('自建商店的 id 不對')
    shopRules.types[id as ShopType] = {
      name: m.name ?? '新的商店', cell: id, emoji: m.emoji ?? '🏪', desc: m.desc ?? '', ai: m.ai !== false,
      keeper: { classes: [...CUSTOM_KEEPER_CLASSES], title: m.keeper?.title ?? '店主', tags: [...(m.keeper?.tags ?? [])] },
      catalog_tag: m.catalog ?? '', buys: [...(m.buys ?? [])], ai_effects: [...CUSTOM_AI_EFFECTS], specials: [],
      ...(m.fixed?.length ? { fixed: clone(m.fixed) } : {}),
      custom: true, craft: [...(m.craft ?? [])],
    }
    if (m.work) {
      workRules.jobs[id] = { name: `${m.name ?? '商店'}幫工`, attr: m.work.attr ?? 'cha', dc: m.work.dc ?? 12, rate_cc: m.work.rate_cc ?? 3, desc: m.work.desc ?? '' }
    } else delete workRules.jobs[id]
    CELL_ICON[id as CellKind] = m.emoji ?? '🏪'
    return
  }
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

// ---- 位置 ----

export interface PlacementResult {
  /** 區塊 key → 格子 index → 改成的種類 */
  overrides: Record<string, Record<number, CellKind>>
  /** 擺不上去的：哪家店、哪一格、為什麼 */
  rejected: { shop: string; at: CellRef; reason: string }[]
}

/**
 * 算出所有商店的位置：先拿掉內建商店移走的格子，再依序擺上移過去的內建商店與自建商店。
 * 目標要是空地（道路），同一格只能擺一家；擺不上去的內建商店留在原地。
 */
export function computePlacements(shops: Record<string, ShopMod>): PlacementResult {
  const areas = new Map<string, { width: number; kinds: CellKind[] }>()
  const kindsOf = (key: string) => {
    if (!areas.has(key)) {
      const a = settlementArea(key, false)
      areas.set(key, { width: a?.width ?? 0, kinds: a ? a.cells.map((c) => c.kind) : [] })
    }
    return areas.get(key)!
  }
  const index = (r: CellRef) => r.y * kindsOf(r.area).width + r.x
  const rejected: PlacementResult['rejected'] = []
  const moves: { shop: string; cell: CellKind; from: CellRef; to: CellRef }[] = []
  for (const [id, m] of Object.entries(shops)) {
    if (m.custom) continue
    const cell = snapshot[id as ShopType]?.cell as CellKind | undefined
    if (!cell) continue
    for (const mv of m.moves ?? []) {
      const a = kindsOf(mv.from.area)
      if (a.kinds[index(mv.from)] !== cell) {
        rejected.push({ shop: id, at: mv.from, reason: '原本的格子不是這家店' })
        continue
      }
      a.kinds[index(mv.from)] = 'floor'
      moves.push({ shop: id, cell, from: mv.from, to: mv.to })
    }
  }
  const taken = new Set<string>()
  const place = (shop: string, kind: CellKind, at: CellRef): boolean => {
    const a = kindsOf(at.area)
    const key = `${at.area}:${index(at)}`
    const reason = taken.has(key) ? '那一格已經擺了別的店' : a.kinds[index(at)] !== 'floor' ? '那一格不是空地（道路）' : isLotCell(at.area, at.x, at.y) ? '那一格是待售的空地' : undefined
    if (reason) {
      rejected.push({ shop, at, reason })
      return false
    }
    a.kinds[index(at)] = kind
    taken.add(key)
    return true
  }
  for (const mv of moves) {
    if (!place(mv.shop, mv.cell, mv.to)) kindsOf(mv.from.area).kinds[index(mv.from)] = mv.cell
  }
  for (const [id, m] of Object.entries(shops)) {
    if (!m.custom) continue
    for (const p of m.places ?? []) place(id, id as CellKind, p)
  }
  const overrides: PlacementResult['overrides'] = {}
  for (const [key, a] of areas) {
    const base = settlementArea(key, false)!
    a.kinds.forEach((k, i) => {
      if (base.cells[i]?.kind !== k) (overrides[key] ??= {})[i] = k
    })
  }
  return { overrides, rejected }
}

/** 套用所有商店的位置（擺不上去的略過），回傳擺不上去的與原因 */
export function applyShopPlacements(shops: Record<string, ShopMod>): PlacementResult['rejected'] {
  const r = computePlacements(shops)
  setCellOverrides(r.overrides)
  return r.rejected
}

/** 內建商店原本在哪些格子（所有聚落） */
export function builtinCells(id: string): CellRef[] {
  const cell = snapshot[id as ShopType]?.cell
  if (!cell) return []
  const out: CellRef[] = []
  for (const loc of geography.locations) {
    if (loc.type === 'dungeon') continue
    for (const key of blockKeys(loc.id)) {
      const a = settlementArea(key, false)
      a?.cells.forEach((c, i) => {
        if (c.kind === cell) out.push({ area: key, x: i % a.width, y: Math.floor(i / a.width) })
      })
    }
  }
  return out
}

/** 哪些地方用到這家自建商店：擔任店主的固定 NPC（受訓的特質刪除時一起拿掉，不擋） */
export function shopUsage(id: string): string[] {
  return [
    ...namedNpcs.filter((n) => n.keeper === id).map((n) => `固定 NPC「${n.name}」擔任店主`),
    ...Object.values(specialMaps).filter((m) => m.shops?.some((s) => s.shop === id)).map((m) => `特殊地圖「${m.name}」擺了這家店`),
  ]
}
