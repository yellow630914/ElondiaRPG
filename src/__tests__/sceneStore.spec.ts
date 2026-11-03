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
    expect(prompts[1]!.system).not.toContain('第 1 段之後')
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
