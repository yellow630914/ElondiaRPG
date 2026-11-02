// 特殊任務生成器的流程（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4c）：大綱 → 完整內容 → 有錯誤時交回 AI 修 → 加入世界；AI 用假的回覆
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { stories } from '@/engine/data'
import { applyContent, emptyMods } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useQuestGen } from '@/stores/questGen'
import { useSettings } from '@/stores/settings'
import { reply } from './questGenFixture'

const answers: string[] = []
const prompts: { system: string; user: string }[] = []
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async (_p: unknown, _c: unknown, prompt: { system: string; user: string }, _s: unknown, onUsage?: (u: { input: number; output: number }) => void) => {
    prompts.push(prompt)
    onUsage?.({ input: 1000, output: 200 })
    return answers.shift() ?? '{}'
  }),
  streamNarration: vi.fn(async function* () { yield '' }),
}))

const OUTLINE = { title: '燈塔的守夜人', premise: '守夜人是眼線', start: '索里耶爾的公會', nodes: [{ id: 'ask', title: '打聽', kind: 'story', where: '酒館', branches: ['接 tower'] }], new: [] }

/** 第三個任務點需要一個沒有人設定的旗標（錯誤） */
function broken() {
  const r = reply()
  ;(r.story.nodes[2] as { requires: { flags: string[] } }).requires.flags = ['typo']
  return r
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  answers.length = 0
  prompts.length = 0
  const settings = useSettings()
  settings.sources[0]!.provider = 'gemini'
  settings.sources[0]!.configs.gemini.apiKey = 'AIza-test'
  const c = useContent()
  c.switchWorld(c.createWorld('生成'))
})
afterEach(() => applyContent(emptyMods()))

describe('quest generator flow', () => {
  it('outlines, generates, fixes errors and adds the quest to the world', async () => {
    const gen = useQuestGen()
    gen.input.prompt = '燈塔守夜人是走私集團的眼線'
    answers.push(JSON.stringify(OUTLINE))
    await gen.makeOutline()
    expect(gen.error).toBe('')
    expect(gen.outline).toContain('# 燈塔的守夜人')
    expect(gen.drafts).toHaveLength(1)

    // 第一次有錯誤，交回去修，第二次通過
    answers.push(JSON.stringify(broken()), JSON.stringify(reply()))
    await gen.generate()
    expect(prompts).toHaveLength(3)
    expect(prompts[1]!.user).toContain('玩家確認過的大綱')
    expect(prompts[2]!.user).toContain('程式檢查出的錯誤')
    expect(prompts[2]!.user).toContain('typo')
    expect(gen.result?.errors).toEqual([])
    expect(gen.spent).toEqual({ input: 3000, output: 600, calls: 3 })

    const id = gen.accept()
    expect(id).toBeDefined()
    expect(stories.find((s) => s.id === id)?.title).toBe('燈塔的守夜人')
    expect(useContent().mods.npcs[Object.keys(useContent().mods.npcs)[0]!]?.name).toBe('老守夜人格倫')
    // 加入之後草稿拿掉，回到輸入
    expect(gen.drafts).toHaveLength(0)
    expect(gen.outline).toBe('')
  })

  it('stops after the fix rounds and keeps the errors for the player', async () => {
    const gen = useQuestGen()
    gen.input.prompt = '燈塔'
    answers.push(JSON.stringify(broken()), JSON.stringify(broken()), JSON.stringify(broken()))
    await gen.generate()
    expect(prompts).toHaveLength(3)
    expect(gen.result?.errors.some((e) => e.includes('typo'))).toBe(true)
    expect(gen.accept()).toBeUndefined()
    // 草稿留著，重新整理之後可以接著做
    setActivePinia(createPinia())
    const again = useQuestGen()
    expect(again.drafts).toHaveLength(1)
    again.openDraft(again.drafts[0]!.id)
    expect(again.result?.errors.length).toBeGreaterThan(0)
  })

  it('reports a reply that is not JSON', async () => {
    const gen = useQuestGen()
    gen.input.prompt = '燈塔'
    answers.push('抱歉，我不能', '還是不行', '真的不行')
    await gen.generate()
    expect(gen.error).toContain('生成失敗')
    expect(gen.result).toBeNull()
  })

  it('needs a model source', async () => {
    useSettings().sources[0]!.configs.gemini.apiKey = ''
    const gen = useQuestGen()
    gen.input.prompt = '燈塔'
    await gen.makeOutline()
    expect(gen.error).toContain('世界設計')
  })
})
