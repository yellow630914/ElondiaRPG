import { describe, expect, it } from 'vitest'
import { geography, itemRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { categoryMult, marketMult, marketRules, pctText, tagEffectText, townStates, townTags, tradeCategory, TRADE_CATEGORIES, type TradeCategory } from '@/engine/market'
import { normalizeMods } from '@/engine/mods'
import { addItem, newGame } from '@/engine/state'
import { breakdownText, buyBreakdown, cartQuote, checkoutCart, dealMoney, glutCount, glutMult, sellBreakdown, sellItem, sellPrice, sellTotalOf, shopKey, shopState, type PriceBreakdown } from '@/engine/trade'

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
    const s = at('ironforge')
    // 只看固定標籤（今天的動態狀態另外測）
    const tagX = (loc: string, cat: TradeCategory) => categoryMult(s, loc, cat).parts.filter((p) => p.kind === 'tag').reduce((a, p) => a * p.x, 1)
    expect(tagX('ironforge', 'metal')).toBe(0.5)
    expect(tagX('ironforge', 'weapon')).toBe(0.8)
    expect(tagX('ironforge', 'grain')).toBe(1)
    expect(categoryMult(s, 'ironforge', 'metal').parts.filter((p) => p.kind === 'tag').map((p) => p.label)).toEqual(['礦產豐富'])
    // 灰岩堡壘：邊境（武器 ×1.3）
    expect(tagX('greyrock', 'weapon')).toBe(1.3)
    // 地下城、驛站沒有標籤也沒有狀態
    expect(categoryMult(s, 'ws_a_b', 'metal')).toEqual({ category: 'metal', x: 1, parts: [] })
    const [lo, hi] = marketRules.mult_range
    expect(lo).toBe(0.4)
    expect(hi).toBe(2.5)
    // 結果是各部分相乘、再夾在範圍裡
    for (const loc of ['ironforge', 'greyrock', 'soriel', 'tidehaven']) {
      for (const day of [1, 9, 23, 40]) {
        s.time.day = day
        for (const c of TRADE_CATEGORIES) {
          const m = categoryMult(s, loc, c)
          expect(m.x).toBeCloseTo(Math.max(lo, Math.min(hi, m.parts.reduce((a, p) => a * p.x, 1))))
        }
      }
    }
  })

  it('applies to both the shop price and the buying price', () => {
    for (const town of ['ironforge', 'soriel']) {
      const s = at(town)
      standOn(s, 'smithy')
      s.inventory = []
      addItem(s.inventory, '鐵礦石', 1)
      // 王都（×1.15）× 類別倍率；材料全價收購，沒有折扣、聲望與身分的加減
      const x = marketMult(s, town, '鐵礦石').x
      expect(sellPrice(s, shopKey(s, 'smithy'), '鐵礦石')).toBe(Math.max(1, Math.floor(itemRules.items.find((i) => i.name === '鐵礦石')!.price_cc * 1.15 * x)))
      // 店裡的武器
      const deal = shopState(s, 'smithy').deals.find((d) => d.id.startsWith('item:') && tradeCategory(s, d.title) === 'weapon')
      if (deal) {
        const def = itemRules.items.find((i) => i.name === deal.id.slice(5))!
        expect(deal.gives[0]!.amount).toBe(Math.max(1, Math.round(def.price_cc * 1.15 * marketMult(s, town, def.name).x)))
      }
    }
    // 鐵爐堡的礦石有「礦產豐富」
    expect(marketMult(at('ironforge'), 'ironforge', '鐵礦石').parts.some((p) => p.label === '礦產豐富')).toBe(true)
  })

  it('describes the tags for the town screen', () => {
    const t = townTags('ironforge')
    expect(t.map((x) => x.def.name)).toEqual(['礦產豐富', '鍛造重鎮'])
    expect(tagEffectText(t[0]!.def)).toBe('礦石與金屬 −50%')
    expect(pctText(1.3)).toBe('+30%')
  })
})

describe('動態狀態（R19 T4）', () => {
  const towns = geography.locations.filter((l) => l.type !== 'dungeon')

  it('has 30–40 states that only use known categories and tags', () => {
    const ids = Object.keys(marketRules.states)
    expect(ids.length).toBeGreaterThanOrEqual(30)
    expect(ids.length).toBeLessThanOrEqual(40)
    for (const d of Object.values(marketRules.states)) {
      for (const c of Object.keys(d.mult)) expect(TRADE_CATEGORIES).toContain(c)
      for (const t of [...(d.tags ?? []), ...(d.not_tags ?? [])]) expect(marketRules.tags[t]).toBeDefined()
      expect(d.days[0]).toBeLessThanOrEqual(d.days[1])
      expect(d.days[1]).toBeLessThanOrEqual(marketRules.state_rules.period_days)
    }
  })

  it('draws at most 2 fitting, non-conflicting states, the same on every load', () => {
    const s = at('ironforge')
    let seen = 0
    for (const l of towns) {
      for (let day = 1; day <= 120; day++) {
        s.time.day = day
        const list = townStates(s, l.id)
        seen += list.length
        expect(list.length).toBeLessThanOrEqual(marketRules.state_rules.max)
        const groups = list.map((x) => x.def.group).filter(Boolean)
        expect(new Set(groups).size).toBe(groups.length)
        for (const x of list) {
          if (x.def.tags?.length) expect(x.def.tags.some((t) => l.trade_tags!.includes(t)), `${l.id} ${x.id}`).toBe(true)
          if (x.def.regions?.length) expect(x.def.regions).toContain(l.region)
          if (x.def.types?.length) expect(x.def.types).toContain(l.type)
          expect(day).toBeGreaterThanOrEqual(x.start)
          expect(day).toBeLessThan(x.end)
          expect(x.end - x.start).toBeLessThanOrEqual(marketRules.state_rules.period_days)
        }
        // 同一個存檔、同一天重算一樣
        expect(townStates({ seed: s.seed, time: { ...s.time } }, l.id).map((x) => x.id)).toEqual(list.map((x) => x.id))
      }
    }
    // 平均每座聚落每天大約 0.4～1.2 個狀態
    const avg = seen / (towns.length * 120)
    expect(avg).toBeGreaterThan(0.3)
    expect(avg).toBeLessThan(1.3)
    expect(townStates(s, 'ws_a_b')).toEqual([])
  })

  it('changes over time and between worlds', () => {
    const a = at('ironforge')
    const b = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 99, birthplace: 'ironforge' })
    const seq = (s: typeof a) => Array.from({ length: 60 }, (_, d) => { s.time.day = d + 1; return townStates(s, 'tidehaven').map((x) => x.id).join('+') }).join(',')
    expect(new Set(seq(a).split(',')).size).toBeGreaterThan(2)
    expect(seq(a)).not.toEqual(seq(b))
  })

  it('adds the states to the price', () => {
    const s = at('ironforge')
    for (let day = 1; day <= 60; day++) {
      s.time.day = day
      for (const st of townStates(s, 'ironforge')) {
        const [cat, x] = Object.entries(st.def.mult)[0]!
        const part = categoryMult(s, 'ironforge', cat as TradeCategory).parts.find((p) => p.kind === 'state' && p.label === st.def.name)
        expect(part?.x).toBe(x)
        expect(part?.daysLeft).toBe(st.end - day)
        return
      }
    }
    throw new Error('60 天裡鐵爐堡都沒有狀態')
  })
})

describe('價格拆解（R19 T5）', () => {
  const num = (t: string) => {
    if (t.startsWith('×')) return Number(t.slice(1))
    const m = /^([+−±])(\d+)%/.exec(t)
    return m ? 1 + (m[1] === '−' ? -1 : 1) * Number(m[2]) / 100 : NaN
  }
  /** 拆解的每一步相乘（夾過的類別倍率以夾過的為準） */
  function product(b: PriceBreakdown, base: number): number {
    const clamp = b.steps.find((s) => s.kind === 'clamp')
    return b.steps.filter((s) => s.kind !== 'base' && s.kind !== 'cap' && !(clamp && (s.kind === 'tag' || s.kind === 'state')))
      .reduce((a, s) => a * num(s.text), base)
  }

  it('explains a shop price step by step', () => {
    const s = at('ironforge')
    s.time.day = 6 // 鐵爐堡這天有「礦坑塌方」（種子 6）
    standOn(s, 'smithy')
    const key = shopKey(s, 'smithy')
    s.relationships ??= {}
    s.relationships[shopState(s, 'smithy').keeper] = { ...(s.relationships[shopState(s, 'smithy').keeper] ?? {}), affinity: 25 } as never
    const deals = shopState(s, 'smithy').deals.filter((d) => d.id.startsWith('item:'))
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) {
      const b = buyBreakdown(s, key, d)!
      expect(b.total).toBe(dealMoney(s, key, d))
      expect(b.steps[0]!.kind).toBe('base')
      expect(b.steps.some((x) => x.label === '王都物價' && x.text === '×1.15')).toBe(true)
      expect(b.steps.some((x) => x.label.startsWith('折扣') && x.text === '−5%')).toBe(true)
      const p = product(b, d.basis!.base)
      expect(Math.abs(p - b.total)).toBeLessThanOrEqual(Math.max(1, b.total * 0.02))
    }
    const ore = deals.find((d) => d.title === '鐵礦石')
    if (ore) {
      const b = buyBreakdown(s, key, ore)!
      // 動態狀態的標籤後面寫還有幾天（「礦坑塌方（還有 N 天）」）
      expect(b.steps.map((x) => x.label.replace(/（還有 \d+ 天）$/, ''))).toEqual(expect.arrayContaining(['材料加成（目錄價是收購價）', '礦產豐富', '礦坑塌方']))
      expect(b.category).toBe('礦石與金屬')
      expect(breakdownText(b)).toContain('礦坑塌方（還有 3 天） +60%')
    }
  })

  it('sells at the save rule\'s ratio (default 50%); materials stay at full price', () => {
    const s = at('soriel')
    standOn(s, 'temple')
    const key = shopKey(s, 'temple')
    s.inventory = []
    addItem(s.inventory, '治療藥劑', 1)
    const half = sellPrice(s, key, '治療藥劑')!
    expect(sellBreakdown(s, key, '治療藥劑')!.steps.map((x) => x.label)).toContain('收購 50%')
    s.options = { ...s.options!, sellRatio: 100 }
    const full = sellPrice(s, key, '治療藥劑')!
    expect(full).toBeGreaterThanOrEqual(half * 2 - 1)
    expect(full).toBeLessThanOrEqual(half * 2 + 1)
    expect(sellBreakdown(s, key, '治療藥劑')!.steps.map((x) => x.label)).toContain('收購 100%')
  })

  it('explains a buying price, including the cap on gear', () => {
    const s = at('soriel')
    standOn(s, 'smithy')
    const key = shopKey(s, 'smithy')
    s.inventory = []
    addItem(s.inventory, '狼皮', 2)
    const b = sellBreakdown(s, key, '狼皮')!
    expect(b.total).toBe(sellPrice(s, key, '狼皮'))
    expect(b.steps.map((x) => x.label)).toContain('材料全價收購')
    expect(Math.abs(product(b, itemRules.items.find((i) => i.name === '狼皮')!.price_cc) - b.total)).toBeLessThanOrEqual(1)
    // 這間店不收的東西沒有拆解
    addItem(s.inventory, '乾糧', 1)
    expect(sellBreakdown(s, key, '乾糧')).toBeUndefined()
    // 特別交易沒有拆解
    const special = shopState(s, 'smithy').deals.find((d) => !d.id.startsWith('item:'))
    if (special) expect(buyBreakdown(s, key, special)).toBeUndefined()
  })
})

describe('收購遞減（R19 T6）', () => {
  function smithy(town = 'soriel') {
    const s = at(town)
    standOn(s, 'smithy')
    s.inventory = []
    addItem(s.inventory, '狼皮', 30)
    addItem(s.inventory, '鐵礦石', 5)
    s.money_cc = 0
    return { s, key: shopKey(s, 'smithy') }
  }

  it('makes each extra item of the same category cheaper, in the cart and after checkout', () => {
    const { s, key } = smithy()
    const first = sellPrice(s, key, '狼皮')!
    const q = cartQuote(s, 'smithy', { buy: [], sell: [{ name: '狼皮', qty: 5 }] })
    expect(q.sell[0]!.price).toBe(first)
    expect(q.sell[0]!.total).toBe(sellTotalOf(s, key, '狼皮', 5))
    expect(q.sell[0]!.total).toBeLessThan(first * 5)
    expect(q.sellTotal).toBe(q.sell[0]!.total)
    checkoutCart(s, 'smithy', { buy: [], sell: [{ name: '狼皮', qty: 5 }] })
    expect(s.money_cc).toBe(q.sell[0]!.total)
    expect(glutCount(s, key, 'leather')).toBe(5)
    expect(glutMult(s, key, 'leather')).toBeCloseTo(0.85)
    expect(sellPrice(s, key, '狼皮')!).toBeLessThan(first)
    // 別的類別、別間店不受影響
    expect(glutMult(s, key, 'metal')).toBe(1)
    expect(glutMult(s, shopKey(s, 'general'), 'leather')).toBe(1)
    // 拆解寫出來
    expect(sellBreakdown(s, key, '狼皮')!.steps.some((x) => x.kind === 'glut' && x.label.includes('5 件皮革與毛皮'))).toBe(true)
  })

  it('counts earlier lines of the same category in one cart', () => {
    const { s, key } = smithy()
    addItem(s.inventory, '野狗皮', 3)
    const q = cartQuote(s, 'smithy', { buy: [], sell: [{ name: '狼皮', qty: 4 }, { name: '野狗皮', qty: 3 }] })
    expect(q.sell[1]!.total).toBe(sellTotalOf(s, key, '野狗皮', 3, 4))
    expect(q.sell[1]!.total).toBeLessThan(sellTotalOf(s, key, '野狗皮', 3)!)
  })

  it('stops at −50% and recovers day by day', () => {
    const { s, key } = smithy()
    sellItem(s, 'smithy', '狼皮', 25)
    expect(glutCount(s, key, 'leather')).toBe(25)
    expect(glutMult(s, key, 'leather')).toBe(0.5)
    s.time.day += 2
    expect(glutCount(s, key, 'leather')).toBe(25 - 2 * marketRules.sell_glut.recover_per_day)
    s.time.day += 10
    expect(glutCount(s, key, 'leather')).toBe(0)
    expect(glutMult(s, key, 'leather')).toBe(1)
  })

  it('follows the save rule (0 turns it off)', () => {
    const { s, key } = smithy()
    sellItem(s, 'smithy', '狼皮', 10)
    s.options = { defeatLoot: 'half', ...s.options, sellGlutPct: 5 }
    expect(glutMult(s, key, 'leather')).toBeCloseTo(0.5)
    s.options.sellGlutPct = 0
    expect(glutMult(s, key, 'leather')).toBe(1)
    expect(sellTotalOf(s, key, '狼皮', 3)).toBe(sellPrice(s, key, '狼皮')! * 3)
  })
})
