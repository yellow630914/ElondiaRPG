import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { combatant, startCombat } from '@/engine/combat'
import { companionRules, describeCondition, stories } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { useItem } from '@/engine/inventory'
import { applyEffects } from '@/engine/effects'
import { applyContent, builtinCondition, conditionUsage, emptyMods, newCondition, normalizeMods, sanitizeCondition, type ContentMods } from '@/engine/mods'
import { newStory } from '@/engine/storyMods'
import { useGame } from '@/stores/game'
import { gainCondition } from '@/engine/party'
import { longRest } from '@/engine/rest'
import { addItem, newGame, pruneStatuses } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
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

  it('creates a custom condition that an event effect gives to the player', () => {
    const c = editableWorld()
    c.saveCondition('mod_cond_a1', { ...newCondition(), name: '聖光加護', check_penalty: -2, combat_temp_hp: 4 })
    expect(c.mods.conditions.mod_cond_a1!.custom).toBe(true)
    expect(companionRules.conditions.mod_cond_a1).toMatchObject({ name: '聖光加護', check_penalty: -2, combat_temp_hp: 4, clears: 'long_rest' })
    expect('custom' in companionRules.conditions.mod_cond_a1!).toBe(false)
    // 內建的 id 不能當自建的；自建的 id 要是 mod_cond_ 開頭
    expect(() => sanitizeCondition('fed_well', { name: 'x' }, true)).toThrow()
    expect(() => sanitizeCondition('my_cond', { name: 'x' }, true)).toThrow()

    // 特殊任務的效果可以選自建的狀態
    c.saveStory('mod_story_c1', { ...newStory('mod_story_c1'), rewards: [{ type: 'condition', target: 'pc', condition: 'mod_cond_a1', add: true }] })
    expect(stories.find((x) => x.id === 'mod_story_c1')!.rewards).toEqual([{ type: 'condition', target: 'pc', condition: 'mod_cond_a1', add: true }])
    expect(conditionUsage('mod_cond_a1')).toContain('特殊任務「新的特殊任務」')
    expect(() => c.deleteCondition('mod_cond_a1')).toThrow('還有地方用到')

    const state = game()
    const report = { schema_version: '0.1', report_id: 'r-1', kind: 'event', time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {} } as unknown as Report
    applyEffects(state, report, [{ type: 'condition', target: 'pc', condition: 'mod_cond_a1', add: true }])
    expect(state.party[0]!.status).toContain('mod_cond_a1')
    startCombat(state, [['giant_rat', 1]])
    expect(combatant(state.combat!, state.party[0]!.id).tempHp).toBe(4)
    delete state.combat
    standOn(state, 'inn')
    longRest(state, 'inn')
    expect(state.party[0]!.status).not.toContain('mod_cond_a1')

    // 拿掉引用之後可以刪；刪掉的自建狀態從存檔的角色身上拿掉
    c.deleteStory('mod_story_c1')
    useGame().state = state
    state.party[0]!.status.push('mod_cond_a1')
    expect(() => c.deleteCondition('mod_cond_a1')).toThrow('還有地方用到')
    state.party[0]!.status = state.party[0]!.status.filter((x) => x !== 'mod_cond_a1')
    c.deleteCondition('mod_cond_a1')
    expect(companionRules.conditions.mod_cond_a1).toBeUndefined()
    state.party[0]!.status.push('mod_cond_a1')
    pruneStatuses(state)
    expect(state.party[0]!.status).not.toContain('mod_cond_a1')
  })

  it('keeps references to custom conditions in the same package when reading it back', () => {
    const m = mods({
      conditions: {
        mod_cond_x: { ...newCondition(), name: '甲', stacks_to: 'mod_cond_y' },
        mod_cond_y: { ...newCondition(), name: '乙', replaces: ['mod_cond_x'] },
        bad_id: { ...newCondition(), name: '壞' },
      },
      stories: { mod_story_r: { ...newStory('mod_story_r'), rewards: [{ type: 'condition', target: 'pc', condition: 'mod_cond_y', add: true }] } },
      items: { 甲乙茶: { custom: true, category: 'food', price_cc: 5, use: { condition: 'mod_cond_x' } } as never },
    })
    expect(Object.keys(m.conditions).sort()).toEqual(['mod_cond_x', 'mod_cond_y'])
    expect(m.conditions.mod_cond_x!.stacks_to).toBe('mod_cond_y')
    expect(m.conditions.mod_cond_y!.replaces).toEqual(['mod_cond_x'])
    expect(m.stories.mod_story_r!.rewards).toEqual([{ type: 'condition', target: 'pc', condition: 'mod_cond_y', add: true }])
    expect(m.items['甲乙茶']!.use?.condition).toBe('mod_cond_x')
    applyContent(m)
    const pc = game().party[0]!
    expect(gainCondition(pc, 'mod_cond_x')).toBe('mod_cond_x')
    expect(gainCondition(pc, 'mod_cond_x')).toBe('mod_cond_y')
    expect(pc.status).toContain('mod_cond_y')
    expect(pc.status).not.toContain('mod_cond_x')
    applyContent(emptyMods())
    expect(companionRules.conditions.mod_cond_x).toBeUndefined()
  })
})
