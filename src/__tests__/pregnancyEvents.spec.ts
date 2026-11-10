import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters, tagsAllowed } from '@/engine/content'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { birthDc, familyTick } from '@/engine/pregnancy'
import { travelEvents } from '@/engine/road'
import {
  answerPregnancyEvent, maybePregnancyEvent, pendingPregnancyEvent, pregnancyCandidates, pregnancyTemplates, prunePregnancyEvent, unawareMothers,
} from '@/engine/pregnancyEvents'
import { newGame, withRng } from '@/engine/state'
import { sanitizeTravelEvent, travelEventWarnings } from '@/engine/travelEventMods'
import type { Character, GameState } from '@/engine/types'

function game() {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender: '女', seed: 7 })
  return { state, pc: pcOf(state) }
}

/** 直接放一筆懷孕記錄（受孕的機率另外測） */
function pregnant(state: GameState, key: string, daysAgo = 4) {
  const day = state.time.day
  state.time = { ...state.time, day: day + daysAgo }
  ;(state.pregnancies ??= {})[key] = { conceived: day, due: day + 40, father: { name: '旅人' } }
}

/** 一位女性夥伴入隊 */
function mate(state: GameState): Character {
  const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
  const c = { ...pcOf(state), id: rec.id, name: rec.name, isPlayer: false, gender: 'female', status: [] } as Character
  state.party.push(c)
  return c
}

/** 擲到有事件為止（每次重設冷卻） */
function roll(state: GameState, moment: 'rest' | 'travel'): boolean {
  for (let i = 0; i < 60; i++) {
    delete state.pregnancyEvents
    if (maybePregnancyEvent(state, moment)) return true
  }
  return false
}

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('懷孕的察覺事件：資料', () => {
  it('察覺事件：主角 6 件、夥伴 3 件；孕期事件：主角 12 件、夥伴 15 件（3 件親密）；都帶懷孕的標籤，夥伴的事件用 {a} 寫名字', () => {
    const all = pregnancyTemplates()
    const disc = all.filter((t) => !t.known)
    const stage = all.filter((t) => t.known)
    expect(disc.filter((t) => t.subject === 'pc')).toHaveLength(6)
    expect(disc.filter((t) => t.subject === 'companion')).toHaveLength(3)
    expect(stage.filter((t) => t.subject === 'pc')).toHaveLength(12)
    expect(stage.filter((t) => t.subject === 'companion')).toHaveLength(15)
    expect(stage.filter((t) => t.subject === 'companion' && t.options?.some((o) => o.adult_scene))).toHaveLength(3)
    for (const t of all) {
      expect(t.scope).toBe('pregnancy')
      expect(t.tags).toContain('pregnancy')
      if (t.subject === 'companion') expect(t.text).toContain('{a}')
      if (!t.known) expect(t.options?.some((o) => o.reveal)).toBe(true)
      else expect(t.options?.some((o) => o.reveal)).toBe(false)
      expect(travelEventWarnings(t)).toEqual([])
      // 內建的事件經過整理不變（編輯器打開再存不會改到）
      expect(sanitizeTravelEvent(t.id, t, false)).toEqual(t)
    }
  })
})

describe('懷孕的察覺事件：觸發', () => {
  it('受孕未滿 3 天、已經察覺、到了中期的人都不擲；篩選關掉時不擲', () => {
    const { state } = game()
    pregnant(state, 'pc', 1)
    expect(unawareMothers(state)).toEqual([])
    state.time = { ...state.time, day: state.time.day + 3 }
    expect(unawareMothers(state)).toEqual(['pc'])
    setContentFilters({ ...DEFAULT_FILTERS })
    expect(tagsAllowed(['pregnancy'])).toBe(false)
    expect(roll(state, 'rest')).toBe(false)
    setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true })
    state.pregnancies!.pc!.known = true
    expect(unawareMothers(state)).toEqual([])
    state.pregnancies!.pc!.known = false
    state.time = { ...state.time, day: state.pregnancies!.pc!.conceived + 20 }
    expect(unawareMothers(state)).toEqual([])
  })

  it('長休之後與旅途各有自己的事件；旅店老闆娘只在聚落裡', () => {
    const { state } = game()
    pregnant(state, 'pc')
    const rest = pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)
    const travel = pregnancyCandidates(state, 'pc', 'travel').map((t) => t.id)
    expect(rest).toContain('pg_pc_morning')
    expect(rest).toContain('pg_pc_innkeeper')
    expect(travel).toContain('pg_pc_sour')
    expect(travel).not.toContain('pg_pc_morning')
    state.road = {} as GameState['road']
    expect(pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)).not.toContain('pg_pc_innkeeper')
  })

  it('跳出事件之後擋住移動；冷卻內不再跳', () => {
    const { state } = game()
    pregnant(state, 'pc')
    expect(roll(state, 'rest')).toBe(true)
    expect(state.pregnancyEvent?.mother).toBe('pc')
    const first = state.pregnancyEvent
    expect(maybePregnancyEvent(state, 'rest')).toBe(false)
    expect(state.pregnancyEvent).toEqual(first)
  })
})

describe('懷孕的察覺事件：回應', () => {
  it('選了 reveal: always 的選項就察覺；不察覺的選項之後還會再擲', () => {
    const { state } = game()
    pregnant(state, 'pc')
    state.pregnancyEvent = { template: 'pg_pc_innkeeper', mother: 'pc' }
    const r = answerPregnancyEvent(state, 1)
    expect(r.outcome.tags).toContain('懷孕')
    expect(state.pregnancies!.pc!.known).toBeFalsy()
    expect(state.pregnancyEvent).toBeUndefined()
    state.pregnancyEvent = { template: 'pg_pc_innkeeper', mother: 'pc' }
    const r2 = answerPregnancyEvent(state, 0)
    expect(state.pregnancies!.pc!.known).toBe(true)
    expect(r2.outcome.summary).toContain('你懷孕了')
    expect(pcOf(state).pregMark).toMatchObject({ known: true, stage: 'hidden' })
  })

  it('夥伴的事件：名字代進文字，關心的選項親密度 +2 並察覺', () => {
    const { state } = game()
    const m = mate(state)
    pregnant(state, m.id)
    state.pregnancyEvent = { template: 'pg_mate_belly', mother: m.id }
    const t = pendingPregnancyEvent(state)!
    expect(t.title).toBe(`${m.name}摸著肚子發呆`)
    expect(t.text).not.toContain('{a}')
    const r = answerPregnancyEvent(state, 0)
    expect(state.pregnancies![m.id]!.known).toBe(true)
    expect(r.changes.affinity?.[0]).toMatchObject({ npc: m.id })
    expect(r.outcome.summary).toContain(`${m.name}懷孕了`)
  })

  it('那個人已經不在隊上、已經察覺時，等待中的事件作廢', () => {
    const { state } = game()
    const m = mate(state)
    pregnant(state, m.id)
    state.pregnancyEvent = { template: 'pg_mate_appetite', mother: m.id }
    state.party = state.party.filter((x) => x !== m)
    prunePregnancyEvent(state)
    expect(state.pregnancyEvent).toBeUndefined()
  })

  it('不在隊上的人：主角在同一座城、到了中期時察覺，人際關係多一則近況', () => {
    const { state } = game()
    const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
    pregnant(state, rec.id, 0)
    state.time = { ...state.time, day: state.pregnancies![rec.id]!.conceived + 16 }
    familyTick(state)
    expect(state.pregnancies![rec.id]!.known).toBe(true)
    expect(state.npcLife?.news[rec.id]?.at(-1)?.text).toContain('懷孕了')
  })
})

describe('孕期事件', () => {
  it('已經察覺的人照階段出現孕期事件；察覺事件不再出現', () => {
    const { state } = game()
    pregnant(state, 'pc', 10)
    state.pregnancies!.pc!.known = true
    const early = pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)
    expect(early).toContain('pg_st_retch')
    expect(early).not.toContain('pg_pc_morning')
    expect(early).not.toContain('pg_st_quickening')
    state.time = { ...state.time, day: state.pregnancies!.pc!.conceived + 20 }
    const mid = pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)
    expect(mid).toContain('pg_st_quickening')
    expect(mid).not.toContain('pg_st_retch')
    // 走動也有孕期事件（路人的祝福只在聚落裡）
    expect(pregnancyCandidates(state, 'pc', 'step').map((t) => t.id)).toContain('pg_st_blessing')
  })

  it('夥伴的親密事件要親密度 40 以上（雇來的、懷別人孩子的夥伴不會主動求歡）', () => {
    const { state } = game()
    const m = mate(state)
    pregnant(state, m.id, 25)
    state.pregnancies![m.id]!.known = true
    const ids = () => pregnancyCandidates(state, m.id, 'rest', { ...state.time, hour: 22 }).map((t) => t.id)
    expect(ids()).not.toContain('pg_mt_want')
    expect(ids().length).toBeGreaterThan(0)
    ;(state.relationships ??= {})[m.id] = { ...(state.relationships[m.id] ?? {}), affinity: 40 } as never
    expect(ids()).toContain('pg_mt_want')
  })

  it('父親在隊上的事件：父親不在時不出現；父親的名字代進 {f}，親密度給父親', () => {
    const { state } = game()
    const dad = mate(state)
    pregnant(state, 'pc', 20)
    state.pregnancies!.pc!.known = true
    state.pregnancies!.pc!.father = { name: '旅人' }
    expect(pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)).not.toContain('pg_st_father_touch')
    state.pregnancies!.pc!.father = { id: dad.id, name: dad.name }
    expect(pregnancyCandidates(state, 'pc', 'rest').map((t) => t.id)).toContain('pg_st_father_touch')
    state.pregnancyEvent = { template: 'pg_st_father_touch', mother: 'pc' }
    expect(pendingPregnancyEvent(state)!.title).toBe(`${dad.name}的手`)
    const r = answerPregnancyEvent(state, 0)
    expect(r.changes.affinity?.[0]).toMatchObject({ npc: dad.id })
    expect(pcOf(state).status).toContain('fetal_joy')
  })

  it('產婆的叮囑讓這次生產的 DC 低 1', () => {
    const { state } = game()
    pregnant(state, 'pc', 33)
    state.pregnancies!.pc!.known = true
    state.pregnancyEvent = { template: 'pg_st_midwife', mother: 'pc' }
    answerPregnancyEvent(state, 0)
    expect(state.pregnancies!.pc!.birth_dc).toBe(1)
    state.pendingBirth = { mother: 'pc' }
    expect(birthDc(state)).toBe(11)
  })

  it('編輯器的篩選：父親不明、種族、混血、非自願', () => {
    const { state } = game()
    pregnant(state, 'pc', 20)
    const p = state.pregnancies!.pc!
    p.known = true
    delete p.father
    const base = { ...pregnancyTemplates().find((t) => t.id === 'pg_st_tight')! }
    delete base.in_settlement
    const check = (extra: object) => {
      travelEvents.templates.push({ ...base, id: 'zz_test', ...extra })
      const ok = pregnancyCandidates(state, 'pc', 'rest').some((t) => t.id === 'zz_test')
      travelEvents.templates.pop()
      return ok
    }
    expect(check({ father: 'unknown' })).toBe(true)
    p.father = { id: 'x', name: '龍', race: 'hualong' }
    expect(check({ father: 'unknown' })).toBe(false)
    expect(check({ father_races: ['hualong'] })).toBe(true)
    expect(check({ father_races: ['elf'] })).toBe(false)
    expect(check({ mixed: true })).toBe(true)
    expect(check({ mixed: false })).toBe(false)
    expect(check({ forced: true })).toBe(false)
    p.forced = true
    expect(check({ forced: true })).toBe(true)
    expect(check({ requires: { flags: ['never_set'] } })).toBe(false)
  })
})
