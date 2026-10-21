// 商店與交易。說明見 docs/TRADE.md。
//
// - 每間店（雜貨店、神殿、酒館、鐵匠鋪、裁縫店、珠寶店、魔法物品店、情報商）每天有一份交易清單。每筆交易 = 付出（金錢、物品、時間）＋ 得到（報酬模板的效果，可複合）。
//   AI 判定開啟時清單由 AI 依商店類型生成（程式驗證、補上價格下限），否則依物品目錄與 specials 生成。
// - 一般交易（買、賣）直接計算，不需要 AI。
// - 主角想殺價、交涉時才是主動行動（bargain）：成功程度決定這筆交易的價格倍率。
// - 價格 = 目錄價 × 地點倍率；購買時再扣親密度折扣（每點 0.2%，最多 10%）與談判得到的長期折扣。

import { snapshot } from './character'
import {
  companionRules, craftRules, damageTypeName, dungeonEncounters, enemies, geography, itemDef, itemRules, locationById, regionById, shopRules, slaveryRules,
  stories, townQuestTemplates, wildEncounters, type DealCost, type Degree, type ItemCategory, type ItemDef, type ShopType, type ShopTypeDef,
} from './data'
import { applyEffects, type RewardEffect } from './effects'
import { formatMoney } from './money'
import { gearName, gearPrice, gearRules, randomGear, registerGear, sanitizeGearSpec, shiftRarity } from './gear'
import { askingPrice, generateNpc, npcRecord, slavePrice, weightedPick } from './npcs'
import { addAffinity, pcOf } from './party'
import { ensureRelationship } from './social'
import { reputationBand } from './security'
import { pointOffers, storyOffers } from './intel'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Deal, GameState, Report, ShopState } from './types'

const CELL_SHOP: Record<string, ShopType> = {
  shop: 'general', temple: 'temple', tavern: 'tavern', smithy: 'smithy', tailor: 'tailor', jeweler: 'jeweler', magic: 'magic', informant: 'informant',
}

export function shopTypeForCell(cellKind: string): ShopType | null {
  return CELL_SHOP[cellKind] ?? null
}

export function shopKey(state: GameState, type: ShopType): string {
  return `${state.location}/${type}`
}

function typeOf(key: string): ShopType {
  return key.split('/')[1] as ShopType
}

export function locationMult(state: GameState): number {
  return (shopRules.location_price_mult[locationById(state.location).type] ?? 1) * notorietyMult(state)
}

/** 剛遣散入隊沒多久的夥伴：這座城的物價暫時上漲（crafts.json 的 dismiss_penalty） */
export function notorietyMult(state: GameState): number {
  const until = Number(state.flags[`notoriety:${state.location}`] ?? 0)
  return until >= state.time.day ? craftRules.dismiss_penalty.price_mult : 1
}

/** 商店賣材料時的加成（材料的目錄價是收購價） */
const MATERIAL_MARKUP = 2

export function locationRank(type: string): number {
  return shopRules.location_rank[type] ?? 1
}

/** 店主：每間店固定一位，第一次查看時生成 */
function keeperFor(state: GameState, type: ShopType): string {
  const id = `keeper_${state.location}_${type}`
  if (npcRecord(state, id)) return id
  const def = shopRules.types[type]
  // 店主是普通人：神殿是神官，其他是商人
  withRng(state, (rng) => generateNpc(state, rng, {
    id, kind: 'commoner', tags: [type === 'temple' ? 'priest' : 'merchant'], occupation: def.keeper.title, level: rng.int(1, 4),
  }))
  return id
}

export function keeperTitle(type: ShopType): string {
  return shopRules.types[type].keeper.title
}

/** 物品的價值（目錄或 AI 自創物品） */
export function itemValue(state: GameState, name: string): number | undefined {
  return itemDef(name)?.price_cc ?? state.customItems?.[name]?.price_cc
}

export function itemCategory(state: GameState, name: string): ItemCategory | undefined {
  return itemDef(name)?.category ?? (state.customItems?.[name]?.category as ItemCategory | undefined)
}

function itemDeal(state: GameState, name: string, stock: number, markup = 1): Deal {
  // 目錄裡的物品，或登錄在存檔的裝備（流浪商人的優良裝備）
  const def = itemDef(name) ?? state.customItems![name]!
  return {
    id: `item:${name}`,
    title: name,
    ...(def.desc ? { desc: def.desc } : {}),
    gives: [{ type: 'money', amount: Math.max(1, Math.round(def.price_cc * markup * locationMult(state))) }],
    gets: [{ type: 'item', name, qty: 1 }],
    stock,
  }
}

/** 規則生成的清單：目錄裡這種店賣的東西（依聚落規模），加上 specials。 */
function rulesDeals(state: GameState, type: ShopType): Deal[] {
  const def = shopRules.types[type]
  const rank = locationRank(locationById(state.location).type)
  const available = itemRules.items.filter((i) => i.tags.includes(def.catalog_tag) && locationRank(i.min_location ?? 'village') <= rank)
  return withRng(state, (rng) => {
    const deals: Deal[] = []
    const equipment = available.filter((i) => i.category === 'equipment')
    const pickSome = <T>(list: T[], n: number) => [...list].sort(() => rng.next() - 0.5).slice(0, n)
    for (const i of available) {
      if (i.category === 'equipment') continue
      const stock = i.category === 'food' || i.category === 'gear' ? 20 : rng.int(2, 5)
      // 材料的目錄價是收購價：店裡賣的時候加成（避免買進賣出套利）
      deals.push(itemDeal(state, i.name, stock, i.category === 'material' ? def.random?.material_markup ?? MATERIAL_MARKUP : 1))
    }
    // 裝備：稀有的材料比較少出現（第一級最常見，精金極少）
    const gearWeight = (i: ItemDef) => [0, 10, 6, 1.5, 0.2, 0][i.gear ? gearRules.materials[i.gear.material]?.tier ?? 1 : 1] ?? 1
    const picked = new Set<string>()
    for (let n = rng.int(3, 6); n > 0 && picked.size < equipment.length; n--) {
      const pool = equipment.filter((i) => !picked.has(i.name))
      picked.add(weightedPick(rng, Object.fromEntries(pool.map((i) => [i.name, gearWeight(i)]))))
    }
    for (const name of picked) deals.push(itemDeal(state, name, 1))
    // 魔法物品店：每天隨機上架消耗品與材料（材料以收購價加成賣出，依聚落規模限制價格）
    if (def.random) {
      const r = def.random
      const have = new Set(deals.map((d) => d.title))
      const consumables = itemRules.items.filter((i) => i.category === 'consumable' && !have.has(i.name) && locationRank(i.min_location ?? 'village') <= rank)
      for (const i of pickSome(consumables, r.consumables ?? 0)) deals.push(itemDeal(state, i.name, rng.int(1, 3)))
      const cap = r.max_material_price?.[Math.min(rank, (r.max_material_price.length ?? 1) - 1)] ?? 300
      const materials = itemRules.items.filter((i) => i.category === 'material' && i.price_cc <= cap && i.price_cc >= 5)
      for (const i of pickSome(materials, r.materials ?? 0)) deals.push(itemDeal(state, i.name, rng.int(1, 2), r.material_markup ?? 2))
    }
    // 流浪商人：幾件隨機的優良裝備
    for (let n = def.rare_gear ?? 0; n > 0; n--) {
      const spec = randomGear(rng, pcOf(state).level + 2)
      if (spec.rarity === undefined || spec.rarity === 'common') spec.rarity = 'uncommon'
      deals.push(itemDeal(state, registerGear(state, spec), 1))
    }
    if (def.info) deals.push(...infoDeals(state, def.info))
    for (const sp of def.specials) deals.push(specialDeal(sp))
    return deals
  })
}

/**
 * 情報商：事件點的情報（近郊或附近地下城某一層的強敵、寶物、流浪商人）、特殊任務的消息、進行中委託的線索。
 * 事件點與任務消息見 intel.ts。
 */
function infoDeals(state: GameState, info: NonNullable<ShopTypeDef['info']>): Deal[] {
  const mult = locationMult(state)
  const deals: Deal[] = []
  const points = withRng(state, (rng) => pointOffers(state, rng, info.points_per_day, info.point_prices, info.valid_days, mult))
  for (const o of [...points, ...storyOffers(state, mult)]) {
    deals.push({ id: o.id, title: o.title, desc: o.desc, gives: [{ type: 'money', amount: o.price }], gets: o.gets, stock: 1 })
  }
  // 只有要檢定的委託用得到線索
  for (const q of state.quests.filter((x) => x.status === 'accepted' && !x.flags?.lead && x.template && townQuestTemplates[x.template]?.dc !== undefined)) {
    deals.push({
      id: `info:quest:${q.id}`, title: `「${q.title}」的線索`, desc: '打聽委託的內幕（委託的檢定 +5）。',
      gives: [{ type: 'money', amount: Math.round(info.quest_price * mult) }],
      gets: [{ type: 'quest_flag', quest: q.id, key: 'lead', value: true }, { type: 'memory', summary: `從情報商那裡買到「${q.title}」的線索。`, importance: 1 }],
      stock: 1,
    })
  }
  return deals
}

function specialDeal(sp: { id: string; title: string; desc?: string; gives: DealCost[]; gets: RewardEffect[]; stock: number }): Deal {
  return { id: `special:${sp.id}`, title: sp.title, ...(sp.desc ? { desc: sp.desc } : {}), gives: sp.gives.map((g) => ({ ...g })), gets: sp.gets.map((g) => ({ ...g })), stock: sp.stock }
}

/** 今天這間店的狀態（第一次查看時生成）。 */
export function shopState(state: GameState, type: ShopType): ShopState {
  const key = shopKey(state, type)
  const shops = (state.shops ??= {})
  const cur = shops[key]
  if (cur && cur.day === state.time.day) return cur
  const keeper = keeperFor(state, type)
  const shop: ShopState = { day: state.time.day, keeper, deals: rulesDeals(state, type), source: 'rules' }
  shops[key] = shop
  return shop
}

// ---- 價格 ----

/** 購買時的折扣：店主親密度（每點 0.2%，最多 10%）＋ 談判得到的長期折扣 */
export function discount(state: GameState, key: string): number {
  const shop = state.shops?.[key]
  const aff = shop ? (state.relationships?.[shop.keeper]?.affinity ?? 0) : 0
  const fromAffinity = Math.max(0, Math.min(shopRules.max_affinity_discount, aff * shopRules.affinity_discount_per_point))
  const negotiated = Number(state.flags[`discount:${key}`] ?? 0) || 0
  return Math.min(0.5, fromAffinity + negotiated)
}

/** 這筆交易實際要付的錢：折扣後，再依這裡所屬勢力的聲望調整（見 security.json） */
export function dealMoney(state: GameState, key: string, deal: Deal): number {
  const base = deal.gives.filter((g) => g.type === 'money').reduce((s, g) => s + (g.amount ?? 0), 0)
  return base > 0 ? Math.max(1, Math.round(base * (1 - discount(state, key)) * (1 + reputationBand(state).buy))) : 0
}

/** 收購價：目錄價 × 收購比例（材料是全價）× 地點倍率 × 親密度加成 × 聲望倍率 */
export function sellPrice(state: GameState, key: string, name: string): number | null {
  const type = typeOf(key)
  const cat = itemCategory(state, name)
  const value = itemValue(state, name)
  if (!cat || value === undefined || !shopRules.types[type].buys.includes(cat)) return null
  const ratio = cat === 'material' ? itemRules.material_sell_ratio : itemRules.sell_ratio
  return Math.max(1, Math.floor(value * ratio * locationMult(state) * (1 + discount(state, key) / 2) * (1 + reputationBand(state).sell)))
}

// ---- 交易 ----

function tradeReport(state: GameState, key: string, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  const type = typeOf(key)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'trade',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: `${loc.name}的${shopRules.types[type].name}` },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

/** 把效果裡的代號換成實際對象：keeper 店主、party 每位隊友、local 當地勢力 */
export function expandTokens(state: GameState, effects: RewardEffect[], keeper?: string): RewardEffect[] {
  const out: RewardEffect[] = []
  for (const e of effects) {
    if (e.type === 'affinity' && e.npc === 'party') {
      for (const m of state.party) if (!m.isPlayer) out.push({ ...e, npc: m.id })
    } else if ((e.type === 'affinity' || e.type === 'relationship_text') && e.npc === 'keeper') {
      if (keeper) out.push({ ...e, npc: keeper })
    } else if (e.type === 'reputation' && e.faction === 'local') {
      out.push({ ...e, faction: locationById(state.location).faction ?? 'guild' })
    } else out.push(e)
  }
  return out
}

function haveItem(state: GameState, name: string): number {
  return state.inventory.find((i) => i.name === name)?.qty ?? 0
}

/** 一般的商品（目錄裡的物品）：可以一次買好幾份 */
export function isItemDeal(deal: Deal): boolean {
  return deal.id.startsWith('item:')
}

/** 買下一筆交易：付出金錢、物品、時間，得到報酬。不需要 AI。一般的商品可以一次買 qty 份。 */
export function buyDeal(state: GameState, type: ShopType, dealId: string, qty = 1): Report {
  const key = shopKey(state, type)
  const shop = shopState(state, type)
  const deal = shop.deals.find((d) => d.id === dealId)
  if (!deal || deal.stock <= 0) throw new Error('這筆交易已經沒有了')
  const n = Math.max(1, Math.floor(qty) || 1)
  if (n > 1 && !isItemDeal(deal)) throw new Error('這筆交易一次只能做一份')
  if (n > deal.stock) throw new Error(`今天只剩 ${deal.stock} 份`)
  const money = dealMoney(state, key, deal) * n
  if (state.money_cc < money) throw new Error('錢不夠')
  for (const g of deal.gives) {
    if (g.type === 'item' && haveItem(state, g.name ?? '') < (g.qty ?? 1) * n) throw new Error(`需要 ${g.name} ×${(g.qty ?? 1) * n}`)
  }
  const hours = deal.gives.filter((g) => g.type === 'hours').reduce((s, g) => s + (g.amount ?? 0), 0) * n
  const report = tradeReport(state, key, Math.max(0.1, hours))
  const keeperRec = npcRecord(state, shop.keeper)!
  ensureRelationship(state, keeperRec)
  if (money) report.changes.money_cc = -money
  for (const g of deal.gives) if (g.type === 'item') (report.changes.items_lost ??= []).push({ name: g.name!, qty: (g.qty ?? 1) * n })
  // 一次買好幾份：物品的數量相乘（其他效果一般的商品不會有）
  const gets = n > 1 ? deal.gets.map((g) => (g.type === 'item' ? { ...g, qty: g.qty * n } : g)) : deal.gets
  const notes = applyEffects(state, report, expandTokens(state, gets, shop.keeper))
  deal.stock -= n
  const paid = [money ? formatMoney(money) : '', ...deal.gives.filter((g) => g.type === 'item').map((g) => `${g.name} ×${(g.qty ?? 1) * n}`), hours ? `${hours} 小時` : '']
    .filter(Boolean).join('、')
  report.outcome.summary = `在${keeperRec.name}的店裡交易「${deal.title}」${n > 1 ? ` ×${n}` : ''}${paid ? `，付出 ${paid}` : ''}。${notes.join('；')}`
  // 有人入隊、得到報酬以外的後果時，值得交給 AI 描寫
  if (deal.gets.some((g) => g.type === 'companion' || g.type === 'memory')) report.kind = 'social'
  if (deal.gets.some((g) => g.type === 'start_story')) report.kind = 'event'
  return commitReport(state, report)
}

/** 賣出物品 */
export function sellItem(state: GameState, type: ShopType, name: string, qty: number): Report {
  const key = shopKey(state, type)
  const shop = shopState(state, type)
  const price = sellPrice(state, key, name)
  if (price === null) throw new Error('這間店不收這種東西')
  const n = Math.min(Math.floor(qty), haveItem(state, name))
  if (n <= 0) throw new Error('沒有這個物品')
  const report = tradeReport(state, key, 0.1)
  ensureRelationship(state, npcRecord(state, shop.keeper)!)
  report.changes.items_lost = [{ name, qty: n }]
  report.changes.money_cc = price * n
  report.outcome.summary = `賣出 ${name} ×${n}，得到 ${formatMoney(price * n)}。`
  return commitReport(state, report)
}

// ---- 交涉（主動行動） ----

export function bargainTarget(type: ShopType, dealId: string): string {
  return `${type}|${dealId}`
}

function parseBargain(state: GameState, target: string): { type: ShopType; key: string; shop: ShopState; deal: Deal } {
  const [type, dealId] = target.split('|') as [ShopType, string]
  const shop = shopState(state, type)
  const deal = shop.deals.find((d) => d.id === dealId)
  if (!deal || deal.stock <= 0) throw new Error('這筆交易已經沒有了')
  return { type, key: shopKey(state, type), shop, deal }
}

export function bargainSetup(state: GameState, target: string) {
  const { deal, shop } = parseBargain(state, target)
  if (deal.haggled) throw new Error('這筆交易今天已經交涉過了')
  if (!deal.gives.some((g) => g.type === 'money' && (g.amount ?? 0) > 0)) throw new Error('這筆交易不用付錢')
  const rec = npcRecord(state, shop.keeper)!
  ensureRelationship(state, rec)
  const aff = state.relationships?.[rec.id]?.affinity ?? 0
  const f = shopRules.bargain.price_factor
  const pct = (x: number) => `${x < 1 ? '' : '+'}${Math.round((x - 1) * 100)}%`
  return {
    dc: shopRules.bargain.base - Math.floor(aff / 25),
    keeper: rec,
    deal,
    outcomes: {
      critical: `價格 ${pct(f.critical)}，店主很欣賞你`, success: `價格 ${pct(f.success)}`, partial: `價格 ${pct(f.partial)}`,
      fail: '不讓價', fumble: `價格 ${pct(f.fumble)}，店主不高興（親密度 -3）`,
    } as Record<Degree, string>,
  }
}

export function applyBargain(state: GameState, report: Report, target: string, degree: Degree): string {
  const { deal, shop } = parseBargain(state, target)
  const factor = shopRules.bargain.price_factor[degree]
  const before = deal.gives.find((g) => g.type === 'money')!.amount ?? 0
  for (const g of deal.gives) if (g.type === 'money' && g.amount) g.amount = Math.max(1, Math.round(g.amount * factor))
  deal.haggled = true
  if (degree === 'critical') addAffinity(state, report, shop.keeper, 2, '交涉愉快')
  if (degree === 'fumble') addAffinity(state, report, shop.keeper, -3, '被惹惱')
  const after = deal.gives.find((g) => g.type === 'money')!.amount ?? 0
  if (after < before) return `「${deal.title}」從 ${formatMoney(before)} 降到 ${formatMoney(after)}。`
  if (after > before) return `店主不高興，「${deal.title}」漲到 ${formatMoney(after)}。`
  return `店主不肯讓價。`
}

// ---- AI 生成的清單 ----

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN)

/**
 * 驗證 AI 生成的交易清單：效果只能是這種店允許的種類，數值夾在上限內，
 * 價格不低於內容價值的 price_floor_ratio（目錄物品、自創物品、夥伴依各自的價格表）。
 * 驗證後的清單 = AI 的交易 + specials + 乾糧（雜貨店），取代規則清單。
 */
export function applyAiDeals(state: GameState, type: ShopType, raw: unknown): number {
  const shop = shopState(state, type)
  const def = shopRules.types[type]
  const caps = shopRules.ai_caps
  const pc = pcOf(state)
  const mult = locationMult(state)
  const allowSlaves = !!slaveryRules.markets[state.location]
  const list = Array.isArray((raw as { deals?: unknown })?.deals) ? (raw as { deals: unknown[] }).deals : []
  const deals: Deal[] = []
  for (const [i, r] of list.entries()) {
    if (deals.length >= caps.deals || !r || typeof r !== 'object') continue
    const d = r as Record<string, unknown>
    const title = clip(d.title, 30)
    if (!title) continue
    const gets: RewardEffect[] = []
    let value = 0
    for (const g of Array.isArray(d.gets) ? d.gets : []) {
      const x = (g ?? {}) as Record<string, unknown>
      const t = String(x.type) as RewardEffect['type']
      if (!def.ai_effects.includes(t)) continue
      if (t === 'item') {
        const name = clip(x.name, 20)
        const qty = Math.max(1, Math.min(20, Math.round(num(x.qty) || 1)))
        if (!name) continue
        let price = itemValue(state, name)
        if (price === undefined) {
          const cat = String(x.category) as ItemCategory
          const range = itemRules.custom_price_ranges[cat]
          if (!range) continue
          price = Math.max(range[0], Math.min(range[1], Math.round(num(x.price_cc) || range[0])))
          ;(state.customItems ??= {})[name] = { category: cat, price_cc: price, ...(clip(x.desc, 60) ? { desc: clip(x.desc, 60) } : {}) }
        }
        value += price * qty
        gets.push({ type: 'item', name, qty })
      } else if (t === 'gear') {
        // 特製裝備：材料不超過主角等級 + 2，稀有度最多比材料原本的高一級；登錄後當成一般物品賣
        const probe = sanitizeGearSpec({ ...x, rarity: undefined, enchants: undefined }, { maxLevel: pc.level + 2 })
        if (!probe) continue
        const spec = sanitizeGearSpec(x, { maxLevel: pc.level + 2, maxRarity: shiftRarity(gearRules.materials[probe.material]!.rarity, 1) })!
        const name = registerGear(state, spec, clip(x.name, 20) || undefined, clip(x.desc, 80) || undefined)
        value += gearPrice(spec)
        gets.push({ type: 'item', name, qty: 1 })
      } else if (t === 'affinity') {
        const npc = String(x.npc ?? '')
        if (npc !== 'keeper' && npc !== 'party' && !state.relationships?.[npc]) continue
        const delta = Math.max(-caps.affinity, Math.min(caps.affinity, Math.round(num(x.delta) || 0)))
        if (delta) gets.push({ type: 'affinity', npc, delta })
      } else if (t === 'flag') {
        const key = clip(x.key, 30).replace(/[^\w:\-\u4e00-\u9fff]/g, '_')
        if (key) gets.push({ type: 'flag', key: `ai:${key}`, value: typeof x.value === 'number' || typeof x.value === 'boolean' ? x.value : clip(x.value, 60) || true })
      } else if (t === 'memory') {
        const summary = clip(x.summary, 120)
        if (summary) gets.push({ type: 'memory', summary, importance: 1 })
      } else if (t === 'reputation') {
        const delta = Math.max(-caps.reputation, Math.min(caps.reputation, Math.round(num(x.delta) || 0)))
        if (delta) gets.push({ type: 'reputation', faction: clip(x.faction, 30) || 'local', delta })
      } else if (t === 'condition') {
        if (x.condition === 'blessed') gets.push({ type: 'condition', target: 'pc', condition: 'blessed', add: true })
      } else if (t === 'companion') {
        const mode = x.mode === 'slave' && allowSlaves ? 'slave' : x.mode === 'voluntary' ? 'voluntary' : 'hired'
        const spec = (x.npc && typeof x.npc === 'object' ? x.npc : {}) as Record<string, unknown>
        const level = Math.max(1, Math.min(pc.level + 1, Math.round(num(spec.level) || 1)))
        const race = typeof spec.race === 'string' ? spec.race : 'human'
        const cls = typeof spec.class === 'string' ? spec.class : 'fighter'
        value += mode === 'slave' ? slavePrice({ race, class: cls, level }) : mode === 'hired' ? askingPrice(level) : 0
        gets.push({
          type: 'companion', mode,
          npc: { name: clip(spec.name, 12), race, class: cls, level, personality: clip(spec.personality, 80), appearance: clip(spec.appearance, 100), background: clip(spec.background, 100) },
          ...(mode === 'slave' ? { contract: 'labor' } : {}),
        })
      }
    }
    if (!gets.length) continue
    const gives: DealCost[] = []
    let itemsGiven = 0
    for (const g of Array.isArray(d.gives) ? d.gives : []) {
      const x = (g ?? {}) as Record<string, unknown>
      if (x.type === 'item' && clip(x.name, 20)) {
        const name = clip(x.name, 20)
        const qty = Math.max(1, Math.min(10, Math.round(num(x.qty) || 1)))
        gives.push({ type: 'item', name, qty })
        itemsGiven += (itemValue(state, name) ?? 0) * itemRules.sell_ratio * qty
      } else if (x.type === 'hours') {
        const h = Math.max(0.5, Math.min(4, num(x.amount) || 1))
        gives.push({ type: 'hours', amount: h })
      }
    }
    const asked = Math.max(0, Math.round(num((Array.isArray(d.gives) ? d.gives : []).find((g) => (g as { type?: string })?.type === 'money')?.amount) || 0))
    const floor = Math.ceil(value * mult * caps.price_floor_ratio - itemsGiven)
    const hours = gives.filter((g) => g.type === 'hours').reduce((s, g) => s + (g.amount ?? 0), 0)
    let money = Math.max(asked, floor)
    if (money < 5 && !itemsGiven && !hours) money = 5
    if (money > 0) gives.unshift({ type: 'money', amount: money })
    const stock = Math.max(1, Math.min(caps.stock, Math.round(num(d.stock) || 1)))
    deals.push({ id: `ai:${state.time.day}:${i}`, title, ...(clip(d.desc, 80) ? { desc: clip(d.desc, 80) } : {}), gives, gets, stock })
  }
  if (!deals.length) return 0
  const extras = def.specials.map(specialDeal)
  if (type === 'general') extras.unshift(itemDeal(state, '乾糧', 20))
  shop.deals = [...deals, ...extras]
  shop.source = 'ai'
  return deals.length
}

/** 給 UI 與 AI 看的效果說明 */
export function effectText(state: GameState, e: RewardEffect, keeper?: string): string {
  const who = (id: string) => (id === 'keeper' ? (keeper ? npcRecord(state, keeper)?.name ?? '店主' : '店主') : id === 'party' ? '隊友們' : state.relationships?.[id]?.name ?? npcRecord(state, id)?.name ?? id)
  switch (e.type) {
    case 'money': return `${e.amount >= 0 ? '+' : ''}${formatMoney(e.amount)}`
    case 'item': return `${e.name} ×${e.qty}`
    case 'gear': return `【${e.name ?? gearName(e.spec)}】`
    case 'affinity': return `${who(e.npc)}好感 ${e.delta > 0 ? '+' : ''}${e.delta}`
    case 'reputation': return `聲望 ${e.delta > 0 ? '+' : ''}${e.delta}`
    case 'xp': return `經驗 +${e.amount}`
    case 'flag': return e.key.startsWith('discount:') ? `長期折扣 ${Math.round(Number(e.value) * 100)}%` : '劇情旗標'
    case 'companion': {
      const name = typeof e.npc === 'string' ? who(e.npc) : e.npc.name || '新同伴'
      return `${name}${{ voluntary: '同行', hired: '受雇同行', slave: '（奴隸）入隊' }[e.mode]}`
    }
    case 'memory': return '一段記憶'
    case 'condition': return `${e.add ? '獲得' : '解除'}「${companionRules.conditions[e.condition]?.name ?? e.condition}」`
    case 'quest_reward': return `委託報酬 ${e.percent > 0 ? '+' : ''}${e.percent}%`
    case 'quest_flag': return e.key === 'lead' ? '委託線索（檢定 +5）' : e.key === 'suspicious' ? '消息走漏（檢定 -2）' : '委託旗標'
    case 'hp': return '生命值變化'
    case 'intel': return `情報：${e.intel.title}`
    case 'start_story': return `開始特殊任務「${stories.find((d) => d.id === e.story)?.title ?? e.story}」`
    case 'ability': return `${e.chance !== undefined && e.chance < 1 ? `${Math.round(e.chance * 100)}% 機率` : ''}${e.choices ? `學習新能力（${e.choices} 選一）` : `領悟${e.ability ? `【${e.ability}】` : '新能力'}`}`
    default: return e.type
  }
}

export function costText(state: GameState, key: string, deal: Deal): string {
  const money = dealMoney(state, key, deal)
  return [
    money ? formatMoney(money) : '',
    ...deal.gives.filter((g) => g.type === 'item').map((g) => `${g.name} ×${g.qty ?? 1}`),
    ...deal.gives.filter((g) => g.type === 'hours').map((g) => `${g.amount} 小時`),
  ].filter(Boolean).join('＋') || '免費'
}
