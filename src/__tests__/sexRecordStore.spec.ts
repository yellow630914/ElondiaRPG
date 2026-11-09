// 性經歷：親密場景寫完經過之後另外請 AI 記下（stores/game.ts 的 recordSex；docs/LEWD_STATS.md 第 29 節）
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { addHours, commitReport } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

let reply = '{"records":[]}'
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async () => reply),
  streamNarration: vi.fn(async function* () {
    yield '兩人在旅店的房間裡度過了第一夜。'
  }),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  reply = '{"records":[]}'
})

function scene(state: GameState, adult = '在旅店的房間裡共度一夜'): Report {
  return commitReport(state, {
    schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: addHours(state.time, 1) },
    location: { at: state.location }, party: [{ id: 'pc', name: '艾倫' }], others: [{ id: 'npc_lina', name: '莉娜' }],
    outcome: { result: 'success', summary: '和莉娜過夜' }, changes: {}, narration: { adult_scene: adult },
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
  vi.mocked(providers.completeText).mockClear()
  return { g, settings, providers }
}

describe('record sex after an intimate scene', () => {
  it('writes the narration first, then sends it to the sexlog source and applies the records once', async () => {
    const { g, providers } = await setup()
    const { sexRecordOf, sexLogged } = await import('@/engine/sexRecord')
    const r = scene(g.state!)
    reply = '{"records":[{"id":"pc","sex":1,"with":[{"name":"莉娜","id":"npc_lina"}],"summary":"第一夜","first_time":"和莉娜，在旅店"}]}'
    await g.narrate(r)
    await vi.waitFor(() => expect(sexLogged(g.state!, r.report_id)).toBe(true))
    const prompt = vi.mocked(providers.completeText).mock.calls.at(-1)![2] as { system: string; user: string }
    expect(prompt.user).toContain('兩人在旅店的房間裡度過了第一夜。')
    expect(sexRecordOf(g.state!, 'pc')).toMatchObject({ virgin: false, partners: 1, times: 1, first: { with: '莉娜' } })
    // 重寫經過：已經記過，不再呼叫
    const calls = vi.mocked(providers.completeText).mock.calls.length
    await g.narrate(r)
    await g.recordSex(r, undefined, { manual: true })
    expect(vi.mocked(providers.completeText).mock.calls.length).toBe(calls)
    expect(sexRecordOf(g.state!, 'pc').times).toBe(1)
  })

  it('does nothing when switched off (unless asked by hand), or for scenes that are only teasing', async () => {
    const { g, settings, providers } = await setup()
    const { sexLogged } = await import('@/engine/sexRecord')
    settings.sexRecordAi = false
    const r = scene(g.state!)
    await g.recordSex(r, '……')
    expect(providers.completeText).not.toHaveBeenCalled()
    await g.recordSex(r, '……', { manual: true })
    expect(sexLogged(g.state!, r.report_id)).toBe(true)
    settings.sexRecordAi = true
    const t = scene(g.state!, '挑逗')
    t.narration!.tease = '挑逗'
    vi.mocked(providers.completeText).mockClear()
    await g.recordSex(t, '……')
    expect(providers.completeText).not.toHaveBeenCalled()
  })
})
