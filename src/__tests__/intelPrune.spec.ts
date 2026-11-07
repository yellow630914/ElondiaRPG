import { describe, expect, it } from 'vitest'
import { addIntel, expireIntel, KEEP_OLD_POINTS } from '@/engine/intel'
import { newGame } from '@/engine/state'

describe('intel pruning', () => {
  it('keeps only the latest finished or expired event points, never story news or rumors', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
    const story = addIntel(state, { kind: 'story', title: '任務消息', text: '', story: 'x' })
    story.status = 'done'
    const rumor = addIntel(state, { kind: 'rumor', title: '傳聞', text: '' })
    for (let i = 0; i < KEEP_OLD_POINTS + 10; i++) addIntel(state, { kind: 'point', title: `舊的 ${i}`, text: '', until: 0 })
    state.time.day = 5
    const fresh = addIntel(state, { kind: 'point', title: '還有效', text: '', until: 99 })
    expireIntel(state)
    const old = state.intel!.filter((it) => it.kind === 'point' && it.status !== 'active')
    expect(old).toHaveLength(KEEP_OLD_POINTS)
    expect(old[0]!.title).toBe('舊的 10')
    expect(state.intel).toContain(story)
    expect(state.intel).toContain(rumor)
    expect(state.intel).toContain(fresh)
  })

  it('never reuses an id after old intel is dropped', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
    for (let i = 0; i < KEEP_OLD_POINTS + 5; i++) {
      const it = addIntel(state, { kind: 'point', title: `點 ${i}`, text: '' })
      it.status = 'done'
    }
    const ids = state.intel!.map((it) => it.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
