// 委託打造：在鐵匠鋪（金屬、木材）、裁縫店（皮革、布料）、珠寶店（寶石）選底材與材料，交給工匠打造（data/rules/gear.json 的 craft）。
// 走主動行動 craft（target = "底材:材料"）：玩家可以描述想要的樣子，AI 決定成功程度，
// 也可以用 gear 效果替成品取名、寫描述、挑附魔（程式依成功程度夾住稀有度與附魔點數）。
// AI 關閉時依規則：成功以上隨機附魔。

import { itemDef, locationById, shopRules, type Degree } from './data'
import { applyEffects, type RewardEffect } from './effects'
import { gearName, gearRules, type MaterialKind, rarityName, rarityPoints, registerGear, rollEnchants, sanitizeGearSpec, shiftRarity } from './gear'
import { CELL_NAME, currentCell, type CellKind } from './grid'
import { formatMoney } from './money'
import { withRng } from './state'
import type { GameState, GearSpec, Report } from './types'

export interface CraftPlan {
  /** 輔料、總價值、讓稀有度再高一級的機率、屬性方向 */
  aux: AuxItem[]
  auxValue: number
  auxChance: number
  elements: string[]
  base: string
  material: string
  tier: number
  /** 需要的打造材料數量（第一級材料為 0） */
  units: number
  /** 會用掉的物品（從便宜的開始） */
  uses: { name: string; qty: number }[]
  /** 持有的打造材料數量 */
  have: number
  fee: number
  dc: number
  /** 不能打造的原因 */
  blocked?: string
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
  return (Object.keys(CRAFT_SHOP) as MaterialKind[]).filter((k) => CRAFT_SHOP[k] === cell)
}

export function canCraftHere(state: GameState): boolean {
  return craftKindsHere(state).length > 0
}

export interface AuxItem { name: string; qty: number }

/**
 * 打造的 target：「底材:材料」，有輔料時接上「|名稱*數量」，例如 longsword:steel|火蜥鱗片*2|熔岩核心*1。
 */
export function parseCraftTarget(target?: string): { base: string; material: string; aux: AuxItem[] } {
  const [head, ...rest] = (target ?? '').split('|')
  const [base, material] = (head ?? '').split(':')
  if (!base || !material || !gearRules.bases[base] || !gearRules.materials[material]) throw new Error('請選擇要打造的裝備與材料')
  if (gearRules.bases[base]!.kind !== gearRules.materials[material]!.kind) throw new Error('這種材料不能拿來做這件裝備')
  const aux = rest.map((x) => {
    const i = x.lastIndexOf('*')
    return { name: i >= 0 ? x.slice(0, i) : x, qty: Math.max(1, Math.round(Number(i >= 0 ? x.slice(i + 1) : 1)) || 1) }
  }).filter((a) => a.name)
  return { base, material, aux }
}

export function craftTarget(base: string, material: string, aux: AuxItem[] = []): string {
  return [`${base}:${material}`, ...aux.filter((a) => a.qty > 0).map((a) => `${a.name}*${a.qty}`)].join('|')
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

/** 打造的花費與材料（不檢查站的位置） */
export function craftPlan(state: GameState, base: string, material: string, aux: AuxItem[] = []): CraftPlan {
  const r = craftRules()
  const m = gearRules.materials[material]!
  const tier = m.tier
  const units = tier === 1 ? 0 : unitsFor(base)
  const owned = state.inventory
    .filter((i) => forgeOf(i.name).includes(material))
    .sort((a, b) => (itemDef(a.name)?.price_cc ?? 0) - (itemDef(b.name)?.price_cc ?? 0))
  const have = owned.reduce((s, i) => s + i.qty, 0)
  const uses: { name: string; qty: number }[] = []
  let need = units
  for (const i of owned) {
    if (need <= 0) break
    const q = Math.min(i.qty, need)
    uses.push({ name: i.name, qty: q })
    need -= q
  }
  const mult = shopRules.location_price_mult[locationById(state.location).type] ?? 1
  const fee = Math.round(gearRules.bases[base]!.price * r.fee[tier - 1]! * mult)
  const loc = locationById(state.location)
  const minLoc = r.min_location[String(tier)]
  // 輔料：只能是材料，數量要扣掉當作打造材料用掉的
  const a = r.aux
  let auxBlocked: string | undefined
  if (aux.length > a.max_kinds) auxBlocked = `輔料最多 ${a.max_kinds} 種`
  for (const x of aux) {
    const owned = (state.inventory.find((i) => i.name === x.name)?.qty ?? 0) - (uses.find((u) => u.name === x.name)?.qty ?? 0)
    if (itemDef(x.name)?.category !== 'material') auxBlocked ??= `${x.name}不是材料，不能當輔料`
    else if (x.qty > a.max_qty) auxBlocked ??= `每種輔料最多 ${a.max_qty} 個`
    else if (owned < x.qty) auxBlocked ??= `${x.name}不夠（還有 ${Math.max(0, owned)} 個）`
  }
  const auxValue = aux.reduce((sum, x) => sum + (itemDef(x.name)?.price_cc ?? 0) * x.qty, 0)
  const plain = gearRules.bases[base]!.price * m.price
  const auxChance = Math.round(Math.min(a.max_chance, (auxValue / Math.max(1, plain)) * a.chance_per_value) * 100) / 100
  let blocked: string | undefined
  if (minLoc && (shopRules.location_rank[loc.type] ?? 1) < (shopRules.location_rank[minLoc] ?? 0)) blocked = `${loc.name}沒有工匠會處理${m.name}`
  else if (have < units) blocked = `打造材料不夠（需要 ${units} 份能做成${m.name}的材料，持有 ${have} 份）`
  else if (state.money_cc < fee) blocked = `工錢不夠（需要 ${formatMoney(fee)}）`
  else if (auxBlocked) blocked = auxBlocked
  return {
    base, material, tier, units, uses, have, fee, dc: r.dc[tier - 1]!, aux, auxValue, auxChance, elements: auxElements(aux),
    ...(blocked ? { blocked } : {}),
  }
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
  const { base, material, aux } = parseCraftTarget(target)
  const kind = gearRules.bases[base]!.kind
  if (!craftKindsHere(state).includes(kind)) throw new Error(`${gearRules.bases[base]!.name}要到${CELL_NAME[CRAFT_SHOP[kind]]}打造`)
  const plan = craftPlan(state, base, material, aux)
  if (plan.blocked) throw new Error(plan.blocked)
  const name = gearName({ base, material })
  const at = (d: Degree) => rarityName(craftRarity(material, d)!)
  const used = plan.uses.map((u) => `${u.name}×${u.qty}`).join('、')
  const auxText = aux.map((x) => `${x.name}×${x.qty}`).join('、')
  return {
    attr: craftRules().attr, dc: plan.dc, hours: craftRules().hours, situational: [],
    scene: `${locationById(state.location).name}・委託打造${name}（工錢 ${formatMoney(plan.fee)}${used ? `，材料 ${used}` : ''}${auxText ? `，輔料 ${auxText}（${Math.round(plan.auxChance * 100)}% 機率品質再高一級）` : ''}）`,
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
  const { base, material, aux } = parseCraftTarget(target)
  const plan = craftPlan(state, base, material, aux)
  // 輔料：成功程度有做出東西時擲一次，擲中就再高一級
  const boosted = plan.auxChance > 0 && !!craftRarity(material, degree) && withRng(state, (rng) => rng.chance(plan.auxChance))
  const rarity = craftRarity(material, degree, boosted)
  const lost = rarity ? plan.units : degree === 'fail' ? Math.ceil(plan.units * craftRules().lost_on_fail) : plan.units
  const effects: RewardEffect[] = [{ type: 'money', amount: -plan.fee }]
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
  if (!rarity) return `付了 ${formatMoney(plan.fee)} 工錢，但${degree === 'fail' ? '沒做成' : '搞砸了'}${lost ? `，損失了 ${lost} 份材料` : ''}。`
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
  return `付了 ${formatMoney(plan.fee)} 工錢，打造出【${name}】。${boosted ? '輔料讓成品的品質更上一層。' : ''}`
}
