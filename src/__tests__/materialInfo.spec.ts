import { afterEach, describe, expect, it } from 'vitest'
import { enemies, itemDef, itemRules, saveItems, setSaveItems, type ItemDef } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import {
  auxLeaning, inferMaterialTier, materialGroup, materialGroupName, materialGroupOrder, materialLabel, materialRecipes, materialRecipesFull, materialTier, materialUses, maxMaterialTier, tierForMonsterLevel,
} from '@/engine/materialInfo'
import { sanitizeItem } from '@/engine/mods'

const materials = () => itemRules.items.filter((i) => i.category === 'material')

describe('材料的等級、用途與小類（R24）', () => {
  afterEach(() => setSaveItems([]))

  it('maps monster levels to material tiers by the tiers’ suggested levels', () => {
    const levels: Record<number, number> = {}
    for (const m of Object.values(gearRules.materials)) levels[m.tier] = Math.min(levels[m.tier] ?? 99, m.level)
    expect(tierForMonsterLevel(1)).toBe(1)
    expect(tierForMonsterLevel(levels[2]! - 1)).toBe(1)
    expect(tierForMonsterLevel(levels[2]!)).toBe(2)
    expect(tierForMonsterLevel(levels[3]!)).toBe(3)
    expect(tierForMonsterLevel(99)).toBe(maxMaterialTier())
  })

  it('takes the tier from forging, then recipes, then the monsters that drop it', () => {
    // 能打造：打造材料的等級
    const hide = itemDef('硬化獸皮')!
    const forgeTier = Math.min(...hide.forge!.materials.map((m) => gearRules.materials[m]!.tier))
    expect(materialTier(undefined, '硬化獸皮')).toEqual({ tier: forgeTier, source: 'forge' })
    expect(materialLabel(undefined, '硬化獸皮')).toBe(`打造材料・第 ${forgeTier} 級`)
    expect(materialUses(undefined, '硬化獸皮')).toMatch(/^可打造硬皮（第 \d 級）/)
    // 配方原料：用到它的配方裡最低的配方等級；種類照用到它的工藝
    expect(materialTier(undefined, '夜光蘑菇')).toEqual({ tier: 2, source: 'recipe' })
    expect(materialLabel(undefined, '夜光蘑菇')).toBe('煉金、烹飪材料・第 2 級')
    expect(materialUses(undefined, '夜光蘑菇')).toBe('可以做：微弱法力恢復藥劑（煉金 Lv.2）、蘑菇濃湯（烹飪 Lv.3）')
    // 怪物素材：會掉它的怪物裡最低的等級換算
    const drop = materials().find((m) => !m.forge && !materialRecipes(m.name).length && Object.values(enemies).some((e) => e.loot?.some((l) => l.item === m.name)))!
    const lowest = Math.min(...Object.values(enemies).filter((e) => e.loot?.some((l) => l.item === drop.name)).map((e) => e.level))
    expect(materialTier(undefined, drop.name)).toEqual({ tier: tierForMonsterLevel(lowest), source: 'drop' })
    expect(materialGroup(undefined, drop.name)).toBe('monster')
    expect(materialLabel(undefined, drop.name)).toBe(`怪物素材・第 ${tierForMonsterLevel(lowest)} 級`)
    // 不是材料：沒有等級、沒有用途
    expect(materialTier(undefined, '乾糧')).toBeUndefined()
    expect(materialUses(undefined, '乾糧')).toBe('')
  })

  it('groups materials by what they are for', () => {
    // 能打造的照貿易類別、配方原料照工藝、其他照貿易類別（怪物素材）
    expect(materialGroup(undefined, '硬化獸皮')).toBe('leather')
    expect(materialGroup(undefined, '夜光蘑菇')).toBe('craft:alchemy')
    expect(materialGroupName('craft:alchemy')).toBe('煉金原料')
    expect(materialGroup(undefined, '史萊姆凝膠')).toBe('monster')
    const order = materialGroupOrder()
    expect(order.indexOf('leather')).toBeLessThan(order.indexOf('craft:alchemy'))
    expect(order.indexOf('craft:alchemy')).toBeLessThan(order.indexOf('monster'))
    expect(order.at(-1)).toBe('other')
    // 每件內建材料的小類都在順序表裡
    for (const m of materials()) expect(order, m.name).toContain(materialGroup(undefined, m.name))
  })

  it('tells materials without a crafting use that they work as auxiliaries, with their leaning', () => {
    expect(materialUses(undefined, '史萊姆凝膠')).toMatch(/^可作為輔料.*，或可以賣或交付委託$/)
    expect(auxLeaning(undefined, '熔岩核心')).toContain('火焰')
    expect(materialUses(undefined, '熔岩核心')).toContain('可作為輔料（偏火焰')
  })

  it('lists the first recipes and keeps the rest for the tooltip', () => {
    const many = materials().find((m) => materialRecipes(m.name).length > 3)!
    const n = materialRecipes(many.name).length
    expect(materialUses(undefined, many.name)).toContain(`等 ${n} 種`)
    expect(materialRecipesFull(many.name).split('\n')).toHaveLength(n + 1)
    expect(materialRecipesFull('夜光蘑菇')).toBe('')
  })

  it('every built-in material either has a tier or is a plain material with no known source', () => {
    const withTier = materials().filter((m) => materialTier(undefined, m.name))
    // 盤點時大部分材料都推得出等級（掉落、配方、打造）
    expect(withTier.length / materials().length).toBeGreaterThan(0.8)
    for (const m of withTier) {
      const t = materialTier(undefined, m.name)!.tier
      expect(t, m.name).toBeGreaterThanOrEqual(1)
      expect(t, m.name).toBeLessThanOrEqual(maxMaterialTier())
    }
  })

  it('lets content set the tier by hand', () => {
    expect(sanitizeItem('測試材料', { category: 'material', price_cc: 5, tags: [], tier: 9 }, true).tier).toBe(maxMaterialTier())
    expect(sanitizeItem('測試材料', { category: 'material', price_cc: 5, tags: [] }, true).tier).toBeUndefined()
    expect(sanitizeItem('測試藥水', { category: 'consumable', price_cc: 5, tags: [], tier: 3 }, true).tier).toBeUndefined()
    const def = itemDef('史萊姆凝膠')!
    const inferred = inferMaterialTier('史萊姆凝膠')
    def.tier = 5
    try {
      expect(materialTier(undefined, '史萊姆凝膠')).toEqual({ tier: 5, source: 'manual' })
      // 世界編輯器顯示的「照推的」不看手動填的
      expect(inferMaterialTier('史萊姆凝膠')).toEqual(inferred)
    } finally {
      delete def.tier
    }
  })

  it('rebuilds the reverse index when the save’s invented recipes change', () => {
    expect(materialRecipes('史萊姆凝膠').some((r) => r.invented)).toBe(false)
    const invented: ItemDef = {
      name: '黏黏藥膏', category: 'consumable', price_cc: 20, tags: [],
      recipe: { craft: 'alchemy', level: 1, inputs: [{ name: '史萊姆凝膠', qty: 2 }] },
    }
    setSaveItems([...saveItems(), invented])
    expect(materialRecipes('史萊姆凝膠')).toContainEqual({ name: '黏黏藥膏', craft: 'alchemy', level: 1, invented: true })
    expect(materialUses(undefined, '史萊姆凝膠')).toContain('黏黏藥膏（煉金 Lv.1）')
    setSaveItems([])
    expect(materialRecipes('史萊姆凝膠').some((r) => r.name === '黏黏藥膏')).toBe(false)
  })
})
