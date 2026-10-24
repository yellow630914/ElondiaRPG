import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { craftPlan, makeTarget } from '@/engine/craft'
import { crafterRefusal, gainCraftXp, isShopStaff, keeperCraftLevel, skillOf, toolAccess } from '@/engine/crafting'
import { craftRules } from '@/engine/data'
import { gearSpecOf } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { addItem, newGame, withRng } from '@/engine/state'
import { setAffinity } from '@/engine/social'
import { dismiss } from '@/engine/town'
import { locationMult } from '@/engine/trade'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 20000
  return state
}

const pc = (state: GameState) => state.party[0]!

function companion(state: GameState, bond: 'hired' | 'voluntary' | 'slave', affinity = 50) {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 3, kind: 'adventurer', location: state.location }))
  const m = joinParty(state, rec, bond)
  setAffinity(state, m.id, affinity)
  return m
}

describe('craft skills', () => {
  it('starts every craft at level 1 and levels up with experience', () => {
    const state = game()
    expect(skillOf(pc(state), 'smithing')).toEqual({ level: 1, xp: 0 })
    expect(gainCraftXp(pc(state), 'smithing', 5)).toBeUndefined()
    expect(gainCraftXp(pc(state), 'smithing', 3)).toBe(2)
    expect(skillOf(pc(state), 'smithing')).toEqual({ level: 2, xp: 2 })
    // 一次跳好幾級，滿級後不再累積
    gainCraftXp(pc(state), 'smithing', 1000)
    expect(skillOf(pc(state), 'smithing')).toEqual({ level: craftRules.max_level, xp: 0 })
  })
})

describe('tools', () => {
  it('needs a kit anywhere, a workshop for tier 3: unpacked at an inn or rented at the shop', () => {
    const state = game()
    state.inventory = []
    expect(toolAccess(state, 'smithing').tier).toBe(0)
    addItem(state.inventory, '隨身鍛造工具', 1)
    expect(toolAccess(state, 'smithing')).toMatchObject({ tier: 1, source: '隨身鍛造工具' })
    addItem(state.inventory, '攜帶式鍛爐', 1)
    // 在路上展開不了，只能當隨身工具用
    expect(toolAccess(state, 'smithing').tier).toBe(1)
    standOn(state, 'inn')
    expect(toolAccess(state, 'smithing')).toMatchObject({ tier: 2, source: '展開攜帶式鍛爐' })
    // 在鐵匠鋪：沒有自己的工坊時可以租
    state.inventory = []
    standOn(state, 'smithy')
    expect(toolAccess(state, 'smithing')).toMatchObject({ tier: 2, rentPerHour: craftRules.workshop_rent.per_hour_cc })
    expect(toolAccess(state, 'jewelcraft').tier).toBe(0)
  })
})

describe('making it yourself', () => {
  it('checks level, tools and materials; tier 1 material is bought', () => {
    const state = game()
    state.inventory = []
    expect(craftPlan(state, 'longsword', 'iron', [], pc(state)).blocked).toContain('低階')
    addItem(state.inventory, '隨身鍛造工具', 1)
    const iron = craftPlan(state, 'longsword', 'iron', [], pc(state))
    expect(iron.blocked).toBeUndefined()
    expect(iron.materialCost).toBeGreaterThan(0)
    expect(iron.fee).toBe(iron.materialCost)
    expect(craftPlan(state, 'longsword', 'steel', [], pc(state)).blocked).toContain('只有 Lv.1')
    pc(state).crafts = { smithing: { level: 3, xp: 0 } }
    addItem(state.inventory, '精鋼錠', 2)
    expect(craftPlan(state, 'longsword', 'steel', [], pc(state)).blocked).toBeUndefined()
    addItem(state.inventory, '秘銀礦石', 2)
    expect(craftPlan(state, 'longsword', 'mithril', [], pc(state)).blocked).toContain('中階')
    standOn(state, 'smithy')
    const rented = craftPlan(state, 'longsword', 'mithril', [], pc(state))
    expect(rented.blocked).toBeUndefined()
    expect(rented.rent).toBe(craftRules.workshop_rent.per_hour_cc * craftRules.self.hours)
    // 自己的隨身工具就夠用的材料：站在店裡也不收租金
    const own = craftPlan(state, 'longsword', 'steel', [], pc(state))
    expect(own.rent).toBe(0)
    expect(own.tool?.source).toBe('隨身鍛造工具')
  })

  it('lists every reason at once and says where to get the tool', () => {
    const state = game()
    state.inventory = []
    state.money_cc = 0
    const plan = craftPlan(state, 'longsword', 'mithril', [], pc(state))
    expect(plan.blockers.length).toBeGreaterThanOrEqual(3)
    expect(plan.blockers.some((b) => b.includes('只有 Lv.1'))).toBe(true)
    expect(plan.blockers.some((b) => b.includes('到鐵匠鋪租用工坊'))).toBe(true)
    expect(plan.blockers.some((b) => b.includes('打造材料不夠'))).toBe(true)
  })

  it('crafts a piece, pays the material and gives craft experience', () => {
    const state = game()
    addItem(state.inventory, '隨身鍛造工具', 1)
    const plan = craftPlan(state, 'longsword', 'iron', [], pc(state))
    const money = state.money_cc
    prepareAction(state, { kind: 'make', target: makeTarget('pc', 'longsword', 'iron'), text: '' })
    expect(state.pendingAction!.situational).toContainEqual({ label: '艾倫的鍛造（Lv.1）', value: 1 })
    state.pendingAction!.natural = 20
    const r = resolveAction(state, null)
    valid(r)
    expect(r.check?.degree).toBe('critical')
    expect(state.money_cc).toBe(money - plan.fee)
    const made = r.changes.items_gained!.find((i) => gearSpecOf(state, i.name))!
    expect(gearSpecOf(state, made.name)).toMatchObject({ base: 'longsword', material: 'iron' })
    expect(r.changes.craft_xp).toEqual([{ actor: 'pc', craft: 'smithing', amount: 3 }])
    expect(skillOf(pc(state), 'smithing').xp).toBe(3)
  })

  it('lets willing companions and slaves craft with their own stats, but not hired hands', () => {
    const state = game()
    addItem(state.inventory, '製革工具組', 1)
    const hired = companion(state, 'hired')
    expect(crafterRefusal(state, hired)).toContain('雇傭')
    expect(() => prepareAction(state, { kind: 'make', target: makeTarget(hired.id, 'leather_armor', 'leather'), text: '' })).toThrow('不肯動手')
    const friend = companion(state, 'voluntary', 10)
    expect(crafterRefusal(state, friend)).toContain('親密度')
    setAffinity(state, friend.id, 40)
    expect(crafterRefusal(state, friend)).toBeUndefined()
    friend.crafts = { leatherwork: { level: 2, xp: 0 } }
    friend.attrs.dex = 18
    pc(state).attrs.dex = 8
    const p = prepareAction(state, { kind: 'make', target: makeTarget(friend.id, 'leather_armor', 'leather'), text: '' })
    expect(p.actor).toBe(friend.id)
    expect(p.attr).toBe('dex')
    expect(p.modifiers.dex).toBeGreaterThan(2)
    expect(p.situational).toContainEqual({ label: `${friend.name}的製革（Lv.2）`, value: 2 })
    p.natural = 15
    const r = resolveAction(state, null)
    valid(r)
    expect(r.changes.craft_xp?.[0]?.actor).toBe(friend.id)
  })
})

describe('shopkeepers', () => {
  it('have craft levels by town size that limit and improve commissions', () => {
    const lv = keeperCraftLevel({ id: 'keeper_x_smithy' }, 'smithing', 'capital')
    expect(lv).toBeGreaterThanOrEqual(4)
    expect(keeperCraftLevel({ id: 'keeper_x_smithy' }, 'smithing', 'capital')).toBe(lv)
    expect(keeperCraftLevel({ id: 'k', crafts: { smithing: { level: 1, xp: 0 } } }, 'smithing', 'capital')).toBe(1)

    const state = game()
    standOn(state, 'smithy')
    state.npcs ??= {}
    state.npcs['keeper_soriel_smithy'] = { ...(state.npcs['keeper_soriel_smithy'] ?? { id: 'keeper_soriel_smithy', name: '鐵匠', race: 'human', class: '', level: 2, location: 'soriel', hire_cc: 0, personality: '' }), crafts: { smithing: { level: 2, xp: 0 } } }
    addItem(state.inventory, '秘銀礦石', 2)
    expect(craftPlan(state, 'longsword', 'mithril').blocked).toContain('工匠（鍛造 Lv.2）')
    state.npcs!['keeper_soriel_smithy']!.crafts = { smithing: { level: 5, xp: 0 } }
    const p = prepareAction(state, { kind: 'craft', target: 'dagger:iron', text: '' })
    expect(p.situational).toContainEqual({ label: '工匠的手藝（鍛造 Lv.5）', value: 4 })
  })

  it('cannot be invited away from the shop', () => {
    expect(isShopStaff({ id: 'keeper_soriel_smithy' })).toBe(true)
    expect(isShopStaff({ id: 'clerk_soriel' })).toBe(true)
    expect(isShopStaff({ id: 'gen-1' })).toBe(false)
  })
})

describe('dismissing someone right after they join', () => {
  it('hurts their affinity and raises prices in town for a while', () => {
    const state = game()
    const base = locationMult(state)
    const m = companion(state, 'hired', 20)
    const r = dismiss(state, m.id)
    valid(r)
    expect(r.outcome.tags).toContain('用完就丟')
    expect(r.changes.affinity?.[0]).toMatchObject({ npc: m.id, delta: craftRules.dismiss_penalty.affinity })
    expect(locationMult(state)).toBeCloseTo(base * craftRules.dismiss_penalty.price_mult)
    state.time.day += craftRules.dismiss_penalty.notoriety_days + 1
    expect(locationMult(state)).toBeCloseTo(base)

    // 一起冒險好幾天之後再遣散：沒有懲罰
    const later = companion(state, 'hired', 20)
    state.time.day += craftRules.dismiss_penalty.days + 1
    expect(dismiss(state, later.id).outcome.tags).not.toContain('用完就丟')
  })
})
