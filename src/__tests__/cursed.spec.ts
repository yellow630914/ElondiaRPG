import { describe, expect, it } from 'vitest'
import { itemDef, itemRules, lewdRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, unequipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { gearCheckModifiers } from '@/engine/perks'
import { cutLock, keysFor, parseUnbindTarget, stuckRestraint, uncurse, uncurseFee } from '@/engine/restraints'
import { addItem, newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import { notForSale } from '@/engine/trade'
import { attrOf } from '@/engine/character'
import type { GameState, GearSlot } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 8, birthplace: 'rhineburg' })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const slotOf = (state: GameState, name: string) => (Object.keys(pcOf(state).gear!) as GearSlot[]).find((s) => pcOf(state).gear![s]?.name === name)!

describe('詛咒具', () => {
  it('自己戴上就被詛咒鎖住：卸不下、掙不開、鑰匙打不開、鐵匠剪不斷；神殿解咒後碎掉', () => {
    const state = game()
    const pc = pcOf(state)
    const str = attrOf(pc, 'str')
    addItem(state.inventory, '壓制項圈', 1)
    addItem(state.inventory, '黃金鑰匙', 1)
    const r = equipItem(state, '壓制項圈', pc.id)
    expect(r.outcome.summary).toContain('詛咒')
    const slot = slotOf(state, '壓制項圈')
    expect(pc.gear![slot]!.locked).toBe('curse:壓制項圈')
    expect(attrOf(pc, 'str')).toBe(str - 1)
    expect(stuckRestraint(pc, slot)).toMatchObject({ curse: true, lock: 'rune' })
    expect(() => unequipItem(state, pc.id, slot)).toThrow('神殿')
    expect(() => parseUnbindTarget(state, `${pc.id}:${slot}`)).toThrow('詛咒')
    expect(keysFor(state, pc, slot)).toEqual([])
    standOn(state, 'smithy')
    expect(() => cutLock(state, pc.id, slot)).toThrow('剪不斷')
    expect(standOn(state, 'temple')).toBe(true)
    const fee = uncurseFee(pc, slot)!
    expect(fee).toBe(lewdRules.unbind.uncurse!.fee_cc.rune)
    const money = state.money_cc
    uncurse(state, pc.id, slot)
    expect(pc.gear![slot]).toBeUndefined()
    expect(state.money_cc).toBe(money - fee)
    expect(state.inventory.some((i) => i.name === '壓制項圈')).toBe(false)
    expect(attrOf(pc, 'str')).toBe(str)
  })

  it('陷阱的 restrain 給詛咒具時也是詛咒鎖；檢定的減值寫成「詛咒」', () => {
    const state = game()
    const pc = pcOf(state)
    const report = baseReport(state, 'event', 0)
    const notes = applyEffects(state, report, [{ type: 'restrain', item: '吐真項圈' }])
    expect(notes.join('')).toContain('神殿')
    const slot = slotOf(state, '吐真項圈')
    expect(pc.gear![slot]!.locked).toBe('curse:吐真項圈')
    expect(gearCheckModifiers(pc, { context: 'action', skill: 'deceive' })).toEqual([{ label: '詛咒【吐真項圈】', value: -3 }])
  })

  it('不在商店賣，只有地下城寶箱、陷阱與事件', () => {
    const cursed = itemRules.items.filter((i) => i.gear?.curse)
    expect(cursed.length).toBe(13)
    for (const i of cursed) expect(notForSale(i), i.name).toBe(true)
    expect(itemDef('產卵肛塞')!.gear!.lock).toBe('rune')
  })
})
