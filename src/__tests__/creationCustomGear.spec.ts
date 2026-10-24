import { afterEach, describe, expect, it } from 'vitest'
import { creationCatalog, creationCost, creationGear, creationItemCost, gearRules } from '@/engine/gear'
import { applyContent, emptyMods, newBase, normalizeMods } from '@/engine/mods'
import { newGame } from '@/engine/state'

afterEach(() => applyContent(emptyMods()))

const SWORD = '老兵的佩劍'
function world() {
  const mods = emptyMods()
  mods.items[SWORD] = { name: SWORD, category: 'equipment', price_cc: 500, tags: [], custom: true, gear: { base: 'longsword', material: 'steel', rarity: 'rare', enchants: { mods: { hit: 1 } }, attrs: { str: 1 } } }
  mods.items['老兵的魔杖'] = { name: '老兵的魔杖', category: 'equipment', price_cc: 500, tags: [], custom: true, gear: { base: 'spellstaff', material: 'oak' } }
  mods.items['主人的項圈'] = { name: '主人的項圈', category: 'equipment', price_cc: 50, tags: [], custom: true, gear: { base: 'choker', material: 'linen' }, master_force: {} }
  mods.bases.b_axe = { ...newBase(), name: '戰斧' }
  applyContent(normalizeMods(mods))
}

describe('custom gear at character creation', () => {
  it('lists custom equipment the class can use, priced by tier, rarity and attributes', () => {
    world()
    const main = creationCatalog('fighter', 'human').find((s) => s.slot === 'main_hand')!
    const sword = main.options.find((o) => o.item === SWORD)!
    expect(sword).toMatchObject({ custom: true, base: 'longsword', tier: gearRules.materials.steel!.tier })
    // 鋼（2 級、普通）＋稀有（2 點）＋力量 +1
    expect(creationItemCost(SWORD)).toBe(2 + 2 + 1)
    expect(sword.cost).toBe(5)
    // 戰士不能拿法杖；主人強制裝備的東西不列
    expect(main.options.some((o) => o.item === '老兵的魔杖')).toBe(false)
    expect(creationCatalog('wizard', 'human').find((s) => s.slot === 'main_hand')!.options.some((o) => o.item === '老兵的魔杖')).toBe(true)
    expect(creationCatalog('fighter', 'human').some((s) => s.options.some((o) => o.item === '主人的項圈'))).toBe(false)
    // 自建的底材也能選（做成第 1～3 級材料）
    expect(main.options.filter((o) => o.base === 'b_axe' && !o.item).map((o) => o.tier)).toEqual([1, 2, 3])
  })

  it('equips the custom item as it is, and checks the budget', () => {
    world()
    const pick = { main_hand: { base: 'longsword', tier: 2, item: SWORD } }
    expect(creationCost('fighter', pick)).toBe(5)
    expect(() => creationGear('fighter', pick, 4)).toThrow('預算')
    const gear = creationGear('fighter', pick, 5)
    expect(gear.main_hand).toEqual({ name: SWORD, spec: { base: 'longsword', material: 'steel', rarity: 'rare', enchants: { mods: { hit: 1 } }, attrs: { str: 1 } } })
    expect(() => creationGear('fighter', { main_hand: { base: 'spellstaff', tier: 1, item: '老兵的魔杖' } }, 9)).toThrow('不能選')
    expect(() => creationGear('fighter', { accessory: { base: 'choker', tier: 1, item: '主人的項圈' } }, 9)).toThrow('不能當起始裝備')
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, gear: pick, gearBudget: 5 })
    expect(state.party[0]!.gear?.main_hand?.name).toBe(SWORD)
  })

  it('forgets custom gear when the world goes back to the built-in content', () => {
    world()
    applyContent(emptyMods())
    expect(creationCatalog('fighter', 'human').some((s) => s.options.some((o) => o.custom))).toBe(false)
    expect(() => creationGear('fighter', { main_hand: { base: 'longsword', tier: 2, item: SWORD } }, 9)).toThrow()
  })
})
