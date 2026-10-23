// 商店的自訂內容（docs/CONTENT_EDITOR.md 3.8 節）：內建的店只能改圖示、描述、AI 特別商品、店主設定（之後的批次會加上
// 固定清單、收購類別、工作、受訓與位置）；店名、店種、上架的物品類型與店的專屬功能不能改。

import { npcTags, shopRules, type ShopType, type ShopTypeDef } from './data'
import { CELL_ICON, type CellKind } from './grid'

/** 內建商店可以改的欄位 */
export interface ShopMod {
  emoji?: string
  desc?: string
  ai?: boolean
  keeper?: { title?: string; tags?: string[] }
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** 內建商店的快照（模組載入時） */
const snapshot = clone(shopRules.types)

export function builtinShop(id: string): ShopTypeDef | undefined {
  return snapshot[id as ShopType] ? clone(snapshot[id as ShopType]) : undefined
}

/** 整理商店的修改：只留可以改的欄位，和內建一樣的不存 */
export function sanitizeShopMod(id: string, raw: Partial<ShopMod>): ShopMod {
  const base = builtinShop(id)
  if (!base) throw new Error('沒有這家店')
  const out: ShopMod = {}
  const emoji = str(raw.emoji, 8)
  if (emoji && emoji !== base.emoji) out.emoji = emoji
  const desc = str(raw.desc, 200)
  if (desc && desc !== base.desc) out.desc = desc
  if (typeof raw.ai === 'boolean' && raw.ai !== base.ai) out.ai = raw.ai
  const title = str(raw.keeper?.title, 8)
  const tags = [...new Set((raw.keeper?.tags ?? []).filter((t) => !!npcTags.tags[t]))]
  const keeper: NonNullable<ShopMod['keeper']> = {}
  if (title && title !== base.keeper.title) keeper.title = title
  if (raw.keeper?.tags && tags.length && JSON.stringify(tags) !== JSON.stringify(base.keeper.tags ?? [])) keeper.tags = tags
  if (Object.keys(keeper).length) out.keeper = keeper
  return out
}

/** 把商店還原成內建的樣子（圖示也一起） */
export function restoreShops() {
  for (const [id, def] of Object.entries(snapshot)) {
    shopRules.types[id as ShopType] = clone(def)
    CELL_ICON[def.cell as CellKind] = def.emoji
  }
}

/** 套用一家店的修改 */
export function applyShopMod(id: string, m: ShopMod) {
  const def = shopRules.types[id as ShopType]
  if (!def) throw new Error('沒有這家店')
  if (m.emoji) def.emoji = m.emoji
  if (m.desc) def.desc = m.desc
  if (m.ai !== undefined) def.ai = m.ai
  if (m.keeper?.title) def.keeper.title = m.keeper.title
  if (m.keeper?.tags) def.keeper.tags = [...m.keeper.tags]
  CELL_ICON[def.cell as CellKind] = def.emoji
}
