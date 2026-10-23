import { afterEach, describe, expect, it } from 'vitest'
import { shopRules } from '@/engine/data'
import { CELL_ICON, enterLocation } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { sanitizeShopMod } from '@/engine/shopMods'
import { newGame } from '@/engine/state'
import { keeperFor } from '@/engine/trade'

afterEach(() => applyContent(emptyMods()))

describe('built-in shop edits', () => {
  it('keep only the fields a built-in shop may change, and only when they differ', () => {
    const m = sanitizeShopMod('smithy', {
      emoji: '🔨', desc: '新的說明', ai: false, keeper: { title: '老師傅', tags: ['merchant', 'villain', 'nope'] },
      name: '改名', catalog_tag: 'magic',
    } as never)
    expect(m).toEqual({ emoji: '🔨', desc: '新的說明', ai: false, keeper: { title: '老師傅', tags: ['merchant', 'villain'] } })
    const same = shopRules.types.smithy
    expect(sanitizeShopMod('smithy', { emoji: same.emoji, desc: same.desc, ai: same.ai })).toEqual({})
    expect(() => sanitizeShopMod('nope', {})).toThrow()
  })

  it('apply to the shop rules and the map icon, and restore cleanly', () => {
    applyContent(normalizeMods({ ...emptyMods(), shops: { smithy: { emoji: '🔨', ai: false, keeper: { title: '老師傅', tags: ['villain'] } }, ghost: { emoji: '👻' } } }))
    expect(shopRules.types.smithy).toMatchObject({ emoji: '🔨', ai: false, name: '鐵匠鋪', catalog_tag: 'smith' })
    expect(CELL_ICON.smithy).toBe('🔨')
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    enterLocation(state)
    const keeper = npcRecord(state, keeperFor(state, 'smithy'))!
    expect(keeper).toMatchObject({ occupation: '老師傅', tags: ['villain'] })
    applyContent(emptyMods())
    expect(shopRules.types.smithy).toMatchObject({ emoji: '⚒️', ai: true })
    expect(CELL_ICON.smithy).toBe('⚒️')
  })
})
