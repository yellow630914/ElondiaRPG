import { afterEach, describe, expect, it } from 'vitest'
import { contentRevision, landmarks, npcs, stories } from '@/engine/data'
import { applyContent, emptyMods, normalizeMods, sanitizeNpc } from '@/engine/mods'
import { squadOf, squads } from '@/engine/squads'
import { newGame } from '@/engine/state'
import { storyNeedsLandmark } from '@/engine/story'
import { newStory, sanitizeStory } from '@/engine/storyMods'

afterEach(() => applyContent(emptyMods()))

// 依內容算出來的快取（任務用到的地標、小隊表）：套用世界設定之後要跟著換
describe('caches built from content', () => {
  it('bumps the content revision when a world is applied or reset', () => {
    const before = contentRevision()
    applyContent(emptyMods())
    expect(contentRevision()).toBeGreaterThan(before)
  })

  it('finds the quests that use a landmark, and follows world changes', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    // 萊茵堡沒有任何任務用到的地標（任務點不在那裡、委託人也不待在那裡）
    const givers = new Set(stories.flatMap((d) => (d.start.kind === 'npc' && d.start.npc ? [npcs.find((n) => n.id === d.start.npc)?.landmark] : [])))
    const id = Object.values(landmarks).find((l) => l.location === 'rhineburg' && !givers.has(l.id)
      && !stories.some((d) => d.nodes.some((n) => n.at.where === 'cell' && n.at.cell === l.id)))!.id
    expect(storyNeedsLandmark(state, id)).toBe(false)
    // 自建一個任務：任務點在這個地標，公會就接得到
    const s = newStory('mod_story_cache')
    s.start = { kind: 'guild', location: 'rhineburg' }
    s.nodes[0]!.at = { where: 'cell', location: 'rhineburg', cell: id }
    applyContent(normalizeMods({ ...emptyMods(), stories: { mod_story_cache: sanitizeStory('mod_story_cache', s, true) } }))
    expect(storyNeedsLandmark(state, id)).toBe(true)
    // 換回內建：又用不到了
    applyContent(emptyMods())
    expect(storyNeedsLandmark(state, id)).toBe(false)
  })

  it('rebuilds the squad table when the world changes', () => {
    expect(squadOf('npc_ael')?.name).toBe('旅歌隊')
    expect(squadOf('npc_mira')).toBe(squads().find((s) => s.leader === 'npc_mira'))
    const mira = npcs.find((n) => n.id === 'npc_mira')!
    applyContent(normalizeMods({ ...emptyMods(), npcs: { npc_mira: sanitizeNpc('npc_mira', { ...mira, squad: { ...mira.squad!, name: '新的隊名' } } as never, false) } }))
    expect(squadOf('npc_ael')?.name).toBe('新的隊名')
    applyContent(emptyMods())
    expect(squadOf('npc_ael')?.name).toBe('旅歌隊')
  })
})
