// 故事線總覽（storylines.ts）：接取條件、開始特殊任務把任務連成故事線；呼應不算同一條
import { describe, expect, it } from 'vitest'
import { stories, type StoryDef } from '@/engine/data'
import { storylines } from '@/engine/storylines'

const at = { where: 'cell' as const, location: 'soriel', cell: 'tavern' as const }
const quest = (id: string, extra: Partial<StoryDef> = {}, sets: string[] = [], reads: string[] = []): StoryDef => ({
  id, title: id, summary: `（測試線・一）`, start: { kind: 'guild', location: 'soriel' }, start_flags: [`${id}_go`],
  nodes: [{ id: 'n', title: 'n', text: '', at, kind: 'story', requires: { flags: [`${id}_go`, ...reads] }, success: { set_flags: sets, complete: true } }],
  ...extra,
})

describe('storylines', () => {
  it('links quests by start conditions and start_story, and keeps echoes apart', () => {
    const a = quest('a', {}, ['a_done'])
    const b = quest('b', { start: { kind: 'guild', location: 'soriel', requires: { flags: ['a_done'] } } })
    const c = quest('c')
    c.nodes[0]!.success!.effects = [{ type: 'start_story', story: 'd' }]
    const d = quest('d', { start: { kind: 'manual' } })
    const e = quest('e', {}, [], ['a_done']) // 任務點讀到 a 的旗標：呼應
    const lines = storylines([a, b, c, d, e])
    const group = (id: string) => lines.find((l) => l.ids.includes(id))!
    expect(group('a').ids).toEqual(['a', 'b'])
    expect(group('a').edges).toEqual([{ from: 'a', to: 'b', kind: 'unlock', flags: ['a_done'] }])
    expect(group('c').edges).toEqual([{ from: 'c', to: 'd', kind: 'start', flags: [] }])
    expect(group('e').ids).toEqual(['e'])
    expect(group('e').outside).toEqual({ e: ['a'] })
    expect(group('a').name).toBe('測試線')
  })

  it('puts every built-in story in exactly one storyline', () => {
    const ids = storylines().flatMap((l) => l.ids)
    expect(ids.sort()).toEqual(stories.map((s) => s.id).sort())
  })
})
