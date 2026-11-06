import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { shopRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { addItem, newGame } from '@/engine/state'
import { bargainNet, cartBargainTarget, cartQuote, checkoutCart, dealMoney, sellPrice, sellTotalOf, settleNet, shopKey, shopState, type Cart } from '@/engine/trade'
import type { GameState, Report } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'ironforge' })
  enterLocation(state)
  standOn(state, 'smithy')
  state.money_cc = 5000
  state.inventory = []
  addItem(state.inventory, '狼皮', 3)
  return state
}
/** 鐵匠鋪今天兩樣一般商品，各補到 5 個 */
function pick(state: GameState) {
  const shop = shopState(state, 'smithy')
  const items = shop.deals.filter((d) => d.id.startsWith('item:')).slice(0, 2)
  for (const d of items) d.stock = 5
  return { shop, a: items[0]!, b: items[1]! }
}

describe('購物車與整車交涉（R19 T1）', () => {
  it('quotes buy and sell lines at the usual prices', () => {
    const state = game()
    const { a, b } = pick(state)
    const key = shopKey(state, 'smithy')
    const cart: Cart = { buy: [{ dealId: a.id, qty: 2 }, { dealId: b.id, qty: 1 }], sell: [{ name: '狼皮', qty: 3 }] }
    const q = cartQuote(state, 'smithy', cart)
    expect(q.buyTotal).toBe(dealMoney(state, key, a) * 2 + dealMoney(state, key, b))
    // 收購遞減：三張狼皮一張比一張便宜
    expect(q.sellTotal).toBe(sellTotalOf(state, key, '狼皮', 3))
    expect(q.sell[0]!.price).toBe(sellPrice(state, key, '狼皮'))
    expect(q.listNet).toBe(q.buyTotal - q.sellTotal)
    expect(q.net).toBe(q.listNet)
    expect(q.blocked).toBeUndefined()
    expect(cartQuote(state, 'smithy', { buy: [{ dealId: a.id, qty: 9 }], sell: [{ name: '狼皮', qty: 4 }] }).blockers.join()).toMatch(/只剩 5 個.*只有 3 個|只有 3 個.*只剩 5 個/)
  })

  it('checks out in one report: items both ways, one money change', () => {
    const state = game()
    const { a } = pick(state)
    const cart: Cart = { buy: [{ dealId: a.id, qty: 2 }], sell: [{ name: '狼皮', qty: 3 }] }
    const q = cartQuote(state, 'smithy', cart)
    const money = state.money_cc
    const r = checkoutCart(state, 'smithy', cart)
    valid(r)
    expect(state.money_cc).toBe(money - q.net)
    expect(state.inventory.some((i) => i.name === '狼皮')).toBe(false)
    expect(state.inventory.find((i) => i.name === a.title)?.qty).toBe(2)
    expect(a.stock).toBe(3)
    expect(r.outcome.summary).toContain('賣了 狼皮×3')
  })

  it('settles at the offer when it is better for the shop than the result (the old B21 bug)', () => {
    // 原價 330、出價 300、成功（×0.85 → 280）：成交 300，不是 280
    expect(settleNet(330, bargainNet(330, 0, 0.85), 'success', 300)).toBe(300)
    // 出價比能談到的還低：照能談到的
    expect(settleNet(330, bargainNet(330, 0, 0.85), 'success', 250)).toBe(281)
    // 出價比原價高：不超過原價
    expect(settleNet(330, bargainNet(330, 0, 0.85), 'success', 400)).toBe(330)
    // 沒談成：出價不算數
    expect(settleNet(330, bargainNet(330, 0, 1.1), 'fumble', 300)).toBe(363)
    // 賣出的部分照原價（不然同一間店低買高賣就穩賺），只有買的部分打折
    expect(bargainNet(0, 100, 0.85)).toBe(-100)
    expect(bargainNet(200, 100, 0.85)).toBe(70)
    expect(settleNet(100, bargainNet(200, 100, 0.85), 'success', 90)).toBe(90)
  })

  it('bargains the whole cart once a day; the offer counts only for the same cart', () => {
    const state = game()
    const { a, b } = pick(state)
    const cart: Cart = { buy: [{ dealId: a.id, qty: 2 }], sell: [{ name: '狼皮', qty: 1 }] }
    const list = cartQuote(state, 'smithy', cart).listNet
    const offer = list - 1
    const p = prepareAction(state, { kind: 'bargain', target: cartBargainTarget('smithy', cart), text: '一次買這麼多，算便宜點', offer_cc: offer })
    expect(p.outcomes.success).toContain('付')
    const prompt = buildActionPrompt(state, p, '')
    expect(prompt.user).toContain(`出價：想付`)
    p.natural = 20
    resolveAction(state, null)
    const shop = state.shops![shopKey(state, 'smithy')]!
    expect(shop.cartBargain?.degree).toBe('critical')
    const q = cartQuote(state, 'smithy', cart)
    expect(q.offerApplies).toBe(true)
    expect(q.net).toBe(Math.min(list, Math.max(bargainNet(q.buyTotal, q.sellTotal, shopRules.bargain.price_factor.critical), offer)))
    expect(q.held).toBe(true)
    // 改了購物車：談好的價就不算了，照原價交易
    const changed: Cart = { ...cart, buy: [...cart.buy, { dealId: b.id, qty: 1 }] }
    const q2 = cartQuote(state, 'smithy', changed)
    expect(q2.held).toBe(false)
    expect(q2.offerApplies).toBe(false)
    expect(q2.net).toBe(q2.listNet)
    // 一天一次
    expect(() => prepareAction(state, { kind: 'bargain', target: cartBargainTarget('smithy', cart), text: '' })).toThrow('今天已經和這間店交涉過了')
    // 結帳後用掉
    checkoutCart(state, 'smithy', cart)
    expect(shop.cartBargain?.spent).toBe(true)
    expect(cartQuote(state, 'smithy', { buy: [{ dealId: b.id, qty: 1 }], sell: [] }).bargain).toBeUndefined()
  })

  it('needs something to buy: selling is never haggled up', () => {
    const state = game()
    expect(() => prepareAction(state, { kind: 'bargain', target: cartBargainTarget('smithy', { buy: [], sell: [{ name: '狼皮', qty: 3 }] }), text: '' })).toThrow('沒有要買的東西')
  })

  it('a changed cart after the bargain checks out at the list price', () => {
    const state = game()
    const { a, b } = pick(state)
    const cart: Cart = { buy: [{ dealId: a.id, qty: 1 }], sell: [] }
    const p = prepareAction(state, { kind: 'bargain', target: cartBargainTarget('smithy', cart), text: '' })
    p.natural = 20
    resolveAction(state, null)
    const big: Cart = { buy: [{ dealId: a.id, qty: 3 }, { dealId: b.id, qty: 2 }], sell: [{ name: '狼皮', qty: 3 }] }
    const q = cartQuote(state, 'smithy', big)
    const money = state.money_cc
    const r = checkoutCart(state, 'smithy', big)
    expect(state.money_cc).toBe(money - q.listNet)
    expect(r.outcome.summary).toContain('照原價')
  })
})
