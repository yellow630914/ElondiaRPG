// 圖紙（docs/CRAFTING.md 2.2 節，R21 的 K6）：每個底材一張，記在存檔的 blueprints（底材 id），全隊共用、不會用掉。
// 自己動手打造時沒有那個底材的圖紙 DC +5（委託店家不受影響：店主有自己的圖樣）。世界編輯器新增的底材自動有對應的圖紙。

import { craftRules, type ShopType } from './data'
import { gearRules } from './gear'
import type { Rng } from './rng'
import type { Deal, GameState } from './types'

export const blueprintRules = () => craftRules.blueprints

/** 「長劍圖紙」 */
export function blueprintName(base: string): string {
  return `${gearRules.bases[base]?.name ?? base}圖紙`
}

export function hasBlueprint(state: Pick<GameState, 'blueprints'>, base: string): boolean {
  return !!state.blueprints?.includes(base)
}

/** 圖紙的目錄價：底材價格 × price_mult，取到十位，至少 min_price */
export function blueprintPrice(base: string): number {
  const r = blueprintRules()
  return Math.max(r.min_price, Math.round(((gearRules.bases[base]?.price ?? 0) * r.price_mult) / 10) * 10)
}

/** 拿到一張圖紙（已經有的不重複）；回傳是不是新的 */
export function grantBlueprint(state: GameState, base: string): boolean {
  if (!gearRules.bases[base] || hasBlueprint(state, base)) return false
  state.blueprints = [...(state.blueprints ?? []), base]
  return true
}

/** 可以有圖紙的底材：一般的底材（拘束具、專屬底材不算） */
export function blueprintBases(): string[] {
  return Object.entries(gearRules.bases).filter(([, b]) => !b.restraint && !b.exclusive).map(([id]) => id)
}

/** 店的種類 → 這間店打造的材料種類（金屬與木材在鐵匠鋪、皮革與布料在裁縫店、寶石在珠寶店） */
const SHOP_KINDS: Partial<Record<ShopType, string[]>> = { smithy: ['metal', 'wood'], tailor: ['leather', 'cloth'], jeweler: ['jewel'] }

/** 隨機一張還沒有的圖紙（kinds 限定材料種類；都有了時 undefined） */
export function randomBlueprint(state: GameState, rng: Rng, kinds?: string[], maxBasePrice = Infinity): string | undefined {
  const pool = blueprintBases().filter((b) => !hasBlueprint(state, b) && (!kinds || kinds.includes(gearRules.bases[b]!.kind)) && gearRules.bases[b]!.price <= maxBasePrice)
  return pool.length ? rng.pick(pool) : undefined
}

/** 店裡今天賣的圖紙（特別交易，一張一張買）：會打造那種底材的店上架 3～5 張，村莊、前哨只有便宜的底材 */
export function blueprintDeals(state: GameState, rng: Rng, type: ShopType, small: boolean, priceMult: number): Deal[] {
  const kinds = SHOP_KINDS[type]
  if (!kinds) return []
  const r = blueprintRules()
  const max = small ? r.village_max_base_price : Infinity
  const pool = blueprintBases().filter((b) => !hasBlueprint(state, b) && kinds.includes(gearRules.bases[b]!.kind) && gearRules.bases[b]!.price <= max)
  const picked = [...pool].sort(() => rng.next() - 0.5).slice(0, rng.int(r.shop[0], r.shop[1]))
  return picked.map((b) => ({
    id: `blueprint:${b}`,
    title: blueprintName(b),
    desc: `自己打造${gearRules.bases[b]!.name}時不用加 DC（不會用掉，任何材料都適用）`,
    gives: [{ type: 'money', amount: Math.max(1, Math.round(blueprintPrice(b) * priceMult)) }],
    gets: [{ type: 'blueprint', base: b }],
    stock: 1,
  }))
}
