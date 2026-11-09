// NPC 自己的日子裡的成人向私生活（npcLife.ts 的 rollLust；docs/NPC_SYSTEM.md 第 14 節、docs/LEWD_STATS.md 第 29 節）
import { afterEach, describe, expect, it } from 'vitest'
import { setContentFilters } from '@/engine/content'
import { enterLocation } from '@/engine/grid'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { canPair, knownNpcs, newsOf, rollLust, setNpcLife, setPairs, tickNpcLife, type LustCtx } from '@/engine/npcLife'
import { sexRecordItems, sexRecordOf } from '@/engine/sexRecord'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { newGame, withRng } from '@/engine/state'
import type { GameState, NpcRecord } from '@/engine/types'
import { buildNewsPrompt } from '@/narrator/judge'

afterEach(() => {
  setNpcLife({ on: true, days: 3, pairs: true })
  setContentFilters({ ntr: true, male_partner: true })
})

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

/** 認識一個普通人（不會自己成長，只擲私生活），淫亂寫死 */
function known(state: GameState, lewdness: number, extra: Partial<NpcRecord> = {}): NpcRecord {
  const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location })))
  Object.assign(rec, { lewd: { lewdness, submission: 20 }, gender: 'female', ...extra })
  ensureRelationship(state, rec)
  return rec
}

const ctx = (): LustCtx => ({ paired: new Set(), touched: new Set() })

/** 擲 days 天（每天一次），數有幾次事件 */
function count(state: GameState, rec: NpcRecord, days: number): number {
  let n = 0
  for (let d = 1; d <= days; d++) if (rollLust(state, rec, d, ctx())) n++
  return n
}

describe('NPC 的私生活', () => {
  it('淫亂越高越常發生；同一天擲出來的都一樣', () => {
    const state = game()
    const hot = known(state, 90)
    const cold = known(state, 5)
    const h = count(state, hot, 120)
    const c = count(state, cold, 120)
    expect(h).toBeGreaterThan(c * 2)
    // 固定亂數：同一天重擲一樣
    const s2 = game()
    const again = known(s2, 90)
    again.id = hot.id
    expect(rollLust(s2, again, 7, ctx())?.text).toBe(rollLust(game(), { ...again }, 7, ctx())?.text)
  })

  it('自慰記進性經歷的自慰次數，不算在最近幾次裡', () => {
    const state = game()
    const rec = known(state, 60, { sex: { virgin: true } })
    setPairs(state, rec.id, false)
    setNpcLife({ pairs: false })
    for (let d = 1; d <= 60; d++) rollLust(state, rec, d, ctx())
    const r = sexRecordOf(state, rec.id)
    expect(r.solo).toBeGreaterThan(0)
    expect(r.soloLast).toBeDefined()
    expect(sexRecordItems(state, rec.id).find((x) => x.label === '自慰')?.value).toContain('次')
  })

  it('和其他認識的 NPC 發生關係：兩人都記下、都有近況；設定或人際關係關掉時不會', () => {
    const state = game()
    const a = known(state, 95)
    const b = known(state, 95)
    // 互相寫了關係：比較容易挑到
    a.relations = { [b.id]: '老朋友' }
    setNpcLife({ days: 3 })
    let pairDay = 0
    for (let d = 1; d <= 300 && !pairDay; d++) {
      const r = rollLust(state, a, d, ctx())
      if (r?.adult.kind === 'pair') pairDay = d
    }
    expect(pairDay).toBeGreaterThan(0)
    expect(sexRecordOf(state, a.id).recent[0]!.with[0]!.id).toBe(b.id)
    expect(sexRecordOf(state, b.id).recent[0]!.with[0]!.id).toBe(a.id)
    expect(newsOf(state, b.id).at(-1)?.adult).toMatchObject({ kind: 'pair', with: a.id })

    // 設定關掉：不挑 NPC
    setNpcLife({ pairs: false })
    expect(canPair(state, a.id)).toBe(false)
    for (let d = 301; d <= 500; d++) expect(rollLust(state, a, d, ctx())?.adult.kind).not.toBe('pair')
    // 設定開著、人際關係裡關掉其中一人
    setNpcLife({ pairs: true })
    setPairs(state, b.id, false)
    expect(state.npcLife?.noPairs).toEqual([b.id])
    for (let d = 501; d <= 700; d++) expect(rollLust(state, a, d, ctx())?.adult.kind).not.toBe('pair')
    setPairs(state, b.id, true)
    expect(state.npcLife?.noPairs).toBeUndefined()
  })

  it('內容篩選關掉 NTR 時，和主角夠親密的人只會自慰', () => {
    setContentFilters({ ntr: false })
    const state = game()
    const rec = known(state, 95)
    setAffinity(state, rec.id, 70)
    for (let d = 1; d <= 200; d++) {
      const r = rollLust(state, rec, d, ctx())
      if (r) expect(r.adult.kind).toBe('solo')
    }
    expect(sexRecordOf(state, rec.id).recent).toEqual([])
  })

  it('關掉男性對象時，NPC 之間不挑男性', () => {
    setContentFilters({ male_partner: false })
    const state = game()
    const a = known(state, 95)
    known(state, 95, { gender: 'male' })
    for (let d = 1; d <= 300; d++) expect(rollLust(state, a, d, ctx())?.adult.kind).not.toBe('pair')
  })

  it('娼妓接客：一次好幾位客人，人數照算', () => {
    const state = game()
    const rec = known(state, 70, { tags: ['prostitute'] })
    const before = sexRecordOf(state, rec.id).partners
    const r = rollLust(state, rec, 1, ctx()) ?? rollLust(state, rec, 2, ctx())
    expect(r?.adult.kind).toBe('client')
    expect(sexRecordOf(state, rec.id).partners).toBeGreaterThan(before + 1)
  })

  it('每次擲骰時認識的人也擲；有事的記進近況，交給 AI 的提示詞附上性經歷', () => {
    const state = game()
    const rec = known(state, 95)
    expect(knownNpcs(state).map((r) => r.id)).toContain(rec.id)
    tickNpcLife(state) // 第一次只記下今天
    const changed: string[] = []
    for (let i = 0; i < 20; i++) {
      state.time = { ...state.time, day: state.time.day + 3 }
      changed.push(...tickNpcLife(state))
    }
    expect(changed).toContain(rec.id)
    const news = newsOf(state, rec.id)
    expect(news.some((n) => n.adult)).toBe(true)
    const prompt = buildNewsPrompt(state, [{ id: rec.id, news }], true)!
    expect(prompt.user).toContain('性經歷：')
    expect(prompt.system).toContain('成人向的私生活')
  })
})
