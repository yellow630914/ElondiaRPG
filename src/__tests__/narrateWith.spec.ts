// 玩家的行動與要求：改寫這則日誌的玩家意圖，再整段重寫（只是文字，不改結果）
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

describe('rewrite with the player\'s action and requests', () => {
  it('saves the text as this entry\'s player intent, rewrites the whole narration with it, and keeps it for later rewrites', async () => {
    const { g, providers } = await setup()
    const r = event(g.state!)
    g.narrations[r.report_id] = { text: '你推開酒館的門。', status: 'done' }
    const money = g.state!.money_cc
    chunks = ['你壓低聲音問她昨晚去了哪裡。']
    await g.narrateWith(r, '  我壓低聲音問她昨晚去了哪裡；多寫她的表情  ')
    const saved = g.state!.reports.find((x) => x.report_id === r.report_id)!
    expect(saved.narration?.player_intent).toBe('我壓低聲音問她昨晚去了哪裡；多寫她的表情')
    const prompt = vi.mocked(providers.streamNarration).mock.calls.at(-1)![2] as { user: string }
    expect(prompt.user).toContain('玩家意圖：我壓低聲音問她昨晚去了哪裡；多寫她的表情')
    // 整段重寫，不是接在後面；遊戲狀態不變
    expect(g.narrations[r.report_id]).toMatchObject({ text: '你壓低聲音問她昨晚去了哪裡。', status: 'done' })
    expect(g.state!.money_cc).toBe(money)
    // 之後一般的重寫也沿用
    chunks = ['又寫了一次。']
    await g.narrate(saved)
    expect((vi.mocked(providers.streamNarration).mock.calls.at(-1)![2] as { user: string }).user).toContain('玩家意圖：我壓低聲音問她昨晚去了哪裡')
  })

  it('an empty text removes the player intent', async () => {
    const { g, providers } = await setup()
    const r = event(g.state!)
    r.narration = { player_intent: '原本的做法' }
    chunks = ['重寫。']
    await g.narrateWith(r, '   ')
    expect(g.state!.reports.find((x) => x.report_id === r.report_id)!.narration?.player_intent).toBeUndefined()
    expect((vi.mocked(providers.streamNarration).mock.calls.at(-1)![2] as { user: string }).user).not.toContain('玩家意圖')
  })
})
