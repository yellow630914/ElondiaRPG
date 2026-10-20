import { describe, expect, it } from 'vitest'
import { itemRules } from '@/engine/data'
import { enchantPoints, gearName, gearPrice, gearRules, gearStats, generateLoadout, startingGear } from '@/engine/gear'
import { Rng } from '@/engine/rng'

describe('gear', () => {
  it('lists every base × material of the same kind in the catalog', () => {
    const items = itemRules.items
    const names = new Set(items.filter((i) => i.gear).map((i) => i.name))
    for (const [base, b] of Object.entries(gearRules.bases)) {
      for (const [material, m] of Object.entries(gearRules.materials)) {
        if (m.kind !== b.kind) continue
        const name = gearName({ base, material })
        expect(names.has(name), name).toBe(true)
        const def = items.find((i) => i.name === name)!
        expect(def.gear).toEqual({ base, material })
        expect(def.price_cc).toBe(gearPrice({ base, material }))
      }
    }
  })

  it('scales stats with the material and keeps chain cheaper than plate', () => {
    const iron = gearStats({ base: 'longsword', material: 'iron' })
    const mithril = gearStats({ base: 'longsword', material: 'mithril' })
    expect(iron.weapon).toBe('longsword')
    expect(mithril.mods.hit ?? 0).toBeGreaterThan(iron.mods.hit ?? 0)
    expect(gearPrice({ base: 'chain', material: 'iron' })).toBeLessThan(gearPrice({ base: 'plate', material: 'iron' }))
    expect(gearName({ base: 'boots', material: 'leather' })).toBe('皮靴')
    expect(gearName({ base: 'boots', material: 'dragonhide' })).toBe('龍皮靴')
    expect(gearName({ base: 'plate', material: 'adamantine' })).toBe('精金板甲')
  })

  it('counts enchant points from the cost table', () => {
    expect(enchantPoints({ mods: { hit: 1, ap_regen: 1 } })).toBe(3)
    expect(enchantPoints({ resist: { fire: -0.25 }, offense: { cold: 0.5 } })).toBe(3)
    expect(enchantPoints({ mods: { threat: -0.2 } })).toBe(2)
  })

  it('starts classes with first-tier gear', () => {
    const g = startingGear('fighter')
    expect(g.main_hand?.name).toBe('鐵長劍')
    for (const e of Object.values(g)) expect(gearRules.materials[e!.spec.material]!.tier).toBe(1)
  })

  it('generates loadouts whose materials never exceed the level', () => {
    for (const level of [1, 3, 7, 12]) {
      for (let seed = 1; seed <= 40; seed++) {
        const out = generateLoadout('fighter', level, new Rng(seed))
        expect(out.main_hand).toBeDefined()
        for (const e of Object.values(out)) expect(gearRules.materials[e!.spec.material]!.level).toBeLessThanOrEqual(level)
        if (out.main_hand && gearRules.bases[out.main_hand.spec.base]!.two_handed) expect(out.off_hand).toBeUndefined()
      }
    }
    // 高等級的冒險者穿得比較多
    const count = (level: number) => {
      let n = 0
      for (let seed = 1; seed <= 60; seed++) n += Object.keys(generateLoadout('rogue', level, new Rng(seed))).length
      return n
    }
    expect(count(10)).toBeGreaterThan(count(1))
  })
})
