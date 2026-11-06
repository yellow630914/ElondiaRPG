// 材料的資訊（見 docs/ITEMS.md 4.6 節）：等級、用途（能做什麼）、小類。
// 行囊、商店的一行說明與材料的分段都讀這裡。
//
// 用途要從配方反查（哪些配方用到這件材料），所以建一份索引，只在物品目錄或存檔的自創配方換過時重建
// （contentRevision：載入世界包、模組，世界編輯器存檔；saveItemsRevision：讀檔、開新遊戲、自創配方新增或改名），
// 平常畫面每一行都只是查表。

import { contentRevision, CRAFT_IDS, craftRules, damageTypeName, enemies, itemDef, itemRules, saveItems, saveItemsRevision, type CraftId, type ItemDef } from './data'
import { gearRules } from './gear'
import { TRADE_CATEGORIES, tradeCategory, tradeCategoryName, type TradeCategory } from './market'
import type { GameState } from './types'

/** 用到這件材料的一個配方 */
export interface MaterialRecipeUse {
  name: string
  craft: CraftId
  level: number
  /** 這個存檔自創的配方 */
  invented?: boolean
}

interface IndexEntry {
  recipes: MaterialRecipeUse[]
  /** 會掉這件材料的怪物裡最低的等級 */
  dropLevel?: number
}

let cache: { key: string; map: Map<string, IndexEntry>; tierLevels: number[] } | undefined

function index(): { map: Map<string, IndexEntry>; tierLevels: number[] } {
  const key = `${contentRevision()}:${saveItemsRevision()}`
  if (cache?.key === key) return cache
  const map = new Map<string, IndexEntry>()
  const entry = (name: string) => {
    let e = map.get(name)
    if (!e) map.set(name, (e = { recipes: [] }))
    return e
  }
  const add = (items: ItemDef[], invented: boolean) => {
    for (const i of items) {
      if (!i.recipe) continue
      for (const x of i.recipe.inputs) {
        const list = entry(x.name).recipes
        if (!list.some((r) => r.name === i.name)) list.push({ name: i.name, craft: i.recipe.craft, level: i.recipe.level, ...(invented ? { invented } : {}) })
      }
    }
  }
  add(itemRules.items, false)
  add(saveItems(), true)
  for (const e of Object.values(enemies)) {
    for (const l of e.loot ?? []) {
      const x = entry(l.item)
      x.dropLevel = Math.min(x.dropLevel ?? Number.POSITIVE_INFINITY, e.level)
    }
  }
  for (const e of map.values()) e.recipes.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'zh-Hant'))
  // 各級材料的建議等級（gear.json 的 materials：同一級取最低的）：怪物素材照掉落的怪物等級換算
  const tierLevels: number[] = []
  for (const m of Object.values(gearRules.materials)) tierLevels[m.tier] = Math.min(tierLevels[m.tier] ?? Number.POSITIVE_INFINITY, m.level)
  cache = { key, map, tierLevels }
  return cache
}

/** 打造材料（gear.json 的 materials）裡最高的等級；材料的等級不會超過它 */
export function maxMaterialTier(): number {
  return Math.max(...Object.values(gearRules.materials).map((m) => m.tier))
}

/** 怪物等級 → 材料等級：建議等級不超過這個怪物等級的最高一級（Lv.1 → 1、Lv.3 → 2、Lv.7 → 3……） */
export function tierForMonsterLevel(level: number): number {
  const { tierLevels } = index()
  let tier = 1
  tierLevels.forEach((lv, t) => {
    if (lv !== undefined && lv <= level && t > tier) tier = t
  })
  return tier
}

function isMaterial(state: Pick<GameState, 'customItems'> | undefined, name: string): boolean {
  return (itemDef(name)?.category ?? state?.customItems?.[name]?.category) === 'material'
}

/** 用到這件材料的配方（照配方等級排序） */
export function materialRecipes(name: string): MaterialRecipeUse[] {
  return index().map.get(name)?.recipes ?? []
}

/** 這件材料能打造成的材料（gear.json 的 materials），附上等級 */
export function materialForges(name: string): { id: string; name: string; tier: number }[] {
  const seen = new Set<string>()
  return (itemDef(name)?.forge?.materials ?? []).flatMap((id) => {
    const m = gearRules.materials[id]
    if (!m || seen.has(m.name)) return []
    seen.add(m.name)
    return [{ id, name: m.name, tier: m.tier }]
  })
}

export type MaterialTierSource = 'manual' | 'forge' | 'recipe' | 'drop'

/**
 * 材料的等級（推不出來時 undefined）：
 * 手動填的（items.json、世界編輯器的 tier）→ 能打造的材料的等級 → 用到它的配方裡最低的配方等級（怪物也會掉的，和掉落換算取較低的）→ 會掉它的怪物等級換算。
 */
export function materialTier(state: Pick<GameState, 'customItems'> | undefined, name: string): { tier: number; source: MaterialTierSource } | undefined {
  if (!isMaterial(state, name)) return undefined
  const own = itemDef(name)?.tier
  if (own) return { tier: own, source: 'manual' }
  return inferMaterialTier(name)
}

/** 沒有手動填等級時照用途推的等級（世界編輯器顯示「沒填時算第幾級」） */
export function inferMaterialTier(name: string): { tier: number; source: Exclude<MaterialTierSource, 'manual'> } | undefined {
  const forges = materialForges(name)
  if (forges.length) return { tier: Math.min(...forges.map((f) => f.tier)), source: 'forge' }
  const recipes = materialRecipes(name)
  const drop = index().map.get(name)?.dropLevel
  const dropTier = drop !== undefined ? tierForMonsterLevel(drop) : undefined
  // 配方等級是工藝等級（1～5），和材料等級不是同一套刻度：怪物也會掉的，取兩者較低的
  // （例如 Lv.2 冰嶺熊掉的熊掌雖然只有烹飪 Lv.4 的配方用得到，仍算第 1 級）
  if (recipes.length) {
    const tier = recipes[0]!.level
    return dropTier !== undefined && dropTier < tier ? { tier: dropTier, source: 'drop' } : { tier, source: 'recipe' }
  }
  if (dropTier !== undefined) return { tier: dropTier, source: 'drop' }
  return undefined
}

/** 輔料的屬性偏向（名稱與描述裡的字，和打造時的 auxElements 同一份對照，gear.json 的 craft.aux.elements） */
export function auxLeaning(state: Pick<GameState, 'customItems'> | undefined, name: string): string[] {
  const text = `${name}${itemDef(name)?.desc ?? state?.customItems?.[name]?.desc ?? ''}`
  return Object.entries(gearRules.craft.aux.elements).filter(([, words]) => words.some((w) => text.includes(w))).map(([k]) => damageTypeName(k))
}

/**
 * 材料的種類標籤（行囊、商店的類別欄）：能打造的「打造材料」、配方原料「煉金材料」（用到它的工藝）、
 * 其他照貿易類別（「怪物素材」），都沒有時「材料」；後面接等級，例如「煉金材料・第 2 級」。
 */
export function materialLabel(state: Pick<GameState, 'customItems'> | undefined, name: string): string {
  const kind = materialForges(name).length ? '打造材料'
    : materialRecipes(name).length ? `${[...new Set(materialRecipes(name).map((r) => craftRules.skills[r.craft].name))].join('、')}材料`
    : tradeCategory(state, name) ? tradeCategoryName(tradeCategory(state, name))
    : '材料'
  const t = materialTier(state, name)
  return t ? `${kind}・第 ${t.tier} 級` : kind
}

/** 一行說明的配方最多列幾個（其餘寫「等 N 種」，滑鼠移上去看全部） */
export const RECIPE_PREVIEW = 3

const recipeText = (r: MaterialRecipeUse) => `${r.name}（${craftRules.skills[r.craft].name} Lv.${r.level}）`

/**
 * 材料能做什麼（一行）：可打造哪些材料、可以做哪些配方；都沒有時寫可以當輔料（附上偏向）、賣或交付委託。
 * 不是材料時是空字串。
 */
export function materialUses(state: Pick<GameState, 'customItems'> | undefined, name: string): string {
  if (!isMaterial(state, name)) return ''
  const parts: string[] = []
  const forges = materialForges(name)
  if (forges.length) parts.push(`可打造${forges.map((f) => `${f.name}（第 ${f.tier} 級）`).join('、')}`)
  const recipes = materialRecipes(name)
  if (recipes.length) {
    const more = recipes.length > RECIPE_PREVIEW ? `等 ${recipes.length} 種` : ''
    parts.push(`可以做：${recipes.slice(0, RECIPE_PREVIEW).map(recipeText).join('、')}${more}`)
  }
  if (parts.length) return parts.join('・')
  const lean = auxLeaning(state, name)
  return `可作為輔料${lean.length ? `（偏${lean.join('、')}）` : ''}，或可以賣或交付委託`
}

/** 用到這件材料的全部配方（滑鼠提示）；沒有超過一行能列的數量時是空字串 */
export function materialRecipesFull(name: string): string {
  const recipes = materialRecipes(name)
  return recipes.length > RECIPE_PREVIEW ? `可以做：\n${recipes.map(recipeText).join('\n')}` : ''
}

/**
 * 材料的小類（行囊、商店的分段），照用途分（玩家要的是「這是拿來做什麼的」）：
 * - 能打造的：照貿易類別（礦石與金屬、皮革與毛皮、布料、木材、奢侈品）
 * - 配方原料：照用到它的配方裡最低等級那個的工藝（`craft:alchemy`「煉金原料」……）
 * - 其他：照貿易類別（怪物素材……），推不出來的是 other
 * - 怪物素材件數最多（內建約 300 件），再照等級分成「怪物素材・第 N 級」（`monster:N`），推不出等級的留在 monster
 */
export type MaterialGroup = TradeCategory | `craft:${CraftId}` | `monster:${number}` | 'other'

export function materialGroup(state: Pick<GameState, 'customItems'> | undefined, name: string): MaterialGroup {
  if (!materialForges(name).length) {
    const r = materialRecipes(name)[0]
    if (r) return `craft:${r.craft}`
  }
  const trade = tradeCategory(state, name)
  if (trade === 'monster') {
    const t = materialTier(state, name)
    if (t) return `monster:${t.tier}`
  }
  return trade ?? 'other'
}

export function materialGroupName(g: MaterialGroup): string {
  if (g === 'other') return '其他材料'
  if (g.startsWith('craft:')) return `${craftRules.skills[g.slice(6) as CraftId]?.name ?? g.slice(6)}原料`
  if (g.startsWith('monster:')) return `${tradeCategoryName('monster')}・第 ${g.slice(8)} 級`
  return tradeCategoryName(g)
}

/** 小類的順序：打造材料、配方原料（照工藝）、怪物素材（等級高的先，推不出等級的最後）與其他貿易類別、其他 */
export function materialGroupOrder(): MaterialGroup[] {
  const forge: TradeCategory[] = ['metal', 'leather', 'cloth', 'wood', 'luxury']
  const monsterTiers = Array.from({ length: maxMaterialTier() }, (_, i) => `monster:${maxMaterialTier() - i}` as const)
  return [
    ...forge, ...CRAFT_IDS.map((c) => `craft:${c}` as const),
    ...TRADE_CATEGORIES.filter((c) => !forge.includes(c)).flatMap((c) => (c === 'monster' ? [...monsterTiers, c] : [c])),
    'other',
  ]
}
