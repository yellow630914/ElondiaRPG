import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { combatant, startCombat } from '@/engine/combat'
import { companionRules, describeCondition } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { useItem } from '@/engine/inventory'
import { applyContent, builtinCondition, conditionUsage, emptyMods, normalizeMods, sanitizeCondition, type ContentMods } from '@/engine/mods'
import { gainCondition } from '@/engine/party'
import { longRest } from '@/engine/rest'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { editableWorld } from './testWorld'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const mods = (patch: Partial<ContentMods>) => normalizeMods(JSON.parse(JSON.stringify({ ...emptyMods(), ...patch })))

function game() {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 9, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 5000
  return state
}

/** 沒有狀態時主角在戰鬥中的加減（裝備的） */
function combatantWithout(state: GameState) {
  const pc = state.party[0]!
  const saved = [...pc.status]
  pc.status = []
  startCombat(state, [['giant_rat', 1]])
  const m = { ...combatant(state.combat!, pc.id).baseMods }
  delete state.combat
  pc.status = saved
  return m
}

describe('non-combat condition content', () => {
  it('cleans up an edited condition and only accepts built-in ones', () => {
    const c = sanitizeCondition('fed_well', {
      name: '超長的名字一二三四五六七八', desc: '', check_penalty: -99, check_attrs: ['str', 'nope' as never],
      combat_mods: { hit: 9, evade: 'x' as unknown as number }, combat_temp_hp: 999,
      clears: 'long_rest', group: 'meal', rank: 99, stacks_to: 'slave_mark', replaces: ['fed_light', 'away', 'nope'],
    })
    expect(c).toEqual({
      name: '超長的名字一二三四五', desc: builtinCondition('fed_well')!.desc, check_penalty: -5, check_attrs: ['str'],
      combat_mods: { hit: 5 }, combat_temp_hp: 50, clears: 'long_rest', group: 'meal', rank: 9, replaces: ['fed_light'],
    })
    // 由規則加上與解除的狀態：解除時機、同組與疊加照內建的
    expect(sanitizeCondition('slave_mark', { name: '印記', desc: 'x', clears: 'long_rest', group: 'meal' })).toEqual({ name: '印記', desc: 'x' })
    expect(() => sanitizeCondition('nope', { name: 'x' })).toThrow()
    expect(normalizeMods({ conditions: { nope: { name: 'x' }, fed_well: { name: '飽' } } }).conditions).toEqual({ fed_well: expect.objectContaining({ name: '飽' }) })
  })

  it('applies an edited meal to food, combat and long rest, and restores it', () => {
    applyContent(mods({ conditions: { fed_well: { ...builtinCondition('fed_well')!, name: '吃很飽', combat_temp_hp: 20, combat_mods: { damage: 2 }, clears: undefined } } }))
    expect(companionRules.conditions.fed_well!.name).toBe('吃很飽')
    expect(describeCondition(companionRules.conditions.fed_well!)).toBe('每場戰鬥開始時暫時生命 20；戰鬥中武器傷害 +2')

    const state = game()
    addItem(state.inventory, '燉肉套餐', 1)
    useItem(state, '燉肉套餐', 'pc')
    expect(state.party[0]!.status).toContain('fed_well')
    const plain = combatantWithout(state).damage ?? 0
    startCombat(state, [['giant_rat', 1]])
    const me = combatant(state.combat!, state.party[0]!.id)
    expect(me.tempHp).toBe(20)
    expect(me.baseMods.damage).toBe(2 + plain)
    delete state.combat
    // 拿掉「長休解除」：長休後還在
    standOn(state, 'inn')
    longRest(state, 'inn')
    expect(state.party[0]!.status).toContain('fed_well')

    applyContent(emptyMods())
    expect(companionRules.conditions.fed_well!.name).toBe('飽足')
    expect(companionRules.conditions.fed_well!.combat_temp_hp).toBe(6)
  })

  it('does not loop forever when stacks_to forms a cycle', () => {
    applyContent(mods({ conditions: { tipsy: { ...builtinCondition('tipsy')!, stacks_to: 'cheered' } } }))
    const pc = game().party[0]!
    expect(gainCondition(pc, 'cheered')).toBe('cheered')
    expect(() => gainCondition(pc, 'cheered')).not.toThrow()
  })

  it('saves edits in the world and drops them when they match the built-in again', () => {
    const c = editableWorld()
    c.saveCondition('cheered', { ...builtinCondition('cheered')!, check_penalty: -2 })
    expect(c.mods.conditions.cheered!.check_penalty).toBe(-2)
    expect(companionRules.conditions.cheered!.check_penalty).toBe(-2)
    c.saveCondition('cheered', builtinCondition('cheered')!)
    expect(c.mods.conditions.cheered).toBeUndefined()
    c.saveCondition('cheered', { ...builtinCondition('cheered')!, name: '好心情' })
    c.restoreCondition('cheered')
    expect(companionRules.conditions.cheered!.name).toBe('興致高昂')
  })

  it('lists where a condition comes from', () => {
    const used = conditionUsage('fed_light')
    expect(used).toEqual(expect.arrayContaining(['酒館菜單「黑麵包」', '物品「乾糧」', '奴隸生活的事件']))
    expect(conditionUsage('blessed').some((u) => u.startsWith('地標') || u.startsWith('特殊任務'))).toBe(true)
  })
})
