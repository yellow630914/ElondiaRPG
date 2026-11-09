// 成人向任務的處子問題（11/9 實測決定）與「性經歷」整個開關（sexRecord.ts、npcLife.ts）
import { afterEach, describe, expect, it } from 'vitest'
import { setContentFilters } from '@/engine/content'
import { namedNpcById, stories } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { generateNpc, npcRecord, registerNpc } from '@/engine/npcs'
import { defaultLoyalAffinity, keepsFirst, rollLust, setNpcLife, setPairs, type LustCtx } from '@/engine/npcLife'
import { addEncounter, npcSexSeed, rescueStoryVirgins, setSexRecords, sexRecordOf, sexRecordsNote, sexValueOf, storyVirginIds, STORY_VIRGIN_FIX } from '@/engine/sexRecord'
import { ensureRelationship } from '@/engine/social'
import { migrate, newGame, withRng } from '@/engine/state'
import type { GameState, NpcRecord } from '@/engine/types'

afterEach(() => {
  setContentFilters({ non_virgin: true })
  setSexRecords(true)
  setNpcLife({ on: true, days: 3, pairs: true, loyal: defaultLoyalAffinity() })
})

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' })
  enterLocation(state)
  return state
}
const ctx = (): LustCtx => ({ paired: new Set(), touched: new Set() })
const seedOf = (id: string) => { const d = namedNpcById(id)!; return npcSexSeed({ id, tags: d.tags ?? [], ...(d.sex ? { sex: d.sex } : {}) }) }

describe('成人向任務的開頭 NPC', () => {
  it('沒標非處女的成人向任務：開頭 NPC（不是男性）初始是處子；也當非處女任務開頭的人不算', () => {
    const ids = storyVirginIds()
    expect(ids.has('npc_mimi')).toBe(true)
    expect(seedOf('npc_mimi').virgin).toBe(true)
    expect(ids.has('npc_stella')).toBe(false) // 也開頭了非處女的任務
    for (const id of ids) expect(namedNpcById(id)?.gender).not.toBe('male')
    // 每一個成人向、沒標非處女任務的開頭 NPC：不是男性的話，初始都是處子。
    // 寫死有經驗的只剩嚮導（帶主角參加儀式，本人不和主角發生關係）
    const guides = new Set(['npc_sister_agathe', 'npc_seph_fertility', 'npc_yh_liu_mama'])
    for (const st of stories) {
      const id = st.start.kind === 'npc' ? st.start.npc : undefined
      if (!id || !st.tags?.includes('adult') || st.tags.includes('non_virgin')) continue
      const def = namedNpcById(id)
      if (!def || def.gender === 'male' || !ids.has(id)) continue
      if (def.sex?.virgin === false) { expect(guides.has(id), `${st.id} 的 ${def.name} 寫死有經驗，任務卻沒標非處女`).toBe(true); continue }
      expect(seedOf(id).virgin, `${st.id} 的 ${def.name}`).toBe(true)
    }
  })

  it('劇情寫了第一次的溫如玉、玄霜是處子；有經驗的女主角，她的任務標了非處女', () => {
    expect(seedOf('npc_yh_wen_ruyu').virgin).toBe(true)
    expect(seedOf('npc_yh_xuanshuang').virgin).toBe(true)
    for (const sid of ['noir_blank_score', 'tdur_bridle', 'tdsr_herd', 'conf_last']) expect(stories.find((s) => s.id === sid)?.tags).toContain('non_virgin')
  })

  it('還是處子的開頭 NPC：私生活打開了也只會自慰', () => {
    const state = game()
    const rec = npcRecord(state, 'npc_mimi')!
    ensureRelationship(state, rec)
    setPairs(state, 'npc_mimi', true)
    expect(keepsFirst(state, 'npc_mimi')).toBe(true)
    for (let d = 1; d <= 200; d++) { const r = rollLust(state, rec, d, ctx()); if (r) expect(r.adult.kind).toBe('solo') }
    expect(sexRecordOf(state, 'npc_mimi').virgin).toBe(true)
  })
})

describe('關掉非處女篩選', () => {
  it('照擲的 NPC 初始都是處子、私生活不會失去第一次；寫死有經驗的照舊', () => {
    const state = game()
    const ids = Array.from({ length: 40 }, (_, i) => `rnd_${i}`)
    expect(ids.some((id) => !npcSexSeed({ id }).virgin)).toBe(true)
    setContentFilters({ non_virgin: false })
    expect(ids.every((id) => npcSexSeed({ id }).virgin)).toBe(true)
    expect(seedOf('npc_noir').virgin).toBe(false)
    const rec: NpcRecord = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location })))
    Object.assign(rec, { lewd: { lewdness: 90, submission: 20 } })
    ensureRelationship(state, rec)
    setPairs(state, rec.id, true)
    for (let d = 1; d <= 200; d++) { const r = rollLust(state, rec, d, ctx()); if (r) expect(r.adult.kind).toBe('solo') }
  })
})

describe('存檔救濟', () => {
  it('寫進存檔、已經不是處子的開頭 NPC 改回處子，幕後的成人向近況拿掉；和主角發生過的不動；只做一次', () => {
    const state = game()
    addEncounter(state, 'npc_mimi', { day: 2, with: [{ name: '旅人' }], sex: 2, service: 0, summary: '和一位旅人共度了一夜' })
    addEncounter(state, 'npc_lena', { day: 2, with: [{ name: '艾倫', id: state.party[0]!.id }], sex: 1, service: 0, summary: '和主角' })
    state.npcLife = { ...(state.npcLife ?? {}), news: { npc_mimi: [{ day: 2, text: '和一位旅人共度了一夜。', adult: { kind: 'stranger', with: '旅人' } }, { day: 3, text: '在城裡休養。' }] } } as GameState['npcLife']
    delete state.flags[STORY_VIRGIN_FIX]
    expect(sexRecordOf(state, 'npc_mimi').virgin).toBe(false)
    migrate(state)
    expect(sexRecordOf(state, 'npc_mimi').virgin).toBe(true)
    expect(state.npcLife!.news.npc_mimi!.map((n) => n.text)).toEqual(['在城裡休養。'])
    expect(sexRecordOf(state, 'npc_lena').virgin).toBe(false)
    // 之後在遊戲裡失去第一次：再讀檔也不會被改回
    addEncounter(state, 'npc_mimi', { day: 9, with: [{ name: '旅人' }], sex: 1, service: 0, summary: '再一次' })
    migrate(state)
    expect(sexRecordOf(state, 'npc_mimi').virgin).toBe(false)
  })
})

describe('「性經歷」整個開關', () => {
  it('關掉時：私生活不擲成人向的事、提示詞不附、身價不看', () => {
    const state = game()
    const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, tags: ['slave'] })))
    Object.assign(rec, { lewd: { lewdness: 90, submission: 20 } })
    ensureRelationship(state, rec)
    setPairs(state, rec.id, true)
    expect(sexRecordsNote(state)).not.toBe('')
    setSexRecords(false)
    for (let d = 1; d <= 100; d++) expect(rollLust(state, rec, d, ctx())).toBeNull()
    expect(sexRecordsNote(state, [rec.id])).toBe('')
    expect(sexValueOf(state, rec.id)).toEqual({ mult: 1, notes: [] })
  })
})
