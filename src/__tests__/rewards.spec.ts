import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
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

describe('AI effects stay within what the party has', () => {
  function pending(state: GameState) {
    state.money_cc = 100
    state.inventory.push({ name: '治療藥劑', qty: 2 })
    return prepareAction(state, { kind: 'free', text: '試試看' })
  }

  it('never spends more money than the party holds, even over several entries', () => {
    const state = game(3, 'fighter')
    const p = pending(state)
    const spend = (amounts: number[]) => sanitizeJudgment(state, p, { degree: 'fail', effects: amounts.map((amount) => ({ type: 'money', amount })) }).effects
    expect(spend([-100, -100])).toEqual([{ type: 'money', amount: -100 }])
    expect(spend([-60, -60])).toEqual([{ type: 'money', amount: -60 }, { type: 'money', amount: -40 }])
    // 先賺再花：賺到的也可以花掉
    expect(spend([30, -200])).toEqual([{ type: 'money', amount: 30 }, { type: 'money', amount: -130 }])
  })

  it('gives away no more of an item than the party holds, even over several entries', () => {
    const state = game(3, 'fighter')
    const p = pending(state)
    const effects = [{ type: 'item', name: '治療藥劑', qty: -2 }, { type: 'item', name: '治療藥劑', qty: -2 }]
    expect(sanitizeJudgment(state, p, { degree: 'fail', effects }).effects).toEqual([{ type: 'item', name: '治療藥劑', qty: -2 }])
  })

  it('keeps reputation changes to known factions, by id or name', () => {
    const state = game(3, 'fighter')
    const p = pending(state)
    const rep = (faction: string) => sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'reputation', faction, delta: 1 }] }).effects
    expect(rep('holy_ring')).toEqual([{ type: 'reputation', faction: 'holy_ring', delta: 1 }])
    expect(rep('聖環教廷')).toEqual([{ type: 'reputation', faction: 'holy_ring', delta: 1 }])
    expect(rep('亂寫的勢力')).toEqual([])
  })

  it('tells the writer when a proposed amount was cut down', () => {
    const state = game(3, 'fighter')
    const p = pending(state)
    const j = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'money', amount: 1000 }, { type: 'item', name: '金幣袋', qty: 5 }] })
    expect(j.adjusted).toHaveLength(2)
    expect(j.adjusted![0]).toContain('超過上限')
    expect(sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'money', amount: 10 }] }).adjusted).toBeUndefined()
    // 寫手拿到實際結算的數字
    expect(resolveAction(state, j).narration?.focus?.filter((f) => f.includes('超過上限'))).toHaveLength(2)
    expect(state.money_cc).toBe(100 + 30 * state.party[0]!.level)
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
    settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-sonnet-5-5' }
    settings.sources[0]!.provider = 'anthropic'
    settings.aiJudge = true
    // 判定時順便寫出經過：一次呼叫
    settings.judgeWritesNarrative = true
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    standOn(g.state!, 'tavern')
    g.recruit('npc_lina')
    await g.perform({ kind: 'free', target: 'npc_lina', text: '聊聊天' })
    const report = g.state!.reports.at(-1)!
    expect(report.check?.source).toBe('ai')
    const source = settings.sources[0]!.name
    expect(g.usage[report.report_id]).toEqual({
      input: 1200, output: 300, calls: 1,
      by: [{ feature: 'judge', source, provider: 'anthropic', model: 'claude-sonnet-5-5', input: 1200, output: 300, calls: 1 }],
    })
    expect(g.totalUsage).toEqual({ input: 1200, output: 300, calls: 1, cached: 0 })
    expect(g.usageBySource).toEqual([{ source, provider: 'anthropic', model: 'claude-sonnet-5-5', input: 1200, output: 300, calls: 1, cached: 0, features: ['judge'] }])
    expect(g.narrations[report.report_id]?.text).toBe('你們聊到深夜。')
  })

  it('groups usage by source and keeps old entries without a source', async () => {
    const { useGame, usageSourceLabel } = await import('@/stores/game')
    const g = useGame()
    const part = { source: '來源 2', provider: 'gemini' as const, model: 'gemini-pro-latest' }
    g.usage = {
      r1: { input: 100, output: 10, calls: 2, by: [{ feature: 'judge', ...part, input: 60, output: 4, calls: 1 }, { feature: 'narration', ...part, input: 40, output: 6, calls: 1 }] },
      old: { input: 5, output: 1, calls: 1 },
    }
    expect(g.usageBySource).toEqual([
      { ...part, input: 100, output: 10, calls: 2, cached: 0, features: ['judge', 'narration'] },
      { source: '', provider: '', model: '', input: 5, output: 1, calls: 1, cached: 0, features: [] },
    ])
    expect(usageSourceLabel(part)).toBe('來源 2（Google Gemini gemini-pro-latest）')
    expect(usageSourceLabel(g.usageBySource[1]!)).toBe('未記錄來源')
  })
})

describe('model sources', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('migrates the old single-service settings into source 1', async () => {
    localStorage.setItem('elondia.settings', JSON.stringify({ provider: 'gemini', configs: { gemini: { apiKey: 'AIza-old', model: 'gemini-pro-latest' } }, aiJudge: true }))
    const { useSettings } = await import('@/stores/settings')
    const settings = useSettings()
    expect(settings.sources.length).toBe(3)
    expect(settings.sources[0]).toMatchObject({ name: '來源 1', provider: 'gemini' })
    expect(settings.sources[0]!.configs.gemini.apiKey).toBe('AIza-old')
    // 來源 2、3 先複製一份，只要改模型就好
    expect(settings.sources[1]!.configs.gemini.apiKey).toBe('AIza-old')
    expect(settings.sourceFor('shop')).toMatchObject({ index: 0, provider: 'gemini' })
    expect(settings.ready('judge')).toBe(true)
    // 預設判定與正文分開
    expect(settings.splitJudgeNarrative()).toBe(true)
    settings.judgeWritesNarrative = true
    expect(settings.splitJudgeNarrative()).toBe(false)
  })

  it('narrates a judged action with the narration prompt by default, even with AI narration off', async () => {
    const { useSettings } = await import('@/stores/settings')
    const { useGame } = await import('@/stores/game')
    const providers = await import('@/narrator/providers')
    const settings = useSettings()
    settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
    settings.aiJudge = true
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    standOn(g.state!, 'tavern')
    g.recruit('npc_lina')
    await g.perform({ kind: 'free', target: 'npc_lina', text: '聊聊天' })
    const judgePrompt = vi.mocked(providers.completeText).mock.calls[0]![2] as { system: string }
    expect(judgePrompt.system).toContain('narrative 填空字串')
    await new Promise((r) => setTimeout(r, 0))
    const narrationPrompt = vi.mocked(providers.streamNarration).mock.calls[0]![2] as { system: string; user: string }
    expect(narrationPrompt.system).toContain('敘事者')
    expect(narrationPrompt.user).toContain('聊聊天')
    // 其他種類的日誌：AI 細節描述關閉時不自動寫
    const report = g.state!.reports.at(-1)!
    expect(settings.autoNarrates(report)).toBe(true)
    expect(settings.autoNarrates({ ...report, check: undefined, kind: 'combat' })).toBe(false)
    settings.aiNarration = true
    expect(settings.autoNarrates({ ...report, check: undefined, kind: 'combat' })).toBe(true)
    settings.narrateKinds.combat = false
    expect(settings.autoNarrates({ ...report, check: undefined, kind: 'combat' })).toBe(false)
  })

  it('sends each feature to its own source, and lets the writing model write the action', async () => {
    const { useSettings } = await import('@/stores/settings')
    const { useGame } = await import('@/stores/game')
    const providers = await import('@/narrator/providers')
    const settings = useSettings()
    settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
    settings.sources[1]!.provider = 'gemini'
    settings.sources[1]!.configs.gemini = { apiKey: 'AIza', model: 'gemini-flash-latest' }
    settings.routes.judge = 1
    settings.aiJudge = true
    expect(settings.splitJudgeNarrative()).toBe(true)
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    standOn(g.state!, 'tavern')
    g.recruit('npc_lina')
    await g.perform({ kind: 'free', target: 'npc_lina', text: '聊聊天' })
    const judgeCall = vi.mocked(providers.completeText).mock.calls[0]!
    expect(judgeCall[0]).toBe('gemini')
    expect(judgeCall[1]).toMatchObject({ model: 'gemini-flash-latest' })
    const prompt = judgeCall[2] as { system: string; user: string }
    expect(prompt.system).toContain('narrative 填空字串')
    expect(prompt.system).not.toContain('<style>')
    // 經過交給敘事正文的來源（即使沒開 AI 細節描述）
    await new Promise((r) => setTimeout(r, 0))
    const narrationCall = vi.mocked(providers.streamNarration).mock.calls[0]!
    expect(narrationCall[0]).toBe('anthropic')
    expect(narrationCall[1]).toMatchObject({ model: 'claude-opus-5-5' })
  })

  it('sends adult scenes to their own source, even when the judge wrote the narrative', async () => {
    const { useSettings } = await import('@/stores/settings')
    const { useGame } = await import('@/stores/game')
    const providers = await import('@/narrator/providers')
    const settings = useSettings()
    settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
    settings.sources[2]!.provider = 'gemini'
    settings.sources[2]!.configs.gemini = { apiKey: 'AIza', model: 'gemini-pro-latest' }
    settings.adult = true
    await nextTick()
    expect(settings.routes.adult).toBe(0)
    settings.routes.adult = 2
    settings.aiJudge = true
    settings.judgeWritesNarrative = true
    expect(settings.splitJudgeNarrative()).toBe(false)
    vi.mocked(providers.completeText).mockResolvedValueOnce(JSON.stringify({ degree: 'success', summary: '共度一夜。', narrative: '判定寫的經過。', adult_scene: '和莉娜共度一夜', effects: [] }))
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    standOn(g.state!, 'tavern')
    g.recruit('npc_lina')
    await g.perform({ kind: 'free', target: 'npc_lina', text: '邀她回房' })
    await new Promise((r) => setTimeout(r, 0))
    const report = g.state!.reports.at(-1)!
    expect(report.narration?.adult_scene).toBe('和莉娜共度一夜')
    expect(settings.narrationFeature(report)).toBe('adult')
    // 判定寫的經過不採用，交給成人場景正文的來源重寫
    expect(g.narrations[report.report_id]?.text).not.toBe('判定寫的經過。')
    const call = vi.mocked(providers.streamNarration).mock.calls[0]!
    expect(call[0]).toBe('gemini')
    expect((call[2] as { system: string }).system).toContain('<adult_scene>')
    // 成人向關閉時一律用敘事正文
    settings.adult = false
    expect(settings.narrationFeature(report)).toBe('narration')
  })

  it('gives old settings an adult route matching narration', async () => {
    localStorage.setItem('elondia.settings', JSON.stringify({ routes: { narration: 1, judge: 2 } }))
    const { useSettings } = await import('@/stores/settings')
    expect(useSettings().routes).toMatchObject({ narration: 1, adult: 1, judge: 2 })
  })
})
