// 家具賣給雜貨店（玩家回報：家具是什麼商人在收）
import { describe, expect, it } from 'vitest'
import { itemDef, itemRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { sellPrice, shopKey } from '@/engine/trade'

describe('家具的收購', () => {
  it('雜貨店收家具，別的店不收', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'albena' })
    enterLocation(state)
    expect(sellPrice(state, shopKey(state, 'general'), '木板床')).toBeGreaterThan(0)
    expect(sellPrice(state, shopKey(state, 'smithy'), '木板床')).toBeNull()
  })

  it('依配方做家具來賣不會賺：材料與花費不低於基本的收購價', () => {
    const byName = new Map(itemRules.items.map((i) => [i.name, i]))
    for (const f of itemRules.items.filter((i) => i.category === 'furniture' && i.recipe)) {
      const r = f.recipe!
      const cost = r.inputs.reduce((s, x) => s + (itemDef(x.name)?.price_cc ?? byName.get(x.name)?.price_cc ?? 0) * x.qty, 0) + (r.cost_cc ?? 0)
      expect(cost, f.name).toBeGreaterThanOrEqual(Math.floor(f.price_cc * itemRules.sell_ratio) - 2)
    }
  })
})
