import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { act, combatant, startCombat } from '@/engine/combat'
import { describeStatus, statuses } from '@/engine/data'
import {
  applyContent, emptyMods, newAbility, newItem, newStatus, normalizeMods, sanitizeStatus, statusUsage, type ContentMods,
} from '@/engine/mods'
import { migrate, newGame } from '@/engine/state'
import { useGame } from '@/stores/game'
import { editableWorld } from './testWorld'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const mods = (patch: Partial<ContentMods>) => normalizeMods(JSON.parse(JSON.stringify({ ...emptyMods(), ...patch })))

describe('status content', () => {
  it('cleans up an authored status', () => {
    const s = sanitizeStatus('mod_status_x', {
      name: '超長的名字一二三四五六七八', kind: 'debuff' as const,
      mods: { hit: -99, evade: 'x' as unknown as number, threat: 0.5 },
      luck: '1d4', luck_on: undefined,
      advantage: ['attack', 'nope' as never], resist: { fire: 0.5, nope: 1 },
      dot: { dice: '2d6', type: 'nope' }, pulse: { dice: '1d8', type: 'force', mod: true },
      on_hit: { status: 'mod_status_x', turns: 3 },
      control: 'stun', special: 'nope' as never, charges: 99,
    }, true)
    expect(s).toEqual({
      name: '超長的名字一二三四五', kind: 'debuff', mods: { hit: -10, threat: 0.5 }, advantage: ['attack'], resist: { fire: 0.5 },
      pulse: { dice: '1d8', type: 'force', mod: true }, control: 'stun', charges: 10, custom: true,
    })
    // 幸運骰要寫作用在哪些擲骰；命中附加不能是自己
    expect(sanitizeStatus('a', { name: 'a', kind: 'buff', luck: '-1d6', luck_on: ['save'] }, true)).toMatchObject({ luck: '-1d6', luck_on: ['save'] })
    expect(sanitizeStatus('a', { name: 'a', kind: 'buff', on_hit: { status: 'poisoned', turns: 2 } }, true).on_hit).toEqual({ status: 'poisoned', turns: 2 })
  })

  it('adds a custom status that a custom ability applies in combat, and edits a built-in one', () => {
    const hex = { ...newStatus('debuff'), name: '腐蝕', mods: { evade: -2 }, dot: { dice: '1d6', type: 'acid' } }
    const ability = { ...newAbility('mod_ability_h'), name: '腐蝕斬', resolve: 'auto' as const, apply: [{ status: 'mod_status_h', turns: 2 }] }
    // 從儲存的資料讀回來（還沒套用時）：能力引用自建的狀態也要認得
    const m = mods({ statuses: { mod_status_h: hex, exposed: { ...statuses.exposed!, mods: { evade: -5 } } }, abilities: { mod_ability_h: ability } })
    expect(m.abilities.mod_ability_h!.apply).toEqual([{ status: 'mod_status_h', turns: 2 }])
    expect(m.statuses.exposed!.custom).toBeUndefined()
    applyContent(m)
    expect(statuses.exposed!.mods).toEqual({ evade: -5 })
    expect(describeStatus(statuses.mod_status_h!)).toBe('迴避 -2；每回合 1d6 酸蝕傷害')

    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    state.party[0]!.abilities.push('mod_ability_h')
    startCombat(state, [['goblin', 1]])
    const combat = state.combat!
    combat.turn = combat.order.indexOf('pc')
    combatant(combat, 'pc').ap = 10
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    act(state, { type: 'ability', ability: 'mod_ability_h', target: foe.id })
    expect(foe.statuses.some((s) => s.id === 'mod_status_h')).toBe(true)

    // 移除之後：進行中的戰鬥拿掉這個狀態，內建的恢復原狀
    applyContent(emptyMods())
    expect(statuses.mod_status_h).toBeUndefined()
    expect(statuses.exposed!.mods).toEqual({ evade: -3 })
    const loaded = migrate(JSON.parse(JSON.stringify(state)))
    expect(loaded.combat!.combatants.find((c) => c.id === foe.id)!.statuses.some((s) => s.id === 'mod_status_h')).toBe(false)
  })

  it('lists where a status is used and blocks deleting it until nothing does', () => {
    const c = editableWorld()
    const g = useGame()
    c.saveStatus('mod_status_u', { ...newStatus('buff'), name: '鼓勁' })
    c.saveStatus('mod_status_v', { ...newStatus('buff'), name: '鼓勁之刃', on_hit: { status: 'mod_status_u', turns: 2 } })
    c.saveAbility('mod_ability_u', { ...newAbility('mod_ability_u'), name: '振奮', apply: [{ status: 'mod_status_u', turns: 2, to: 'self' }] })
    c.saveItem('鼓勁藥', { ...newItem('鼓勁藥'), category: 'consumable', use: { status: { id: 'mod_status_u', turns: 3 } } })
    g.state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    startCombat(g.state, [['goblin', 1]])
    g.state.combat!.combatants[0]!.statuses.push({ id: 'mod_status_u', turns: 2, source: 'pc' })
    const used = statusUsage('mod_status_u', g.state)
    for (const where of ['能力「振奮」', '狀態「鼓勁之刃」的命中附加', '物品「鼓勁藥」', '目前存檔的戰鬥中']) {
      expect(used.join('、'), where).toContain(where)
    }
    expect(() => c.deleteStatus('mod_status_u')).toThrow('還有地方用到')
    expect(() => c.deleteStatus('exposed')).toThrow('內建')
    // 一個一個拿掉之後可以刪
    g.state = null
    c.deleteAbility('mod_ability_u')
    c.deleteStatus('mod_status_v')
    c.deleteItem('鼓勁藥')
    c.deleteStatus('mod_status_u')
    expect(statuses.mod_status_u).toBeUndefined()
  })

  it('applies an always-on status to the target of an attack even on a miss', () => {
    applyContent(mods({ abilities: { mod_ability_m: { ...newAbility('mod_ability_m'), hit: -10, apply: [{ status: 'exposed', turns: 2, on: 'always' }] } } }))
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    state.party[0]!.abilities.push('mod_ability_m')
    startCombat(state, [['goblin', 1]])
    const combat = state.combat!
    combat.turn = combat.order.indexOf('pc')
    combatant(combat, 'pc').ap = 10
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    act(state, { type: 'ability', ability: 'mod_ability_m', target: foe.id })
    expect(foe.statuses.some((s) => s.id === 'exposed')).toBe(true)
  })

  it('describes the new statuses in plain words', () => {
    expect(describeStatus(statuses.prone!)).toBe('攻擊劣勢；被攻擊時對方優勢')
    expect(describeStatus(statuses.giant_might!)).toBe('武器傷害 +3；減傷 +1；仇恨 +30%')
    expect(describeStatus(statuses.sacred_weapon!)).toBe('命中 +2；武器命中時附加 1d6 神聖傷害')
    expect(describeStatus(statuses.poison_blade!)).toContain('武器命中時使目標中毒 3 回合')
  })
})
