import { describe, expect, it } from 'vitest'
import { geography, itemRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { categoryMult, marketMult, marketRules, pctText, tagEffectText, townTags, tradeCategory, TRADE_CATEGORIES } from '@/engine/market'
import { normalizeMods } from '@/engine/mods'
import { addItem, newGame } from '@/engine/state'
import { sellPrice, shopKey, shopState } from '@/engine/trade'

const at = (birthplace: string) => {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace })
  enterLocation(state)
  return state
}

describe('貿易類別（R19 T2）', () => {
  it('infers categories from existing fields', () => {
    const s = at('ironforge')
    expect(tradeCategory(s, '鐵礦石')).toBe('metal')
    expect(tradeCategory(s, '木材')).toBe('wood')
    expect(tradeCategory(s, '狼皮')).toBe('leather')
    expect(tradeCategory(s, '絲綢布匹')).toBe('cloth')
    expect(tradeCategory(s, '金錠')).toBe('metal')
    expect(tradeCategory(s, '星辰石原石')).toBe('luxury')
    expect(tradeCategory(s, '史萊姆凝膠')).toBe('monster')
    expect(tradeCategory(s, '乾糧')).toBe('grain')
    expect(tradeCategory(s, '麥酒')).toBe('liquor')
    expect(tradeCategory(s, '治療藥劑')).toBe('herb')
    expect(tradeCategory(s, '火球術卷軸')).toBe('magic')
    expect(tradeCategory(s, '羽毛床')).toBe('luxury')
    expect(tradeCategory(s, '麻繩（50 呎）')).toBe('goods')
    expect(tradeCategory(s, '懸賞告示')).toBeUndefined()
    expect(tradeCategory(s, '《說話之道》')).toBeUndefined()
  })

  it('uses the hand-written category first', () => {
    const s = at('ironforge')
    expect(tradeCategory(s, '燒刀子')).toBe('liquor')
    expect(tradeCategory(s, '藥草')).toBe('herb')
    expect(tradeCategory(s, '雲錦')).toBe('cloth')
  })

  it('sorts equipment by its base', () => {
    const s = at('ironforge')
    const equip = itemRules.items.filter((i) => i.gear)
    const of = (base: string) => tradeCategory(s, equip.find((i) => i.gear!.base === base)!.name)
    expect(of('longsword')).toBe('weapon')
    expect(of('shield')).toBe('armor')
    expect(of('plate')).toBe('armor')
  })

  it('gives every material a category, and only uses known ids', () => {
    const s = at('ironforge')
    const missing = itemRules.items.filter((i) => i.category === 'material' && !tradeCategory(s, i.name)).map((i) => i.name)
    expect(missing).toEqual([])
    for (const i of itemRules.items) {
      if (i.trade_category) expect(TRADE_CATEGORIES).toContain(i.trade_category)
    }
  })

  it('keeps a valid category from mods and drops an unknown one', () => {
    const out = normalizeMods({ items: { 試做的布: { category: 'material', price_cc: 10, tags: [], trade_category: 'cloth' }, 怪東西: { category: 'material', price_cc: 10, tags: [], trade_category: 'nope' } } })
    expect(out.items?.['試做的布']?.trade_category).toBe('cloth')
    expect(out.items?.['怪東西']?.trade_category).toBeUndefined()
  })
})

describe('城鎮的固定標籤（R19 T3）', () => {
  it('tags every settlement with 1–3 known tags', () => {
    for (const l of geography.locations.filter((x) => x.type !== 'dungeon')) {
      expect(l.trade_tags?.length, l.id).toBeGreaterThanOrEqual(1)
      expect(l.trade_tags!.length, l.id).toBeLessThanOrEqual(3)
      for (const t of l.trade_tags!) expect(marketRules.tags[t], `${l.id}: ${t}`).toBeDefined()
    }
  })

  it('multiplies the tags of the town and clamps the result', () => {
    expect(categoryMult('ironforge', 'metal').x).toBe(0.5)
    expect(categoryMult('ironforge', 'weapon').x).toBe(0.8)
    expect(categoryMult('ironforge', 'grain').x).toBe(1)
    expect(categoryMult('ironforge', 'metal').parts.map((p) => p.label)).toEqual(['礦產豐富'])
    // 灰岩堡壘：邊境（武器 ×1.3）
    expect(categoryMult('greyrock', 'weapon').x).toBe(1.3)
    // 地下城、驛站沒有標籤
    expect(categoryMult('ws_a_b', 'metal').x).toBe(1)
    const [lo, hi] = marketRules.mult_range
    expect(lo).toBe(0.4)
    expect(hi).toBe(2.5)
  })

  it('applies to both the shop price and the buying price', () => {
    const iron = at('ironforge')
    const soriel = at('soriel')
    for (const s of [iron, soriel]) {
      standOn(s, 'smithy')
      s.inventory = []
      addItem(s.inventory, '鐵礦石', 1)
      addItem(s.inventory, '狼皮', 1)
    }
    // 兩座都是王都（聚落倍率相同）：鐵爐堡的礦石只收一半，狼皮一樣
    const sell = (s: typeof iron, n: string) => sellPrice(s, shopKey(s, 'smithy'), n)!
    expect(sell(iron, '鐵礦石')).toBe(Math.floor(sell(soriel, '鐵礦石') * 0.5))
    expect(sell(iron, '狼皮')).toBe(sell(soriel, '狼皮'))
    // 店裡的武器：鐵爐堡（鍛造重鎮）是 ×0.8
    const deal = shopState(iron, 'smithy').deals.find((d) => d.id.startsWith('item:') && tradeCategory(iron, d.title) === 'weapon')
    if (deal) {
      const name = deal.id.slice(5)
      const def = itemRules.items.find((i) => i.name === name)!
      expect(marketMult(iron, 'ironforge', name).x).toBe(0.8)
      expect(deal.gives[0]!.amount).toBe(Math.max(1, Math.round(def.price_cc * 1.15 * 0.8)))
    }
  })

  it('describes the tags for the town screen', () => {
    const t = townTags('ironforge')
    expect(t.map((x) => x.def.name)).toEqual(['礦產豐富', '鍛造重鎮'])
    expect(tagEffectText(t[0]!.def)).toBe('礦石與金屬 −50%')
    expect(pctText(1.3)).toBe('+30%')
  })
})
