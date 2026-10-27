import { describe, expect, it } from 'vitest'
import v025 from './fixtures/saves-v0.2.5.json'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { PC_TAG_MAX, pcTagChoices, pcTagEffect, sanitizePcTags, setPcTags } from '@/engine/pcTags'
import { palaceNeedsPersuading, zoneEntryBlock } from '@/engine/security'
import { landmarkClosed } from '@/engine/landmarks'
import { shopRefusal } from '@/engine/tattooShop'
import { unmarkRepOk } from '@/engine/slavery'
import { landmarks, slaveryRules } from '@/engine/data'
import { migrate, newGame, SAVE_SCHEMA } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(tags?: string[], tagChange = false): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg', ...(tags ? { tags } : {}), ...(tagChange ? { options: { tagChange: true } } : {}) })
  enterLocation(state)
  return state
}

describe('player identity tags', () => {
  it('lets the player pick up to three NPC tags, skipping slave, prostitute and clashing ones', () => {
    const ids = pcTagChoices().map(([id]) => id)
    expect(ids).toContain('royal')
    expect(ids).not.toContain('slave')
    expect(ids).not.toContain('prostitute')
    expect(sanitizePcTags(['noble', 'royal', 'priest', 'merchant'])).toHaveLength(PC_TAG_MAX)
    // 好人與惡人互斥：留前面的
    expect(sanitizePcTags(['good', 'villain', 'noble'])).toEqual(['good', 'noble'])
    expect(sanitizePcTags(['slave', 'nope', 'noble', 'noble', 3])).toEqual(['noble'])
    expect(sanitizePcTags(undefined)).toEqual([])
  })

  it('keeps the tags chosen at creation on the player', () => {
    expect(pcOf(game(['noble', 'priest'])).tags).toEqual(['noble', 'priest'])
    expect(pcOf(game()).tags).toBeUndefined()
  })

  it('lets royals walk into the palace without reputation or persuading', () => {
    const commoner = game(['noble'])
    expect(palaceNeedsPersuading(commoner)).toBe(true)
    expect(zoneEntryBlock(commoner, 'palace')).toContain('聲望')
    const royal = game(['royal'])
    expect(pcTagEffect(royal, 'bypass_reputation')).toBe(true)
    expect(palaceNeedsPersuading(royal)).toBe(false)
    expect(zoneEntryBlock(royal, 'palace')).toBeNull()
    // 通緝中還是進不去
    royal.wanted = { rhine_empire: { day: 1 } }
    expect(zoneEntryBlock(royal, 'palace')).toContain('通緝')
  })

  it('lets royals past every reputation gate: landmarks and the temple services', () => {
    const armory = landmarks.lm_imperial_armory!
    expect(armory.open?.min_reputation).toBeGreaterThan(0)
    const commoner = game(['noble'])
    commoner.time.hour = 12
    expect(landmarkClosed(commoner, armory)).toContain('聲望')
    expect(shopRefusal(commoner, 'temple')).toContain('聲望')
    expect(unmarkRepOk(commoner, slaveryRules.unmark.services.temple!)).toBe(false)
    const royal = game(['royal'])
    royal.time.hour = 12
    expect(landmarkClosed(royal, armory)).toBeUndefined()
    expect(shopRefusal(royal, 'temple') ?? '').not.toContain('聲望')
    expect(unmarkRepOk(royal, slaveryRules.unmark.services.temple!)).toBe(true)
  })

  it('changes tags in game only when the save rule allows it', () => {
    const locked = game(['noble'])
    expect(() => setPcTags(locked, ['royal'])).toThrow('不允許')
    expect(pcOf(locked).tags).toEqual(['noble'])
    const open = game(['noble'], true)
    setPcTags(open, ['royal', 'villain'])
    expect(pcOf(open).tags).toEqual(['royal', 'villain'])
    setPcTags(open, [])
    expect(pcOf(open).tags).toBeUndefined()
  })
})

describe('save compatibility for player tags', () => {
  it('loads v0.2.5 saves (schema 9) with no tags and the palace still guarded', () => {
    for (const raw of Object.values(v025 as Record<string, unknown>)) {
      const state = migrate(JSON.parse(JSON.stringify(raw)) as GameState)
      expect(state.schema).toBe(SAVE_SCHEMA)
      expect(pcOf(state).tags).toBeUndefined()
      expect(state.options?.tagChange).toBeUndefined()
      expect(() => setPcTags(state, ['royal'])).toThrow('不允許')
    }
  })

  it('round-trips tags through a save and drops ones it does not know', () => {
    const state = game(['royal', 'priest'], true)
    const loaded = migrate(JSON.parse(JSON.stringify(state)) as GameState)
    expect(pcOf(loaded).tags).toEqual(['royal', 'priest'])
    expect(loaded.options?.tagChange).toBe(true)
    // 內容改過、或手動改壞的存檔：不認得的、不能選的拿掉
    pcOf(loaded).tags = ['ghost', 'slave', 'royal']
    expect(pcOf(migrate(loaded)).tags).toEqual(['royal'])
    pcOf(loaded).tags = ['ghost']
    expect(pcOf(migrate(loaded)).tags).toBeUndefined()
  })
})
