import { describe, expect, it } from 'vitest'
import { geography, shopRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { applyAiTitle, generatedTitle, shopKindName, shopTitle, wantsAiTitle } from '@/engine/shopNames'
import { applyAiDeals, buyDeal, shopState } from '@/engine/trade'
import type { GameState } from '@/engine/types'
import { buildShopPrompt } from '@/narrator/judge'

function game(seed = 1): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  enterLocation(state)
  return state
}

describe('shop names', () => {
  it('generates a stable name from the region words and the shop suffix', () => {
    const a = generatedTitle('albena', 'tavern')
    expect(generatedTitle('albena', 'tavern')).toEqual(a)
    const words = shopRules.naming.regions.central!.words
    const suffixes = shopRules.naming.suffix.tavern!
    expect(words.some((w) => a.name.startsWith(w))).toBe(true)
    expect(suffixes.some((x) => a.name.endsWith(x))).toBe(true)
    expect(a.desc).not.toContain('{air}')
    expect(a.desc.length).toBeGreaterThan(5)
    expect(a.greeting).not.toBe('')
  })

  it('names every shop kind in every settlement, with region suffixes in the east sea', () => {
    for (const loc of geography.locations.filter((l) => l.type !== 'dungeon')) {
      for (const kind of ['tavern', 'inn', 'general', 'smithy', 'tailor', 'jeweler', 'magic', 'informant', 'temple'] as const) {
        const t = generatedTitle(loc.id, kind)
        expect(t.name.length, `${loc.id}/${kind}`).toBeGreaterThan(1)
      }
    }
    // 同一個地點的店不會用到同一個字詞
    for (const loc of geography.locations.filter((l) => l.type !== 'dungeon')) {
      const words = shopRules.naming.regions[loc.region]!.words
      const used = (['tavern', 'inn', 'general', 'smithy', 'tailor', 'jeweler', 'magic', 'informant', 'temple'] as const)
        .map((k) => words.find((w) => generatedTitle(loc.id, k).name.startsWith(w)))
      expect(new Set(used).size, loc.id).toBe(used.length)
    }
    const eastSuffix = shopRules.naming.regions.east_sea!.suffix!.tavern!
    const east = geography.locations.find((l) => l.region === 'east_sea' && l.type !== 'dungeon')!
    expect(eastSuffix.some((x) => generatedTitle(east.id, 'tavern').name.endsWith(x))).toBe(true)
  })

  it('prefers hand-written names, field by field', () => {
    const state = game()
    expect(shopTitle(state, 'soriel', 'tavern').name).toBe('聖鐘酒館')
    // 只寫了名字與描述：招呼語用規則生成的
    const smithy = shopTitle(state, 'soriel', 'smithy')
    expect(smithy.name).toBe('聖環鍛造坊')
    expect(smithy.greeting).toBe(generatedTitle('soriel', 'smithy').greeting)
    expect(shopKindName('inn')).toBe('旅店')
  })

  it('keeps the AI name once and never replaces a hand-written one', () => {
    const state = game()
    expect(wantsAiTitle(state, 'albena', 'tavern')).toBe(true)
    expect(applyAiTitle(state, 'albena', 'tavern', { name: '  老橡木酒館  ', desc: '昏黃的燈下擺著幾張長桌。', greeting: '進來坐！' })).toBe(true)
    expect(shopTitle(state, 'albena', 'tavern')).toEqual({ name: '老橡木酒館', desc: '昏黃的燈下擺著幾張長桌。', greeting: '進來坐！' })
    expect(wantsAiTitle(state, 'albena', 'tavern')).toBe(false)
    expect(applyAiTitle(state, 'albena', 'tavern', { name: '別的名字' })).toBe(false)
    expect(shopTitle(state, 'albena', 'tavern').name).toBe('老橡木酒館')
    // 手寫的名字不請 AI 取
    expect(wantsAiTitle(state, 'soriel', 'tavern')).toBe(false)
    expect(applyAiTitle(state, 'soriel', 'tavern', { name: 'AI 酒館' })).toBe(false)
    // 沒有名字就不存；過長的截斷
    expect(applyAiTitle(state, 'albena', 'smithy', { desc: '只有描述' })).toBe(false)
    applyAiTitle(state, 'albena', 'smithy', { name: '一二三四五六七八九十十一十二十三' })
    expect(shopTitle(state, 'albena', 'smithy').name.length).toBeLessThanOrEqual(12)
  })

  it('uses the plain shop name for wandering merchants and waystations', () => {
    const state = game()
    expect(shopTitle(state, 'albena', 'wanderer').name).toBe(shopRules.types.wanderer.name)
    expect(shopTitle(state, 'ws_albena_soriel', 'general').name).toBe(shopRules.waystation.name)
    expect(wantsAiTitle(state, 'ws_albena_soriel', 'general')).toBe(false)
  })

  it('asks the AI for a name with the deals, stores it, and uses the name in trade reports', () => {
    const state = game()
    state.location = 'albena'
    enterLocation(state)
    shopState(state, 'general')
    expect(buildShopPrompt(state, 'general').system).toContain('"shop"')
    applyAiDeals(state, 'general', {
      shop: { name: '河岸商行', desc: '堆滿貨箱的老倉庫。', greeting: '要什麼自己挑。' },
      deals: [{ title: '旅行套組', gives: [{ type: 'money', amount: 30 }], gets: [{ type: 'item', name: '乾糧', qty: 3 }], stock: 1 }],
    })
    expect(shopTitle(state, 'albena', 'general').name).toBe('河岸商行')
    expect(buildShopPrompt(state, 'general').system).not.toContain('"shop"')
    expect(buildShopPrompt(state, 'general').user).toContain('河岸商行')
    state.money_cc = 10_000
    const report = buyDeal(state, 'general', 'item:乾糧')
    expect(report.location.scene).toBe('阿爾貝納的河岸商行')
  })
})
