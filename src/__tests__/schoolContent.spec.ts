// 流派的共用工程：事件條件 schools、選項的 requires、流派給的技能（docs/LEWD_STATS.md 第 6 節）
import { describe, expect, it } from 'vitest'
import { act, currentActor, effectiveLustMax, purityPotency, startCombat, unusableReason, type Combatant } from '@/engine/combat'
import { abilityDef } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { assertOption, optionBlocked } from '@/engine/road'
import { schoolAbilities } from '@/engine/schools'
import { newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { sanitizeTravelEvent } from '@/engine/travelEventMods'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'cleric', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

describe('流派的條件與技能', () => {
  it('事件條件可以要求主角修了某個流派', () => {
    const state = game()
    expect(condMet(state, { schools: ['beast'] })).toBe(false)
    pcOf(state).perks = [...(pcOf(state).perks ?? []), 'school_beast']
    expect(condMet(state, { schools: ['beast', 'abstinence'] })).toBe(true)
  })

  it('有條件的選項不符合時灰掉並寫出要哪一派；回應時擋下', () => {
    const state = game()
    const o = { label: '和它談條件', requires: { schools: ['beast'] } }
    expect(optionBlocked(state, o)).toBe('要修獸蟲派')
    expect(() => assertOption(state, o)).toThrow('要修獸蟲派')
    pcOf(state).perks = [...(pcOf(state).perks ?? []), 'school_beast']
    expect(optionBlocked(state, o)).toBeUndefined()
    // 內容編輯器存的選項條件會留著
    const t = sanitizeTravelEvent('x', { scope: 'road', kind: 'choice', title: 't', text: 't', options: [{ label: 'a', requires: { schools: ['beast', 'nope'] } }] }, true)
    expect(t.options?.[0]?.requires).toEqual({ schools: ['beast'] })
  })

  it('禁慾派給輔助技能：入門靜心、聖療，3 級結界，5 級淨化；進階破慾，7 級護盾，11 級清淨頌，15 級歸魂之禱；不佔攜帶上限', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = [...(pc.perks ?? []), 'school_abstinence']
    pc.level = 1
    expect(schoolAbilities(pc)).toEqual(['school_abst_calm', 'school_abst_mend'])
    pc.level = 5
    expect(schoolAbilities(pc)).toEqual(['school_abst_calm', 'school_abst_mend', 'school_abst_ward', 'school_abst_purify'])
    pc.perks.push('pure_heart')
    pc.level = 15
    expect(schoolAbilities(pc)).toEqual([
      'school_abst_calm', 'school_abst_mend', 'school_abst_ward', 'school_abst_purify',
      'school_abst_break', 'school_abst_aegis', 'school_abst_hymn', 'school_abst_return',
    ])
    startCombat(state, [['giant_rat', 1]])
    const me = state.combat!.combatants.find((c) => c.id === pc.id)!
    expect(me.abilities).toEqual(expect.arrayContaining(['school_abst_ward', 'school_abst_return']))
  })
})

describe('禁慾派的清淨技能', () => {
  function setup() {
    const state = game()
    const pc = pcOf(state)
    pc.perks = [...(pc.perks ?? []), 'school_abstinence', 'pure_heart']
    pc.level = 15
    pc.hp = pc.maxHp = 300
    startCombat(state, [['giant_rat', 1]])
    const combat = state.combat!
    const me = combat.combatants.find((c) => c.id === pc.id)!
    for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
    me.ap = me.apMax = 10
    return { state, combat, me }
  }

  it('慾望超過門檻不能用；越接近零越強；用完反噬', () => {
    const { state, combat, me } = setup()
    const max = effectiveLustMax(me)
    const mend = abilityDef('school_abst_mend')
    me.lust = Math.ceil(max * 0.45)
    expect(unusableReason(combat, me, 'school_abst_mend')).toBe('慾望太高（要在 40% 以下）')
    me.lust = 0
    expect(purityPotency(me, mend)).toBe(2)
    me.lust = Math.round(max * 0.2)
    expect(purityPotency(me, mend)).toBeCloseTo(1.5, 1)
    me.lust = 0
    me.hp = 100
    act(state, { type: 'ability', ability: 'school_abst_mend', target: me.id })
    // 2d8 + 信仰調整值 + 15 級，×2
    expect(me.hp - 100).toBeGreaterThanOrEqual((2 + 15) * 2 - 4)
    expect(me.lust).toBe(Math.round(max * 0.3))
    expect(unusableReason(combat, me, 'school_abst_aegis')).toBeNull()
    expect(unusableReason(combat, me, 'school_abst_hymn')).toBe('慾望太高（要在 25% 以下）')
  })

  it('靜心消退自己的慾望；每回合開始多消退（入門 5%＋進階 5%）', () => {
    const { state, me } = setup()
    const max = effectiveLustMax(me)
    me.lust = Math.round(max * 0.6)
    const before = me.lust
    act(state, { type: 'ability', ability: 'school_abst_calm' })
    expect(before - me.lust!).toBe(Math.round(15 * 1.5))
    expect(me.lustMods?.calm).toBeCloseTo(0.1)
  })

  it('歸魂之禱：倒下的友軍站起來，回復最大生命 30% × 清淨倍率', () => {
    const { state, combat, me } = setup()
    const down: Combatant = { ...me, id: 'buddy', name: '隊友', hp: 0, maxHp: 100, statuses: [] }
    combat.combatants.push(down)
    me.lust = 0
    act(state, { type: 'ability', ability: 'school_abst_return' })
    expect(down.hp).toBe(60)
    expect(me.lust).toBe(Math.round(effectiveLustMax(me) * 0.8))
    expect(unusableReason(combat, me, 'school_abst_return')).not.toBeNull()
  })
})
