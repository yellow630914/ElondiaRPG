import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import combatExample from '../../examples/reports/combat-snake-creek.json'
import travelExample from '../../examples/reports/travel-rivervale-snowridge.json'
import { prepareAction } from '@/engine/actions'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { recruit } from '@/engine/town'
import type { Report } from '@/engine/types'
import { composeJudge, composeNarration, type ComposeOptions } from '@/narrator/compose'
import { loreForReport, loreItems, type Worldbook } from '@/narrator/lore'
import { activeEntries, defaultPromptConfig, normalizeConfig } from '@/narrator/promptConfig'

const book = worldbook as unknown as Worldbook
const combat = combatExample as unknown as Report
const trip = travelExample as unknown as Report
const loreOpts = { adult: false, budgetChars: 20000, playerName: '艾倫' }

function options(patch: Partial<ComposeOptions> = {}): ComposeOptions {
  const config = patch.config ?? defaultPromptConfig()
  return { config, lore: loreItems(book, config.lore, config.customLore), adult: false, budgetChars: 20000, language: 'zh-Hant', ...patch }
}

function game(seed = 16) {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  enterLocation(state)
  return state
}

describe('worldbook entries', () => {
  it('reports the status and injection order of every entry', () => {
    const sel = loreForReport(loreItems(book), combat, loreOpts)
    expect(sel.states[0]).toMatchObject({ status: 'constant', position: 1 })
    expect(sel.states[5]!.status).toBe('off')
    expect(sel.states[30]!.status).toBe('off')
    expect(sel.states[16]!.status).toBe('adult')
    expect(sel.states[46]!.status).toBe('idle')
    const hit = sel.triggered[0]!
    expect(sel.states[hit.uid]).toMatchObject({ status: 'triggered', position: sel.constant.length + 1 })
    expect(sel.states[hit.uid]!.hit).toBeTruthy()
    // 常駐條目全部在觸發條目前面
    const positions = Object.values(sel.states).filter((s) => s.position).map((s) => s.position!).sort((a, b) => a - b)
    expect(positions).toEqual(positions.map((_, i) => i + 1))
    expect(loreForReport(loreItems(book), trip, loreOpts).states[46]).toMatchObject({ status: 'triggered', hit: '旅行報告' })
  })

  it('marks entries cut by the budget', () => {
    const sel = loreForReport(loreItems(book), combat, { ...loreOpts, budgetChars: 6000 })
    expect(Object.values(sel.states).some((s) => s.status === 'budget')).toBe(true)
    expect(sel.chars).toBeLessThanOrEqual(6000)
  })

  it('applies overrides and custom entries', () => {
    const items = loreItems(book, { 0: { mode: 'off' }, 44: { content: '只有一位神。', order: 1 } }, [
      { uid: 100000, comment: '蛇溪的傳說', content: '蛇溪底下睡著一條老蛇。', keys: ['蛇溪'], mode: 'keyword', order: 650, adult: false, builtin: false },
    ])
    const sel = loreForReport(items, combat, loreOpts)
    expect(sel.states[0]!.status).toBe('off')
    expect(sel.constant[0]).toMatchObject({ uid: 44, content: '只有一位神。', edited: true })
    expect(sel.triggered.map((e) => e.comment)).toContain('蛇溪的傳說')
    expect(sel.states[100000]).toMatchObject({ status: 'triggered', hit: '蛇溪' })
  })
})

describe('prompt order for caching', () => {
  it('keeps the narration system identical across different reports', () => {
    const state = game()
    const a = composeNarration(state, combat, options()).prompt
    const b = composeNarration(state, trip, options()).prompt
    expect(a.system).toBe(b.system)
    expect(a.system).toContain('<style>')
    expect(a.system).toContain('埃隆迪亞・史詩奇幻')
    expect(a.system).toContain('埃隆迪亚大陆')
    // 觸發條目與報告在 user，本次要求在最後
    expect(a.user).toContain('<report>')
    expect(a.user.trim().endsWith('請依照上述報告寫出這次事件的詳細經過。')).toBe(true)
    expect(a.system).not.toContain('約 500～900 字')
    const keys = a.sections!.map((s) => s.key)
    // 文風緊接在規則後面，當作規則的最後一條，排在世界書前面
    expect(keys.slice(0, 3)).toEqual(['rules', 'style', 'lore_constant'])
    expect(a.system).toContain('9. 如果提供了 <relationships>')
    expect(a.system).toMatch(/<\/relationship_updates>；沒有明顯改變就不要輸出這一段。\n10\. 文風/)
    expect(keys.indexOf('report')).toBeLessThan(keys.indexOf('request'))
    const parts = a.sections!.map((s) => s.part).join(',')
    expect(parts).toMatch(/^(system,)+(user,?)+$/)
  })

  it('applies styles and custom entries by target and position', () => {
    const config = defaultPromptConfig()
    config.styles[0]!.enabled = false
    config.styles[1]!.enabled = true
    config.styles[1]!.targets = ['narration']
    config.custom = [
      { id: 'a', name: '前段', content: '{{player}}怕水。', enabled: true, targets: ['narration', 'judge'], position: 'system' },
      { id: 'b', name: '後段', content: '這次多寫對白。', enabled: true, targets: ['judge'], position: 'end' },
    ]
    const state = game()
    recruit(state, 'npc_lina')
    const narration = composeNarration(state, combat, options({ config })).prompt
    expect(narration.system).toContain('輕小說')
    expect(narration.system).not.toContain('史詩奇幻')
    expect(narration.system).toContain('艾倫怕水。')
    expect(narration.user).not.toContain('這次多寫對白。')

    const p1 = prepareAction(state, { kind: 'free', target: 'npc_lina', text: '聊聊天' })
    const judge = composeJudge(state, p1, options({ config }))
    expect(judge.lore).toBeUndefined()
    expect(judge.prompt.system).not.toContain('輕小說')
    expect(judge.prompt.system).toContain('艾倫怕水。')
    expect(judge.prompt.system).not.toContain('<worldbook>')
    expect(judge.prompt.user).toContain('<notes>\n這次多寫對白。')
  })

  it('keeps the judgment system identical across actions and can include the worldbook', () => {
    const config = { ...defaultPromptConfig(), loreInJudge: true }
    const s1 = game(16)
    recruit(s1, 'npc_lina')
    const s2 = JSON.parse(JSON.stringify(s1)) as typeof s1
    const a = composeJudge(s1, prepareAction(s1, { kind: 'free', target: 'npc_lina', text: '聊聊天' }), options({ config }))
    const b = composeJudge(s2, prepareAction(s2, { kind: 'free', text: '去河谷問路' }), options({ config }))
    expect(a.prompt.system).toBe(b.prompt.system)
    expect(a.prompt.system).toContain('<worldbook>')
    expect(a.prompt.user).toContain('<effects_allowed>')
    expect(a.prompt.sections!.map((x) => x.key).slice(0, 4)).toEqual(['rules', 'style', 'format', 'lore_constant'])
    expect(a.prompt.system).toContain('9. narrative 的文風')
    expect(b.lore!.states[6]!.status).toBe('triggered')
  })
})

describe('prompt config', () => {
  it('normalizes saved or imported settings', () => {
    expect(normalizeConfig(null).styles.length).toBeGreaterThan(1)
    const c = normalizeConfig({ styles: [{ name: 'x', content: 'y', targets: ['bogus', 'judge'] }], custom: [{ name: 'z', content: 'w' }] })
    expect(c.styles[0]).toMatchObject({ name: 'x', enabled: true, targets: ['judge'] })
    expect(c.custom[0]!.position).toBe('system')
    expect(c.loreInJudge).toBe(false)
    expect(activeEntries(c.styles, 'narration', '艾倫')).toEqual([])
  })
})

describe('prompts store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('persists entries and previews a judgment without touching the game', async () => {
    const { usePrompts } = await import('@/stores/prompts')
    const { useGame } = await import('@/stores/game')
    const prompts = usePrompts()
    const e = prompts.addEntry('styles')
    e.content = '多寫雨聲。'
    prompts.moveEntry('styles', e.id, -1)
    await new Promise((r) => setTimeout(r, 0))
    expect(JSON.parse(localStorage.getItem('elondia.prompts')!).styles.at(-2).content).toBe('多寫雨聲。')

    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    const rng = g.state!.rngState
    const preview = await g.composeJudgePreview()
    expect(preview?.sample).toBe(true)
    expect(preview!.prompt.system).toContain('多寫雨聲。')
    expect(g.state!.pendingAction).toBeUndefined()
    expect(g.state!.rngState).toBe(rng)

    const narration = await g.composeFor(combat)
    expect(narration.lore!.states[0]!.status).toBe('constant')
  })
})
