// 淫服裁縫鋪（成人向，docs/LEWD_STATS.md 第 25 節；規則在 lewd.json 的 outfit_tailor）：
// 魅氣濃的城鎮，裁縫店可以訂做成人向服裝，選一項慾望指標加成（加成依材料）。

import { charmLevel } from './charm'
import { lewdRules, locationById } from './data'
import { gearName, gearPrice, gearRules, registerGear } from './gear'
import { currentCell } from './grid'
import { lewdName } from './lewd'
import { formatMoney } from './money'
import { commitReport } from './state'
import { baseReport } from './town'
import type { GameState, GearSpec, LewdStat, Report } from './types'

export const outfitTailorRules = () => lewdRules.outfit_tailor

/** 站在魅氣濃的城鎮的裁縫店 */
export function outfitTailorHere(state: GameState): boolean {
  const loc = locationById(state.location)
  return loc.type !== 'dungeon' && currentCell(state).kind === 'tailor' && charmLevel(loc.id) >= outfitTailorRules().charm_min
}

/** 可以訂做的底材（成人向服裝）與各自能用的材料（有加成的） */
export function outfitChoices(): { base: string; name: string; materials: string[] }[] {
  const bonus = outfitTailorRules().bonus
  return Object.entries(gearRules.bases)
    .filter(([, b]) => b.outfit === 'adult')
    .map(([id, b]) => ({
      base: id, name: b.name,
      materials: Object.entries(gearRules.materials).filter(([m, d]) => d.kind === b.kind && bonus[m] !== undefined).map(([m]) => m),
    }))
    .filter((x) => x.materials.length)
}

/** 這套訂做的組成與價格 */
export function outfitOrder(base: string, material: string, stat: LewdStat): { spec: GearSpec; price: number; bonus: number } {
  const r = outfitTailorRules()
  const choice = outfitChoices().find((x) => x.base === base)
  if (!choice?.materials.includes(material)) throw new Error('這個底材不能用這種材料訂做')
  if (!r.stats.includes(stat)) throw new Error('不能加這一項')
  const bonus = r.bonus[material]!
  const spec: GearSpec = { base, material, lewd: { [stat]: bonus } }
  return { spec, bonus, price: Math.round(gearPrice({ base, material }) * r.fee_mult + r.fee_base) }
}

/** 訂做：付錢，拿到一件帶指標加成的淫服 */
export function orderOutfit(state: GameState, base: string, material: string, stat: LewdStat): Report {
  if (!outfitTailorHere(state)) throw new Error('這裡的裁縫不做這種衣服')
  const { spec, price, bonus } = outfitOrder(base, material, stat)
  if (state.money_cc < price) throw new Error(`錢不夠（要 ${formatMoney(price)}）`)
  const name = registerGear(state, spec, `訂做的${gearName(spec)}`, `淫服裁縫鋪訂做的，穿上時${lewdName(stat)} +${bonus}。`)
  const r = baseReport(state, 'trade', 2)
  r.changes.money_cc = -price
  r.changes.items_gained = [{ name, qty: 1, owner: 'pc' }]
  r.outcome.summary = `裁縫照你的身材訂做了「${name}」（${lewdName(stat)} +${bonus}），收了 ${formatMoney(price)}。`
  r.outcome.tags = ['淫服']
  return commitReport(state, r)
}
