// 物品的顯示資訊：分類圖示、一行說明（行囊與商店共用）

import { craftRules, itemDef, itemRules, type ItemCategory } from '@/engine/data'
import { seedSummary } from '@/engine/garden'
import { furnitureSummary } from '@/engine/homes'
import { gearRules, gearSpecOf, gearSummary } from '@/engine/gear'
import { intelSummary, isIntelItem, useSummary } from '@/engine/inventory'
import { toolSummary } from '@/engine/tools'
import { itemCategory } from '@/engine/trade'
import type { GameState } from '@/engine/types'

export const CATEGORY_ICON: Record<ItemCategory, string> = {
  food: '🍞', consumable: '🧪', scroll: '📜', gear: '🧰', material: '🪨', equipment: '⚔️', info: '🗞️', furniture: '🛋️',
}
/** 篩選分頁的順序 */
export const CATEGORY_ORDER: ItemCategory[] = ['equipment', 'consumable', 'scroll', 'food', 'gear', 'material', 'info', 'furniture']

export function categoryOf(state: GameState, name: string): ItemCategory | undefined {
  return itemCategory(state, name)
}

export function categoryIcon(state: GameState, name: string): string {
  const c = categoryOf(state, name)
  return c ? CATEGORY_ICON[c] : '📦'
}

export function categoryName(state: GameState, name: string): string {
  const c = categoryOf(state, name)
  return c ? itemRules.categories[c] : '其他'
}

/** 一行效果說明：裝備的數值、使用效果、工具模板、可打造的材料 */
export function itemEffect(state: GameState, name: string): string {
  const def = itemDef(name)
  const spec = gearSpecOf(state, name)
  const forgeNames = [...new Set((def?.forge?.materials ?? []).map((m) => gearRules.materials[m]?.name).filter(Boolean))]
  const forge = forgeNames.length ? `可打造${forgeNames.join('、')}` : ''
  const recipe = def?.recipe ? `配方：${craftRules.skills[def.recipe.craft].name} Lv.${def.recipe.level}` : ''
  return [spec ? gearSummary(spec) : '', useSummary(def?.use), toolSummary(def?.tool), isIntelItem(state, name) ? intelSummary(def?.intel) : '', forge,
    furnitureSummary(def?.furniture), seedSummary(def?.seed), recipe]
    .filter(Boolean).join('・')
}

/** 物品的描述文字（目錄或 AI 自創的） */
export function itemText(state: GameState, name: string): string {
  return itemDef(name)?.desc ?? state.customItems?.[name]?.desc ?? ''
}
