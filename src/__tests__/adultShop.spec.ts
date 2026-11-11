import { describe, expect, it } from 'vitest'
import { BIND_KINDS, itemDef, itemRules, shopRules, specialMaps } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import { currentArea, currentCell, enterLocation, standOn } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { bindsOf } from '@/engine/schools'
import { addItem, newGame } from '@/engine/state'
import { shopState } from '@/engine/trade'
import type { GameState } from '@/engine/types'

function game(birthplace = 'albena', seed = 8): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed, birthplace })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const soldItems = (state: GameState, shop: Parameters<typeof shopState>[1]) =>
  shopState(state, shop).deals.flatMap((d) => d.gets.filter((g) => g.type === 'item').map((g) => (g as { name: string }).name))

describe('成人用品店（地下街）', () => {
  it('每條地下街都有一間，站得上去', () => {
    const uw = Object.entries(specialMaps).filter(([id]) => id.startsWith('sm_uw_'))
    expect(uw.length).toBeGreaterThan(10)
    for (const [, m] of uw) expect(m.shops).toEqual([{ shop: 'adult_shop', x: 4, y: 4 }])
    const state = game()
    expect(standOn(state, 'adult_shop')).toBe(true)
    expect(currentArea(state).key).toBe('sm/sm_uw_albena')
    expect(currentCell(state).kind).toBe('adult_shop')
  })

  it('只賣標了 adult_shop 的貨：拘束具一次上架好幾件，鎖也有，鑰匙不賣', () => {
    const state = game()
    const items = soldItems(state, 'adult_shop')
    for (const n of items) if (itemDef(n)) expect(itemDef(n)!.tags, n).toContain('adult_shop')
    const restraints = items.filter((n) => itemDef(n)?.gear && gearRules.bases[itemDef(n)!.gear!.base]?.restraint)
    expect(restraints.length).toBeGreaterThanOrEqual(shopRules.types.adult_shop!.restraints![0])
    expect(items).toContain('白鐵鎖')
    // 淫服訂製用的布料與皮也有賣（第 1、2 級）
    for (const n of ['亞麻布', '絲綢布匹', '鞣製皮革', '硬化獸皮']) expect(items, n).toContain(n)
    expect(items.some((n) => n.endsWith('鑰匙'))).toBe(false)
    for (const i of itemRules.items.filter((x) => x.key)) expect(i.tags, i.name).not.toContain('adult_shop')
  })

  it('原本的店只留基礎款；進階的只在成人用品店', () => {
    expect(itemDef('絲帶手銬')!.tags).toEqual(['tailor', 'adult_shop'])
    expect(itemDef('單手套')!.tags).toEqual(['adult_shop'])
    expect(itemDef('口球')!.tags).toEqual(['adult_shop'])
    expect(shopRules.types.magic!.restraints).toBeUndefined()
    for (const shop of ['tailor', 'smithy', 'jeweler', 'magic'] as const) {
      const tag = shopRules.types[shop]!.catalog_tag
      const sold = itemRules.items.filter((i) => i.tags.includes(tag) && i.gear && gearRules.bases[i.gear.base]?.restraint)
      for (const i of sold) expect(i.tags, i.name).toContain('adult_shop')
    }
  })

  it('每種拘束在成人用品店都買得到程度 1～3', () => {
    const m: Record<string, Set<number>> = {}
    for (const i of itemRules.items.filter((x) => x.tags.includes('adult_shop') && x.gear)) {
      const base = gearRules.bases[i.gear!.base]!
      if (!base.bind_kind) continue
      ;(m[base.bind_kind] ??= new Set()).add(i.gear!.bind ?? base.bind!)
    }
    for (const k of BIND_KINDS) expect([...m[k]!].sort(), k).toEqual([1, 2, 3])
  })

  it('鎖鏈自帶環：短鏈拘束比長鏈強；兩格額外飾品欄都能放拘束具', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '前手鏈・短', 1)
    equipItem(state, '前手鏈・短', pc.id)
    expect(bindsOf(pc)).toEqual([expect.objectContaining({ kind: 'hands', bind: 3 })])
    addItem(state.inventory, '腿環鏈・長', 1)
    addItem(state.inventory, '皮口銜', 1)
    equipItem(state, '腿環鏈・長', pc.id, 'extra_1')
    equipItem(state, '皮口銜', pc.id, 'extra_2')
    expect(pc.gear!.extra_2?.name).toBe('皮口銜')
    expect(bindsOf(pc).map((b) => `${b.kind}${b.bind}`).sort()).toEqual(['hands3', 'legs1', 'mouth1'])
  })
})
