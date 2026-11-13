// 物品的顯示資訊：類別、稀有度、一行說明（行囊與商店共用）。圖示見 ItemIcon.vue

import { craftRules, itemDef, itemRules, type ItemCategory } from '@/engine/data'
import { seedSummary } from '@/engine/garden'
import { furnitureSummary } from '@/engine/homes'
import { gearKnown, gearSpecOf, gearStats, gearSummaryParts, type SummaryPart } from '@/engine/gear'
import { intelSummary, isIntelItem, useSummary } from '@/engine/inventory'
import { toolSummary } from '@/engine/tools'
import { itemCategory } from '@/engine/trade'
import { materialLabel, materialUses } from '@/engine/materialInfo'
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

/** 類別欄：材料寫種類與等級（「煉金材料・第 2 級」，materialInfo.ts），其他寫類別 */
export function categoryName(state: GameState, name: string): string {
  const c = categoryOf(state, name)
  if (c === 'material') return materialLabel(state, name)
  return c ? itemRules.categories[c] : '其他'
}

/** 一行效果說明：裝備的數值、使用效果、工具模板；材料寫能做什麼（可打造、可以做的配方、輔料） */
export function itemEffect(state: GameState, name: string): string {
  return itemEffectParts(state, name).map((p) => p.text).join('・')
}

/** itemEffect 拆成一段一段：有細節的段落（拘束具的「限制行走 2」）帶 tip，畫面用 EffectLine.vue 顯示 */
export function itemEffectParts(state: GameState, name: string): SummaryPart[] {
  const def = itemDef(name)
  const spec = gearSpecOf(state, name)
  const forge = materialUses(state, name)
  const recipe = def?.recipe ? `配方：${craftRules.skills[def.recipe.craft].name} Lv.${def.recipe.level}` : ''
  const rest = [useSummary(def?.use), toolSummary(def?.tool), isIntelItem(state, name) ? intelSummary(def?.intel) : '', forge,
    furnitureSummary(def?.furniture), seedSummary(def?.seed), recipe].filter(Boolean).map((text) => ({ text }))
  return [...(spec ? gearSummaryParts(spec) : []), ...rest]
}

/** 物品的描述文字（目錄或 AI 自創的） */
export function itemText(state: GameState, name: string): string {
  return itemDef(name)?.desc ?? state.customItems?.[name]?.desc ?? ''
}
