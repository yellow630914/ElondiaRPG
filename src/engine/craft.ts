// 委託打造：在鐵匠鋪（金屬、木材）、裁縫店（皮革、布料）、珠寶店（寶石）選底材與材料，交給工匠打造（data/rules/gear.json 的 craft）。
// 走主動行動 craft（target = "底材:材料"）：玩家可以描述想要的樣子，AI 決定成功程度，
// 也可以用 gear 效果替成品取名、寫描述、挑附魔（程式依成功程度夾住稀有度與附魔點數）。
// AI 關閉時依規則：成功以上隨機附魔。

import { blueprintRules, hasBlueprint } from './blueprints'
import { craftRules as craftSkillRules, isCustomShopId, itemDef, locationById, shopRules, type CraftId, type Degree, type ShopType } from './data'
import {
  crafterRefusal, craftForKind, craftName, craftXpFor, gainCraftXp, keeperCraftLevel, skillOf, toolAccess, toolBlocker, toolTierFor, type ToolAccess,
} from './crafting'
import { npcRecord } from './npcs'
import { dealMoney, keeperFor, locationMult, shopKey, shopTypeForCell } from './trade'
import { applyEffects, type RewardEffect } from './effects'
import { forgeItemsForMaterial, gearName, gearRules, type MaterialKind, rarityName, rarityPoints, registerGear, rollEnchants, sanitizeGearSpec, shiftRarity } from './gear'
import { CELL_NAME, currentArea, currentCell, type CellKind } from './grid'
import { memberOrResident } from './homes'
import { formatMoney } from './money'
import { withRng } from './state'
import type { Character, GameState, GearSpec, Report } from './types'

export interface CraftPlan {
  /** 輔料、總價值、讓稀有度再高一級的機率、屬性方向 */
  aux: AuxItem[]
  auxValue: number
  auxChance: number
  elements: string[]
  base: string
  material: string
  tier: number
  /** 需要的打造材料數量（委託第一級材料時為 0：工匠提供） */
  units: number
  /** 會用掉的物品（選定的那種優先，其餘從便宜的開始；含當場補買的） */
  uses: { name: string; qty: number }[]
  /** 持有的打造材料數量（不含當場補買的） */
  have: number
  /** 能做成這種材料的物品：持有幾個、站的這間店今天有沒有賣（單價、存貨） */
  sources: { name: string; have: number; price?: number; stock?: number }[]
  /** 選定優先用的那一種 */
  use?: string
  /** 當場補買：向站的這間店買不夠的份數（買來直接用掉；沒做成時剩下的留在行囊） */
  buys: { name: string; qty: number; price: number }[]
  buyCost: number
  /** 委託：工錢；自己動手：工坊租金（不含當場補買） */
  fee: number
  dc: number
  /** 自己動手時：有沒有這個底材的圖紙（沒有時 dc 已經 +5） */
  blueprint?: boolean
  /** 做這種材料的工藝 */
  craft: CraftId
  /** 做的人的工藝等級（委託：店主；自己動手：做的人） */
  level: number
  /** 自己動手：做的人與能用的工具 */
  crafter?: string
  tool?: ToolAccess
  /** 自己動手：工坊租金 */
  rent?: number
  /** 自己動手的第一級材料：底材價格 × tier1_cost_ratio 的材料費，扣掉用掉的打造材料的價值（最少 0） */
  materialCost?: number
  /** 不能打造的原因（全部列出，用「；」接起來） */
  blocked?: string
  /** 不能打造的原因，一條一條 */
  blockers: string[]
}

function craftRules() {
  return gearRules.craft
}

/** 物品可以拿來打造哪些材料 */
export function forgeOf(name: string): string[] {
  return itemDef(name)?.forge?.materials ?? []
}

/** 哪種材料到哪裡打造 */
export const CRAFT_SHOP: Record<MaterialKind, CellKind> = { metal: 'smithy', wood: 'smithy', leather: 'tailor', cloth: 'tailor', jewel: 'jeweler' }

/** 這裡可以打造的材料類型 */
export function craftKindsHere(state: GameState): MaterialKind[] {
  const cell = currentCell(state).kind
  // 自建的商店：接哪些材料類型看商店的設定
  const custom = isCustomShopId(cell) ? shopRules.types[cell] : undefined
  if (custom) return (custom.craft ?? []) as MaterialKind[]
  return (Object.keys(CRAFT_SHOP) as MaterialKind[]).filter((k) => CRAFT_SHOP[k] === cell)
}

export function canCraftHere(state: GameState): boolean {
  return craftKindsHere(state).length > 0
}

export interface AuxItem { name: string; qty: number }

/** 打造的選項：優先用哪一種打造材料、不夠時向這間店當場補買 */
export interface CraftOptions { use?: string; buy?: boolean }

/**
 * 打造的 target：「底材:材料」，有輔料時接上「|名稱*數量」，選項接上「|!use=名稱」「|!buy」，
 * 例如 longsword:steel|火蜥鱗片*2|!use=精鋼錠|!buy。
 */
export function parseCraftTarget(target?: string): { base: string; material: string; aux: AuxItem[]; opts: CraftOptions } {
  const [head, ...segs] = (target ?? '').split('|')
  const opts: CraftOptions = {}
  for (const x of segs) {
    if (x === '!buy') opts.buy = true
    else if (x.startsWith('!use=') && x.length > 5) opts.use = x.slice(5)
  }
  const rest = segs.filter((x) => !x.startsWith('!'))
  const [base, material] = (head ?? '').split(':')
  if (!base || !material || !gearRules.bases[base] || !gearRules.materials[material]) throw new Error('請選擇要打造的裝備與材料')
  if (gearRules.bases[base]!.kind !== gearRules.materials[material]!.kind) throw new Error('這種材料不能拿來做這件裝備')
  if (gearRules.bases[base]!.restraint || gearRules.bases[base]!.exclusive) throw new Error(`${gearRules.bases[base]!.name}不能打造`)
  const aux = rest.map((x) => {
    const i = x.lastIndexOf('*')
    return { name: i >= 0 ? x.slice(0, i) : x, qty: Math.max(1, Math.round(Number(i >= 0 ? x.slice(i + 1) : 1)) || 1) }
  }).filter((a) => a.name)
  return { base, material, aux, opts }
}

export function craftTarget(base: string, material: string, aux: AuxItem[] = [], opts: CraftOptions = {}): string {
  return [
    `${base}:${material}`, ...aux.filter((a) => a.qty > 0).map((a) => `${a.name}*${a.qty}`),
    ...(opts.use ? [`!use=${opts.use}`] : []), ...(opts.buy ? ['!buy'] : []),
  ].join('|')
}

/** 站的這間店今天賣的這件物品（只讀今天已經有的清單，不會建立；打開打造面板時先建立） */
export function shopOfferHere(state: GameState, name: string): { key: string; dealId: string; price: number; stock: number } | undefined {
  const type = shopTypeForCell(currentCell(state).kind)
  if (!type) return undefined
  const key = shopKey(state, type)
  const shop = state.shops?.[key]
  if (!shop || shop.day !== state.time.day) return undefined
  const deal = shop.deals.find((d) => d.id === `item:${name}` && d.stock > 0)
  return deal ? { key, dealId: deal.id, price: dealMoney(state, key, deal), stock: deal.stock } : undefined
}

/** 輔料的屬性方向：名稱與描述裡的字（gear.json 的 craft.aux.elements） */
export function auxElements(aux: AuxItem[]): string[] {
  const text = aux.map((a) => `${a.name}${itemDef(a.name)?.desc ?? ''}`).join('')
  return Object.entries(craftRules().aux.elements).filter(([, words]) => words.some((w) => text.includes(w))).map(([k]) => k)
}

function unitsFor(base: string): number {
  const b = gearRules.bases[base]!
  const u = craftRules().units
  return b.two_handed ? u.two_handed! : u[b.slot] ?? 1
}

/**
 * 打造的花費與材料（不檢查站的位置）。沒有 crafter 是委託店主；有 crafter 是這位隊員自己動手：
 * 不付工錢，第一級材料要買（材料費），工具不夠中階時在店裡租工坊
 */
export function craftPlan(state: GameState, base: string, material: string, aux: AuxItem[] = [], crafter?: Character, opts: CraftOptions = {}): CraftPlan {
  const r = craftRules()
  const m = gearRules.materials[material]!
  const tier = m.tier
  const craft = craftForKind(m.kind)
  // 委託的第一級材料由工匠提供（含在工錢裡）；自己動手一律用打造材料
  const units = tier === 1 && !crafter ? 0 : unitsFor(base)
  // 選定的那種優先，其餘從便宜的開始
  const price = (n: string) => itemDef(n)?.price_cc ?? 0
  const first = (a: string, b: string) => (a === opts.use ? -1 : b === opts.use ? 1 : 0) || price(a) - price(b)
  const owned = state.inventory.filter((i) => forgeOf(i.name).includes(material)).sort((a, b) => first(a.name, b.name))
  const have = owned.reduce((s, i) => s + i.qty, 0)
  const uses: { name: string; qty: number }[] = []
  let need = units
  for (const i of owned) {
    if (need <= 0) break
    const q = Math.min(i.qty, need)
    uses.push({ name: i.name, qty: q })
    need -= q
  }
  // 能做成這種材料的物品：持有幾個、這間店有沒有賣
  const sources = forgeItemsForMaterial(material).map((name) => {
    const offer = shopOfferHere(state, name)
    return { name, have: owned.filter((i) => i.name === name).reduce((s, i) => s + i.qty, 0), ...(offer ? { price: offer.price, stock: offer.stock } : {}) }
  })
  // 當場補買：不夠的份數向這間店買（選定的那種優先，其餘從便宜的開始）
  const buys: { name: string; qty: number; price: number }[] = []
  if (opts.buy && need > 0) {
    for (const s of sources.filter((x) => x.price !== undefined).sort((a, b) => first(a.name, b.name) || a.price! - b.price!)) {
      if (need <= 0) break
      const q = Math.min(s.stock!, need)
      buys.push({ name: s.name, qty: q, price: s.price! })
      const u = uses.find((x) => x.name === s.name)
      if (u) u.qty += q
      else uses.push({ name: s.name, qty: q })
      need -= q
    }
  }
  const bought = buys.reduce((s, b) => s + b.qty, 0)
  const buyCost = buys.reduce((s, b) => s + b.qty * b.price, 0)
  const mult = locationMult(state)
  const loc = locationById(state.location)
  // 委託：店主的工藝等級決定做得了幾級的材料；自己動手：做的人的等級與工具
  const self = crafter ? selfCost(state, tier, craft) : undefined
  // 自己動手的第一級材料：打造材料很便宜，材料費仍照底材價格算（不然貴的底材幾乎不花錢），用掉的打造材料抵掉它們的價值
  const usedValue = uses.reduce((s, u) => s + (itemDef(u.name)?.price_cc ?? 0) * u.qty, 0)
  const materialCost = self && tier === 1 ? Math.max(0, Math.round(gearRules.bases[base]!.price * craftSkillRules.self.tier1_cost_ratio * mult) - usedValue) : 0
  const fee = self ? self.rent + materialCost : Math.round(gearRules.bases[base]!.price * r.fee[tier - 1]! * mult)
  const shop = craftShop(state, m.kind)
  const level = crafter ? skillOf(crafter, craft).level : keeperCraftLevel(npcRecord(state, keeperId(state, shop)) ?? { id: keeperId(state, shop) }, craft, loc.type)
  // 輔料：只能是材料，數量要扣掉當作打造材料用掉的
  const a = r.aux
  const auxBlocked: string[] = []
  if (aux.length > a.max_kinds) auxBlocked.push(`輔料最多 ${a.max_kinds} 種`)
  for (const x of aux) {
    const owned = (state.inventory.find((i) => i.name === x.name)?.qty ?? 0) - (uses.find((u) => u.name === x.name)?.qty ?? 0)
    if (itemDef(x.name)?.category !== 'material') auxBlocked.push(`${x.name}不是材料，不能當輔料`)
    else if (x.qty > a.max_qty) auxBlocked.push(`每種輔料最多 ${a.max_qty} 個`)
    else if (owned < x.qty) auxBlocked.push(`${x.name}不夠（還有 ${Math.max(0, owned)} 個）`)
  }
  const auxValue = aux.reduce((sum, x) => sum + (itemDef(x.name)?.price_cc ?? 0) * x.qty, 0)
  const plain = gearRules.bases[base]!.price * m.price
  const auxChance = Math.round(Math.min(a.max_chance, (auxValue / Math.max(1, plain)) * a.chance_per_value) * 100) / 100
  // 不能打造的原因全部列出來，不用改一項才發現下一項
  const blockers: string[] = []
  if (level < tier) {
    blockers.push(crafter
      ? `${crafter.name}的${craftName(craft)}只有 Lv.${level}，處理不了${m.name}（要 Lv.${tier}）`
      : `${loc.name}的工匠（${craftName(craft)} Lv.${level}）處理不了${m.name}（要 Lv.${tier}）`)
  }
  if (self && self.tool.tier < toolTierFor(tier)) blockers.push(`${m.name}${toolBlocker(craft, toolTierFor(tier), self.tool)}`)
  if (have + bought < units) {
    const sold = sources.reduce((s, x) => s + (x.stock ?? 0), 0)
    const hint = !opts.buy && sold ? '；這間店有賣，可以當場補買' : opts.buy && sold ? `；這間店只剩 ${sold} 份` : ''
    blockers.push(`打造材料不夠（需要 ${units} 份能做成${m.name}的材料，持有 ${have} 份${hint}）`)
  }
  const feeName = crafter ? [materialCost ? '材料費' : '', self?.rent ? '工坊租金' : ''].filter(Boolean).join('與') || '費用' : '工錢'
  if (state.money_cc < fee + buyCost) blockers.push(`${buyCost ? `${feeName}加上補買的材料` : feeName}不夠（需要 ${formatMoney(fee + buyCost)}）`)
  blockers.push(...auxBlocked)
  return {
    base, material, tier, units, uses, have, sources, ...(opts.use ? { use: opts.use } : {}), buys, buyCost,
    // 自己動手打造時沒有這個底材的圖紙：DC + 5（委託店家不受影響，docs/CRAFTING.md 2.2 節）
    fee, dc: r.dc[tier - 1]! + (crafter && !hasBlueprint(state, base) ? blueprintRules().dc_without : 0), aux, auxValue, auxChance, elements: auxElements(aux),
    ...(crafter ? { blueprint: hasBlueprint(state, base) } : {}),
    craft, level,
    ...(crafter && self ? { crafter: crafter.id, tool: self.tool, rent: self.rent, ...(materialCost ? { materialCost } : {}) } : {}),
    blockers, ...(blockers.length ? { blocked: blockers.join('；') } : {}),
  }
}

/** 自己動手的花費：工具要在店裡租時付租金（打造材料另外用行囊裡的或當場補買） */
function selfCost(state: GameState, tier: number, craft: CraftId) {
  const tool = toolAccess(state, craft, toolTierFor(tier))
  const rent = tool.rentPerHour && tool.tier >= toolTierFor(tier) ? tool.rentPerHour * craftSkillRules.self.hours : 0
  return { tool, rent }
}

/** 委託打造找哪家店的店主：站在接這種材料的自建商店時是這家店，否則是內建的店 */
function craftShop(state: GameState, kind: MaterialKind): string {
  const cell = currentCell(state).kind
  return isCustomShopId(cell) && craftKindsHere(state).includes(kind) ? cell : CRAFT_SHOP[kind] === 'shop' ? 'general' : CRAFT_SHOP[kind]
}

function keeperId(state: GameState, shop: string): string {
  return keeperFor(state, shop as ShopType)
}

/**
 * 成功程度對應的稀有度：大成功 +1；成功至少優良。
 * boosted（輔料擲中）：大成功、成功再高一級；部分成功改成照成功做。
 */
export function craftRarity(material: string, degree: Degree, boosted = false): string | undefined {
  const natural = gearRules.materials[material]!.rarity
  const success = natural === 'common' ? 'uncommon' : natural
  if (degree === 'critical') return shiftRarity(natural, boosted ? 2 : 1)
  if (degree === 'success') return boosted ? shiftRarity(success, 1) : success
  if (degree === 'partial') return boosted ? success : natural
  return undefined
}

export function setupCraft(state: GameState, target?: string) {
  if (!canCraftHere(state)) throw new Error('要在鐵匠鋪、裁縫店或珠寶店委託打造')
  const { base, material, aux, opts } = parseCraftTarget(target)
  const kind = gearRules.bases[base]!.kind
  if (!craftKindsHere(state).includes(kind)) throw new Error(`${gearRules.bases[base]!.name}要到${CELL_NAME[CRAFT_SHOP[kind]]}打造`)
  const plan = craftPlan(state, base, material, aux, undefined, opts)
  if (plan.blocked) throw new Error(plan.blocked)
  const name = gearName({ base, material })
  const at = (d: Degree) => rarityName(craftRarity(material, d)!)
  const used = plan.uses.map((u) => `${u.name}×${u.qty}`).join('、')
  const auxText = aux.map((x) => `${x.name}×${x.qty}`).join('、')
  // 委託打造由店主擲：d20 + 店主的工藝等級 × 2（docs/CRAFTING.md 1.1 節）
  return {
    attr: craftSkillRules.skills[plan.craft].attr, dc: plan.dc, hours: craftRules().hours, craftCheck: 'keeper' as const,
    situational: [{ label: `工匠的手藝（${craftName(plan.craft)} Lv.${plan.level}）`, value: plan.level * craftSkillRules.level_bonus }],
    scene: `${locationById(state.location).name}・委託打造${name}（工錢 ${formatMoney(plan.fee)}${used ? `，材料 ${used}` : ''}${boughtText(plan)}${auxText ? `，輔料 ${auxText}（${Math.round(plan.auxChance * 100)}% 機率品質再高一級）` : ''}）`,
    targetName: name,
    outcomes: {
      critical: `做出${at('critical')}品質的${name}，附魔 ${rarityPoints(craftRarity(material, 'critical')!)} 點`,
      success: `做出${at('success')}品質的${name}，附魔 ${rarityPoints(craftRarity(material, 'success')!)} 點`,
      partial: `做出普通的${name}（沒有附魔）`,
      fail: `沒做成，材料損失一半，工錢照付`,
      fumble: '搞砸了，材料全部損失，工錢照付',
    } as Partial<Record<Degree, string>>,
  }
}

/**
 * 結算打造：付工錢、用掉材料，依成功程度做出裝備。gear 是 AI 提出的成品（名稱、描述、附魔），
 * 底材與材料固定為委託的內容，稀有度與附魔點數依成功程度夾住。
 */
export function applyCraft(state: GameState, report: Report, target: string, degree: Degree, gear?: Extract<RewardEffect, { type: 'gear' }>): string {
  const { base, material, aux, opts } = parseCraftTarget(target)
  return finishCraft(state, report, craftPlan(state, base, material, aux, undefined, opts), degree, gear)
}

/** 自己動手的花費名稱：材料費、工坊租金 */
export function selfFeeName(plan: Pick<CraftPlan, 'materialCost' | 'rent'>): string {
  return [plan.materialCost ? '材料費' : '', plan.rent ? '工坊租金' : ''].filter(Boolean).join('、') || '費用'
}

/** 「（其中當場買了 精鋼錠×2，80 白鸛）」 */
function boughtText(plan: CraftPlan): string {
  return plan.buys.length ? `，當場買了 ${plan.buys.map((b) => `${b.name}×${b.qty}`).join('、')}（${formatMoney(plan.buyCost)}）` : ''
}

/** 當場補買（打造與配方共用）：付錢、放進行囊（接著照一般的材料用掉）、扣掉站的這間店的存貨 */
export function buyHere(state: GameState, report: Report, buys: { name: string; qty: number; price: number }[]) {
  if (!buys.length) return
  const effects: RewardEffect[] = [{ type: 'money', amount: -buys.reduce((s, b) => s + b.qty * b.price, 0) }]
  for (const b of buys) {
    effects.push({ type: 'item', name: b.name, qty: b.qty })
    const offer = shopOfferHere(state, b.name)
    const deal = offer && state.shops?.[offer.key]?.deals.find((d) => d.id === offer.dealId)
    if (deal) deal.stock = Math.max(0, deal.stock - b.qty)
  }
  applyEffects(state, report, effects)
}

function finishCraft(state: GameState, report: Report, plan: CraftPlan, degree: Degree, gear?: Extract<RewardEffect, { type: 'gear' }>): string {
  const { base, material, aux } = plan
  buyHere(state, report, plan.buys)
  const paid = plan.crafter ? `花了 ${formatMoney(plan.fee)}（${selfFeeName(plan)}）` : `付了 ${formatMoney(plan.fee)} 工錢`
  // 輔料：成功程度有做出東西時擲一次，擲中就再高一級
  const boosted = plan.auxChance > 0 && !!craftRarity(material, degree) && withRng(state, (rng) => rng.chance(plan.auxChance))
  const rarity = craftRarity(material, degree, boosted)
  const lost = rarity ? plan.units : degree === 'fail' ? Math.ceil(plan.units * craftRules().lost_on_fail) : plan.units
  const effects: RewardEffect[] = plan.fee ? [{ type: 'money', amount: -plan.fee }] : []
  let left = lost
  for (const u of plan.uses) {
    if (left <= 0) break
    const q = Math.min(u.qty, left)
    effects.push({ type: 'item', name: u.name, qty: -q })
    left -= q
  }
  // 輔料不論結果都會用掉
  for (const x of aux) effects.push({ type: 'item', name: x.name, qty: -x.qty })
  applyEffects(state, report, effects)
  if (!rarity) return `${plan.fee ? `${paid}，但` : ''}${degree === 'fail' ? '沒做成' : '搞砸了'}${lost ? `，損失了 ${lost} 份材料` : ''}。`
  let spec: GearSpec
  const plainPiece = degree === 'partial' && !boosted
  if (gear) {
    spec = sanitizeGearSpec({ ...gear.spec, rarity }, { maxLevel: 99, maxRarity: rarity, base, material })!
    if (plainPiece) delete spec.enchants
  } else {
    spec = { base, material, ...(rarity !== gearRules.materials[material]!.rarity ? { rarity } : {}) }
    const points = plainPiece ? 0 : rarityPoints(rarity)
    const enchants = points ? withRng(state, (rng) => rollEnchants(base, points, rng, plan.elements)) : undefined
    if (enchants) spec.enchants = enchants
  }
  const name = registerGear(state, spec, gear?.name, gear?.desc)
  applyEffects(state, report, [{ type: 'item', name, qty: 1 }])
  return `${plan.fee ? `${paid}，` : ''}打造出【${name}】。${boosted ? '輔料讓成品的品質更上一層。' : ''}`
}

// ---- 自己動手（行動 make，見 crafting.ts） ----

/** 自己動手的 target：「做的人的 id@底材:材料|輔料…|選項」 */
export function makeTarget(crafter: string, base: string, material: string, aux: AuxItem[] = [], opts: CraftOptions = {}): string {
  return `${crafter}@${craftTarget(base, material, aux, opts)}`
}

/** 打造的部分（去掉「做的人@」） */
export function craftPart(target?: string): string | undefined {
  const at = (target ?? '').indexOf('@')
  return at > 0 ? target!.slice(at + 1) : target
}

export function parseMakeTarget(state: GameState, target?: string): { crafter: Character; base: string; material: string; aux: AuxItem[]; opts: CraftOptions } {
  const at = (target ?? '').indexOf('@')
  const id = at > 0 ? target!.slice(0, at) : 'pc'
  const crafter = memberOrResident(state, currentArea(state), id)
  if (!crafter) throw new Error('隊伍中（或家裡）沒有這位角色')
  return { crafter, ...parseCraftTarget(at > 0 ? target!.slice(at + 1) : target) }
}

export function setupMake(state: GameState, target?: string) {
  const { crafter, base, material, aux, opts } = parseMakeTarget(state, target)
  const refusal = crafterRefusal(state, crafter)
  if (refusal) throw new Error(`${crafter.name}不肯動手：${refusal}`)
  const plan = craftPlan(state, base, material, aux, crafter, opts)
  if (plan.blocked) throw new Error(plan.blocked)
  const name = gearName({ base, material })
  const skill = craftSkillRules.skills[plan.craft]
  const at = (d: Degree) => rarityName(craftRarity(material, d)!)
  const used = plan.uses.map((u) => `${u.name}×${u.qty}`).join('、')
  const auxText = aux.map((x) => `${x.name}×${x.qty}`).join('、')
  return {
    actor: crafter.id,
    attr: skill.attr, dc: plan.dc, hours: craftSkillRules.self.hours, craftCheck: 'self' as const,
    situational: [{ label: `${crafter.name}的${skill.name}（Lv.${plan.level}）`, value: plan.level * craftSkillRules.level_bonus }],
    scene: `${locationById(state.location).name}・${crafter.isPlayer ? '親手' : `由${crafter.name}`}打造${name}（${plan.tool!.source}${plan.fee ? `，${selfFeeName(plan)} ${formatMoney(plan.fee)}` : ''}${used ? `，材料 ${used}` : ''}${boughtText(plan)}${auxText ? `，輔料 ${auxText}（${Math.round(plan.auxChance * 100)}% 機率品質再高一級）` : ''}）`,
    targetName: name,
    outcomes: {
      critical: `做出${at('critical')}品質的${name}，附魔 ${rarityPoints(craftRarity(material, 'critical')!)} 點`,
      success: `做出${at('success')}品質的${name}，附魔 ${rarityPoints(craftRarity(material, 'success')!)} 點`,
      partial: `做出普通的${name}（沒有附魔）`,
      fail: `沒做成，材料損失一半${plan.fee ? `，${selfFeeName(plan)}照付` : ''}`,
      fumble: `搞砸了，材料全部損失${plan.fee ? `，${selfFeeName(plan)}照付` : ''}`,
    } as Partial<Record<Degree, string>>,
  }
}

/** 結算自己動手：和委託一樣做出裝備，再給做的人工藝經驗 */
export function applyMake(state: GameState, report: Report, target: string, degree: Degree, gear?: Extract<RewardEffect, { type: 'gear' }>): string {
  const { crafter, base, material, aux, opts } = parseMakeTarget(state, target)
  const plan = craftPlan(state, base, material, aux, crafter, opts)
  const text = finishCraft(state, report, plan, degree, gear)
  const xp = craftXpFor(plan.tier, degree)
  if (!xp) return text
  const level = gainCraftXp(crafter, plan.craft, xp)
  ;(report.changes.craft_xp ??= []).push({ actor: crafter.id, craft: plan.craft, amount: xp, ...(level ? { level } : {}) })
  return `${text}${crafter.name}的${craftName(plan.craft)}經驗 +${xp}${level ? `，升到 Lv.${level}` : ''}。`
}
