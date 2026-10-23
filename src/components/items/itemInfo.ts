// 物品的顯示資訊：類別、稀有度、一行說明（行囊與商店共用）。圖示見 ItemIcon.vue

import { craftRules, itemDef, itemRules, type ItemCategory } from '@/engine/data'
import { seedSummary } from '@/engine/garden'
import { furnitureSummary } from '@/engine/homes'
import { gearKnown, gearRules, gearSpecOf, gearStats, gearSummary } from '@/engine/gear'
import { intelSummary, isIntelItem, useSummary } from '@/engine/inventory'
import { toolSummary } from '@/engine/tools'
import { itemCategory } from '@/engine/trade'
import type { GameState, GearSpec } from '@/engine/types'

/** 篩選分頁的順序 */
export const CATEGORY_ORDER: ItemCategory[] = ['equipment', 'consumable', 'scroll', 'food', 'gear', 'material', 'info', 'furniture']

export function categoryOf(state: GameState, name: string): ItemCategory | undefined {
  return itemCategory(state, name)
}

/** 裝備組成的稀有度（圖示底框上色用）；不知道的組成或不是裝備時是空字串 */
export function specRarity(spec: GearSpec | undefined): string {
  return spec && gearKnown(spec) ? gearStats(spec).rarity : ''
}

export function itemRarity(state: GameState, name: string): string {
  return specRarity(gearSpecOf(state, name))
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
