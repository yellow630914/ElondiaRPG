import { describe, expect, it } from 'vitest'
import { locationById } from '@/engine/data'
import { generateResident } from '@/engine/population'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'

describe('adventurer tags by class', () => {
  it('rarely makes paladins villains, and often makes them good', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 })
    const rng = new Rng(42)
    const loc = locationById('soriel')
    const stat: Record<string, { n: number; villain: number; good: number }> = {}
    for (let i = 0; i < 3000; i++) {
      const r = generateResident(state, rng, loc, 'adventurer')
      const s = (stat[r.class] ??= { n: 0, villain: 0, good: 0 })
      s.n++
      if (r.tags?.includes('villain')) s.villain++
      if (r.tags?.includes('good')) s.good++
    }
    const rate = (c: string, k: 'villain' | 'good') => stat[c]![k] / stat[c]!.n
    expect(rate('paladin', 'villain')).toBeLessThan(0.03)
    expect(rate('rogue', 'villain')).toBeGreaterThan(rate('fighter', 'villain'))
    expect(rate('paladin', 'good')).toBeGreaterThan(rate('fighter', 'good'))
  }, 30000)
})

describe('races by location', () => {
  it('makes each people the majority in their own capital', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 })
    const rng = new Rng(9)
    const majority = (loc: string) => {
      const n: Record<string, number> = {}
      for (let i = 0; i < 400; i++) {
        const r = generateResident(state, rng, locationById(loc), 'commoner')
        n[r.race] = (n[r.race] ?? 0) + 1
      }
      return Object.entries(n).sort((a, b) => b[1] - a[1])[0]![0]
    }
    expect(majority('silvermoon')).toBe('elf')
    expect(majority('ironforge')).toBe('dwarf')
    expect(majority('bloodplume')).toBe('demon')
    expect(majority('canglue')).toBe('yulin')
    expect(majority('sunscorch')).toBe('catfolk')
    expect(majority('soriel')).toBe('human')
  }, 30000)
})
