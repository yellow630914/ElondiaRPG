// 物品圖示的資料面：玩家在世界裡上傳的圖（data URL）與查找順序。說明見 docs/ITEMS.md 第 8 節。
// 內建的像素圖（類別、底材）在 components/items/itemArt.ts，這裡只決定「用哪一個」。
//
// 查找順序：
// 1. 物品自己上傳的圖（物品目錄的 icon）
// 2. 裝備：底材上傳的圖 → 內建的底材圖
// 3. 類別上傳的圖 → 內建的類別圖

import { itemDef, type ItemCategory } from './data'
import { gearRules, gearSpecOf } from './gear'
import type { GameState, GearSpec } from './types'

/** 上傳的圖縮到這個邊長以內 */
export const ICON_PX = 48
/** data URL 的長度上限（48×48 的 PNG 通常 2～8 KB） */
export const ICON_MAX_CHARS = 16_000
const DATA_URL = /^data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/]+={0,2}$/

/** 整理上傳的圖：只收圖片的 data URL，太大的不收 */
export function sanitizeIcon(v: unknown): string | undefined {
  return typeof v === 'string' && v.length <= ICON_MAX_CHARS && DATA_URL.test(v) ? v : undefined
}

/** 世界裡上傳的類別圖示（applyContent 套用；沒有的用內建的） */
export const categoryIcons: Partial<Record<ItemCategory, string>> = {}

export function setCategoryIcons(icons: Partial<Record<ItemCategory, string>>) {
  for (const k of Object.keys(categoryIcons) as ItemCategory[]) delete categoryIcons[k]
  Object.assign(categoryIcons, icons)
}

/** 要顯示的圖示：上傳的圖、內建的底材圖或內建的類別圖 */
export type IconSource =
  | { kind: 'image'; src: string }
  | { kind: 'base'; base: string }
  | { kind: 'category'; category?: ItemCategory }

export function categoryIconSource(category: ItemCategory | undefined): IconSource {
  const src = category ? categoryIcons[category] : undefined
  return src ? { kind: 'image', src } : { kind: 'category', category }
}

export function gearIconSource(spec: Pick<GearSpec, 'base'>): IconSource {
  const src = gearRules.bases[spec.base]?.icon
  return src ? { kind: 'image', src } : { kind: 'base', base: spec.base }
}

/** 物品的圖示；spec 是身上裝備的組成（物品目錄裡沒有的裝備也找得到底材） */
export function itemIconSource(state: Pick<GameState, 'customItems'> | undefined, name: string, spec?: GearSpec): IconSource {
  const def = itemDef(name)
  if (def?.icon) return { kind: 'image', src: def.icon }
  const gear = spec ?? gearSpecOf(state, name)
  if (gear && gearRules.bases[gear.base]) return gearIconSource(gear)
  return categoryIconSource(def?.category ?? (state?.customItems?.[name]?.category as ItemCategory | undefined))
}
