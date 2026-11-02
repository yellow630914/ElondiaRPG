// 特殊任務的可達性（storyReach.ts）：到不了的任務點、走不到完成、選了會卡住的結果；內建任務一筆都不能有
import { describe, expect, it } from 'vitest'
import { stories, type StoryDef, type StoryNode } from '@/engine/data'
import { storyReach } from '@/engine/storyReach'
import { storyCheck } from '@/engine/storyMods'

const at = { where: 'cell' as const, location: 'soriel', cell: 'tavern' as const }
const node = (id: string, extra: Partial<StoryNode>): StoryNode => ({ id, title: id, text: '', at, kind: 'story', ...extra })
const story = (nodes: StoryNode[]): StoryDef => ({ id: 'test_reach', title: '測試', summary: '', start: { kind: 'guild', location: 'soriel' }, start_flags: ['r_start'], nodes })

describe('story reachability', () => {
  it('finds nodes that never unlock and stories that cannot be completed', () => {
    const r = storyReach(story([
      node('a', { requires: { flags: ['r_start'] }, success: { set_flags: ['r_a'] } }),
      node('b', { requires: { flags: ['r_a', 'r_never'] }, success: { complete: true } }), // r_never：任務裡沒人設定 → 當成外面會設定，不算到不了
      node('c', { requires: { flags: ['r_b_done'] }, success: { complete: true } }), // r_b_done 只由 d 設定，d 又要 c 的旗標
      node('d', { requires: { flags: ['r_c_done'] }, success: { set_flags: ['r_b_done'] } }),
      node('e', { requires: { flags: ['r_b_done'] }, success: { set_flags: ['r_c_done'] } }),
    ]))
    expect(r.unreachable).toEqual(['c', 'd', 'e'])
    expect(r.canComplete).toBe(true)
    const none = storyReach(story([node('a', { requires: { flags: ['r_start'] }, success: { set_flags: ['r_x'] } })]))
    expect(none.canComplete).toBe(false)
  })

  it('finds outcomes after which nothing is left to do', () => {
    const r = storyReach(story([
      node('ask', {
        kind: 'choice', requires: { flags: ['r_start'] },
        options: [
          { label: '答應', success: { set_flags: ['r_yes'] } },
          { label: '轉身離開', success: { text: '你走了。' } }, // 什麼都沒設定：之後沒有任務點
        ],
      }),
      node('go', { requires: { flags: ['r_yes'] }, success: { complete: true } }),
      // 判定沒寫失敗：可以再試，不算卡住
      node('side', { kind: 'check', check: { attr: 'str', dc: 10 }, requires: { flags: ['r_yes'] }, success: { set_flags: ['r_bonus'] } }),
    ]))
    expect(r.stuck).toEqual([{ node: 'ask', label: '「轉身離開」' }])
    expect(r.unreachable).toEqual([])
  })

  it('reports them as warnings in the story check', () => {
    const w = storyCheck(story([
      node('ask', { kind: 'choice', requires: { flags: ['r_start'] }, options: [{ label: '離開', success: {} }, { label: '幫忙', success: { complete: true } }] }),
      node('lost', { requires: { flags: ['r_lost'] }, success: { set_flags: ['r_lost2'] } }),
      node('lost2', { requires: { flags: ['r_lost2'] }, success: { set_flags: ['r_lost'] } }),
    ])).warnings
    expect(w.some((x) => x.includes('「lost」') && x.includes('不會解鎖'))).toBe(true)
    expect(w.some((x) => x.includes('「ask」') && x.includes('「離開」'))).toBe(true)
  })

  it('has nothing to report in the built-in stories', () => {
    const found: string[] = []
    for (const s of stories) {
      const r = storyReach(s)
      expect(r.truncated, s.id).toBe(false)
      if (r.unreachable.length || !r.canComplete || r.stuck.length) found.push(s.id)
    }
    expect(found).toEqual([])
  })
})
