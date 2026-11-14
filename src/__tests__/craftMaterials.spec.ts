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
  // 舊存檔的角色（沒有工藝資料）算 Lv.1；新角色的 0 級規則在 crafting.spec 另外測
  delete state.party[0]!.crafts
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

  it('self-crafting with your own materials charges no material fee, iron or steel (only the workshop rent)', () => {
    const state = game()
    standOn(state, 'smithy')
    addItem(state.inventory, '鐵礦石', 3)
    const iron = craftPlan(state, 'plate', 'iron', [], pc(state))
    expect(iron.uses).toEqual([{ name: '鐵礦石', qty: 3 }])
    expect(iron.fee).toBe(iron.rent ?? 0)
    expect(iron.supplied).toBe(0)
    expect(iron.supplyCost).toBe(0)
  })

  it('a commission uses your materials first; the craftsman supplies only the missing units, for every tier', () => {
    const state = game()
    standOn(state, 'smithy')
    const wages = (m: string) => Math.round(gearRules.bases.plate!.price * gearRules.craft.fee[gearRules.materials[m]!.tier - 1]! * locationMult(state))
    const unit = Math.round(itemDef('鐵礦石')!.price_cc * locationMult(state))
    // 什麼都沒帶：3 份都由工匠代備
    const none = craftPlan(state, 'plate', 'iron')
    expect(none.units).toBe(3)
    expect(none.supplied).toBe(3)
    expect(none.supplyUnit).toBe(unit)
    expect(none.supplyCost).toBe(3 * unit)
    expect(none.fee).toBe(wages('iron'))
    // 帶了 2 份：只代備 1 份
    addItem(state.inventory, '鐵礦石', 2)
    const some = craftPlan(state, 'plate', 'iron')
    expect(some.uses).toEqual([{ name: '鐵礦石', qty: 2 }])
    expect(some.supplied).toBe(1)
    expect(some.supplyCost).toBe(unit)
    // 帶夠了：不收材料費
    addItem(state.inventory, '鐵礦石', 1)
    expect(craftPlan(state, 'plate', 'iron').supplyCost).toBe(0)
    // 第 2 級一樣：不再因為材料不夠擋住，改成代備
    const steel = craftPlan(state, 'plate', 'steel')
    expect(steel.supplied).toBe(3)
    expect(steel.blockers.some((b) => b.includes('打造材料不夠'))).toBe(false)
  })

  it('charges the supplied materials, and a failed commission loses only half of your own materials', () => {
    const state = game()
    standOn(state, 'smithy')
    state.money_cc = 1e6
    addItem(state.inventory, '鐵礦石', 2)
    const plan = craftPlan(state, 'plate', 'iron')
    prepareAction(state, { kind: 'craft', target: craftTarget('plate', 'iron'), text: '' })
    state.pendingAction!.natural = 1
    const r = resolveAction(state, null)
    expect(['fail', 'fumble']).toContain(r.check?.degree)
    expect(r.changes.money_cc).toBe(-(plan.fee + plan.supplyCost))
    const lost = r.changes.items_lost?.find((i) => i.name === '鐵礦石')?.qty ?? 0
    expect(lost).toBe(r.check?.degree === 'fail' ? 1 : 2)
    expect(r.outcome.summary).toContain('工匠代備 1 份材料')
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

  it('a commission with no materials is not blocked: the smith supplies them for a fee', () => {
    const state = game()
    standOn(state, 'smithy')
    const plan = craftPlan(state, 'longsword', 'iron')
    expect(plan.units).toBe(2)
    expect(plan.supplied).toBe(2)
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

  it('commission: tier 3+ is not supplied (bring it or buy it here); tier 1-2 can be fully supplied without using your own', () => {
    const state = game()
    standOn(state, 'smithy')
    state.money_cc = 1e6
    addItem(state.inventory, '鐵礦石', 3)
    const own = craftPlan(state, 'plate', 'iron')
    expect(own.supplied).toBe(0)
    expect(own.uses).toEqual([{ name: '鐵礦石', qty: 3 }])
    const all = craftPlan(state, 'plate', 'iron', [], undefined, { supplyAll: true })
    expect(all.uses).toEqual([])
    expect(all.supplied).toBe(3)
    expect(all.supplyAll).toBe(true)
    expect(all.blocked).toBeUndefined()
    expect(parseCraftTarget(craftTarget('plate', 'iron', [], { supplyAll: true })).opts.supplyAll).toBe(true)
    // 第 3 級以上：全部代備也不行
    expect(craftPlan(state, 'longsword', 'mithril', [], undefined, { supplyAll: true }).supplied).toBe(0)
    expect(craftPlan(state, 'longsword', 'mithril').blocked).toContain('第 2 級以下')
  })

  it('commission: tier 3+ materials the shop sells can be bought on the spot (gold at the jeweler)', () => {
    const state = game()
    standOn(state, 'jeweler')
    state.money_cc = 1e6
    shopState(state, 'jeweler')
    const base = Object.entries(gearRules.bases).find(([, b]) => b.kind === 'jewel')![0]
    const noBuy = craftPlan(state, base, 'gold')
    const offer = noBuy.sources.find((x) => x.price !== undefined)
    expect(offer, '珠寶店有賣金錠').toBeTruthy()
    expect(noBuy.blocked).toContain('可以當場補買')
    const plan = craftPlan(state, base, 'gold', [], undefined, { buy: true })
    expect(plan.buys.length).toBeGreaterThan(0)
    expect(plan.supplied).toBe(0)
    expect(plan.blocked).toBeUndefined()
  })
})
