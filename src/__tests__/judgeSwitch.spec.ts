// AI 判定進行中換了一局（回首頁、讀檔、開新遊戲）：舊判定作廢，不鎖住新的一局，結果回來也不套用
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { prepareAction } from '@/engine/actions'
import { useGame } from '@/stores/game'
import { judgeTimeout } from '@/stores/settings'

const JUDGMENT = JSON.stringify({ attr: 'cha', dc: 12, degree: 'success', effects: [], rationale: '舊的判定' })
// 遲到的回應：不理會取消，等測試放行才回（模擬連線已經斷不掉的情況）
let release: (() => void) | null = null
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(() => new Promise<string>((resolve) => { release = () => resolve(JUDGMENT) })),
  streamNarration: vi.fn(async function* () { yield '' }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

// 等判定真的送出（前面有動態載入）
const sent = () => vi.waitFor(() => { if (!release) throw new Error('not sent') })
beforeEach(() => { release = null })

describe('AI 判定換局', () => {
  it('drops a running judgment when a new game starts', async () => {
    const game = useGame()
    game.start('艾倫', 'human', 'fighter')
    game.runAction((s) => prepareAction(s, { kind: 'free', text: '舊遊戲的行動' }))
    const old = game.judge(true)
    await sent()
    expect(game.judging).toBe(true)

    await game.toHome()
    game.start('貝拉', 'human', 'wizard')
    expect(game.judging).toBe(false)
    game.runAction((s) => prepareAction(s, { kind: 'free', text: '新遊戲的行動' }))
    const pendingId = game.state!.pendingAction!.id

    release!()
    await old
    // 舊的結果沒有拿去結算新遊戲的行動，也不顯示錯誤
    expect(game.state!.pendingAction?.id).toBe(pendingId)
    expect(game.state!.pendingAction?.text).toBe('新遊戲的行動')
    expect(game.state!.reports.some((r) => r.kind === 'action')).toBe(false)
    expect(game.error).toBeNull()
    expect(game.judging).toBe(false)
  })

  it('still applies the judgment when nothing changed', async () => {
    const game = useGame()
    game.start('艾倫', 'human', 'fighter')
    game.runAction((s) => prepareAction(s, { kind: 'free', text: '打聽消息' }))
    const p = game.judge(true)
    await sent()
    release!()
    await p
    expect(game.state!.pendingAction).toBeFalsy()
    expect(game.state!.reports.at(-1)?.kind).toBe('action')
  })
})

describe('AI 判定逾時的設定值', () => {
  it('clamps to whole minutes 0-30 and falls back to 3 when blank', () => {
    expect(judgeTimeout('')).toBe(3)
    expect(judgeTimeout(undefined)).toBe(3)
    expect(judgeTimeout('abc')).toBe(3)
    expect(judgeTimeout(0)).toBe(0)
    expect(judgeTimeout(0.5)).toBe(1)
    expect(judgeTimeout(100)).toBe(30)
    expect(judgeTimeout(-2)).toBe(0)
    expect(judgeTimeout(7)).toBe(7)
  })
})
