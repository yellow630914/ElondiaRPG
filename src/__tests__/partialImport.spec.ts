// 局部匯入、匯出（docs/plan/WORLD_EDITOR_PLAN.md E2）：選的項目連同用到的東西一起帶；一樣的沿用、不同的選取代／保留／另存一份
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { closure, refKey } from '@/engine/contentRefs'
import { applyContent, emptyMods, newItem, newNpc } from '@/engine/mods'
import { newStory } from '@/engine/storyMods'
import { useContent } from '@/stores/content'
import { usePrompts } from '@/stores/prompts'

const STORY = refKey('stories', 'mod_story_bell')

/** 世界 A：鐘樓的任務，開頭是艾德溫，報酬是鐘樓的鑰匙 */
function makeSource(c: ReturnType<typeof useContent>): string {
  const a = c.createWorld('世界 A')
  c.switchWorld(a)
  c.saveNpc('mod_npc_edwin', { ...newNpc('mod_npc_edwin'), name: '艾德溫' })
  c.saveItem('鐘樓的鑰匙', newItem('鐘樓的鑰匙'))
  const s = newStory('mod_story_bell')
  c.saveStory('mod_story_bell', {
    ...s, title: '鐘樓的幽靈', start: { kind: 'npc', npc: 'mod_npc_edwin' },
    nodes: [{ ...s.nodes[0]!, success: { complete: true, effects: [{ type: 'item', name: '鐘樓的鑰匙', qty: 1 }] } }],
  })
  c.saveNpc('mod_npc_other', { ...newNpc('mod_npc_other'), name: '無關的人' })
  return a
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

describe('partial import', () => {
  it('brings a story from another world together with what it uses', () => {
    const c = useContent()
    const a = makeSource(c)
    c.switchWorld(c.createWorld('世界 B'))
    const src = c.importSource({ world: a })
    const keys = closure(c.analyzeSource(src.mods), [STORY])
    expect([...keys].sort()).toEqual([refKey('items', '鐘樓的鑰匙'), refKey('npcs', 'mod_npc_edwin'), STORY].sort())
    const rows = c.compareImport(src.mods, keys)
    expect(rows.every((r) => r.status === 'new')).toBe(true)
    const pkg = c.packageFor(src.mods, rows, {})
    expect(c.precheckImport(pkg)).toEqual({ changed: [], errors: [], problems: [] })
    expect(c.importPackage(pkg)).toBe(3)
    expect(Object.keys(c.mods.stories)).toEqual(['mod_story_bell'])
    expect(c.mods.npcs.mod_npc_other).toBeUndefined()
    // 再帶一次：一樣的沿用，不寫第二份
    const again = c.compareImport(src.mods, keys)
    expect(again.every((r) => r.status === 'same')).toBe(true)
    expect(c.packageFor(src.mods, again, {}).skipped).toHaveLength(3)
  })

  it('offers a newer version when the copy here was not changed since it was imported', () => {
    const c = useContent()
    const a = makeSource(c)
    const b = c.createWorld('世界 B')
    c.switchWorld(b)
    let src = c.importSource({ world: a })
    const keys = closure(c.analyzeSource(src.mods), [STORY])
    c.importPackage(c.packageFor(src.mods, c.compareImport(src.mods, keys), {}))
    // 世界 A 改了艾德溫：世界 B 沒改過 → 新版本，預設取代
    c.switchWorld(a)
    c.saveNpc('mod_npc_edwin', { ...c.mods.npcs.mod_npc_edwin!, level: 9 })
    c.switchWorld(b)
    src = c.importSource({ world: a })
    const row = c.compareImport(src.mods, keys).find((r) => r.key === refKey('npcs', 'mod_npc_edwin'))!
    expect(row).toMatchObject({ status: 'conflict', custom: true, newerVersion: true })
    // 世界 B 自己改過：不是新版本，預設保留
    c.saveNpc('mod_npc_edwin', { ...c.mods.npcs.mod_npc_edwin!, level: 2 })
    expect(c.compareImport(src.mods, keys).find((r) => r.key === refKey('npcs', 'mod_npc_edwin'))!.newerVersion).toBeUndefined()
  })

  it('saves a separate copy with new ids and its own story flags', () => {
    const c = useContent()
    const a = makeSource(c)
    // 世界 B 已經有同一個任務（改過標題）
    c.switchWorld(c.createWorld('世界 B', a))
    c.saveStory('mod_story_bell', { ...c.mods.stories.mod_story_bell!, title: '改過的鐘樓' })
    const src = c.importSource({ world: a })
    const keys = closure(c.analyzeSource(src.mods), [STORY])
    const rows = c.compareImport(src.mods, keys)
    expect(rows.find((r) => r.key === STORY)!.status).toBe('conflict')
    const pkg = c.packageFor(src.mods, rows, { [STORY]: 'copy' })
    const [[from, to]] = pkg.renamed as [[string, string]]
    expect(from).toBe(STORY)
    expect(to).toMatch(/^stories:mod_story_bell_[0-9a-f]{8}$/)
    const copy = Object.values(pkg.mods.stories!)[0]!
    expect(copy.start_flags![0]).toMatch(/^mod_story_bell_started_[0-9a-f]{8}$/)
    expect(copy.nodes[0]!.requires!.flags).toEqual(copy.start_flags)
    expect(c.precheckImport(pkg).errors).toEqual([])
    c.importPackage(pkg)
    expect(Object.keys(c.mods.stories).sort()).toEqual(['mod_story_bell', to.slice('stories:'.length)].sort())
    expect(c.mods.stories.mod_story_bell!.title).toBe('改過的鐘樓')
  })

  it('exports the picked items with what they use, and reads the picks back', () => {
    const c = useContent()
    makeSource(c)
    const out = c.exportPicked([STORY])
    expect(out.count).toBe(3)
    const file = JSON.parse(out.text)
    expect(file.type).toBe('elondia-content')
    expect(Object.keys(file.npcs)).toEqual(['mod_npc_edwin'])
    expect(file.meta.picked).toEqual([STORY])
    c.switchWorld(c.createWorld('世界 C'))
    expect(c.importSource({ text: out.text }).picked).toEqual([STORY])
  })

  it('keeps the linked prompt set after the page reloads', () => {
    const c = useContent()
    const id = c.createWorld('綁定提示詞')
    const set = usePrompts().sets[0]!.id
    c.linkPromptSet(id, set)
    setActivePinia(createPinia())
    expect(useContent().worlds.find((w) => w.id === id)!.promptSet).toBe(set)
  })
})
