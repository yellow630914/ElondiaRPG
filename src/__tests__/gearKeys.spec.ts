import { describe, expect, it } from 'vitest'
import { registerGear } from '@/engine/gear'
import { hasItemKey, itemLabel, sameShape, specHash, stripItemKeys } from '@/engine/itemKey'
import { canonicalName } from '@/engine/script'
import { addItem, migrate, newGame, SAVE_SCHEMA } from '@/engine/state'
import type { GameState, GearSpec } from '@/engine/types'
import { withoutItemKeys } from '@/narrator/providers'

const headdress = (enchants?: GearSpec['enchants']): GearSpec => ({
  base: 'maid_headdress', material: 'linen', rarity: 'uncommon', ...(enchants ? { enchants } : {}),
})

describe('自訂裝備的鍵：名字＋看不見的屬性雜湊', () => {
  it('附魔不同：名字看起來一樣、鍵不同；附魔一樣：同一個鍵，疊在一起', () => {
    const state: Pick<GameState, 'customItems' | 'inventory'> = { inventory: [] }
    const a = registerGear(state, headdress({ mods: { evade: 1 } }))
    const b = registerGear(state, headdress({ mods: { save: 1 } }))
    const c = registerGear(state, headdress({ mods: { evade: 1 } }))
    expect(itemLabel(a)).toBe('優良亞麻女僕頭飾')
    expect(itemLabel(b)).toBe('優良亞麻女僕頭飾')
    expect(a).not.toBe(b)
    expect(c).toBe(a)
    expect(state.customItems![a]!.gear!.enchants!.mods!.evade).toBe(1)
    expect(state.customItems![b]!.gear!.enchants!.mods!.save).toBe(1)
    for (const n of [a, b, c]) addItem(state.inventory, n, 1)
    expect(state.inventory.map((i) => i.qty)).toEqual([2, 1])
  })

  it('制式品照舊用目錄的名字；有自己名字的也接雜湊，名字裡原本的雜湊不會疊兩層', () => {
    const state: Pick<GameState, 'customItems'> = {}
    expect(registerGear(state, { base: 'maid_headdress', material: 'linen' })).toBe('亞麻女僕頭飾')
    const named = registerGear(state, headdress({ mods: { hit: 1 } }), '月下的頭飾')
    expect(itemLabel(named)).toBe('月下的頭飾')
    expect(hasItemKey(named)).toBe(true)
    const fused = registerGear(state, headdress({ mods: { dr: 1 } }), `淫器・${named}`)
    expect(itemLabel(fused)).toBe('淫器・月下的頭飾')
    expect(fused.length - itemLabel(fused).length).toBe(named.length - itemLabel(named).length)
  })

  it('雜湊不看屬性寫的順序，看不見也不會被 trim 掉', () => {
    expect(specHash({ base: 'x', material: 'y' })).toBe(specHash({ material: 'y', base: 'x' }))
    expect(sameShape({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true)
    expect(specHash({ base: 'x' })).not.toBe(specHash({ base: 'y' }))
    const key = `名字${specHash({ base: 'x' })}`
    expect(key.trim()).toBe(key)
    expect(stripItemKeys(`拿到【${key}】和【${key}】`)).toBe('拿到【名字】和【名字】')
  })

  it('AI 寫顯示的名字（或簡體）時對回行囊裡的鍵', () => {
    const state: Pick<GameState, 'customItems'> = {}
    const a = registerGear(state, headdress({ mods: { evade: 1 } }))
    expect(canonicalName('優良亞麻女僕頭飾', ['亞麻女僕頭飾', a])).toBe(a)
    expect(canonicalName('优良亚麻女仆头饰', ['亞麻女僕頭飾', a])).toBe(a)
    expect(canonicalName('亞麻女僕頭飾', ['亞麻女僕頭飾', a])).toBe('亞麻女僕頭飾')
  })

  it('送給 AI 的提示詞拿掉雜湊', () => {
    const key = `優良亞麻女僕頭飾${specHash({ base: 'x' })}`
    const p = withoutItemKeys({ system: 'sys', user: `行囊：${key}×1`, sections: [{ key: 'inv', title: '行囊', part: 'user', text: key }] })
    expect(p.user).toBe('行囊：優良亞麻女僕頭飾×1')
    expect(p.sections![0]!.text).toBe('優良亞麻女僕頭飾')
    const plain = { system: 'a', user: 'b' }
    expect(withoutItemKeys(plain)).toBe(plain)
  })
})

describe('存檔格式 12：舊的自訂裝備換成新的鍵', () => {
  it('拿掉撞名的編號，行囊、身上、日誌的名字跟著改；屬性一樣的合成一疊', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4 })
    state.schema = 11
    const evade = headdress({ mods: { evade: 1 } })
    const save = headdress({ mods: { save: 1 } })
    state.customItems = {
      優良亞麻女僕頭飾: { category: 'equipment', price_cc: 30, gear: evade },
      '優良亞麻女僕頭飾（2）': { category: 'equipment', price_cc: 30, gear: save },
      '優良亞麻女僕頭飾（3）': { category: 'equipment', price_cc: 30, gear: { ...evade } },
    }
    state.inventory.push({ name: '優良亞麻女僕頭飾', qty: 1 }, { name: '優良亞麻女僕頭飾（2）', qty: 1 }, { name: '優良亞麻女僕頭飾（3）', qty: 1 })
    state.party[0]!.gear = { ...state.party[0]!.gear, head: { name: '優良亞麻女僕頭飾（2）', spec: save } }
    const fixed = migrate(state)
    expect(fixed.schema).toBe(SAVE_SCHEMA)
    const keys = Object.keys(fixed.customItems!)
    expect(keys).toHaveLength(2)
    expect(keys.map(itemLabel)).toEqual(['優良亞麻女僕頭飾', '優良亞麻女僕頭飾'])
    const evadeKey = keys.find((k) => fixed.customItems![k]!.gear!.enchants!.mods!.evade)!
    const saveKey = keys.find((k) => k !== evadeKey)!
    const mine = fixed.inventory.filter((i) => itemLabel(i.name) === '優良亞麻女僕頭飾')
    expect(mine).toEqual([{ name: evadeKey, qty: 2 }, { name: saveKey, qty: 1 }])
    expect(fixed.party[0]!.gear!.head!.name).toBe(saveKey)
  })
})
