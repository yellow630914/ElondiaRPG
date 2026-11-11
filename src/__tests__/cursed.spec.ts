import { describe, expect, it } from 'vitest'
import { itemDef, itemRules, lewdRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, unequipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { gearCheckModifiers } from '@/engine/perks'
import { cursedGearOf, cutLock, keysFor, parseUnbindTarget, stuckRestraint, uncurse, uncurseFee } from '@/engine/restraints'
import { cellAt, currentArea, move } from '@/engine/grid'
import { gearRules } from '@/engine/gear'
import { fusionCandidates } from '@/engine/fusion'
import { arriveAt } from './helpers/travel'
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

  it('神殿的「解開詛咒具」列出隊上每一件與價錢；淫器合煉不收詛咒具', () => {
    const state = game()
    const pc = pcOf(state)
    expect(cursedGearOf(state)).toEqual([])
    addItem(state.inventory, '壓制項圈', 2)
    equipItem(state, '壓制項圈', pc.id)
    const slot = slotOf(state, '壓制項圈')
    expect(cursedGearOf(state)).toEqual([{ member: pc.id, memberName: pc.name, slot, name: '壓制項圈', fee: lewdRules.unbind.uncurse!.fee_cc.rune }])
    standOn(state, 'adult_shop')
    expect(fusionCandidates(state).restraints).not.toContain('壓制項圈')
  })

  it('寶箱的詛咒具扣上來時，換下來的裝備放回行囊（寶箱裡還有別的東西也一樣）', () => {
    const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 3, gender: '女', body: 'fem' })
    enterLocation(state)
    arriveAt(state, 'snake_creek')
    const pc = pcOf(state)
    addItem(state.inventory, '姿勢項圈', 1)
    equipItem(state, '姿勢項圈', pc.id)
    const chests = gearRules.chests as unknown as Record<string, { items: [string, number][] } | string>
    const saved = Object.fromEntries(Object.entries(chests).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, (v as { items: [string, number][] }).items]))
    try {
      for (const k of Object.keys(saved)) (chests[k] as { items: [string, number][] }).items = [['壓制項圈', 1], ['治療藥劑', 1]]
      const area = currentArea(state)
      area.layer = 0
      let opened = false
      for (let i = 0; i < area.cells.length && !opened; i++) {
        if (area.cells[i]!.kind !== 'floor') continue
        const x = i % area.width, y = Math.floor(i / area.width)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (cellAt(area, x + dx, y + dy)?.kind !== 'floor') continue
          state.position = { area: area.key, x, y }
          area.cells[(y + dy) * area.width + x + dx] = { kind: 'chest', level: 3 } as never
          move(state, dx, dy)
          opened = true
          break
        }
      }
      expect(opened).toBe(true)
    } finally {
      for (const [k, v] of Object.entries(saved)) (chests[k] as { items: [string, number][] }).items = v
    }
    expect(pc.gear!.accessory?.name).toBe('壓制項圈')
    expect(state.inventory.find((i) => i.name === '姿勢項圈')?.qty).toBe(1)
    expect(state.inventory.find((i) => i.name === '治療藥劑')?.qty ?? 0).toBeGreaterThan(0)
  })
})
