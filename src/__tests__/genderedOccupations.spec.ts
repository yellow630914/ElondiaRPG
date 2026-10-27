import { describe, expect, it } from 'vitest'
import { npcTags } from '@/engine/data'
import { generateNpc, occupationFor } from '@/engine/npcs'
import { migrate, newGame, withRng } from '@/engine/state'
import type { GameState } from '@/engine/types'

const FEMALE = new Set(npcTags.gendered_occupations!.map((r) => r.female))
const MALE = new Set(npcTags.gendered_occupations!.map((r) => r.male))

describe('gendered occupations', () => {
  it('maps a title to the NPC gender', () => {
    expect(occupationFor('女王的姪女', 'male')).toBe('女王的姪子')
    expect(occupationFor('女王的姪女', 'femboy')).toBe('女王的姪子')
    expect(occupationFor('王子', 'female')).toBe('公主')
    expect(occupationFor('王子', 'futa')).toBe('公主')
    expect(occupationFor('修女', 'unknown')).toBe('修道者')
    expect(occupationFor('麵包師', 'male')).toBe('麵包師')
  })

  it('never generates a male niece or a female prince', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    for (let i = 0; i < 300; i++) {
      for (const tag of ['royal', 'noble', 'priest', 'commoner']) {
        const pool = npcTags.tags[tag]!.occupations!
        const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'commoner', tags: [tag], occupation: pool[i % pool.length] }, 'cmn'))
        const female = rec.gender === 'female' || rec.gender === 'ts' || rec.gender === 'futa'
        const male = rec.gender === 'male' || rec.gender === 'femboy'
        if (male) expect(FEMALE.has(rec.occupation!), `${rec.gender} ${rec.occupation}`).toBe(false)
        if (female) expect(MALE.has(rec.occupation!), `${rec.gender} ${rec.occupation}`).toBe(false)
      }
    }
  })

  it('fixes NPCs already generated in old saves', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'commoner', tags: ['royal'], gender: 'male' }, 'cmn'))
    rec.occupation = '女王的姪女'
    ;(state.npcs ??= {})[rec.id] = rec
    const loaded = migrate(JSON.parse(JSON.stringify(state)) as GameState)
    expect(loaded.npcs![rec.id]!.occupation).toBe('女王的姪子')
  })
})
