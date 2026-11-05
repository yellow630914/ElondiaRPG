import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { craftPlan, craftTarget, makeTarget, parseCraftTarget, shopOfferHere } from '@/engine/craft'
import { produceTarget, recipeOf, recipePlan } from '@/engine/recipes'
import { itemDef } from '@/engine/data'
import { baseType, forgeItemsForMaterial, gearRules, ordinaryBases } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { addItem, newGame } from '@/engine/state'
import { locationMult, sellPrice, shopKey, shopState } from '@/engine/trade'
import { craftRules } from '@/engine/data'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 20000
  state.inventory = []
  addItem(state.inventory, '隨身鍛造工具', 1)
  return state
}
const pc = (state: GameState) => state.party[0]!

describe('打造材料：第 1 級也是物品，來源可以選、可以當場補買', () => {
  it('has items for every tier-1 material, sold in shops', () => {
    for (const [id, m] of Object.entries(gearRules.materials).filter(([, x]) => x.tier === 1)) {
      const items = forgeItemsForMaterial(id)
      expect(items.length, id).toBeGreaterThan(0)
      expect(items.some((n) => itemDef(n)!.tags.length), `${id} 要有店在賣`).toBe(true)
    }
  })

  it('still charges a material fee for tier 1 by the base price, so a plate is not nearly free', () => {
    const state = game()
    standOn(state, 'smithy')
    addItem(state.inventory, '鐵礦石', 3)
    const plan = craftPlan(state, 'plate', 'iron', [], pc(state))
    const full = Math.round(gearRules.bases.plate!.price * craftRules.self.tier1_cost_ratio * locationMult(state))
    expect(plan.materialCost).toBe(full - itemDef('鐵礦石')!.price_cc * 3)
    expect(plan.fee).toBe((plan.rent ?? 0) + plan.materialCost!)
    // 做出來的普通鐵板甲賣不回成本
    expect(sellPrice(state, shopKey(state, 'smithy'), '鐵板甲')!).toBeLessThan(plan.fee + 1)
    // 委託不收材料費（工錢已經照底材價格）
    expect(craftPlan(state, 'plate', 'iron').materialCost).toBeUndefined()
  })

  it('keeps the options in the target and reads old targets', () => {
    const t = craftTarget('longsword', 'steel', [{ name: '火蜥鱗片', qty: 1 }], { use: '精鋼錠', buy: true })
    expect(t).toBe('longsword:steel|火蜥鱗片*1|!use=精鋼錠|!buy')
    expect(parseCraftTarget(t)).toEqual({ base: 'longsword', material: 'steel', aux: [{ name: '火蜥鱗片', qty: 1 }], opts: { use: '精鋼錠', buy: true } })
    expect(parseCraftTarget('longsword:steel').opts).toEqual({})
  })

  it('uses the chosen item first, otherwise the cheapest', () => {
    const state = game()
    pc(state).crafts = { smithing: { level: 2, xp: 0 } }
    addItem(state.inventory, '精鋼錠', 2)
    addItem(state.inventory, '黑鐵礦石', 2)
    expect(craftPlan(state, 'longsword', 'steel', [], pc(state)).uses).toEqual([{ name: '黑鐵礦石', qty: 2 }])
    expect(craftPlan(state, 'longsword', 'steel', [], pc(state), { use: '精鋼錠' }).uses).toEqual([{ name: '精鋼錠', qty: 2 }])
  })

  it('commissions still get tier-1 material from the smith', () => {
    const state = game()
    standOn(state, 'smithy')
    const plan = craftPlan(state, 'longsword', 'iron')
    expect(plan.units).toBe(0)
    expect(plan.blocked).toBeUndefined()
  })

  it('buys what is missing at the shop where you stand, pays and takes it from the stock', () => {
    const state = game()
    standOn(state, 'smithy')
    expect(shopOfferHere(state, '鐵礦石')).toBeUndefined()
    const shop = shopState(state, 'smithy')
    const deal = shop.deals.find((d) => d.id === 'item:鐵礦石')!
    deal.stock = 5
    addItem(state.inventory, '鐵礦石', 1)
    const without = craftPlan(state, 'longsword', 'iron', [], pc(state))
    expect(without.blocked).toContain('可以當場補買')
    const plan = craftPlan(state, 'longsword', 'iron', [], pc(state), { buy: true })
    expect(plan.blocked).toBeUndefined()
    expect(plan.buys).toEqual([{ name: '鐵礦石', qty: 1, price: plan.sources.find((x) => x.name === '鐵礦石')!.price }])
    expect(plan.uses).toEqual([{ name: '鐵礦石', qty: 2 }])
    const money = state.money_cc
    prepareAction(state, { kind: 'make', target: makeTarget('pc', 'longsword', 'iron', [], { buy: true }), text: '' })
    state.pendingAction!.natural = 15
    resolveAction(state, null)
    expect(state.money_cc).toBe(money - plan.buyCost - plan.fee)
    expect(state.inventory.some((i) => i.name === '鐵礦石')).toBe(false)
    expect(state.shops![shopKey(state, 'smithy')]!.deals.find((d) => d.id === 'item:鐵礦石')!.stock).toBe(4)
  })

  it('gives every craftable base a type', () => {
    const types = new Set(ordinaryBases().map(baseType))
    expect(types.has('刀劍')).toBe(true)
    expect(types.has('盾')).toBe(true)
    expect(baseType('boots')).toBe('皮革衣物')
    expect(baseType('plate')).toBe('金屬護甲')
    expect([...types].filter((t) => t.startsWith('其他'))).toEqual([])
  })

  it('buys missing recipe ingredients at the shop too', () => {
    const state = game()
    addItem(state.inventory, '煉金工具組', 1)
    standOn(state, 'shop')
    const deal = shopState(state, 'general').deals.find((d) => d.id === 'item:藥草')!
    deal.stock = 5
    const need = recipeOf('微弱治療藥劑')!.inputs.find((x) => x.name === '藥草')!.qty
    addItem(state.inventory, '藥草', need - 1)
    expect(recipePlan(state, '微弱治療藥劑', 1, pc(state)).blocked).toContain('可以當場補買')
    const plan = recipePlan(state, '微弱治療藥劑', 1, pc(state), { buy: true })
    expect(plan.blocked).toBeUndefined()
    expect(plan.buys.map((b) => [b.name, b.qty])).toEqual([['藥草', 1]])
    expect(plan.buyCost).toBeGreaterThan(0)
    const money = state.money_cc
    prepareAction(state, { kind: 'produce', target: produceTarget('pc', '微弱治療藥劑', 1, { buy: true }), text: '' })
    state.pendingAction!.natural = 15
    resolveAction(state, null)
    expect(state.money_cc).toBe(money - plan.fee - plan.buyCost)
    expect(state.inventory.some((i) => i.name === '藥草')).toBe(false)
    expect(state.inventory.some((i) => i.name === '微弱治療藥劑')).toBe(true)
    expect(deal.stock).toBe(4)
  })
})
