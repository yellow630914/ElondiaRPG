// 自創配方（crafts.json 的 invention，見 docs/CRAFTING.md 第 7 節）：
// 選工藝、等級、類別與材料，描述想做的東西，擲檢定（行動 invent）；AI 判定開啟時由 AI 設計成品，否則仿照同級的現成配方。
// - 強度：效果的種類與數值不超過同一種工藝「高一級」的現成配方（家具看所有工藝的家具配方），
//   所以可以比同級的現成配方稍強，但不超過一級。
// - 價格照同級的現成配方；材料價值不到「價格 × 收購比例 × 份數」的部分當作另外的花費，不能拿來賺錢。
// - 做出來的物品登錄在這個存檔（state.inventions），配方跟著物品，之後可以在「依配方製作」重複做。

import {
  ATTR_IDS, companionRules, craftRules, damageTypes, itemDef, itemRules, locationById, setSaveItems, statuses,
  type AttrId, type CraftId, type Degree, type FurniturePlace, type ItemCategory, type ItemDef, type ItemUse,
} from './data'
import { crafterRefusal, craftName, craftXpFor, gainCraftXp, skillOf, toolAccess, toolTierFor, toolTierName, type ToolAccess } from './crafting'
import { applyEffects, type RewardEffect } from './effects'
import { currentArea } from './grid'
import { memberOrResident } from './homes'
import { formatMoney } from './money'
import { lostQty, producedQty } from './recipes'
import { withRng } from './state'
import { locationMult } from './trade'
import type { Character, GameState, Report } from './types'

export type InventCategory = 'consumable' | 'food' | 'furniture'
export const INVENT_CATEGORY_NAME: Record<InventCategory, string> = { consumable: '消耗品', food: '料理', furniture: '家具' }

/** 這種工藝能自創的類別 */
export function inventCategories(craft: CraftId): InventCategory[] {
  return (craftRules.invention.categories[craft] ?? []).filter((c): c is InventCategory => c === 'consumable' || c === 'food' || c === 'furniture')
}

// ---- 上限 ----

export interface InventCaps {
  craft: CraftId
  level: number
  category: InventCategory
  /** 參考到第幾級的現成配方（高一級，最多到最高級） */
  top: number
  /** 參考的現成配方 */
  refs: string[]
  /** 成品的單價（同級的現成配方裡最貴的） */
  price: number
  /** 一批最多幾份 */
  qty: number
  hours: number
  heal?: { avg: number; dice: string }
  slot?: number
  cleanse: string[]
  cleanseMax: number
  /** 給自己的狀態：id → 最多回合 */
  statuses: Record<string, number>
  tempHp?: number
  ap?: number
  revive?: number
  damage?: { avg: number; dice: string }
  /** 對敵人施加的狀態：id → 最多回合 */
  applies: Record<string, number>
  saveDc?: number
  areaAll: boolean
  escape: boolean
  /** 料理能給的狀態（依 rank 由低到高） */
  conditions: string[]
  comfort: number
  bed: boolean
}

/** 骰子的平均值（2d4+2 → 7） */
export function diceAvg(dice: string): number {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice.replace(/\s/g, ''))
  if (!m) return Number.NaN
  return (Number(m[1]) * (Number(m[2]) + 1)) / 2 + Number(m[3] ?? 0)
}

/** 能參考的現成配方（物品目錄裡的；工作台與苗圃不能自創） */
function referenceItems(craft: CraftId, category: InventCategory, top: number): ItemDef[] {
  return itemRules.items.filter((i) => {
    if (!i.recipe || i.category !== category || i.recipe.level > top) return false
    if (category !== 'furniture') return i.recipe.craft === craft
    return i.furniture?.function !== 'workbench' && i.furniture?.function !== 'garden'
  })
}

/** 自創的上限：同一種工藝高一級的現成配方（沒有這個類別的現成配方時 undefined） */
export function inventCaps(craft: CraftId, level: number, category: InventCategory): InventCaps | undefined {
  if (!inventCategories(craft).includes(category)) return undefined
  const top = Math.min(level + 1, craftRules.max_level)
  const refs = referenceItems(craft, category, top)
  if (!refs.length) return undefined
  // 價格與時間看同級（含以下）的現成配方；沒有時看最便宜的那個
  const same = refs.filter((i) => i.recipe!.level <= level)
  const priced = same.length ? same : [refs.reduce((a, b) => (a.price_cc <= b.price_cc ? a : b))]
  const priceRef = priced.reduce((a, b) => (a.price_cc >= b.price_cc ? a : b))
  const caps: InventCaps = {
    craft, level, category, top, refs: refs.map((i) => i.name),
    price: priceRef.price_cc, qty: Math.max(1, ...refs.map((i) => i.recipe!.qty ?? 1)), hours: Math.max(...priced.map((i) => i.recipe!.hours ?? 2)),
    cleanse: [], cleanseMax: 0, statuses: {}, applies: {}, areaAll: false, escape: false, conditions: [], comfort: 0, bed: false,
  }
  const max = (a: number | undefined, b: number | undefined) => (b === undefined ? a : Math.max(a ?? 0, b))
  for (const i of refs) {
    const u: ItemUse = i.use ?? {}
    if (u.heal && (!caps.heal || diceAvg(u.heal) > caps.heal.avg)) caps.heal = { avg: diceAvg(u.heal), dice: u.heal }
    caps.slot = max(caps.slot, u.slot)
    if (u.cleanse?.length) {
      caps.cleanse = [...new Set([...caps.cleanse, ...u.cleanse])]
      caps.cleanseMax = Math.max(caps.cleanseMax, u.cleanse.length)
    }
    if (u.status) caps.statuses[u.status.id] = Math.max(caps.statuses[u.status.id] ?? 0, u.status.turns)
    caps.tempHp = max(caps.tempHp, u.temp_hp)
    caps.ap = max(caps.ap, u.ap)
    caps.revive = max(caps.revive, u.revive)
    if (u.damage && (!caps.damage || diceAvg(u.damage.dice) > caps.damage.avg)) caps.damage = { avg: diceAvg(u.damage.dice), dice: u.damage.dice }
    if (u.apply) caps.applies[u.apply.status] = Math.max(caps.applies[u.apply.status] ?? 0, u.apply.turns)
    caps.saveDc = max(max(caps.saveDc, u.apply?.dc), u.save?.dc)
    if (u.area === 'all') caps.areaAll = true
    if (u.escape) caps.escape = true
    if (u.condition && !caps.conditions.includes(u.condition)) caps.conditions.push(u.condition)
    caps.comfort = Math.max(caps.comfort, i.furniture?.comfort ?? 0)
    if (i.furniture?.function === 'bed') caps.bed = true
  }
  const rank = (c: string) => companionRules.conditions[c]?.rank ?? 0
  caps.conditions.sort((a, b) => rank(a) - rank(b))
  return caps
}

/** 上限的說明（給玩家與 AI 看） */
export function capsText(caps: InventCaps): string[] {
  const out: string[] = []
  const st = (id: string) => statuses[id]?.name ?? id
  if (caps.category === 'consumable') {
    if (caps.heal) out.push(`回復生命 ≤ ${caps.heal.dice}（平均 ${caps.heal.avg}）`)
    if (caps.slot) out.push(`回復法術環 ≤ ${caps.slot} 環`)
    if (caps.cleanse.length) out.push(`解除狀態：${caps.cleanse.map(st).join('、')}（最多 ${caps.cleanseMax} 種）`)
    const buffs = Object.entries(caps.statuses)
    if (buffs.length) out.push(`給自己或隊友的狀態：${buffs.map(([id, t]) => `${st(id)}（≤ ${t} 回合）`).join('、')}`)
    if (caps.tempHp) out.push(`臨時生命 ≤ ${caps.tempHp}`)
    if (caps.ap) out.push(`立刻獲得行動點 ≤ ${caps.ap}`)
    if (caps.revive) out.push(`救起倒下的隊友 ≤ ${Math.round(caps.revive * 100)}% 生命`)
    if (caps.damage) out.push(`投擲傷害 ≤ ${caps.damage.dice}（平均 ${caps.damage.avg}，傷害類型自由）`)
    const applies = Object.entries(caps.applies)
    if (applies.length) out.push(`對敵人施加：${applies.map(([id, t]) => `${st(id)}（≤ ${t} 回合）`).join('、')}${caps.saveDc ? `，豁免 DC ≤ ${caps.saveDc}` : ''}`)
    if (caps.damage || applies.length) out.push(caps.areaAll ? '範圍可以是所有敵人' : '範圍只能是一名敵人')
    if (caps.escape) out.push('可以傳送脫離戰鬥')
    out.push(`效果最多 ${craftRules.invention.max_effects} 種`)
  } else if (caps.category === 'food') {
    out.push(`吃下去的狀態：${caps.conditions.map((c) => `${companionRules.conditions[c]?.name ?? c}`).join('、')}`)
  } else {
    out.push(`舒適度 ≤ ${caps.comfort}`)
    if (caps.bed) out.push('可以是床')
  }
  out.push(`一批最多 ${caps.qty} 份，單價 ${formatMoney(caps.price)}`)
  return out
}

// ---- AI 的設計 ----

export interface InventionDesign {
  name: string
  desc?: string
  qty: number
  use?: ItemUse
  furniture?: ItemDef['furniture']
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN)
const cleanName = (v: unknown) => clip(v, 40).replace(/[|*@]/g, '').trim().slice(0, 12)
const DAMAGE_IDS = new Set(damageTypes.types.map((t) => t.id))

/** 把 AI 提出的成品夾進上限：超過的數值降到上限，不能用的效果拿掉，沒有任何效果時 undefined */
export function sanitizeDesign(raw: unknown, caps: InventCaps): InventionDesign | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const name = cleanName(r.name)
  if (!name) return undefined
  const qty = Math.max(1, Math.min(caps.qty, Math.round(num(r.qty)) || 1))
  const desc = clip(r.desc, 80)
  const base = { name, qty, ...(desc ? { desc } : {}) }
  if (caps.category === 'food') {
    const u = (r.use && typeof r.use === 'object' ? r.use : r) as Record<string, unknown>
    const wanted = String(u.condition ?? '')
    // 不在清單裡（例如太強）：給能給的最好的
    const condition = caps.conditions.includes(wanted) ? wanted : caps.conditions.at(-1)
    return condition ? { ...base, use: { condition } } : undefined
  }
  if (caps.category === 'furniture') {
    const f = (r.furniture && typeof r.furniture === 'object' ? r.furniture : r) as Record<string, unknown>
    const places = (Array.isArray(f.places) ? f.places : []).filter((p): p is FurniturePlace => p === 'indoor' || p === 'yard' || p === 'basement')
    const comfort = Math.max(0, Math.min(caps.comfort, Math.round(num(f.comfort)) || 0))
    const bed = caps.bed && (f.bed === true || f.function === 'bed')
    const icon = typeof f.icon === 'string' && f.icon.trim() ? [...f.icon.trim()].slice(0, 2).join('') : undefined
    if (!comfort && !bed) return undefined
    return { ...base, qty: 1, furniture: { places: places.length ? [...new Set(places)] : ['indoor'], ...(bed ? { function: 'bed' as const } : {}), ...(comfort ? { comfort } : {}), ...(icon ? { icon } : {}) } }
  }
  // 消耗品：依固定順序取效果，最多 max_effects 種
  const u = (r.use && typeof r.use === 'object' ? r.use : {}) as Record<string, unknown>
  const use: ItemUse = {}
  const groups: (() => boolean)[] = [
    () => {
      if (!caps.heal || typeof u.heal !== 'string' || Number.isNaN(diceAvg(u.heal))) return false
      use.heal = diceAvg(u.heal) <= caps.heal.avg ? u.heal.replace(/\s/g, '') : caps.heal.dice
      return true
    },
    () => {
      const n = Math.min(caps.slot ?? 0, Math.round(num(u.slot)) || 0)
      if (n > 0) use.slot = n
      return n > 0
    },
    () => {
      const list = (Array.isArray(u.cleanse) ? u.cleanse : []).map(String).filter((c) => caps.cleanse.includes(c)).slice(0, caps.cleanseMax)
      if (list.length) use.cleanse = [...new Set(list)]
      return list.length > 0
    },
    () => {
      const s = (u.status && typeof u.status === 'object' ? u.status : {}) as Record<string, unknown>
      const id = String(s.id ?? '')
      const limit = caps.statuses[id]
      if (!limit) return false
      use.status = { id, turns: Math.max(1, Math.min(limit, Math.round(num(s.turns)) || limit)) }
      return true
    },
    () => {
      const n = Math.min(caps.tempHp ?? 0, Math.round(num(u.temp_hp)) || 0)
      if (n > 0) use.temp_hp = n
      return n > 0
    },
    () => {
      const n = Math.min(caps.ap ?? 0, Math.round(num(u.ap)) || 0)
      if (n > 0) use.ap = n
      return n > 0
    },
    () => {
      const n = Math.min(caps.revive ?? 0, Math.round((num(u.revive) || 0) * 100) / 100)
      if (n > 0) use.revive = n
      return n > 0
    },
    () => {
      // 投擲：傷害與施加狀態算一種
      const d = (u.damage && typeof u.damage === 'object' ? u.damage : {}) as Record<string, unknown>
      const a = (u.apply && typeof u.apply === 'object' ? u.apply : {}) as Record<string, unknown>
      let any = false
      if (caps.damage && typeof d.dice === 'string' && !Number.isNaN(diceAvg(d.dice))) {
        use.damage = { dice: diceAvg(d.dice) <= caps.damage.avg ? d.dice.replace(/\s/g, '') : caps.damage.dice, type: DAMAGE_IDS.has(String(d.type)) ? String(d.type) : 'fire' }
        any = true
      }
      const limit = caps.applies[String(a.status ?? '')]
      if (limit) {
        const save = ATTR_IDS.includes(a.save as AttrId) ? (a.save as AttrId) : undefined
        use.apply = {
          status: String(a.status), turns: Math.max(1, Math.min(limit, Math.round(num(a.turns)) || limit)),
          ...(save ? { save, dc: Math.max(8, Math.min(caps.saveDc ?? 12, Math.round(num(a.dc)) || 12)) } : {}),
        }
        any = true
      }
      if (any) use.area = u.area === 'all' && caps.areaAll ? 'all' : 'one'
      return any
    },
    () => {
      if (!caps.escape || u.escape !== true) return false
      use.escape = true
      return true
    },
  ]
  let n = 0
  for (const g of groups) {
    if (n >= craftRules.invention.max_effects) break
    if (g()) n++
  }
  if (!n) return undefined
  if (use.status || use.temp_hp || use.ap || use.revive || use.damage || use.apply || use.escape) use.combat_only = true
  return { ...base, use }
}

// ---- 試做（行動 invent） ----

export interface InventRequest {
  craft: CraftId
  level: number
  category: InventCategory
  inputs: { name: string; qty: number }[]
}

/** target：「做的人的 id@工藝:等級:類別|材料*數量|…」 */
export function inventTarget(crafter: string, req: InventRequest): string {
  return [`${crafter}@${req.craft}:${req.level}:${req.category}`, ...req.inputs.filter((x) => x.qty > 0).map((x) => `${x.name}*${x.qty}`)].join('|')
}

export function parseInventTarget(state: GameState, target?: string): { crafter: Character; req: InventRequest } {
  const t = target ?? ''
  const at = t.indexOf('@')
  const [head, ...rest] = t.slice(at + 1).split('|')
  const [craft, level, category] = (head ?? '').split(':')
  const crafter = memberOrResident(state, currentArea(state), at > 0 ? t.slice(0, at) : 'pc')
  if (!crafter) throw new Error('隊伍中（或家裡）沒有這位角色')
  if (!craftRules.skills[craft as CraftId]) throw new Error('請選擇工藝')
  const merged = new Map<string, number>()
  for (const x of rest) {
    const i = x.lastIndexOf('*')
    const name = i >= 0 ? x.slice(0, i) : x
    if (name) merged.set(name, (merged.get(name) ?? 0) + Math.max(1, Math.round(Number(i >= 0 ? x.slice(i + 1) : 1)) || 1))
  }
  return {
    crafter,
    req: {
      craft: craft as CraftId, level: Math.max(1, Math.min(craftRules.max_level, Math.round(Number(level)) || 1)),
      category: category as InventCategory, inputs: [...merged].map(([name, qty]) => ({ name, qty })),
    },
  }
}

export interface InventPlan {
  caps?: InventCaps
  inputs: { name: string; need: number; have: number }[]
  /** 材料的價值（目錄價） */
  inputValue: number
  /** 做一份時另外的花費（材料價值不夠的差額，乘地點物價）；成品份數多時會再補 */
  cost: number
  rent: number
  fee: number
  dc: number
  hours: number
  /** 做的人的工藝等級 */
  skill: number
  tool: ToolAccess
  blocked?: string
}

/** 材料價值不到「價格 × 收購比例 × 份數」的差額（基準價，還沒乘地點物價） */
export function supplyGap(caps: InventCaps, inputValue: number, qty: number): number {
  return Math.max(0, Math.ceil(caps.price * itemRules.sell_ratio * qty) - inputValue)
}

export function inventPlan(state: GameState, req: InventRequest, crafter: Character): InventPlan {
  const caps = inventCaps(req.craft, req.level, req.category)
  const inputs = req.inputs.map((x) => ({ name: x.name, need: x.qty, have: state.inventory.find((i) => i.name === x.name)?.qty ?? 0 }))
  const inputValue = req.inputs.reduce((s, x) => s + (itemDef(x.name)?.price_cc ?? 0) * x.qty, 0)
  const hours = craftRules.invention.hours
  const tool = toolAccess(state, req.craft)
  const needTier = toolTierFor(req.level)
  const cost = caps ? Math.round(supplyGap(caps, inputValue, 1) * locationMult(state)) : 0
  const rent = tool.rentPerHour && tool.tier >= needTier ? tool.rentPerHour * hours : 0
  const skill = skillOf(crafter, req.craft).level
  const short = inputs.find((x) => x.have < x.need)
  let blocked: string | undefined
  if (!inventCategories(req.craft).includes(req.category)) blocked = `${craftName(req.craft)}不能做${INVENT_CATEGORY_NAME[req.category] ?? '這種東西'}`
  else if (!caps) blocked = `第 ${req.level} 級以內還沒有可以參考的${craftName(req.craft)}${INVENT_CATEGORY_NAME[req.category]}配方`
  else if (skill < req.level) blocked = `${crafter.name}的${craftName(req.craft)}只有 Lv.${skill}（要 Lv.${req.level}）`
  else if (tool.tier < needTier) blocked = `要用${craftName(req.craft)}的${toolTierName(needTier)}（現在：${tool.source}）`
  else if (!inputs.length) blocked = '至少要放一種材料'
  else if (inputs.length > craftRules.invention.max_inputs) blocked = `材料最多 ${craftRules.invention.max_inputs} 種`
  else if (inputs.some((x) => itemDef(x.name)?.category === 'equipment')) blocked = '裝備不能當材料'
  else if (short) blocked = `${short.name}不夠（需要 ${short.need}，持有 ${short.have}）`
  else if (state.money_cc < cost + rent) blocked = `費用不夠（需要 ${formatMoney(cost + rent)}）`
  return {
    ...(caps ? { caps } : {}), inputs, inputValue, cost, rent, fee: cost + rent,
    dc: (craftRules.recipe.dc[req.level - 1] ?? 18) + craftRules.invention.dc_bonus, hours, skill, tool, ...(blocked ? { blocked } : {}),
  }
}

export function setupInvent(state: GameState, target?: string) {
  const { crafter, req } = parseInventTarget(state, target)
  const refusal = crafterRefusal(state, crafter)
  if (refusal) throw new Error(`${crafter.name}不肯動手：${refusal}`)
  const plan = inventPlan(state, req, crafter)
  if (plan.blocked) throw new Error(plan.blocked)
  const skill = craftRules.skills[req.craft]
  const used = plan.inputs.map((x) => `${x.name}×${x.need}`).join('、')
  return {
    actor: crafter.id,
    attr: skill.attr, dc: plan.dc, hours: plan.hours,
    situational: [{ label: `${crafter.name}的${skill.name}（Lv.${plan.skill}）`, value: plan.skill * craftRules.level_bonus }],
    scene: `${locationById(state.location).name}・${crafter.isPlayer ? '' : `由${crafter.name}`}自創${skill.name} Lv.${req.level} 的${INVENT_CATEGORY_NAME[req.category]}（${plan.tool.source}，材料 ${used}）`,
    targetName: `自創的${INVENT_CATEGORY_NAME[req.category]}`,
    outcomes: {
      critical: '做出成品並多做一半，記成新的配方',
      success: '做出成品，記成新的配方',
      partial: '只做出一半的份數，配方還是記下來了',
      fail: '沒做成，材料損失一半，費用照付',
      fumble: '搞砸了，材料全部損失，費用照付',
    } as Partial<Record<Degree, string>>,
  }
}

/** 沒有 AI 的設計時：仿照同級（含以下）最高級的現成配方 */
function templateDesign(state: GameState, caps: InventCaps): InventionDesign {
  const refs = referenceItems(caps.craft, caps.category, caps.level)
  const pool = refs.length ? refs : referenceItems(caps.craft, caps.category, caps.top)
  const best = Math.max(...pool.map((i) => i.recipe!.level))
  const pick = withRng(state, (rng) => rng.pick(pool.filter((i) => i.recipe!.level === best)))
  return {
    name: `特製${pick.name}`.slice(0, 12), qty: pick.recipe!.qty ?? 1, ...(pick.desc ? { desc: pick.desc } : {}),
    ...(pick.use ? { use: JSON.parse(JSON.stringify(pick.use)) as ItemUse } : {}),
    ...(pick.furniture ? { furniture: JSON.parse(JSON.stringify(pick.furniture)) as ItemDef['furniture'] } : {}),
  }
}

/** 名字和現有的物品重複時加上編號 */
function freeName(state: GameState, name: string): string {
  const taken = (n: string) => !!itemDef(n) || !!state.customItems?.[n] || !!state.inventions?.[n]
  if (!taken(name)) return name
  for (let i = 2; ; i++) if (!taken(`${name}${i}`)) return `${name}${i}`
}

/** 結算：付費用、用掉材料；有做出東西時登錄成品與配方 */
export function applyInvent(state: GameState, report: Report, target: string, degree: Degree, raw?: unknown): string {
  const { crafter, req } = parseInventTarget(state, target)
  const plan = inventPlan(state, req, crafter)
  const caps = plan.caps
  if (!caps) return '這次的自創沒有可以參考的配方，什麼也沒做出來。'
  const design = (raw !== undefined ? sanitizeDesign(raw, caps) : undefined) ?? templateDesign(state, caps)
  const made = producedQty(design.qty, degree)
  // 份數多時花費跟著補足（材料價值要撐得起所有的份數）
  const gap = supplyGap(caps, plan.inputValue, design.qty)
  const fee = Math.min(state.money_cc, (made ? Math.round(gap * locationMult(state)) : plan.cost) + plan.rent)
  const effects: RewardEffect[] = fee ? [{ type: 'money', amount: -fee }] : []
  for (const x of plan.inputs) {
    const q = Math.min(x.have, lostQty(x.need, degree))
    if (q) effects.push({ type: 'item', name: x.name, qty: -q })
  }
  let text: string
  if (made) {
    const name = freeName(state, design.name)
    const def: ItemDef = {
      name, category: req.category, price_cc: caps.price, tags: [],
      ...(design.desc ? { desc: design.desc } : {}),
      ...(design.use ? { use: design.use } : {}),
      ...(design.furniture ? { furniture: design.furniture } : {}),
      recipe: {
        craft: req.craft, level: req.level, inputs: req.inputs.map((x) => ({ ...x })),
        ...(design.qty > 1 ? { qty: design.qty } : {}), ...(gap ? { cost_cc: gap } : {}), hours: caps.hours,
      },
    }
    ;(state.inventions ??= {})[name] = def
    setSaveItems(Object.values(state.inventions))
    effects.push({ type: 'item', name, qty: made })
    text = `${fee ? `花了 ${formatMoney(fee)}，` : ''}自創了「${name}」，做出 ${made} 份，配方記下來了（${craftName(req.craft)} Lv.${req.level}）。`
  } else {
    text = `${fee ? `花了 ${formatMoney(fee)}，` : ''}${degree === 'fail' ? '沒做成，損失了一半的材料' : '搞砸了，材料全部損失'}。`
  }
  applyEffects(state, report, effects)
  const xp = craftXpFor(req.level, degree)
  if (xp) {
    const level = gainCraftXp(crafter, req.craft, xp)
    ;(report.changes.craft_xp ??= []).push({ actor: crafter.id, craft: req.craft, amount: xp, ...(level ? { level } : {}) })
    text += `${crafter.name}的${craftName(req.craft)}經驗 +${xp}${level ? `，升到 Lv.${level}` : ''}。`
  }
  return text
}

/** 忘記自創的配方（物品留著，只是不能再做） */
export function forgetInvention(state: GameState, name: string) {
  const def = state.inventions?.[name]
  if (!def?.recipe) throw new Error('沒有這個自創配方')
  delete def.recipe
  setSaveItems(Object.values(state.inventions!))
}
