import { describe, expect, it } from 'vitest'
import { registerGear, specTag } from '@/engine/gear'
import type { GearSpec } from '@/engine/types'

const headdress = (enchants?: GearSpec['enchants'], extra: Partial<GearSpec> = {}): GearSpec => ({
  base: 'maid_headdress', material: 'linen', rarity: 'uncommon', ...(enchants ? { enchants } : {}), ...extra,
})

describe('打造、掉落的裝備名字接上效果', () => {
  it('附魔不同的名字不同，附魔一樣的是同一件（疊在一起）', () => {
    const state: { customItems?: Record<string, never> } = {}
    const a = registerGear(state, headdress({ mods: { evade: 1 } }))
    const b = registerGear(state, headdress({ mods: { save: 1 } }))
    const c = registerGear(state, headdress({ mods: { evade: 1 } }))
    expect(a).toBe('優良亞麻女僕頭飾・迴避+1')
    expect(b).toBe('優良亞麻女僕頭飾・豁免+1')
    expect(c).toBe(a)
  })

  it('抗性、屬性攻擊、仇恨、慾望指標都寫數字', () => {
    expect(specTag(headdress({ mods: { hit: 1, threat: 0.1 }, resist: { fire: -0.25 }, offense: { cold: 0.5 } }))).toBe('命中+1、仇恨+10%、抗火焰25%、寒冰攻擊+50%')
    expect(specTag(headdress(undefined, { lewd: { lewdness: 4 } }))).toBe('淫亂+4')
    expect(specTag(headdress())).toBe('')
  })

  it('沒有附魔的照舊用原本的名字；有自己名字的只在撞名時才接效果', () => {
    const state: { customItems?: Record<string, never> } = {}
    expect(registerGear(state, headdress())).toBe('優良亞麻女僕頭飾')
    expect(registerGear(state, headdress({ mods: { evade: 1 } }), '月下的頭飾')).toBe('月下的頭飾')
    expect(registerGear(state, headdress({ mods: { save: 1 } }), '月下的頭飾')).toBe('月下的頭飾・豁免+1')
    // 效果一樣、其他地方不同（自帶的鎖）：才加編號
    expect(registerGear(state, headdress({ mods: { save: 1 } }, { lock: 'white' }), '月下的頭飾')).toBe('月下的頭飾・豁免+1（2）')
  })
})
