// 分段插圖的流程（stores/scenes.ts）：自動分段、手動分段（留著對得上的、只畫新的）、正文重寫後收到最後、重畫單張
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import { useImageSettings } from '@/stores/image'
import { sceneKey, useScenes } from '@/stores/scenes'
import { useSettings } from '@/stores/settings'
import { renderImage } from '@/narrator/imageProviders'
import { setMonsterGirl } from '@/engine/content'

// fake-indexeddb 用 Node 的 structuredClone：改用 Node 的 Blob
globalThis.Blob = NodeBlob as unknown as typeof Blob

let replies: string[] = []
const prompts: { system: string; user: string }[] = []
vi.mock('@/narrator/providers', () => ({
  completeText: vi.fn(async (_p: unknown, _c: unknown, prompt: { system: string; user: string }) => {
    prompts.push(prompt)
    return replies.shift() ?? '{}'
  }),
  streamNarration: vi.fn(async function* () { yield '' }),
}))
let renders = 0
vi.mock('@/narrator/imageProviders', async (orig) => ({
  ...(await orig<typeof import('@/narrator/imageProviders')>()),
  renderImage: vi.fn(async () => ({ blob: new Blob([`img${++renders}`], { type: 'image/png' }), seed: renders })),
}))

const TEXT = '你推開酒館的門。\n\n莉娜朝你揮手。\n\n你們聊到深夜。\n\n天亮了，你們一起出發。'
const img = (after: number, scene: string) => ({ after, rating: 'general', scene, characters: [] })

function setup() {
  setActivePinia(createPinia())
  const settings = useSettings()
  settings.sources[0]!.configs.anthropic = { apiKey: 'x', model: 'claude-opus-5-5' }
  const image = useImageSettings()
  image.service = 'novelai'
  image.configs.novelai.apiKey = 'k'
  const game = useGame()
  game.start('艾倫', 'human', 'fighter')
  const report: Report = {
    schema_version: '0.1', report_id: `r-seg-${Math.random()}`, kind: 'event',
    time: { start: { ...game.state!.time }, end: { ...game.state!.time } },
    location: { at: game.state!.location }, party: [], outcome: { result: 'success', summary: '在酒館聊天' }, changes: {},
  }
  game.state!.reports.push(report)
  game.narrations[report.report_id] = { text: TEXT, status: 'done' }
  const scenes = useScenes()
  return { game, image, scenes, report, base: sceneKey(game.state!, report.report_id) }
}

const paragraphs = () => TEXT.split('\n\n')

describe('segmented illustrations', () => {
  beforeEach(() => {
    localStorage.clear()
    replies = []
    prompts.length = 0
    renders = 0
  })

  it('auto: asks for up to the set number, draws each one and places it after its paragraph', async () => {
    const t = setup()
    t.image.sceneCount = '2'
    replies.push(JSON.stringify({ images: [img(3, 'night talk'), img(1, 'door')] }))
    await t.scenes.generate(t.game.state!, t.report)
    expect(t.scenes.jobs[t.base]).toBeUndefined()
    expect(prompts[0]!.system).toContain('挑出 1～2 個')
    expect(renders).toBe(2)
    const keys = t.scenes.keysOf(t.base)
    expect(keys).toHaveLength(2)
    const layout = t.scenes.layout(t.base, paragraphs())
    expect(Object.keys(layout.inline).map(Number).sort()).toEqual([0, 2])
    expect(layout.tail).toEqual([])
    expect(t.scenes.plans[layout.inline[2]![0]!]?.scene).toBe('night talk')
  })

  it('manual: keeps images already at picked positions, draws only the new ones, removes the unpicked', async () => {
    const t = setup()
    t.image.sceneCount = '2'
    replies.push(JSON.stringify({ images: [img(1, 'door'), img(3, 'night')] }))
    await t.scenes.generate(t.game.state!, t.report)
    const [door] = t.scenes.layout(t.base, paragraphs()).inline[0]!
    // 留著第 1 段，新畫第 2 段，第 3 段取消
    replies.push(JSON.stringify({ images: [img(2, 'wave')] }))
    await t.scenes.generate(t.game.state!, t.report, { after: [0, 1] })
    expect(prompts[1]!.system).toContain('第 2 段之後')
    expect(prompts[1]!.system).toContain('指定了 1 個位置：第 2 段之後。')
    expect(prompts[1]!.system).toContain('第 1 段之後已經有插圖')
    const layout = t.scenes.layout(t.base, paragraphs())
    expect(layout.inline[0]).toEqual([door])
    expect(t.scenes.plans[layout.inline[1]![0]!]?.scene).toBe('wave')
    expect(layout.inline[2]).toBeUndefined()
    expect(renders).toBe(3)
    // 只取消勾選：不請 AI，只刪掉
    await t.scenes.generate(t.game.state!, t.report, { after: [1] })
    expect(prompts).toHaveLength(2)
    expect(Object.keys(t.scenes.layout(t.base, paragraphs()).inline)).toEqual(['1'])
  })

  it('moves images to the end, marked old, when the narration is rewritten; the auto button replaces them all', async () => {
    const t = setup()
    t.image.sceneCount = '1'
    replies.push(JSON.stringify({ images: [img(2, 'night')] }))
    await t.scenes.generate(t.game.state!, t.report)
    const rewritten = ['全新的開頭。', '完全不同的第二段。']
    const layout = t.scenes.layout(t.base, rewritten)
    expect(layout.inline).toEqual({})
    expect(layout.tail).toEqual([{ key: t.scenes.keysOf(t.base)[0], stale: true }])
    // 沒有顯示正文時全部放最後，不算舊的
    expect(t.scenes.layout(t.base, [], false).tail[0]?.stale).toBe(false)
    // 重新交給 AI 分段：換掉全部
    t.game.narrations[t.report.report_id] = { text: rewritten.join('\n\n'), status: 'done' }
    replies.push(JSON.stringify({ images: [img(1, 'new')] }))
    await t.scenes.generate(t.game.state!, t.report)
    const after = t.scenes.layout(t.base, rewritten)
    expect(after.tail).toEqual([])
    expect(after.inline[0]).toHaveLength(1)
    expect(t.scenes.keysOf(t.base)).toHaveLength(1)
  })

  it('tells which picked positions the AI left out, and lists kept positions as boundaries', async () => {
    const t = setup()
    replies.push(JSON.stringify({ images: [img(1, 'door')] }))
    await t.scenes.generate(t.game.state!, t.report)
    replies.push(JSON.stringify({ images: [img(3, 'night')] }))
    await t.scenes.generate(t.game.state!, t.report, { after: [0, 1, 2] })
    expect(prompts[1]!.system).toContain('第 1 段之後已經有插圖')
    const job = t.scenes.jobs[t.base]
    expect(job?.notice).toBe(true)
    expect(job?.error).toContain('有 1 個位置 AI 沒有畫出來（第 2 段之後）')
    expect(t.scenes.busy(t.base)).toBe(false)
    expect(t.scenes.keysOf(t.base)).toHaveLength(2)
  })

  it('does not redraw a single image while the whole log is being illustrated', async () => {
    const t = setup()
    replies.push(JSON.stringify({ images: [img(1, 'door')] }))
    await t.scenes.generate(t.game.state!, t.report)
    const key = t.scenes.keysOf(t.base)[0]!
    t.scenes.jobs[t.base] = { stage: 'plan' }
    await t.scenes.redraw(t.game.state!, key)
    expect(renders).toBe(1)
    expect(t.scenes.busy(t.base)).toBe(true)
    delete t.scenes.jobs[t.base]
    // 單張在重畫時，整則也算忙
    t.scenes.jobs[key] = { stage: 'image' }
    expect(t.scenes.busy(t.base)).toBe(true)
  })

  it('adds blood, corpse, guro to the negative prompt when monster girls are in the picture (also on redraw)', async () => {
    const t = setup()
    t.image.configs.novelai.negative = 'lowres'
    const negatives = () => vi.mocked(renderImage).mock.calls.map((c) => c[2].negative)
    vi.mocked(renderImage).mockClear()
    replies.push(JSON.stringify({ images: [img(1, 'door')] }))
    await t.scenes.generate(t.game.state!, t.report)
    expect(negatives()).toEqual([undefined])
    t.report.others = [{ id: 'e1', name: '哥布林', monster: 'goblin', status: ['死亡'] }]
    setMonsterGirl('all')
    try {
      replies.push(JSON.stringify({ images: [img(2, 'fight')] }))
      await t.scenes.generate(t.game.state!, t.report)
      expect(prompts[1]!.user).toContain('不要寫 no blood')
      await t.scenes.redraw(t.game.state!, t.scenes.keysOf(t.base)[0]!)
      expect(negatives().slice(1)).toEqual(['lowres, blood, corpse, guro', 'lowres, blood, corpse, guro'])
    } finally {
      setMonsterGirl('off')
    }
  })

  it('redraws one image with the same plan and a new seed, without asking the AI again', async () => {
    const t = setup()
    replies.push(JSON.stringify({ images: [img(1, 'door')] }))
    await t.scenes.generate(t.game.state!, t.report)
    const key = t.scenes.keysOf(t.base)[0]!
    const url = t.scenes.urls[key]
    await t.scenes.redraw(t.game.state!, key)
    expect(t.scenes.jobs[key]).toBeUndefined()
    expect(prompts).toHaveLength(1)
    expect(renders).toBe(2)
    expect(t.scenes.urls[key]).not.toBe(url)
    expect(t.scenes.plans[key]?.scene).toBe('door')
    expect(t.scenes.layout(t.base, paragraphs()).inline[0]).toEqual([key])
  })
})
