// 店名、描述與店主的招呼語。說明見 docs/TRADE.md。
//
// 兩層，前面的有寫就用前面的（各欄位分開看）；AI 不改店名：
// 1. 手寫覆寫：shops.json 的 naming.overrides（依地點與店型）
// 2. 規則生成：地區的字詞＋店型的後綴，用 地點/店型 當種子，同一間店每次都一樣
//
// 旅店（inn）不是商店類型，但也照這裡命名。自建的商店與流浪商人用商店類型本身的名稱。

import { isCustomShopId, locationById, shopDef, shopRules, type ShopType } from './data'
import { hashString } from './npcs'

/** 可以命名的店：商店類型與旅店 */
export type NamedShop = ShopType | 'inn'

export interface ShopTitle {
  name: string
  desc: string
  greeting: string
}

const INN_NAME = '旅店'

/** 從清單裡依種子挑一個（salt 讓同一個種子在不同欄位挑到不同位置） */
function pick<T>(list: readonly T[] | undefined, seed: number, salt: number): T | undefined {
  if (!list?.length) return undefined
  return list[((seed + Math.imul(salt, 2654435761)) >>> 0) % list.length]
}

/** 同一個地點的店依這個順序錯開字詞與氛圍，不會兩間店撞名 */
const KIND_ORDER: string[] = ['tavern', 'inn', 'general', 'smithy', 'tailor', 'jeweler', 'magic', 'informant', 'temple']

/** 第 n 間店用的位置：以地點的種子為起點，間隔和清單長度互質，前 len 間店不會重複 */
function spread<T>(list: readonly T[] | undefined, seed: number, n: number): T | undefined {
  if (!list?.length) return undefined
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  let step = 5
  while (gcd(step, list.length) !== 1) step++
  return list[(seed + n * step) % list.length]
}

/** 規則生成的店名與描述 */
export function generatedTitle(placeId: string, kind: NamedShop): ShopTitle {
  const naming = shopRules.naming
  let region: string | undefined
  try {
    region = locationById(placeId).region
  } catch {
    region = undefined
  }
  const r = region ? naming.regions[region] : undefined
  const seed = hashString(`${placeId}/${kind}`)
  const placeSeed = hashString(placeId)
  const n = Math.max(0, KIND_ORDER.indexOf(kind))
  const word = spread(r?.words, placeSeed, n) ?? ''
  const suffix = pick(r?.suffix?.[kind] ?? naming.suffix[kind], seed, 2) ?? (kind === 'inn' ? INN_NAME : shopDef(kind).name)
  const air = spread(r?.air, placeSeed + 1, n)
  const template = pick(naming.desc[kind], seed, 4)
  return {
    name: `${word}${suffix}`,
    desc: template && air ? template.replace('{air}', air) : '',
    greeting: pick(naming.greeting[kind], seed, 5) ?? '',
  }
}

/** 這間店的名字、描述與招呼語 */
export function shopTitle(placeId: string, kind: NamedShop): ShopTitle {
  // 自建的商店、流浪商人、旅途上的驛站：用商店類型本身的名稱
  if (kind !== 'inn' && (isCustomShopId(kind) || kind === 'wanderer' || placeId.startsWith('ws_'))) {
    const def = shopDef(kind)
    return { name: placeId.startsWith('ws_') && kind === 'general' ? shopRules.waystation.name : def.name, desc: '', greeting: '' }
  }
  const data = shopRules.naming.overrides[placeId]?.[kind] ?? {}
  const gen = generatedTitle(placeId, kind)
  return {
    name: data.name || gen.name,
    desc: data.desc || gen.desc,
    greeting: data.greeting || gen.greeting,
  }
}

/** 店型的一般名稱（「酒館」「鐵匠鋪」），標題旁的小字用 */
export function shopKindName(kind: NamedShop): string {
  return kind === 'inn' ? INN_NAME : shopDef(kind).name
}
