// 流派的共用工程：事件條件 schools、選項的 requires、流派給的技能（docs/LEWD_STATS.md 第 6 節）
import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
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

  it('禁慾派給輔助技能：入門給結界，5 級淨化，進階給破慾，11 級清淨頌；不佔攜帶上限', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = [...(pc.perks ?? []), 'school_abstinence']
    pc.level = 1
    expect(schoolAbilities(pc)).toEqual(['school_abst_ward'])
    pc.level = 5
    expect(schoolAbilities(pc)).toEqual(['school_abst_ward', 'school_abst_purify'])
    pc.perks.push('pure_heart')
    pc.level = 11
    expect(schoolAbilities(pc)).toEqual(['school_abst_ward', 'school_abst_purify', 'school_abst_break', 'school_abst_hymn'])
    startCombat(state, [['giant_rat', 1]])
    const me = state.combat!.combatants.find((c) => c.id === pc.id)!
    expect(me.abilities).toEqual(expect.arrayContaining(['school_abst_ward', 'school_abst_hymn']))
  })
})
