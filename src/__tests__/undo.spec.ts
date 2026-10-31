import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { commitReport, addHours } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
import { OTHER_USAGE, useGame } from '@/stores/game'
import { UNDO_STEPS, firstNewReport, restoreTurn } from '@/stores/undo'

vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async () => '{}'),
  streamNarration: vi.fn(async function* () { yield '' }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

/** 產生一則日誌的動作（順便改一點錢） */
function addReport(s: GameState, money = 0): Report {
  s.money_cc += money
  return commitReport(s, {
    schema_version: '0.1', report_id: `r-undo-${s.nextReportNo++}`, kind: 'event',
    time: { start: { ...s.time }, end: addHours(s.time, 1) },
    location: { at: s.location }, party: [], outcome: { result: 'success', summary: '測試' }, changes: {},
  })
}

function started() {
  const game = useGame()
  game.start('艾倫', 'human', 'fighter')
  return game
}

describe('undo', () => {
  it('rolls back the last turn: state, its log entry and its narration', () => {
    const game = started()
    const money = game.state!.money_cc
    const before = game.state!.reports.length
    const r = game.runAction((s) => addReport(s, 50))!
    game.narrations[r.report_id] = { text: '經過', status: 'done' }
    game.usage[r.report_id] = { input: 100, output: 20, calls: 1 }
    expect(game.undoReports).toEqual([r.report_id])

    expect(game.undo()).toBe(true)
    expect(game.state!.money_cc).toBe(money)
    expect(game.state!.reports.length).toBe(before)
    expect(game.narrations[r.report_id]).toBeUndefined()
    // 用掉的 token 不會不見：算在「其他」
    expect(game.usage[r.report_id]).toBeUndefined()
    expect(game.usage[OTHER_USAGE]?.input).toBe(100)
    expect(game.undoReports).toEqual([])
    expect(game.undo()).toBe(false)
  })

  it('keeps at most UNDO_STEPS turns and can roll back several at once', () => {
    const game = started()
    const money = game.state!.money_cc
    const ids = Array.from({ length: UNDO_STEPS + 2 }, () => game.runAction((s) => addReport(s, 1))!.report_id)
    expect(game.undoReports).toEqual(ids.slice(-UNDO_STEPS))
    // 回退到最舊的那一步：中間的一起撤銷
    game.undo(ids[2])
    expect(game.state!.money_cc).toBe(money + 2)
    expect(game.state!.reports.at(-1)!.report_id).toBe(ids[1])
    expect(game.undoReports).toEqual([])
  })

  it('a turn starts at the last calm action: moves before it stay, a whole fight goes', () => {
    const game = started()
    const money = game.state!.money_cc
    // 走路之類不產生日誌的動作：留著
    game.runAction((s) => { s.money_cc += 1 })
    // 開打、打了幾回合、打完才有日誌：回退到開打之前
    game.runAction((s) => { s.money_cc += 10; s.combat = { fake: true } as unknown as GameState['combat'] })
    game.runAction((s) => { s.money_cc += 10 })
    game.runAction((s) => { delete s.combat; addReport(s, 10) })
    game.undo()
    expect(game.state!.combat).toBeUndefined()
    expect(game.state!.money_cc).toBe(money + 1)
  })

  it('changes the dice: the same action can roll differently after rolling back', () => {
    const game = started()
    const seed = game.state!.rngState
    game.runAction((s) => addReport(s))
    game.undo()
    expect(game.state!.rngState).not.toBe(seed)
  })

  it('offers to reroll a free action that was rolled back', async () => {
    const game = started()
    const before = game.state!.reports.length
    await game.perform({ kind: 'free', text: '在附近四處看看' })
    expect(game.state!.reports.length).toBe(before + 1)
    expect(game.state!.pendingAction).toBeUndefined()
    game.undo()
    // 回到擲骰之前，不是等待判定的狀態
    expect(game.state!.pendingAction).toBeUndefined()
    expect(game.state!.reports.length).toBe(before)
    expect(game.redoInput).toEqual({ kind: 'free', text: '在附近四處看看' })
    await game.redo()
    expect(game.state!.reports.length).toBe(before + 1)
    expect(game.redoInput).toBeNull()
  })

  it('forgets the history on loading another game', () => {
    const game = started()
    game.runAction((s) => addReport(s))
    game.start('貝拉', 'human', 'wizard')
    expect(game.undoReports).toEqual([])
    expect(game.undo()).toBe(false)
  })
})

describe('undo helpers', () => {
  it('finds the first log entry an action added', () => {
    const reports = ['a', 'b', 'c'].map((report_id) => ({ report_id })) as Report[]
    expect(firstNewReport({ reports }, 'c')).toBeUndefined()
    expect(firstNewReport({ reports }, 'a')).toBe('b')
    expect(firstNewReport({ reports }, undefined)).toBe('a')
  })

  it('keeps entries archived since the snapshot archived', () => {
    const r = (id: string) => ({ report_id: id }) as Report
    const saved = { reports: [r('a'), r('b'), r('c')], logArchive: [], rngState: 1 } as unknown as GameState
    const current = { reports: [r('c'), r('d')], logArchive: [{ id: 'a' }, { id: 'b' }], rngState: 2 } as unknown as GameState
    const { state, removed } = restoreTurn(current, saved, 42)
    expect(state.reports.map((x) => x.report_id)).toEqual(['c'])
    expect(state.logArchive!.map((e) => e.id)).toEqual(['a', 'b'])
    expect(state.rngState).toBe(42)
    expect(removed).toEqual(['d'])
  })
})
