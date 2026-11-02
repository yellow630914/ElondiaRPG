// 特殊任務的流程圖模型（storyGraph.ts）：旗標串起來的邊、外面的旗標、分層排版
import { describe, expect, it } from 'vitest'
import { stories, type StoryDef, type StoryNode } from '@/engine/data'
import { layoutGraph, storyGraph } from '@/engine/storyGraph'

const at = { where: 'cell' as const, location: 'soriel', cell: 'tavern' as const }
const node = (id: string, extra: Partial<StoryNode>): StoryNode => ({ id, title: id, text: '', at, kind: 'story', ...extra })
const def: StoryDef = {
  id: 'test_graph', title: '測試', summary: '', start: { kind: 'guild', location: 'soriel' }, start_flags: ['g_start'],
  nodes: [
    node('ask', { kind: 'choice', requires: { flags: ['g_start'] }, options: [
      { label: '答應', success: { set_flags: ['g_yes'] } },
      { label: '拒絕', success: { set_flags: ['g_no'] } },
    ] }),
    node('help', { kind: 'check', check: { attr: 'str', dc: 10 }, requires: { flags: ['g_yes'], flags_none: ['g_no'] }, success: { set_flags: ['g_done'] } }),
    node('rumor', { requires: { flags_any: ['g_no', 'ai:heard'] }, success: { set_flags: ['g_done'], clear_flags: ['g_no'] } }),
    node('end', { requires: { flags: ['g_done'] }, success: { complete: true }, fail: { fail_quest: true } }),
  ],
}

describe('story graph', () => {
  it('turns flags into edges between outcomes and nodes', () => {
    const g = storyGraph(def, [])
    const e = (from: string, to: string) => g.edges.filter((x) => x.from === from && x.to === to).map((x) => x.kind)
    expect(e('start', 'ask')).toEqual(['unlock'])
    expect(e('ask#0', 'help')).toEqual(['unlock'])
    expect(e('ask#1', 'help')).toEqual(['block'])
    expect(e('ask#1', 'rumor')).toEqual(['any'])
    expect(e('ext:ai:heard', 'rumor')).toEqual(['any'])
    expect(e('rumor#0', 'rumor')).toEqual(['clear'])
    expect(e('help#0', 'end')).toEqual(['unlock'])
    expect(e('end#0', 'complete')).toEqual(['end'])
    expect(e('end#1', 'fail')).toEqual(['end'])
    expect(g.externals).toEqual([{ id: 'ext:ai:heard', flag: 'ai:heard', source: 'ai', stories: [] }])
    expect(g.nodes.find((n) => n.id === 'help')!.retryOnFail).toBe(true)
    expect(layoutGraph(g)).toEqual([['start', 'ext:ai:heard'], ['ask'], ['help', 'rumor'], ['end'], ['complete', 'fail']])
  })

  it('lays out every built-in story with each node exactly once', () => {
    for (const s of stories) {
      const g = storyGraph(s)
      const placed = layoutGraph(g).flat().filter((id) => g.nodes.some((n) => n.id === id))
      expect(placed.sort(), s.id).toEqual(g.nodes.map((n) => n.id).sort())
    }
  })
})
