import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { applyContent, emptyMods } from '@/engine/mods'
import { parseWorldFile } from '@/engine/worldPackage'
import { useContent, VANILLA } from '@/stores/content'
import { usePrompts } from '@/stores/prompts'
import { afterEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const NPC = { id: 'mod_npc_pkg', name: '包裡的騎士', race: 'human', class: 'fighter', level: 3, location: 'soriel', hire_cc: 0, personality: '寡言', custom: true }
const LORE = { uid: 100000, comment: '包裡的條目', content: '一段設定', keys: ['騎士'], mode: 'keyword', order: 700, adult: false, builtin: false }

describe('world package', () => {
  it('reads packages and plain content files', () => {
    expect(parseWorldFile({ type: 'elondia-content', npcs: {} }).kind).toBe('content')
    const p = parseWorldFile({ type: 'elondia-world', version: 1, name: '包', content: { npcs: {} }, prompts: { customLore: [] } })
    expect(p).toMatchObject({ kind: 'package', name: '包' })
    expect(() => parseWorldFile({ type: 'elondia-world', name: 'x' })).toThrow('content')
  })

  it('imports a package as a new world with a linked prompt set, and switches the set with the world', () => {
    const content = useContent()
    const prompts = usePrompts()
    const before = prompts.active
    const text = JSON.stringify({ type: 'elondia-world', version: 1, name: '騎士之國', content: { npcs: { [NPC.id]: NPC } }, prompts: { customLore: [LORE] } })
    const r = content.importWorld(text, 'file')
    expect(content.worldName(r.id)).toBe('騎士之國')
    expect(content.worlds.find((w) => w.id === r.id)!.mods.npcs[NPC.id]!.name).toBe('包裡的騎士')
    expect(prompts.sets.find((s) => s.id === r.promptSet)!.config.customLore[0]!.comment).toBe('包裡的條目')
    content.switchWorld(VANILLA)
    prompts.switchSet(before)
    content.switchWorld(r.id)
    expect(prompts.active).toBe(r.promptSet)
    // 匯出：內容與綁定的提示詞組
    const out = JSON.parse(content.exportWorld())
    expect(out.type).toBe('elondia-world')
    expect(out.content.npcs[NPC.id].name).toBe('包裡的騎士')
    expect(out.prompts.customLore[0].comment).toBe('包裡的條目')
  })

  it('imports a plain content file without touching prompt sets', () => {
    const content = useContent()
    const prompts = usePrompts()
    const n = prompts.sets.length
    const r = content.importWorld(JSON.stringify({ type: 'elondia-content', npcs: { [NPC.id]: NPC } }), '只有內容')
    expect(content.worldName(r.id)).toBe('只有內容')
    expect(r.promptSet).toBeUndefined()
    expect(prompts.sets.length).toBe(n)
  })
})
