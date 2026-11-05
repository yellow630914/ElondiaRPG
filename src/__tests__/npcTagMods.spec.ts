import { afterEach, describe, expect, it } from 'vitest'
import { npcTags } from '@/engine/data'
import { applyContent, builtinNpcTag, emptyMods, normalizeMods, type ContentMods } from '@/engine/mods'
import { editableOf, mergeNpcTag, newNpcTag, npcTagUsage, sanitizeNpcTagMod } from '@/engine/npcTagMods'
import { pcTagEffectLines, pcTagModifiers } from '@/engine/pcTags'
import { builtinWorldEntries } from '@/engine/builtinWorld'

afterEach(() => applyContent(emptyMods()))
const mods = (npcTagMods: ContentMods['npcTags']): ContentMods => ({ ...emptyMods(), npcTags: npcTagMods })

describe('身分標籤的編輯（R20 C6）', () => {
  it('keeps every built-in tag the same when opened and saved without changes', () => {
    for (const [id, def] of Object.entries(npcTags.tags)) {
      const e = editableOf(def)
      expect(sanitizeNpcTagMod(e, false), id).toEqual(sanitizeNpcTagMod(sanitizeNpcTagMod(e, false), false))
      // 合併回內建：和原本一樣
      expect(mergeNpcTag(def, sanitizeNpcTagMod(e, false)), id).toEqual(expect.objectContaining({ name: def.name, kinds: def.kinds }))
    }
  })

  it('edits a built-in tag but keeps its hard-coded behaviour', () => {
    const royal = editableOf(builtinNpcTag('royal')!)
    royal.name = '王族'
    royal.pc_effects = { ...royal.pc_effects, checks: [{ check: { skills: ['intimidate'] }, bonus: 3 }] }
    applyContent(mods({ royal: sanitizeNpcTagMod(royal, false) }))
    expect(npcTags.tags.royal!.name).toBe('王族')
    expect(npcTags.tags.royal!.pc_effects?.bypass_reputation).toBe(true)
    expect(npcTags.tags.royal!.location_types).toEqual(['capital'])
    expect(pcTagModifiers({ isPlayer: true, tags: ['royal'] }, { context: 'action', kind: 'intimidate' })).toEqual([{ label: '身分【王族】', value: 3 }])
    applyContent(emptyMods())
    expect(npcTags.tags.royal!.name).toBe('皇族')
  })

  it('adds a custom tag the player can carry', () => {
    const t = { ...newNpcTag(), name: '獵人', emoji: '🏹', pc_effects: { checks: [{ check: { skills: ['survival', 'perception'] }, bonus: 1 }], hint: '在山裡打獵維生' } }
    const m = normalizeMods(mods({ mod_tag_hunter: t as never }))
    expect(m.npcTags?.mod_tag_hunter?.custom).toBe(true)
    applyContent(m)
    expect(npcTags.tags.mod_tag_hunter?.name).toBe('獵人')
    expect(pcTagModifiers({ isPlayer: true, tags: ['mod_tag_hunter'] }, { context: 'travel' })).toEqual([{ label: '身分【獵人】', value: 1 }])
    expect(pcTagEffectLines('mod_tag_hunter').join('；')).toContain('求生檢定、察覺檢定 +1')
  })

  it('cleans bad input: unknown ids, out-of-range numbers, unknown exclusives', () => {
    const m = normalizeMods(mods({
      hacker: { ...newNpcTag(), name: 'x' } as never,
      mod_tag_ok: { name: '一二三四五六七八九十', emoji: '🙂', kinds: ['nobody'], ai_hint: '', wealth: 99, adventurer_chance: 5, exclusive: ['ghost', 'good'], pc_effects: { buy_mult: 9, checks: [{ check: { skills: ['nope'] }, bonus: 9 }] } } as never,
    }))
    expect(m.npcTags?.hacker).toBeUndefined()
    const t = m.npcTags!.mod_tag_ok!
    expect(t.name).toHaveLength(8)
    expect(t.kinds).toEqual(['commoner'])
    expect(t.wealth).toBe(5)
    expect(t.adventurer_chance).toBe(1)
    expect(t.exclusive).toEqual(['good'])
    expect(t.pc_effects?.buy_mult).toBe(1.5)
    expect(t.pc_effects?.checks).toEqual([{ check: {}, bonus: 3 }])
  })

  it('lists where a tag is used', () => {
    expect(npcTagUsage('noble').some((x) => x.startsWith('固定 NPC'))).toBe(true)
    expect(npcTagUsage('merchant').some((x) => x.includes('店主'))).toBe(true)
    expect(npcTagUsage('mod_tag_nobody')).toEqual([])
  })

  it('exports the editable fields of every built-in tag', () => {
    const e = builtinWorldEntries()
    expect(Object.keys(e.npcTags ?? {}).sort()).toEqual(Object.keys(npcTags.tags).sort())
    expect((e.npcTags as Record<string, { pc_effects?: { bypass_reputation?: boolean } }>).royal?.pc_effects?.bypass_reputation).toBeUndefined()
  })
})
