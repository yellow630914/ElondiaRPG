import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { addHours, commitReport } from '@/engine/state'
import { extractJson } from '@/narrator/judge'
import { normalizeConfig } from '@/narrator/promptConfig'
import {
  applyRegex, BUILTIN_THINK_RULE, compileRules, defaultRegexRules, importTavernRegex, parseTavernFind, regexError, streamingView, type RegexRule,
} from '@/narrator/regex'

// 第一個 chunk 帶著貓神預設那種思考區塊
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async () => '<think_nya>\n先想想 {不是 JSON}\n</think_nya>\n{"degree":"success","summary":"聊得很愉快。","narrative":"<thinking>想一下</thinking>你們聊到深夜。","effects":[]}'),
  streamNarration: vi.fn(async function* () {
    yield '<think_nya>\n喵呼呼～收到人類發來的指令啦！'
    yield '\n</think_nya>\n\n你推開酒館的門。'
    yield '暖黃的燈光撲面而來。'
  }),
}))

const rule = (patch: Partial<RegexRule>): RegexRule => ({ id: 'r', name: 'r', enabled: true, find: '', flags: 'g', replace: '', scopes: ['narration', 'judge'], ...patch })

describe('正文正則', () => {
  it('drops think blocks of any name with the built-in rule and leaves the story', () => {
    const text = '<think_nya>\n喵呼呼～\n</think_nya>\n\n你推開門。<THINKING a="1">x</THINKING>燈光很暖。'
    expect(applyRegex(text, defaultRegexRules(), 'narration')).toBe('你推開門。燈光很暖。')
    // 沒有思考區塊時原樣
    expect(applyRegex('你推開門。', defaultRegexRules(), 'narration')).toBe('你推開門。')
  })

  it('applies rules in order, only for their scope, skipping disabled and broken ones', () => {
    const rules = [
      rule({ find: '貓', replace: '狗', scopes: ['narration'] }),
      rule({ find: '狗', replace: '狼' }),
      rule({ find: '(', replace: 'x' }),
      rule({ find: '狼', replace: '熊', enabled: false }),
    ]
    expect(applyRegex('一隻貓', rules, 'narration')).toBe('一隻狼')
    expect(applyRegex('一隻貓', rules, 'judge')).toBe('一隻貓')
    expect(regexError(rules[2]!)).not.toBe('')
    expect(compileRules(rules)).toBe(compileRules(rules.map((r) => ({ ...r }))))
  })

  it('hides an unfinished think block while streaming', () => {
    const rules = defaultRegexRules()
    expect(streamingView('<think_nya>\n還在想', rules, 'narration')).toBe('')
    expect(streamingView('你推開門。<thi', rules, 'narration')).toBe('你推開門。')
    expect(streamingView('你推開門。<think_nya cl', rules, 'narration')).toBe('你推開門。')
    expect(streamingView('<think_nya>想完了</think_nya>\n你推開門', rules, 'narration')).toBe('你推開門')
    // 內建規則關掉時不藏
    expect(streamingView('<think>還在想', [{ ...BUILTIN_THINK_RULE, enabled: false }], 'narration')).toBe('<think>還在想')
  })

  it('gives old prompt sets the built-in rule and keeps an emptied list empty', () => {
    expect(normalizeConfig({ version: 2, styles: [], custom: [] }).regex.map((r) => r.builtin)).toEqual(['think'])
    expect(normalizeConfig({ version: 2, regex: [] }).regex).toEqual([])
  })

  it('reads JSON after a think block with braces in it', () => {
    expect(extractJson('<think_nya>{亂寫}</think_nya>\n{"a":1}')).toEqual({ a: 1 })
  })
})

describe('匯入 SillyTavern 的 regex', () => {
  it('converts AI-output scripts and explains what it drops', () => {
    expect(parseTavernFind('/<think>[\\s\\S]*?<\\/think>/gis')).toEqual({ find: '<think>[\\s\\S]*?<\\/think>', flags: 'gis' })
    expect(parseTavernFind('a.b')).toEqual({ find: 'a\\.b', flags: 'g' })
    const res = importTavernRegex({
      name: '某個預設',
      extensions: {
        regex_scripts: [
          { scriptName: '去思考', findRegex: '/<think_nya>[\\s\\S]*?<\\/think_nya>/g', replaceString: '', placement: [2], disabled: false, markdownOnly: true, minDepth: 0 },
          { scriptName: '加粗', findRegex: '/重要/g', replaceString: '**{{match}}**', placement: [1, 2], trimStrings: ['（OOC）'] },
          { scriptName: '只改輸入', findRegex: '/x/g', placement: [1] },
          { scriptName: '只改送出', findRegex: '/y/g', placement: [2], promptOnly: true },
          { scriptName: '壞掉', findRegex: '/(/g', placement: [2] },
        ],
      },
    })
    expect(res.rules.map((r) => r.name)).toEqual(['去思考', '加粗', '加粗（刪掉 trimStrings）'])
    expect(res.rules[1]!.replace).toBe('**$&**')
    expect(applyRegex('這很重要（OOC）', res.rules, 'narration')).toBe('這很**重要**')
    expect(res.skipped.map((s) => s.name)).toEqual(['只改輸入', '只改送出', '壞掉'])
    expect(res.notes.join()).toContain('markdownOnly')
    expect(res.notes.join()).toContain('minDepth')
    // 單一腳本、陣列也收
    expect(importTavernRegex({ scriptName: 'a', findRegex: '/a/g' }).rules).toHaveLength(1)
    expect(importTavernRegex([{ scriptName: 'a', findRegex: '/a/g' }, { scriptName: 'b', findRegex: '/b/g' }]).rules).toHaveLength(2)
  })
})

describe('套用在日誌正文', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves the narration without the think block, and the judged narrative too', async () => {
    const { useSettings } = await import('@/stores/settings')
    const { useGame } = await import('@/stores/game')
    const settings = useSettings()
    settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    const s = g.state!
    const report = commitReport(s, {
      schema_version: '0.1', report_id: `r-test-${s.nextReportNo++}`, kind: 'event',
      time: { start: { ...s.time }, end: addHours(s.time, 1) },
      location: { at: s.location }, party: [], outcome: { result: 'success', summary: '走進酒館' }, changes: {},
    })
    await g.narrate(report, { manual: true })
    expect(g.narrations[report.report_id]!.text).toBe('你推開酒館的門。暖黃的燈光撲面而來。')

    // AI 判定寫的經過（同一個來源、判定順便寫經過時直接採用）
    settings.aiJudge = true
    settings.judgeWritesNarrative = true
    await g.perform({ kind: 'free', text: '和酒保聊天' })
    const judged = g.state!.reports.at(-1)!
    expect(judged.check?.degree).toBe('success')
    expect(g.narrations[judged.report_id]?.text).toBe('你們聊到深夜。')
  })
})
