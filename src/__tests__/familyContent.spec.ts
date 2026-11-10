import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { applyEffects } from '@/engine/effects'
import { isLactating, lactationSources } from '@/engine/lactation'
import { sanitizeCond } from '@/engine/mods'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { syncPregnancyMarks } from '@/engine/pregnancy'
import { newGame, withRng } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { sanitizeEffects } from '@/engine/storyMods'
import { baseReport } from '@/engine/town'
import type { GameState } from '@/engine/types'

function game(gender = '女') {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender, seed: 3 })
  return { state, pc: pcOf(state) }
}
const report = (state: GameState) => baseReport(state, 'event', 0)

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true, lactation: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('條件：懷孕、泌乳、孩子', () => {
  it('整理：只留認得的欄位；沒有寫的不留', () => {
    expect(sanitizeCond({ pregnancy: { who: 'party', stage_min: 'mid', stage_max: 'bogus', known: true }, lactating: false, children: { min: 1, max: -3 } }))
      .toEqual({ pregnancy: { who: 'party', stage_min: 'mid', known: true }, lactating: false, children: { min: 1, max: 0 } })
    expect(sanitizeCond({ pregnancy: {} })).toEqual({ pregnancy: {} })
    expect(sanitizeCond({})).toBeUndefined()
  })

  it('懷孕：主角或隊伍裡任何一人、階段範圍、察覺了沒', () => {
    const { state } = game()
    expect(condMet(state, { pregnancy: {} })).toBe(false)
    const day = state.time.day
    state.pregnancies = { pc: { conceived: day - 20, due: day + 20 } }
    expect(condMet(state, { pregnancy: {} })).toBe(true)
    expect(condMet(state, { pregnancy: { stage_min: 'mid', stage_max: 'mid' } })).toBe(true)
    expect(condMet(state, { pregnancy: { stage_min: 'late' } })).toBe(false)
    expect(condMet(state, { pregnancy: { known: true } })).toBe(false)
    state.pregnancies.pc!.known = true
    expect(condMet(state, { pregnancy: { known: true } })).toBe(true)
  })

  it('泌乳、孩子的數量', () => {
    const { state } = game()
    expect(condMet(state, { lactating: false })).toBe(true)
    applyEffects(state, report(state), [{ type: 'lactation', op: 'add', target: 'pc', days: 3 }])
    syncPregnancyMarks(state)
    expect(condMet(state, { lactating: true })).toBe(true)
    expect(condMet(state, { children: { min: 1 } })).toBe(false)
    state.children = [{ id: 'c1', name: '小莉', gender: 'female', race: 'human', born: 1, mother: { id: 'pc', name: '莉雅' }, where: { kind: 'temple', location: state.location, since: 1, paidUntil: 1 } }]
    expect(condMet(state, { children: { min: 1, max: 1 } })).toBe(true)
  })
})

describe('效果：懷孕、泌乳', () => {
  it('整理：受孕要有對象；父親是 id 或只寫名字；泌乳的天數夾在 1～60', () => {
    expect(sanitizeEffects([
      { type: 'pregnancy', op: 'conceive', target: 'pc', father: 'npc_x' },
      { type: 'pregnancy', op: 'conceive', target: '$a', father_name: '旅人' },
      { type: 'pregnancy', op: 'reveal', target: 'pc', father: 'npc_x' },
      { type: 'pregnancy', op: 'abort', target: 'pc' },
      { type: 'pregnancy', op: 'conceive' },
      { type: 'lactation', op: 'add', target: 'pc', days: 999 },
      { type: 'lactation', op: 'remove' },
    ])).toEqual([
      { type: 'pregnancy', op: 'conceive', target: 'pc', father: 'npc_x' },
      { type: 'pregnancy', op: 'conceive', target: '$a', father_name: '旅人' },
      { type: 'pregnancy', op: 'reveal', target: 'pc' },
      { type: 'lactation', op: 'add', target: 'pc', days: 60 },
      { type: 'lactation', op: 'remove', target: 'pc' },
    ])
  })

  it('受孕一定成立，父親照寫的；已經懷孕、身體不行、篩選關掉時不做', () => {
    const { state } = game()
    const dad = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'male', race: 'elf' })))
    applyEffects(state, report(state), [{ type: 'pregnancy', op: 'conceive', target: 'pc', father: dad.id }])
    expect(state.pregnancies?.pc).toMatchObject({ father: { id: dad.id, name: dad.name, race: 'elf' } })
    expect(state.pregnancies!.pc!.due - state.pregnancies!.pc!.conceived).toBe(40)
    const notes = applyEffects(state, report(state), [{ type: 'pregnancy', op: 'conceive', target: 'pc' }])
    expect(notes.join()).toContain('已經懷孕')
    const lines = applyEffects(state, report(state), [{ type: 'pregnancy', op: 'reveal', target: 'pc' }])
    expect(lines.join()).toContain('你懷孕了')
    expect(state.pregnancies!.pc!.known).toBe(true)
    // 男性主角不會懷孕；篩選關掉時什麼都不做
    const him = game('男').state
    expect(applyEffects(him, report(him), [{ type: 'pregnancy', op: 'conceive', target: 'pc' }]).join()).toContain('不會懷孕')
    setContentFilters({ ...DEFAULT_FILTERS })
    const off = game().state
    applyEffects(off, report(off), [{ type: 'pregnancy', op: 'conceive', target: 'pc' }])
    expect(off.pregnancies?.pc).toBeUndefined()
  })

  it('受孕可以讓不在隊上的 NPC 懷孕，父親不明時只記名字', () => {
    const { state } = game('男')
    const woman = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
    applyEffects(state, report(state), [{ type: 'pregnancy', op: 'conceive', target: woman.id, father_name: '流浪詩人' }])
    expect(state.pregnancies?.[woman.id]?.father).toEqual({ name: '流浪詩人' })
  })

  it('泌乳：加幾天、停止；陽剛主角不行', () => {
    const { state, pc } = game()
    applyEffects(state, report(state), [{ type: 'lactation', op: 'add', target: 'pc', days: 5 }])
    expect(lactationSources(state, 'pc')).toEqual([{ kind: 'event', until: state.time.day + 4 }])
    expect(isLactating(state, pc)).toBe(true)
    applyEffects(state, report(state), [{ type: 'lactation', op: 'remove', target: 'pc' }])
    expect(isLactating(state, pc)).toBe(false)
    const masc = game()
    pcOf(masc.state).body = 'masc'
    expect(applyEffects(masc.state, report(masc.state), [{ type: 'lactation', op: 'add', target: 'pc', days: 5 }]).join()).toContain('不會泌乳')
  })
})
