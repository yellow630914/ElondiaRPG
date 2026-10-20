// 委託打造：站在雜貨店上，選底材與材料，交給工匠打造（data/rules/gear.json 的 craft）。
// 走主動行動 craft（target = "底材:材料"）：玩家可以描述想要的樣子，AI 決定成功程度，
// 也可以用 gear 效果替成品取名、寫描述、挑附魔（程式依成功程度夾住稀有度與附魔點數）。
// AI 關閉時依規則：成功以上隨機附魔。

import { itemDef, locationById, shopRules, type Degree } from './data'
import { applyEffects, type RewardEffect } from './effects'
import { gearName, gearRules, rarityName, rarityPoints, registerGear, rollEnchants, sanitizeGearSpec, shiftRarity } from './gear'
import { currentCell } from './grid'
import { formatMoney } from './money'
import { withRng } from './state'
import type { GameState, GearSpec, Report } from './types'

export interface CraftPlan {
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

export function canCraftHere(state: GameState): boolean {
  return currentCell(state).kind === 'shop'
}

export function parseCraftTarget(target?: string): { base: string; material: string } {
  const [base, material] = (target ?? '').split(':')
  if (!base || !material || !gearRules.bases[base] || !gearRules.materials[material]) throw new Error('請選擇要打造的裝備與材料')
  if (gearRules.bases[base]!.kind !== gearRules.materials[material]!.kind) throw new Error('這種材料不能拿來做這件裝備')
  return { base, material }
}

function unitsFor(base: string): number {
  const b = gearRules.bases[base]!
  const u = craftRules().units
  return b.two_handed ? u.two_handed! : u[b.slot] ?? 1
}

/** 打造的花費與材料（不檢查站的位置） */
export function craftPlan(state: GameState, base: string, material: string): CraftPlan {
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
  let blocked: string | undefined
  if (minLoc && (shopRules.location_rank[loc.type] ?? 1) < (shopRules.location_rank[minLoc] ?? 0)) blocked = `${loc.name}沒有工匠會處理${m.name}`
  else if (have < units) blocked = `打造材料不夠（需要 ${units} 份能做成${m.name}的材料，持有 ${have} 份）`
  else if (state.money_cc < fee) blocked = `工錢不夠（需要 ${formatMoney(fee)}）`
  return { base, material, tier, units, uses, have, fee, dc: r.dc[tier - 1]!, ...(blocked ? { blocked } : {}) }
}

/** 成功程度對應的稀有度：大成功 +1；成功至少優良 */
export function craftRarity(material: string, degree: Degree): string | undefined {
  const natural = gearRules.materials[material]!.rarity
  if (degree === 'critical') return shiftRarity(natural, 1)
  if (degree === 'success') return natural === 'common' ? 'uncommon' : natural
  if (degree === 'partial') return natural
  return undefined
}

export function setupCraft(state: GameState, target?: string) {
  if (!canCraftHere(state)) throw new Error('要在雜貨店委託工匠打造')
  const { base, material } = parseCraftTarget(target)
  const plan = craftPlan(state, base, material)
  if (plan.blocked) throw new Error(plan.blocked)
  const name = gearName({ base, material })
  const at = (d: Degree) => rarityName(craftRarity(material, d)!)
  const used = plan.uses.map((u) => `${u.name}×${u.qty}`).join('、')
  return {
    attr: craftRules().attr, dc: plan.dc, hours: craftRules().hours, situational: [],
    scene: `${locationById(state.location).name}・委託打造${name}（工錢 ${formatMoney(plan.fee)}${used ? `，材料 ${used}` : ''}）`,
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
  const { base, material } = parseCraftTarget(target)
  const plan = craftPlan(state, base, material)
  const rarity = craftRarity(material, degree)
  const lost = rarity ? plan.units : degree === 'fail' ? Math.ceil(plan.units * craftRules().lost_on_fail) : plan.units
  const effects: RewardEffect[] = [{ type: 'money', amount: -plan.fee }]
  let left = lost
  for (const u of plan.uses) {
    if (left <= 0) break
    const q = Math.min(u.qty, left)
    effects.push({ type: 'item', name: u.name, qty: -q })
    left -= q
  }
  applyEffects(state, report, effects)
  if (!rarity) return `付了 ${formatMoney(plan.fee)} 工錢，但${degree === 'fail' ? '沒做成' : '搞砸了'}${lost ? `，損失了 ${lost} 份材料` : ''}。`
  let spec: GearSpec
  if (gear) {
    spec = sanitizeGearSpec({ ...gear.spec, rarity }, { maxLevel: 99, maxRarity: rarity, base, material })!
    if (degree === 'partial') delete spec.enchants
  } else {
    spec = { base, material, ...(rarity !== gearRules.materials[material]!.rarity ? { rarity } : {}) }
    const points = degree === 'partial' ? 0 : rarityPoints(rarity)
    const enchants = points ? withRng(state, (rng) => rollEnchants(base, points, rng)) : undefined
    if (enchants) spec.enchants = enchants
  }
  const name = registerGear(state, spec, gear?.name, gear?.desc)
  applyEffects(state, report, [{ type: 'item', name, qty: 1 }])
  return `付了 ${formatMoney(plan.fee)} 工錢，打造出【${name}】。`
}
