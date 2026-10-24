import { describe, expect, it } from 'vitest'
import { backgroundFor, backgroundKeys, timeOfDay } from '@/components/fx/backgrounds'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(birthplace = 'soriel'): GameState {
  const s = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5, birthplace })
  return s
}

describe('background images', () => {
  it('splits the day like the ambient tint', () => {
    expect([4, 5, 8, 17, 19, 23].map(timeOfDay)).toEqual(['night', 'dawn', 'day', 'dusk', 'night', 'night'])
  })

  it('looks for the town at this time of day, then the town, then the region', () => {
    const s = game()
    s.time.hour = 20
    expect(backgroundKeys(s)).toEqual(['soriel-night', 'soriel', 'region-central-night', 'region-central'])
    expect(backgroundKeys(null)).toEqual(['title', 'region-central'])
  })

  it('uses the dungeon layer for dungeons and falls back to whatever image exists', () => {
    const s = game()
    s.location = 'whisper_crypt'
    enterLocation(s)
    expect(backgroundKeys(s)[0]).toBe('whisper_crypt-outskirts')
    const files = { 'whisper_crypt': 'crypt.webp', 'region-central': 'plains.webp' }
    expect(backgroundFor(s, files)).toBe('crypt.webp')
    expect(backgroundFor(game(), files)).toBe('plains.webp')
    expect(backgroundFor(game(), {})).toBeNull()
  })
})
