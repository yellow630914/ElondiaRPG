import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { buyCurio, curioStock } from '@/engine/companions'
import { itemRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'

function atBlackMarket() {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 9, birthplace: 'soriel' })
  enterLocation(state)
  state.flags['black_market:soriel'] = true
  state.money_cc = 1e6
  return state
}

describe('black market curios', () => {
  it('stocks a few black-market unique items each day, three by default', () => {
    const state = atBlackMarket()
    const stock = curioStock(state)
    expect(stock).toHaveLength(3)
    for (const c of stock) {
      const i = itemRules.items.find((x) => x.name === c.item)!
      expect(i.black_market && i.gear?.unique).toBeTruthy()
      expect(c.price_cc).toBeGreaterThan(i.price_cc)
    }
    // 同一天看第二次不變
    expect(curioStock(state)).toEqual(stock)
    state.options = { defeatLoot: 'half', blackMarketGear: 0 }
    state.time.day += 1
    expect(curioStock(state)).toEqual([])
  })

  it('sells and haggles', () => {
    const state = atBlackMarket()
    const [a, b] = curioStock(state)
    const money = state.money_cc
    buyCurio(state, a!.item)
    expect(state.money_cc).toBe(money - a!.price_cc)
    expect(state.inventory.some((i) => i.name === a!.item)).toBe(true)
    expect(curioStock(state).some((c) => c.item === a!.item)).toBe(false)
    const before = b!.price_cc
    prepareAction(state, { kind: 'haggle', target: `curio:${b!.item}`, text: '' })
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    const after = curioStock(state).find((c) => c.item === b!.item)!
    expect(after.price_cc).toBeLessThan(before)
    expect(after.haggled).toBe(true)
  })

  it('needs a known black market', () => {
    const state = atBlackMarket()
    delete state.flags['black_market:soriel']
    expect(() => curioStock(state)).toThrow('黑市')
  })
})
