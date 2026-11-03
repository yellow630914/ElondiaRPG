// 續寫：接著這則日誌已經寫好的正文往下寫（只是文字，不改結果）
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { addHours, commitReport } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

let chunks: string[] = []
let failAfter = -1
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async () => '{}'),
  streamNarration: vi.fn(async function* (_p: unknown, _c: unknown, _prompt: unknown, signal?: AbortSignal) {
    for (const [i, c] of chunks.entries()) {
      if (i === failAfter) throw new Error('連線中斷')
      // 「<wait>」：像還在寫的串流，等玩家按停止
      if (c === '<wait>') {
        await new Promise((res) => signal?.addEventListener('abort', res))
        throw new Error('aborted')
      }
      yield c
    }
  }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  chunks = []
  failAfter = -1
})

function event(state: GameState, summary = '和莉娜在酒館聊天'): Report {
  return commitReport(state, {
    schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: addHours(state.time, 1) },
    location: { at: state.location }, party: [{ id: 'pc', name: '艾倫' }], outcome: { result: 'success', summary }, changes: {},
  })
}

async function setup() {
  const { useSettings } = await import('@/stores/settings')
  const { useGame } = await import('@/stores/game')
  const providers = await import('@/narrator/providers')
  const settings = useSettings()
  settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
  const g = useGame()
  g.start('艾倫', 'human', 'fighter')
  return { g, providers }
}

describe('continue the narration', () => {
  it('asks to go on from the last sentence, with the written text, the same system prompt and the hint', async () => {
    const { g, providers } = await setup()
    const r = event(g.state!)
    g.narrations[r.report_id] = { text: '你推開酒館的門。莉娜朝你揮手。', status: 'done' }
    chunks = ['她替你', '倒了一杯麥酒。']
    await g.continueNarration(r, '多寫兩人的對話')
    const calls = vi.mocked(providers.streamNarration).mock.calls
    const prompt = calls.at(-1)![2] as { system: string; user: string }
    expect(prompt.user).toContain('<written>\n你推開酒館的門。莉娜朝你揮手。\n</written>')
    expect(prompt.user).toContain('本次要求（續寫）')
    expect(prompt.user).toContain('玩家希望多寫的方向：多寫兩人的對話')
    expect(prompt.user).not.toContain('請依照上述報告寫出這次事件的詳細經過')
    // system 和一般的敘事一樣（可以共用快取）
    expect(prompt.system).toBe((await g.promptFor(r)).system)
    // 接在後面，多一段；記下續寫的次數
    expect(g.narrations[r.report_id]).toMatchObject({ text: '你推開酒館的門。莉娜朝你揮手。\n\n她替你倒了一杯麥酒。', status: 'done', continued: 1 })
  })

  it('only continues the latest narrated entry, and nothing changes in the game', async () => {
    const { g } = await setup()
    const a = event(g.state!, '第一件事')
    g.narrations[a.report_id] = { text: '第一段。', status: 'done' }
    const b = event(g.state!, '第二件事')
    // 後面那則還沒寫經過：前面那則還能續寫
    expect(g.continueBlock(a)).toBe('')
    g.narrations[b.report_id] = { text: '第二段。', status: 'done' }
    expect(g.continueBlock(a)).toBe('只能續寫最新一則有經過的日誌')
    expect(g.continueBlock(b)).toBe('')
    const before = JSON.stringify(g.state)
    chunks = ['接下去。']
    await g.continueNarration(a)
    expect(g.narrations[a.report_id]!.text).toBe('第一段。')
    expect(g.error).toBe('只能續寫最新一則有經過的日誌')
    await g.continueNarration(b)
    expect(g.narrations[b.report_id]!.text).toBe('第二段。\n\n接下去。')
    // 只是文字：狀態一點都沒變
    expect(JSON.stringify(g.state)).toBe(before)
  })

  it('keeps the original text when the AI fails, and what was written when stopped', async () => {
    const { g } = await setup()
    const r = event(g.state!)
    g.narrations[r.report_id] = { text: '原本的經過。', status: 'done' }
    chunks = ['寫了一半', '後面']
    failAfter = 1
    await g.continueNarration(r)
    expect(g.narrations[r.report_id]).toMatchObject({ text: '原本的經過。', status: 'done' })
    expect(g.narrations[r.report_id]!.continued).toBeUndefined()
    expect(g.error).toContain('續寫失敗')
    // 停止：留下已經寫出來的
    g.error = null
    failAfter = -1
    chunks = ['先寫的這段', '<wait>']
    const p = g.continueNarration(r)
    await vi.waitFor(() => expect(g.narrations[r.report_id]!.text).toContain('先寫的這段'))
    expect(g.narrations[r.report_id]!.status).toBe('streaming')
    g.cancelNarration(r.report_id)
    await p
    expect(g.narrations[r.report_id]!.status).toBe('done')
    expect(g.narrations[r.report_id]).toMatchObject({ text: '原本的經過。\n\n先寫的這段', continued: 1 })
    expect(g.error).toBeNull()
  })

  it('a rewrite starts over without the continuations', async () => {
    const { g } = await setup()
    const r = event(g.state!)
    g.narrations[r.report_id] = { text: '舊的。\n\n續寫的。', status: 'done', continued: 1 }
    chunks = ['重寫的經過。']
    await g.narrate(r)
    expect(g.narrations[r.report_id]).toMatchObject({ text: '重寫的經過。', status: 'done' })
    expect(g.narrations[r.report_id]!.continued).toBeUndefined()
  })
})
