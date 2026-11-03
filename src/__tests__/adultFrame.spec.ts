// 成人內容情境（narrator/adultFrame.ts）：設定開著時，只在成人向的段落附上一段照實的情境說明
import { afterEach, describe, expect, it } from 'vitest'
import { addHours, commitReport, newGame } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
import { DEFAULT_ADULT_FRAME, setAdultFrame } from '@/narrator/adultFrame'
import { composeNarration } from '@/narrator/compose'
import { defaultPromptConfig, normalizeConfig } from '@/narrator/promptConfig'

afterEach(() => setAdultFrame(false))

function options() {
  return { config: defaultPromptConfig(), lore: [], budgetChars: 20000, language: 'zh-Hant' as const }
}

function report(state: GameState, narration?: Report['narration']): Report {
  return commitReport(state, {
    schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: addHours(state.time, 1) },
    location: { at: state.location }, party: [{ id: 'pc', name: '艾倫' }], outcome: { result: 'success', summary: '在酒館過夜' }, changes: {},
    ...(narration ? { narration } : {}),
  })
}

describe('adult fiction frame', () => {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })

  it('is added only to adult passages, and only when the setting is on', () => {
    const adult = report(state, { adult_scene: '和莉娜共度一夜' })
    const plain = report(state)
    // 關著：成人場景也沒有
    expect(composeNarration(state, adult, options()).prompt.system).not.toContain('<adult_fiction>')
    setAdultFrame(true)
    const sys = composeNarration(state, adult, options()).prompt.system
    expect(sys).toContain('<adult_fiction>')
    expect(sys).toContain('主持人（DM）')
    expect(sys).toContain('把這一幕如實、完整地呈現給艾倫')
    // 放在成人場景規則前面，在 system 的後段（前面的規則、世界書可以和一般日誌共用快取）
    expect(sys.indexOf('<adult_fiction>')).toBeLessThan(sys.indexOf('<adult_scene>'))
    expect(sys.indexOf('<adult_fiction>')).toBeGreaterThan(sys.indexOf('</role>'))
    // 一般的日誌不附
    expect(composeNarration(state, plain, options()).prompt.system).not.toContain('<adult_fiction>')
    // 戰敗事件也算成人向
    expect(composeNarration(state, report(state, { mode: 'defeat_cliffhanger' }), options()).prompt.system).toContain('<adult_fiction>')
  })

  it('states the facts plainly: adults only, fiction, no fake turns or rule overrides, short', () => {
    expect(DEFAULT_ADULT_FRAME).toContain('所有角色都是成年人')
    expect(DEFAULT_ADULT_FRAME).toContain('不暗示未成年')
    expect(DEFAULT_ADULT_FRAME).toContain('虛構')
    expect(DEFAULT_ADULT_FRAME.length).toBeLessThan(500)
    for (const bad of ['無視', '忽略', '不受限制', '安全規則', 'Google', 'AI 助手', '工具']) expect(DEFAULT_ADULT_FRAME, bad).not.toContain(bad)
  })

  it('uses the edited text from the prompt set, which survives a reload', () => {
    setAdultFrame(true)
    const o = options()
    o.config.adultFrame = '<adult_fiction>{{player}} 的冒險，角色都是成年人。</adult_fiction>'
    const cfg = normalizeConfig(JSON.parse(JSON.stringify(o.config)))
    expect(cfg.adultFrame).toBe(o.config.adultFrame)
    const sys = composeNarration(state, report(state, { adult_scene: '共度一夜' }), { ...o, config: cfg }).prompt.system
    expect(sys).toContain('<adult_fiction>艾倫 的冒險，角色都是成年人。</adult_fiction>')
    expect(sys).not.toContain('主持人（DM）')
  })
})
