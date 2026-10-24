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
import { activeEntries, defaultPromptConfig, normalizeConfig, parseEntryFile } from '@/narrator/promptConfig'
import { styleLead } from '@/narrator/prompt'

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
    // 預設規則有 {{style}}：文風放在硬性規則的最後一條（規則區塊裡），排在世界書前面
    expect(keys.slice(0, 2)).toEqual(['rules', 'lore_constant'])
    expect(a.system).toContain('10. 如果提供了 <relationships>')
    expect(a.system).toMatch(/<\/relationship_updates>；沒有明顯改變就不要輸出這一段。\n11\. 文風/)
    expect(a.system.indexOf('11. 文風')).toBeLessThan(a.system.indexOf('</hard_rules>'))
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
    expect(a.prompt.system).toContain('10. 文風（narrative）')
    // 規則的「9.」只出現一次（文風接續成第 10 條）
    expect(a.prompt.system.match(/^9\./gm)).toHaveLength(1)
    expect(b.lore!.states[6]!.status).toBe('triggered')
  })
})

describe('narration rules', () => {
  it('uses the default rules until the player edits them, and restores them', () => {
    const state = game()
    const def = composeNarration(state, combat, options()).prompt
    expect(def.system).toContain('7. 使用繁體中文。')
    expect(def.system).toContain('11. 文風')
    // 規則本身列了「{{...}}」當作禁止輸出的例子；只檢查佔位符都換掉了
    expect(def.system).not.toMatch(/\{\{(language|player|currency|style)\}\}/)
    const config = { ...defaultPromptConfig(), narrationRules: '你是說書人，{{player}}是主角。\n1. 用{{language}}。\n2. 每段不超過三句。' }
    const edited = composeNarration(state, combat, options({ config })).prompt
    expect(edited.system).toContain('你是說書人，艾倫是主角。\n1. 用繁體中文。')
    expect(edited.system).toContain('3. 文風')
    expect(edited.system).not.toContain('不可新增報告沒有的戰利品')
    // 空白或讀回來的空字串都用預設
    expect(composeNarration(state, combat, options({ config: { ...config, narrationRules: '  ' } })).prompt.system).toBe(def.system)
    expect(normalizeConfig({ narrationRules: '' }).narrationRules).toBeUndefined()
    expect(normalizeConfig({ narrationRules: 'x' }).narrationRules).toBe('x')
  })

  it('numbers the style after the line right before it', () => {
    expect(styleLead('<framework>\n1. a\n12. b\n</framework>\n<hard_rules>\n1. c\n10. d\n')).toBe('11. 文風')
    expect(styleLead('<execution>\n- 段落\n- 用字\n')).toBe('- 文風')
    expect(styleLead('<negative>\n- x\n</negative>')).toBe('文風')
    expect(styleLead('')).toBe('文風')
  })

  it('puts the style where {{style}} is', () => {
    const state = game()
    const config = { ...defaultPromptConfig(), narrationRules: '<hard_rules>\n1. 甲\n2. 乙\n{{style}}\n</hard_rules>\n<negative>\n- 丙\n</negative>' }
    const p = composeNarration(state, combat, options({ config })).prompt
    expect(p.system).toMatch(/2\. 乙\n3\. 文風[\s\S]*<\/style>\n<\/hard_rules>\n<negative>/)
    expect(p.sections!.some((x) => x.key === 'style')).toBe(false)
    const off = { ...config, styles: config.styles.map((e) => ({ ...e, enabled: false })) }
    expect(composeNarration(state, combat, options({ config: off })).prompt.system).toContain('2. 乙\n</hard_rules>')
  })
})

describe('prompt config', () => {
  it('normalizes saved or imported settings', () => {
    expect(normalizeConfig(null).styles.length).toBeGreaterThan(1)
    const c = normalizeConfig({ styles: [{ name: 'x', content: 'y', targets: ['bogus', 'judge'] }], custom: [{ name: 'z', content: 'w' }] })
    expect(c.styles[0]).toMatchObject({ name: 'x', enabled: true, targets: ['judge'] })
    expect(c.custom[0]!.position).toBe('system')
    expect(c.loreInJudge).toBe(false)
    expect(activeEntries(c.styles, 'narration', '艾倫', { adult: true })).toEqual([])
  })

  it('adds the adult-scene target to old entries that applied to narration', () => {
    const old = normalizeConfig({ styles: [{ name: 'a', content: 'x', targets: ['narration', 'judge'] }, { name: 'b', content: 'y', targets: ['judge'] }] })
    expect(old.version).toBe(2)
    expect(old.styles.map((e) => e.targets)).toEqual([['narration', 'adult', 'judge'], ['judge']])
    // version 2：玩家拿掉的成人場景不會加回來
    const now = normalizeConfig({ version: 2, styles: [{ name: 'a', content: 'x', targets: ['narration'] }] })
    expect(now.styles[0]!.targets).toEqual(['narration'])
    expect(parseEntryFile('styles', JSON.stringify([{ name: 'a', content: 'x', targets: ['narration'] }]))[0]!.targets).toEqual(['narration', 'adult'])
  })

  it('sends adult entries only with the adult setting on', () => {
    const list = normalizeConfig({ version: 2, styles: [
      { name: '一般', content: 'x', targets: ['narration'] },
      { name: '成人', content: 'y', targets: ['narration', 'adult'], adult: true },
    ] }).styles
    expect(list[1]!.adult).toBe(true)
    expect(list[0]!.adult).toBeUndefined()
    expect(activeEntries(list, 'narration', '艾倫', { adult: false }).map((e) => e.name)).toEqual(['一般'])
    expect(activeEntries(list, 'narration', '艾倫', { adult: true }).map((e) => e.name)).toEqual(['一般', '成人'])
    expect(activeEntries(list, 'adult', '艾倫', { adult: true }).map((e) => e.name)).toEqual(['成人'])
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
    const saved = JSON.parse(localStorage.getItem('elondia.promptSets')!) as { active: string; sets: { id: string; config: { styles: { content: string }[] } }[] }
    expect(saved.sets.find((x) => x.id === saved.active)!.config.styles.at(-2)!.content).toBe('多寫雨聲。')

    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    const rng = g.state!.rngState
    const preview = await g.composeJudgePreview()
    expect(preview?.sample).toBe(true)
    // 預設判定只回傳 JSON（不帶文風）；文風在敘事正文裡
    expect(preview!.prompt.system).not.toContain('多寫雨聲。')
    expect(g.state!.pendingAction).toBeUndefined()
    expect(g.state!.rngState).toBe(rng)

    const narration = await g.composeFor(combat)
    expect(narration.lore!.states[0]!.status).toBe('constant')
    expect(narration.prompt.system).toContain('多寫雨聲。')
  })
})

describe('import and export', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('exports and imports styles and other prompts', async () => {
    const { usePrompts } = await import('@/stores/prompts')
    const prompts = usePrompts()
    const e = prompts.addEntry('styles')
    Object.assign(e, { name: '雨夜', content: '多寫雨聲。', targets: ['narration'] })
    const all = prompts.exportEntries('styles')
    const enabled = JSON.parse(prompts.exportEntries('styles', true))
    expect(enabled.type).toBe('elondia-styles')
    expect(enabled.entries.map((x: { name: string }) => x.name)).toEqual(['埃隆迪亞・史詩奇幻', '共通層・直白肉體（NSFW 底座）', '日輕第一視角・吐槽與心跳', '肥膩肉感・濃稠與氣味', '淫語・台詞的色情匯報', '雨夜'])

    prompts.resetAll()
    expect(prompts.importEntries('styles', all)).toEqual({ added: 1, skipped: 12 })
    const imported = prompts.config.styles.at(-1)!
    expect(imported).toMatchObject({ name: '雨夜', content: '多寫雨聲。', targets: ['narration'] })
    expect(imported.preset).toBeUndefined()
    expect(prompts.importEntries('custom', '角色說話要帶口癖。', '口癖.md')).toEqual({ added: 1, skipped: 0 })
    expect(prompts.config.custom.at(-1)).toMatchObject({ name: '口癖', position: 'system', enabled: true })
    expect(() => prompts.importEntries('styles', '{"foo":1}')).toThrow('這不是文風檔案')
  })

  it('round-trips the worldbook in SillyTavern format', async () => {
    const { usePrompts } = await import('@/stores/prompts')
    const prompts = usePrompts()
    await prompts.ensureLoaded()
    prompts.updateLore(44, { mode: 'off' })
    const mine = prompts.addLore()
    Object.assign(mine, { comment: '蛇溪的傳說', content: '蛇溪底下睡著一條老蛇。', keys: ['蛇溪'] })
    const file = await prompts.exportLore()
    const parsed = JSON.parse(file)
    expect(parsed.entries[44]).toMatchObject({ disable: true, constant: false })
    expect(parsed.entries[0]).toMatchObject({ constant: true, extensions: { elondia: { builtin: true } } })

    prompts.resetAll()
    expect(prompts.items.find((x) => x.uid === 44)!.mode).toBe('constant')
    const r = await prompts.importLore(file)
    expect(r).toMatchObject({ added: 1, updated: 1 })
    expect(prompts.items.find((x) => x.uid === 44)).toMatchObject({ mode: 'off', edited: true })
    expect(prompts.config.customLore[0]).toMatchObject({ comment: '蛇溪的傳說', keys: ['蛇溪'], mode: 'keyword' })
    // 同一份再匯入：沒有變化
    expect(await prompts.importLore(file)).toMatchObject({ added: 0, updated: 0 })

    // 原始世界書檔案：內容都已存在，全部略過
    expect((await prompts.importLore(JSON.stringify(worldbook))).added).toBe(0)
    // 其他 SillyTavern 世界書：加成自訂條目，常駐與停用依檔案
    const st = { entries: { 0: { uid: 0, key: ['月'], comment: '雙月', content: '天上有兩個月亮。', constant: true }, 1: { uid: 1, key: [], comment: '舊規則', content: '舊的規則。', disable: true } } }
    expect(await prompts.importLore(JSON.stringify(st))).toMatchObject({ added: 2 })
    expect(prompts.config.customLore.slice(-2).map((x) => x.mode)).toEqual(['constant', 'off'])
    await expect(prompts.importLore('{"a":1}')).rejects.toThrow('世界書')
  })
})
