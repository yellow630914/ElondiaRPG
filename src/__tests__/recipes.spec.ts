import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { CRAFT_IDS, skillOf, toolAccess } from '@/engine/crafting'
import { craftRules, itemDef, itemRules } from '@/engine/data'
import { cropStatus, harvest, plant, plotPlace, seedsFor, uproot } from '@/engine/garden'
import { enterLocation, getArea, placeAt, standOn, type Area } from '@/engine/grid'
import { buyHome, lotsOf, placeFurniture, takeFurniture } from '@/engine/homes'
import { sanitizeItem } from '@/engine/mods'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { lostQty, producedQty, produceTarget, recipeItems, recipePlan } from '@/engine/recipes'
import { setAffinity } from '@/engine/social'
import { addHours, addItem, newGame, withRng } from '@/engine/state'
import { locationMult } from '@/engine/trade'
import type { GameState, Home, Report } from '@/engine/types'
import { itemUsage } from '@/engine/usage'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 100000
  state.inventory = []
  return state
}

const pc = (state: GameState) => state.party[0]!
const qty = (state: GameState, name: string) => state.inventory.find((i) => i.name === name)?.qty ?? 0

function bought(state: GameState): Home {
  buyHome(state, lotsOf(state.location)[0]!.id)
  return Object.values(state.homes!)[0]!
}

function cellOf(area: Area, test: (c: Area['cells'][number]) => boolean) {
  const i = area.cells.findIndex(test)
  expect(i).toBeGreaterThanOrEqual(0)
  return { x: i % area.width, y: Math.floor(i / area.width) }
}

describe('recipe data', () => {
  it('uses existing items and never turns a profit when resold', () => {
    const sell = (name: string) => {
      const d = itemDef(name)!
      return d.price_cc * (d.category === 'material' ? itemRules.material_sell_ratio : itemRules.sell_ratio)
    }
    expect(recipeItems().length).toBeGreaterThan(30)
    for (const { name, recipe } of recipeItems()) {
      for (const x of recipe.inputs) expect(itemDef(x.name), `${name} ← ${x.name}`).toBeDefined()
      const input = recipe.inputs.reduce((s, x) => s + itemDef(x.name)!.price_cc * x.qty, 0) + (recipe.cost_cc ?? 0)
      expect(input, name).toBeGreaterThanOrEqual(sell(name) * (recipe.qty ?? 1))
      expect(recipe.level).toBeGreaterThanOrEqual(1)
      expect(recipe.level).toBeLessThanOrEqual(craftRules.max_level)
    }
  })

  it('has kits, portable workshops and a home workbench for every craft', () => {
    for (const id of CRAFT_IDS) {
      for (const tier of [1, 2]) expect(itemRules.items.some((i) => i.tool?.kind === 'craft' && i.tool.craft === id && i.tool.tier === tier), `${id} tier ${tier}`).toBe(true)
      expect(itemRules.items.some((i) => i.furniture?.function === 'workbench' && i.furniture.craft === id), id).toBe(true)
    }
    // 工作台的配方不需要高階工具（不然要先有工作台才做得出工作台）
    for (const i of itemRules.items.filter((x) => x.furniture?.function === 'workbench' && x.recipe)) expect(i.recipe!.level, i.name).toBeLessThanOrEqual(3)
  })

  it('has seeds whose crops exist and a plot for every place they grow', () => {
    const seeds = itemRules.items.filter((i) => i.seed)
    expect(seeds.length).toBeGreaterThanOrEqual(4)
    for (const s of seeds) {
      for (const y of s.seed!.yields) expect(itemDef(y), `${s.name} → ${y}`).toBeDefined()
      expect(itemRules.items.some((i) => i.furniture?.function === 'garden' && i.furniture.places.includes(s.seed!.place)), s.name).toBe(true)
    }
  })
})

describe('recipe plans', () => {
  it('checks level, tools, materials and money, multiplied by batches', () => {
    const state = game()
    expect(recipePlan(state, '微弱治療藥劑', 1, pc(state)).blocked).toContain('低階')
    addItem(state.inventory, '煉金工具組', 1)
    expect(recipePlan(state, '微弱治療藥劑', 1, pc(state)).blocked).toContain('藥草不夠')
    addItem(state.inventory, '藥草', 9)
    const plan = recipePlan(state, '微弱治療藥劑', 3, pc(state))
    expect(plan.blocked).toBeUndefined()
    expect(plan.inputs).toEqual([{ name: '藥草', need: 9, have: 9 }])
    expect(plan.cost).toBe(Math.round(140 * 3 * locationMult(state)))
    expect(plan.hours).toBe(6)
    expect(plan.dc).toBe(craftRules.recipe.dc[0])
    expect(recipePlan(state, '微弱治療藥劑', 99, pc(state)).batches).toBe(craftRules.recipe.max_batches)
    expect(recipePlan(state, '治療藥劑', 1, pc(state)).blocked).toContain('Lv.1')
    state.money_cc = 0
    expect(recipePlan(state, '微弱治療藥劑', 1, pc(state)).blocked).toContain('費用不夠')
  })

  it('rents the shop workshop for middle-tier recipes', () => {
    const state = game()
    pc(state).crafts = { alchemy: { level: 3, xp: 0 } }
    addItem(state.inventory, '藥草', 4)
    addItem(state.inventory, '光泉水', 1)
    expect(recipePlan(state, '治療藥劑', 1, pc(state)).blocked).toContain('中階')
    standOn(state, 'magic')
    const plan = recipePlan(state, '治療藥劑', 1, pc(state))
    expect(plan.blocked).toBeUndefined()
    expect(plan.rent).toBe(craftRules.workshop_rent.per_hour_cc * 3)
  })

  it('scales the output and losses by degree', () => {
    expect(producedQty(2, 'critical')).toBe(3)
    expect(producedQty(1, 'critical')).toBe(2)
    expect(producedQty(4, 'success')).toBe(4)
    expect(producedQty(3, 'partial')).toBe(2)
    expect(producedQty(3, 'fail')).toBe(0)
    expect(lostQty(5, 'fail')).toBe(3)
    expect(lostQty(5, 'fumble')).toBe(5)
    expect(lostQty(5, 'partial')).toBe(5)
  })
})

describe('producing', () => {
  it('makes the item, uses the materials and money, and gives craft experience', () => {
    const state = game()
    addItem(state.inventory, '炊具組', 1)
    addItem(state.inventory, '野莓', 6)
    pc(state).attrs.dex = 10
    prepareAction(state, { kind: 'produce', target: produceTarget('pc', '野莓派', 2), text: '' })
    expect(state.pendingAction!.attr).toBe(craftRules.skills.cooking.attr)
    expect(state.pendingAction!.hours).toBe(2)
    state.pendingAction!.natural = 8
    const r = resolveAction(state, null)
    valid(r)
    expect(r.check?.degree).toBe('success')
    expect(qty(state, '野莓派')).toBe(4)
    expect(qty(state, '野莓')).toBe(0)
    expect(r.changes.craft_xp).toEqual([{ actor: 'pc', craft: 'cooking', amount: 2 }])
    expect(skillOf(pc(state), 'cooking').xp).toBe(2)
  })

  it('loses half the materials on a failure and still pays the cost', () => {
    const state = game()
    addItem(state.inventory, '煉金工具組', 1)
    addItem(state.inventory, '藥草', 6)
    const money = state.money_cc
    const plan = recipePlan(state, '微弱治療藥劑', 2, pc(state))
    prepareAction(state, { kind: 'produce', target: produceTarget('pc', '微弱治療藥劑', 2), text: '' })
    state.pendingAction!.natural = 2
    pc(state).attrs.int = 8
    const r = resolveAction(state, null)
    valid(r)
    expect(r.check?.degree).toBe('fail')
    expect(qty(state, '微弱治療藥劑')).toBe(0)
    expect(qty(state, '藥草')).toBe(3)
    expect(state.money_cc).toBe(money - plan.fee)
  })

  it('lets a willing companion cook with their own skill', () => {
    const state = game()
    addItem(state.inventory, '炊具組', 1)
    addItem(state.inventory, '生肉', 2)
    addItem(state.inventory, '藥草', 1)
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 3, kind: 'adventurer', location: state.location }))
    const m = joinParty(state, rec, 'voluntary')
    setAffinity(state, m.id, 40)
    m.crafts = { cooking: { level: 2, xp: 0 } }
    expect(recipePlan(state, '獵人燉肉', 1, pc(state)).blocked).toContain('Lv.1')
    const p = prepareAction(state, { kind: 'produce', target: produceTarget(m.id, '獵人燉肉'), text: '' })
    expect(p.actor).toBe(m.id)
    expect(p.situational).toContainEqual({ label: `${m.name}的烹飪（Lv.2）`, value: 2 })
    p.natural = 20
    const r = resolveAction(state, null)
    valid(r)
    expect(qty(state, '獵人燉肉')).toBe(3)
    expect(r.changes.craft_xp?.[0]?.actor).toBe(m.id)
  })

  it('needs the home workbench for high-level recipes', () => {
    const state = game()
    const home = bought(state)
    const ground = home.areas[home.floors.find((k) => home.areas[k]!.homeFloor === 'ground')!]!
    pc(state).crafts = { alchemy: { level: 4, xp: 0 } }
    addItem(state.inventory, '月光晶片', 1)
    addItem(state.inventory, '熒光苔蘚', 2)
    addItem(state.inventory, '攜帶式煉金台', 1)
    const spot = cellOf(ground, (c) => c.kind === 'floor')
    placeAt(state, ground, spot.x, spot.y)
    expect(recipePlan(state, '法力恢復藥劑', 1, pc(state)).blocked).toContain('高階')
    addItem(state.inventory, '煉金實驗室', 1)
    placeFurniture(state, ground, spot.x, spot.y, '煉金實驗室')
    expect(toolAccess(state, 'alchemy').tier).toBe(3)
    expect(recipePlan(state, '法力恢復藥劑', 1, pc(state)).blocked).toBeUndefined()
  })
})

describe('gardening', () => {
  it('plants seeds on matching plots and harvests them when ripe', () => {
    const state = game()
    const home = bought(state)
    const ground = home.areas[home.floors.find((k) => home.areas[k]!.homeFloor === 'ground')!]!
    const basement = Object.values(home.areas).find((a) => a.homeFloor === 'basement')!
    const yard = cellOf(ground, (c) => c.kind === 'yard')
    addItem(state.inventory, '菜圃', 1)
    addItem(state.inventory, '菇床', 1)
    expect(() => placeFurniture(state, ground, yard.x, yard.y, '菇床')).toThrow('只能放在地下室')
    placeFurniture(state, ground, yard.x, yard.y, '菜圃')
    const plot = ground.cells[yard.y * ground.width + yard.x]!
    expect(plotPlace(ground, plot)).toBe('yard')
    addItem(state.inventory, '藥草種子', 2)
    addItem(state.inventory, '菇菌孢子', 1)
    expect(seedsFor(state, ground, plot).map((s) => s.name)).toEqual(['藥草種子'])
    expect(() => plant(state, ground, yard.x, yard.y, '菇菌孢子')).toThrow('菇床')
    plant(state, ground, yard.x, yard.y, '藥草種子')
    expect(qty(state, '藥草種子')).toBe(1)
    expect(() => plant(state, ground, yard.x, yard.y, '藥草種子')).toThrow('已經種了')
    expect(() => takeFurniture(state, ground, yard.x, yard.y)).toThrow('還種著')
    expect(cropStatus(state, plot)).toMatchObject({ ready: false, hoursLeft: 96 })
    expect(() => harvest(state, ground, yard.x, yard.y)).toThrow('96 小時')
    state.time = addHours(state.time, 96)
    expect(cropStatus(state, plot)?.ready).toBe(true)
    const r = harvest(state, ground, yard.x, yard.y)
    valid(r)
    const got = qty(state, '藥草')
    expect(got).toBeGreaterThanOrEqual(2)
    expect(got).toBeLessThanOrEqual(3)
    expect(plot.crop).toBeUndefined()

    // 地下室的菇床；拔掉不退種子
    const floor = cellOf(basement, (c) => c.kind === 'floor')
    placeFurniture(state, basement, floor.x, floor.y, '菇床')
    plant(state, basement, floor.x, floor.y, '菇菌孢子')
    uproot(state, basement, floor.x, floor.y)
    expect(basement.cells[floor.y * basement.width + floor.x]!.crop).toBeUndefined()
    expect(qty(state, '菇菌孢子')).toBe(0)
    expect(itemUsage('藥草種子', state)).toEqual(['目前存檔的行囊（×1）'])
  })

  it('only works on plots in your own house', () => {
    const state = game()
    const street = getArea(state, lotsOf(state.location)[0]!.area)
    expect(() => plant(state, street, 1, 1, '藥草種子')).toThrow('自己的房子')
  })
})

describe('content editor', () => {
  it('keeps recipes and seeds within limits', () => {
    const item = sanitizeItem('月光果醬', {
      category: 'food', price_cc: 20, tags: [],
      recipe: { craft: 'cooking', level: 9, inputs: [{ name: '野莓', qty: 2 }, { name: '野莓', qty: 1 }, { name: '月光果醬', qty: 1 }], qty: 3, hours: 0 },
    }, true)
    expect(item.recipe).toEqual({ craft: 'cooking', level: craftRules.max_level, inputs: [{ name: '野莓', qty: 3 }], qty: 3, hours: 1 })
    expect(sanitizeItem('壞配方', { category: 'food', price_cc: 1, tags: [], recipe: { craft: 'cooking', level: 1, inputs: [] } }, true).recipe).toBeUndefined()
    expect(sanitizeItem('劍', { category: 'equipment', price_cc: 1, tags: [], recipe: { craft: 'smithing', level: 1, inputs: [{ name: '鐵礦石', qty: 1 }] } }, true).recipe).toBeUndefined()
    const seed = sanitizeItem('月光種子', { category: 'material', price_cc: 5, tags: [], seed: { yields: ['野莓', '月光種子'], qty: [5, 2], days: 0, place: 'basement' } }, true)
    expect(seed.seed).toEqual({ yields: ['野莓'], qty: [2, 5], days: 1, place: 'basement' })
    expect(sanitizeItem('壞種子', { category: 'food', price_cc: 1, tags: [], seed: { yields: ['野莓'], qty: [1, 1], days: 1, place: 'yard' } }, true).seed).toBeUndefined()
  })

  it('reports items used as recipe materials', () => {
    expect(itemUsage('蟾蜍毒腺')).toContain('「解毒劑」的配方材料')
    expect(itemUsage('異界花瓣')).toContain('「變異種子」長出的作物')
  })
})
