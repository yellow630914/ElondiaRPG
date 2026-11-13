import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { buyCurio, curioStock } from '@/engine/companions'
import { itemRules } from '@/engine/data'
import { enterLocation, standOn, type CellKind } from '@/engine/grid'
import { newGame } from '@/engine/state'

function atBlackMarket() {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 9, birthplace: 'soriel' })
  enterLocation(state)
  // 黑市在地下街裡：知道地下街（舊存檔打聽到黑市的旗標也算）、站在黑市的地標上
  state.flags['black_market:soriel'] = true
  standOn(state, 'lm_uw_black_soriel' as CellKind)
  state.money_cc = 1e6
  return state
}

describe('black market curios', () => {
  it('stocks a few black-market unique items each day, three by default', () => {
    const state = atBlackMarket()
    // 寄生物的引子另外算（parasiteLures.spec.ts）
    const gear = () => curioStock(state).filter((c) => itemRules.items.find((x) => x.name === c.item)?.gear)
    const stock = gear()
    expect(stock).toHaveLength(3)
    for (const c of stock) {
      const i = itemRules.items.find((x) => x.name === c.item)!
      expect(i.black_market && i.gear?.unique).toBeTruthy()
      expect(c.price_cc).toBeGreaterThan(i.price_cc)
    }
    // 同一天看第二次不變
    expect(gear()).toEqual(stock)
    state.options = { defeatLoot: 'half', blackMarketGear: 0 }
    state.time.day += 1
    expect(gear()).toEqual([])
  })

  it('sells and haggles', () => {
    const state = atBlackMarket()
    const [a, b] = curioStock(state).filter((c) => itemRules.items.find((x) => x.name === c.item)?.gear)
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

  it('needs to stand at the black market in the underworld', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 9, birthplace: 'soriel' })
    enterLocation(state)
    standOn(state, 'tavern')
    expect(() => curioStock(state)).toThrow('黑市')
  })
})
