import { describe, expect, it } from 'vitest'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { actionRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { composeJudge, composeNarration, type ComposeOptions } from '@/narrator/compose'
import { ADULT_PLACEHOLDER, continuityForReport, tailOf } from '@/narrator/continuity'
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
    const j = sanitizeJudgment(state, p, { degree: 'partial', attr: 'cha', dc: 12, difficulty: 'trivial', hours: 9 })
    expect(j).toMatchObject({ degree: 'success', trivial: true, hours: 4 })
    const start = { ...state.time }
    const r = resolveAction(state, j)
    expect(r.check).toMatchObject({ degree: 'success', trivial: true })
    // 日常小事的骰值只決定過程，不算「和骰值不同」
    expect(r.check!.reference_degree).toBeUndefined()
    expect(r.outcome.tags).toContain('日常小事')
    expect((r.time.end.hour ?? 0) * 60 + (r.time.end.minute ?? 0) - ((start.hour ?? 0) * 60 + (start.minute ?? 0))).toBe(240)
  })

  it('keeps the AI\'s failure when it also marks the action trivial (a refusal is not logged as a success)', () => {
    const state = game()
    for (const degree of ['fail', 'fumble'] as const) {
      const p = prepareAction(state, { kind: 'free', text: '要初次見面的人把全部財產送給我' })
      p.natural = 14
      const j = sanitizeJudgment(state, p, { degree, attr: 'cha', dc: 12, difficulty: 'trivial' })
      expect(j.degree).toBe(degree)
      expect(j.trivial).toBeUndefined()
      state.pendingAction = undefined
    }
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

describe('buying several of one thing', () => {
  it('lets a paid purchase bring up to item_qty_bought of the same item, free items stay at item_qty', () => {
    const state = game()
    const p = prepareAction(state, { kind: 'free', text: '在市集比價後買 3 份乾糧' })
    const bought = sanitizeJudgment(state, p, { degree: 'success', difficulty: 'trivial', effects: [{ type: 'money', amount: -12 }, { type: 'item', name: '乾糧', qty: 3 }] })
    expect(bought.effects).toContainEqual({ type: 'item', name: '乾糧', qty: 3 })
    expect(bought.adjusted ?? []).toHaveLength(0)
    const many = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'money', amount: -40 }, { type: 'item', name: '乾糧', qty: 9 }] })
    expect(many.effects).toContainEqual({ type: 'item', name: '乾糧', qty: actionRules.caps.item_qty_bought })
    const gift = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'item', name: '乾糧', qty: 3 }] })
    expect(gift.effects).toContainEqual({ type: 'item', name: '乾糧', qty: actionRules.caps.item_qty })
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

  it('uses the custom word counts when the length is set to custom', () => {
    const state = game()
    const r = act(state, '在廣場上看看有什麼新鮮事')
    const customLength = { short: [300, 500], medium: [1200, 1800], long: [2000, 3000] } as ComposeOptions['config']['customLength']
    expect(composeNarration(state, r, options({ lengthScale: 'custom', customLength })).prompt.user).toContain('篇幅：約 1200～1800 字')
    // 判定時順便寫的經過也照這個
    const p = prepareAction(state, { kind: 'free', text: '在廣場上看看有什麼新鮮事' })
    expect(composeJudge(state, p, options({ lengthScale: 'custom', customLength })).prompt.user).toContain('narrative 篇幅：約 1200～1800 字')
  })
})

describe('narration point of view', () => {
  it('writes second person by default and follows the point-of-view setting in narration and judging', () => {
    const state = game()
    const r = act(state, '在廣場上看看有什麼新鮮事')
    expect(composeNarration(state, r, options()).prompt.user).toContain('視角：第二人稱，以「你」指稱主角艾倫')
    expect(composeNarration(state, r, options({ pov: 'third' })).prompt.user).toContain('視角：第三人稱，以名字「艾倫」')
    expect(composeNarration(state, r, options({ pov: 'first' })).prompt.user).toContain('視角：第一人稱')
    const p = prepareAction(state, { kind: 'free', text: '散步' })
    expect(composeJudge(state, p, options({ pov: 'first' })).prompt.user).toContain('narrative 視角：第一人稱')
    // 只改本次要求，system 不變（可以共用快取）
    expect(composeNarration(state, r, options({ pov: 'third' })).prompt.system).toBe(composeNarration(state, r, options()).prompt.system)
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

  it('does not send adult scenes to the general narration or the judge', () => {
    const state = game()
    const scene = act(state, '和她回房間')
    scene.narration!.adult_scene = '娼館的親密場景'
    scene.outcome.summary = '和薇拉在房裡共度了一晚（成人摘要）'
    const narrations: Record<string, { text: string; status: string }> = { [scene.report_id]: { text: '她的手指滑過你的肩……（露骨描寫）', status: 'done' } }
    // 上一段正文是成人場景：一般日誌與一般判定只帶中性的一句
    const next = act(state, '下樓吃早餐')
    const plain = composeNarration(state, next, options(), narrations).prompt.user
    expect(plain).toContain(ADULT_PLACEHOLDER)
    expect(plain).not.toContain('露骨描寫')
    const p = prepareAction(state, { kind: 'free', text: '問老闆今天的天氣' })
    const judge = composeJudge(state, p, options(), narrations).prompt.user
    expect(judge).toContain(ADULT_PLACEHOLDER)
    expect(judge).not.toContain('露骨描寫')
    resolveAction(state, null)
    // 沒有寫成正文的成人日誌：幕間只寫中性的一句
    const later = act(state, '再和她回房間')
    later.narration!.adult_scene = '娼館的親密場景'
    later.outcome.summary = '又和薇拉共度了一晚（成人摘要）'
    const after = act(state, '出門買東西')
    const c = continuityForReport(state, narrations, after)
    expect(c.interlude.join('\n')).not.toContain('成人摘要')
    expect(c.interlude.join('\n')).toContain(ADULT_PLACEHOLDER)
    // 成人場景自己的請求照常帶原文
    const adultNext = act(state, '晚上再去找她')
    adultNext.narration!.adult_scene = '娼館的親密場景'
    const own = continuityForReport(state, narrations, adultNext)
    expect(own.interlude.join('\n')).toContain('成人摘要')
    expect(own.previous).toContain('露骨描寫')
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

describe('several earlier narrations', () => {
  it('sends the last few passages: the latest longer, the earlier ones as summary and ending, oldest first', () => {
    const state = game()
    const texts = ['第一段：你在城門口遇見了老騎士羅蘭，他答應明天教你劍術。', '第二段：你把羅蘭給的護符掛在脖子上。', '第三段：酒館老闆說羅蘭其實是退役的近衛隊長。']
    const narrations: Record<string, { text: string; status: string; placeholder?: boolean }> = {}
    const done = texts.map((t, i) => {
      const r = act(state, `第 ${i + 1} 件事`)
      narrations[r.report_id] = { text: `${'鋪陳的句子。'.repeat(60)}\n${t}`, status: 'done' }
      return r
    })
    const now = act(state, '去找羅蘭')
    const one = continuityForReport(state, narrations, now)
    expect(one.earlier).toBeUndefined()
    expect(one.previous).toBe(tailOf(narrations[done[2]!.report_id]!.text))
    const three = continuityForReport(state, narrations, now, 3)
    expect(three.earlier).toHaveLength(2)
    expect(three.earlier![0]).toContain('第一段')
    expect(three.earlier![1]).toContain('第二段')
    expect(three.earlier![0]).toContain(done[0]!.outcome.summary!.slice(0, 10))
    expect(three.previous!.length).toBeGreaterThan(one.previous!.length)
    expect(three.previous).toContain('第三段')
    // 要的段數比寫過的多：有幾段給幾段
    expect(continuityForReport(state, narrations, now, 10).earlier).toHaveLength(2)
    // 提示詞：<earlier> 放在 <previous> 前面，設定的段數照用
    const user = composeNarration(state, now, options({ continuityCount: 3 }), narrations).prompt.user
    expect(user.indexOf('<earlier>')).toBeGreaterThan(-1)
    expect(user.indexOf('<earlier>')).toBeLessThan(user.indexOf('<previous>'))
    expect(user).toContain('不要重寫、摘要或複述它')
    expect(composeNarration(state, now, options({ continuityCount: 1 }), narrations).prompt.user).not.toContain('<earlier>')
  })

  it('keeps earlier adult passages out of general requests', () => {
    const state = game()
    const scene = act(state, '和她回房間')
    scene.narration!.adult_scene = '娼館的親密場景'
    const plain = act(state, '下樓吃早餐')
    const narrations = { [scene.report_id]: { text: '（露骨描寫）', status: 'done' }, [plain.report_id]: { text: '你吃了早餐。', status: 'done' } }
    const now = act(state, '出門')
    const c = continuityForReport(state, narrations, now, 3)
    expect(c.earlier!.join('')).toContain(ADULT_PLACEHOLDER)
    expect(c.earlier!.join('')).not.toContain('露骨描寫')
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
    expect(c).toMatchObject({ pov: 'auto', customLength: { short: [200, 400], medium: [500, 900], long: [1000, 1500] } })
    expect(normalizeConfig({ pov: 'third' }).pov).toBe('third')
    expect(normalizeConfig({ pov: 'fourth' }).pov).toBe('auto')
    // 自訂篇幅：夾在範圍內、下限不大於上限，壞掉的那一檔用預設
    expect(normalizeConfig({ lengthScale: 'custom', customLength: { short: [900, 100], medium: [10, 99999], long: 'x' } })).toMatchObject({
      lengthScale: 'custom', customLength: { short: [100, 900], medium: [50, 6000], long: [1000, 1500] },
    })
  })
})
