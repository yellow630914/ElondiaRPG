import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { prepareAction, sanitizeJudgment } from '@/engine/actions'
import { gainXp, learnable, rerollsLeft } from '@/engine/character'
import { abilityDef } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { addHours, commitReport, newGame, withRng } from '@/engine/state'
import { recruit, rerollAbility } from '@/engine/town'
import type { GameState, Report } from '@/engine/types'

vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async (_p: unknown, _c: unknown, _prompt: unknown, _s: unknown, onUsage?: (u: { input: number; output: number }) => void) => {
    onUsage?.({ input: 1200, output: 300 })
    return JSON.stringify({ degree: 'success', summary: '聊得很愉快。', narrative: '你們聊到深夜。', effects: [] })
  }),
  streamNarration: vi.fn(async function* () { yield '' }),
}))

function game(seed = 1, classId = 'wizard'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId, seed })
  enterLocation(state)
  return state
}

function event(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: addHours(state.time, 1) },
    location: { at: state.location }, party: [], outcome: { result: 'success', summary: '事件' }, changes: {},
  }
}

describe('reroll limit from settings', () => {
  it('uses the given limit instead of the default', () => {
    const state = game(1)
    const pc = state.party[0]!
    withRng(state, (rng) => gainXp(pc, 1000, rng))
    expect(rerollsLeft(pc, 1)).toBe(1)
    rerollAbility(state, 'pc', 1)
    expect(() => rerollAbility(state, 'pc', 1)).toThrow('不能再重抽')
    expect(rerollsLeft(pc, 5)).toBe(4)
    expect(() => rerollAbility(state, 'pc', 0)).toThrow('不能再重抽')
  })
})

describe('ability reward', () => {
  it('teaches a named ability, a random one, or offers a choice', () => {
    const state = game(2)
    const pc = state.party[0]!
    const known = pc.abilities.length
    const target = learnable(pc)[0]!
    const report = event(state)
    const notes = applyEffects(state, report, [
      { type: 'ability', target: 'pc', ability: target.name },
      { type: 'ability', target: 'pc', ability: '不存在的能力' },
      { type: 'ability', target: 'pc', choices: 3 },
      { type: 'ability', target: 'pc', chance: 0 },
    ])
    commitReport(state, report)
    expect(pc.abilities).toContain(target.id)
    expect(pc.abilities.length).toBe(known + 2)
    expect(report.changes.skills_gained?.map((x) => x.source)).toEqual(['insight', 'insight'])
    // 1 級法師可以學的不多：選項數量不超過能學的能力
    expect(pc.pendingAbilityChoices?.[0]?.length).toBeGreaterThanOrEqual(1)
    expect(notes.filter((n) => n.includes('領悟'))).toHaveLength(2)
    expect(notes.some((n) => n.includes('選一'))).toBe(true)
  })

  it('lets the AI grant an ability only on a critical success', () => {
    const state = game(3, 'fighter')
    recruit(state, 'npc_lina')
    const p = prepareAction(state, { kind: 'free', target: 'npc_lina', text: '請莉娜教我射箭的訣竅' })
    const effects = [{ type: 'ability', target: 'pc' }, { type: 'ability', target: 'pc' }]
    expect(sanitizeJudgment(state, p, { degree: 'success', effects }).effects).toEqual([])
    expect(sanitizeJudgment(state, p, { degree: 'critical', effects }).effects).toEqual([{ type: 'ability', target: 'pc' }])
    expect(abilityDef(state.party[0]!.abilities[0]!)).toBeTruthy()
  })
})

describe('token usage', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('records the AI judgment usage on the resulting log entry', async () => {
    const { useSettings } = await import('@/stores/settings')
    const { useGame } = await import('@/stores/game')
    const settings = useSettings()
    settings.configs.anthropic = { apiKey: 'x', model: 'claude-sonnet-5-5' }
    settings.provider = 'anthropic'
    settings.aiJudge = true
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    standOn(g.state!, 'tavern')
    g.recruit('npc_lina')
    await g.perform({ kind: 'free', target: 'npc_lina', text: '聊聊天' })
    const report = g.state!.reports.at(-1)!
    expect(report.check?.source).toBe('ai')
    expect(g.usage[report.report_id]).toEqual({ input: 1200, output: 300, calls: 1 })
    expect(g.totalUsage).toEqual({ input: 1200, output: 300, calls: 1, cached: 0 })
    expect(g.narrations[report.report_id]?.text).toBe('你們聊到深夜。')
  })
})
