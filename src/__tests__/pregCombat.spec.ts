import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { bodyImageNotes, syncPregnancyMarks } from '@/engine/pregnancy'
import { postpartumMaxHp, pregnancyTwoFace } from '@/engine/pregCombat'
import { addLactation } from '@/engine/lactation'
import { newGame } from '@/engine/state'
import { portraitSubject } from '@/narrator/imageInfo'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', gender: '女', seed: 5, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
/** 開一場戰鬥看主角的戰鬥資料（看完就拿掉，才能再開下一場） */
function me(state: GameState) {
  const f = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pcOf(state).id)!
  delete state.combat
  return f
}

/** 懷了幾天、察覺了沒 */
function pregnant(state: GameState, days: number, known = true) {
  const day = state.time.day
  state.pregnancies = { pc: { conceived: day - days, due: day - days + 40, known } }
  syncPregnancyMarks(state)
}

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true, lactation: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('懷孕的雙面效應', () => {
  it('沒修流派、還沒察覺時沒有效果；修了流派依階段：初期豁免 +1、中期豁免與減傷 +1、後期豁免 +2 減傷 +1', () => {
    const state = game()
    const pc = pcOf(state)
    pregnant(state, 20)
    expect(pregnancyTwoFace(pc)).toEqual({ mods: {} })
    pc.perks = [...(pc.perks ?? []), 'school_bondage']
    expect(pregnancyTwoFace(pc).mods).toEqual({ save: 1, dr: 1 })
    pregnant(state, 10)
    expect(pregnancyTwoFace(pc).mods).toEqual({ save: 1 })
    pregnant(state, 10, false)
    expect(pregnancyTwoFace(pc)).toEqual({ mods: {} })
    pregnant(state, 33)
    expect(pregnancyTwoFace(pc)).toEqual({ mods: { save: 2, dr: 1 }, allyDown: { damage: 2 } })
  })

  it('戰鬥中加在角色的修正上；慾望戰鬥關閉時沒有', () => {
    const plain = me(game())
    const state = game()
    const pc = pcOf(state)
    pc.perks = [...(pc.perks ?? []), 'school_bondage']
    const schooled = me(state)
    pregnant(state, 33)
    const f = me(state)
    expect((f.baseMods.save ?? 0) - (schooled.baseMods.save ?? 0)).toBe(2)
    expect(f.lustMods?.allyDown).toEqual({ damage: 2 })
    expect(plain.lustMods?.allyDown).toBeUndefined()
    state.options = { ...state.options!, lustMult: 0 }
    expect(me(state).lustMods?.allyDown).toBeUndefined()
  })
})

describe('產後虛弱與形象圖', () => {
  it('產後虛弱：戰鬥中生命上限 ×0.8', () => {
    const state = game()
    const pc = pcOf(state)
    const full = me(state).maxHp
    state.postpartum = { pc: state.time.day + 2 }
    syncPregnancyMarks(state)
    expect(postpartumMaxHp(pc)).toBe(0.8)
    expect(me(state).maxHp).toBe(Math.round(full * 0.8))
  })

  it('形象圖：察覺之後的中期以後寫懷孕；泌乳寫泌乳；篩選關掉時不寫', () => {
    const state = game()
    pregnant(state, 5)
    expect(bodyImageNotes(state, 'pc')).toEqual([])
    pregnant(state, 33)
    expect(bodyImageNotes(state, 'pc')[0]).toContain('pregnant')
    addLactation(state, 'pc', { kind: 'pregnancy' })
    syncPregnancyMarks(state)
    expect(portraitSubject(state, pcOf(state).id)!.appearance).toContain('lactating')
    setContentFilters({ ...DEFAULT_FILTERS })
    expect(bodyImageNotes(state, 'pc')).toEqual([])
  })
})
