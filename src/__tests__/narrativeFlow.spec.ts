import { describe, expect, it } from 'vitest'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { actionRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { composeJudge, composeNarration, type ComposeOptions } from '@/narrator/compose'
import { continuityForReport, tailOf } from '@/narrator/continuity'
import { loreItems, type Worldbook } from '@/narrator/lore'
import { defaultPromptConfig, normalizeConfig } from '@/narrator/promptConfig'
import { varietyHint } from '@/narrator/prompt'

const book = worldbook as unknown as Worldbook

function options(patch: Partial<ComposeOptions['config']> = {}): ComposeOptions {
  const config = { ...defaultPromptConfig(), ...patch }
  return { config, lore: loreItems(book, config.lore, config.customLore), budgetChars: 20000, language: 'zh-Hant' }
}

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 16, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

/** 做一次自由行動，回傳日誌 */
function act(state: GameState, text: string, judgment: Record<string, unknown> | null = null, natural = 10) {
  const p = prepareAction(state, { kind: 'free', text })
  p.natural = natural
  return resolveAction(state, judgment ? sanitizeJudgment(state, p, judgment) : null)
}

describe('everyday actions (difficulty)', () => {
  it('turns a trivial action into at least a success and lets the AI set the time spent', () => {
    const state = game()
    const p = prepareAction(state, { kind: 'free', text: '去雜貨店買一條麵包' })
    p.natural = 2
    const j = sanitizeJudgment(state, p, { degree: 'fail', attr: 'cha', dc: 12, difficulty: 'trivial', hours: 9 })
    expect(j).toMatchObject({ degree: 'success', trivial: true, hours: 4 })
    const start = { ...state.time }
    const r = resolveAction(state, j)
    expect(r.check).toMatchObject({ degree: 'success', trivial: true })
    // 日常小事的骰值只決定過程，不算「和骰值不同」
    expect(r.check!.reference_degree).toBeUndefined()
    expect(r.outcome.tags).toContain('日常小事')
    expect((r.time.end.hour ?? 0) * 60 + (r.time.end.minute ?? 0) - ((start.hour ?? 0) * 60 + (start.minute ?? 0))).toBe(240)
  })

  it('keeps critical results, ignores normal difficulty and rounds hours to quarters', () => {
    const state = game()
    const p = prepareAction(state, { kind: 'free', text: '和店主閒聊' })
    expect(sanitizeJudgment(state, p, { degree: 'critical', difficulty: 'trivial' }).degree).toBe('critical')
    const normal = sanitizeJudgment(state, p, { degree: 'fail', difficulty: 'normal', hours: 0.3 })
    expect(normal).toMatchObject({ degree: 'fail', hours: 0.25 })
    expect(normal.trivial).toBeUndefined()
    expect(sanitizeJudgment(state, p, { degree: 'fail' }).hours).toBeUndefined()
  })

  it('only applies to actions marked as possibly trivial', () => {
    const state = game()
    const free = actionRules.kinds.free
    const saved = { trivial: free.trivial, hours_range: free.hours_range }
    delete free.trivial
    delete free.hours_range
    try {
      const p = prepareAction(state, { kind: 'free', text: '去雜貨店買一條麵包' })
      expect(sanitizeJudgment(state, p, { degree: 'fail', difficulty: 'trivial', hours: 2 })).toMatchObject({ degree: 'fail' })
      expect(sanitizeJudgment(state, p, { degree: 'fail', difficulty: 'trivial', hours: 2 }).hours).toBeUndefined()
    } finally {
      Object.assign(free, saved)
    }
  })

  it('tells the judge when an action may be trivial and how long it may take', () => {
    const state = game()
    const p = prepareAction(state, { kind: 'free', text: '去雜貨店買一條麵包' })
    const user = composeJudge(state, p, options()).prompt.user
    expect(user).toContain('可以判為日常小事')
    expect(user).toContain('hours 可以填 0.25～4')
  })
})

describe('narration length', () => {
  it('writes free actions at medium length and follows the length setting', () => {
    const state = game()
    const r = act(state, '在廣場上看看有什麼新鮮事')
    expect(r.narration?.length).toBe('medium')
    expect(composeNarration(state, r, options()).prompt.user).toContain('篇幅：約 500～900 字')
    expect(composeNarration(state, r, options({ lengthScale: 'longer' })).prompt.user).toContain('篇幅：約 900～1400 字')
    expect(composeNarration(state, r, options({ lengthScale: 'shorter' })).prompt.user).toContain('篇幅：約 400～700 字')
  })

  it('keeps the system prompt identical across length settings (only the request changes)', () => {
    const state = game()
    const r = act(state, '在廣場上看看有什麼新鮮事')
    expect(composeNarration(state, r, options({ lengthScale: 'longer' })).prompt.system).toBe(composeNarration(state, r, options()).prompt.system)
  })
})

describe('continuity between narrations', () => {
  it('passes the end of the last narration and what happened since then', () => {
    const state = game()
    const first = act(state, '在廣場上看看有什麼新鮮事')
    const narrations: Record<string, { text: string; status: string }> = {
      [first.report_id]: { text: `${'你在廣場上繞了一圈。'.repeat(40)}\n最後你決定去酒館坐坐。`, status: 'done' },
    }
    const skipped = act(state, '把行囊整理一遍')
    expect(standOn(state, 'tavern')).toBe(true)
    const p = prepareAction(state, { kind: 'free', text: '點一杯麥酒' })
    const judge = composeJudge(state, p, options(), narrations).prompt.user
    expect(judge).toContain('<previous>')
    expect(judge).toContain('最後你決定去酒館坐坐。')
    expect(judge).toContain(skipped.outcome.summary!.slice(0, 20))
    expect(judge).toMatch(/移動：來到[^\n]*酒館/)
    expect(judge).toContain('把行囊整理一遍')

    const r = resolveAction(state, null)
    const c = continuityForReport(state, narrations, r)
    expect(c.previous).toBe(tailOf(narrations[first.report_id]!.text))
    expect(c.previous!.startsWith('……')).toBe(true)
    expect(c.interlude.some((l) => l.includes('酒館'))).toBe(true)
    const user = composeNarration(state, r, options(), narrations).prompt.user
    expect(user).toContain('<interlude>')
    expect(user).toContain('從它之後接著寫')
    // 上一段正文之前的事不算
    expect(c.interlude.filter((l) => !l.includes('移動'))).toHaveLength(1)

    const off = composeNarration(state, r, options({ continuity: false }), narrations).prompt.user
    expect(off).not.toContain('<previous>')
    expect(off).not.toContain('<interlude>')
  })

  it('skips placeholders, unfinished narrations and reports already narrated', () => {
    const state = game()
    const a = act(state, '散步')
    const b = act(state, '看看告示板')
    const narrations = { [a.report_id]: { text: '', status: 'done', placeholder: true }, [b.report_id]: { text: '寫到一半', status: 'streaming' } }
    const r = act(state, '回旅店')
    const c = continuityForReport(state, narrations, r)
    expect(c.previous).toBeUndefined()
    expect(c.interlude.length).toBeGreaterThanOrEqual(2)
  })
})

describe('varying the structure', () => {
  it('rotates the opening and the ending between consecutive reports', () => {
    expect(varietyHint('r-000010')).not.toBe(varietyHint('r-000011'))
    expect(varietyHint('r-000010').split('；')[0]).not.toBe(varietyHint('r-000011').split('；')[0])
    // 戰敗事件的前半段：收尾已經規定好，只給開場
    expect(varietyHint('r-000010', true)).not.toContain('收尾')
    const state = game()
    const r = act(state, '在廣場上看看有什麼新鮮事')
    expect(composeNarration(state, r, options()).prompt.user).toContain(`這次的寫法：${varietyHint(r.report_id)}`)
    expect(composeNarration(state, r, options({ variety: false })).prompt.user).not.toContain('這次的寫法')
  })
})

describe('prompt settings', () => {
  it('turns continuity and variety on for old settings', () => {
    const c = normalizeConfig({ version: 2, styles: [], custom: [], lore: {}, customLore: [], loreInJudge: false })
    expect(c).toMatchObject({ lengthScale: 'standard', continuity: true, variety: true })
    expect(normalizeConfig({ lengthScale: 'longer', continuity: false, variety: false })).toMatchObject({ lengthScale: 'longer', continuity: false, variety: false })
    expect(normalizeConfig({ lengthScale: 'huge' }).lengthScale).toBe('standard')
  })
})
