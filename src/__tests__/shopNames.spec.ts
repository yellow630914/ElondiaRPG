import { describe, expect, it } from 'vitest'
import { geography, shopRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { migrate, newGame } from '@/engine/state'
import { generatedTitle, shopKindName, shopTitle } from '@/engine/shopNames'
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
    expect(shopTitle('soriel', 'tavern').name).toBe('聖鐘酒館')
    // 只寫了名字與描述：招呼語用規則生成的
    const smithy = shopTitle('soriel', 'smithy')
    expect(smithy.name).toBe('聖環鍛造坊')
    expect(smithy.greeting).toBe(generatedTitle('soriel', 'smithy').greeting)
    expect(shopKindName('inn')).toBe('旅店')
  })

  it('uses the plain shop name for wandering merchants and waystations', () => {
    expect(shopTitle('albena', 'wanderer').name).toBe(shopRules.types.wanderer.name)
    expect(shopTitle('ws_albena_soriel', 'general').name).toBe(shopRules.waystation.name)
  })

  it('never lets the AI rename a shop, and drops names old saves stored', () => {
    const state = game()
    state.location = 'albena'
    enterLocation(state)
    shopState(state, 'general')
    const name = shopTitle('albena', 'general').name
    expect(buildShopPrompt(state, 'general').system).not.toContain('"shop"')
    expect(buildShopPrompt(state, 'general').user).toContain(name)
    applyAiDeals(state, 'general', {
      shop: { name: 'AI 取的名字', desc: '堆滿貨箱的老倉庫。', greeting: '要什麼自己挑。' },
      deals: [{ title: '旅行套組', gives: [{ type: 'money', amount: 30 }], gets: [{ type: 'item', name: '乾糧', qty: 3 }], stock: 1 }],
    })
    expect(shopTitle('albena', 'general').name).toBe(name)
    state.money_cc = 10_000
    const report = buyDeal(state, 'general', 'item:乾糧')
    expect(report.location.scene).toBe(`阿爾貝納的${name}`)
    const old = { ...state, shopNames: { 'albena/general': { name: '河岸商行' } } } as GameState
    expect('shopNames' in migrate(old)).toBe(false)
  })
})
