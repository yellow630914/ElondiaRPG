import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { clampDegree, computeDegree } from '@/engine/checks'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { buildActionPrompt } from '@/narrator/judge'

function game(naturalCrit: boolean) {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  if (naturalCrit) state.options = { ...(state.options ?? { defeatLoot: 'half' }), naturalCrit: true }
  return state
}

describe('save rule: criticals and fumbles only on the die face', () => {
  it('keeps the margin rule by default and drops it when asked', () => {
    expect(computeDegree(10, 25, 15)).toBe('critical')
    expect(computeDegree(10, 4, 15)).toBe('fumble')
    expect(computeDegree(10, 25, 15, true)).toBe('success')
    expect(computeDegree(10, 4, 15, true)).toBe('fail')
    expect(computeDegree(20, 5, 15, true)).toBe('critical')
    expect(computeDegree(1, 30, 15, true)).toBe('fumble')
    expect(computeDegree(10, 13, 15, true)).toBe('partial')
  })

  it('clamps what the AI judge says', () => {
    expect(clampDegree('critical', 17, true)).toBe('success')
    expect(clampDegree('fumble', 5, true)).toBe('fail')
    expect(clampDegree('critical', 20, true)).toBe('critical')
    expect(clampDegree('critical', 17, false)).toBe('critical')

    const state = game(true)
    const p = prepareAction(state, { kind: 'free', text: '在廣場上表演' })
    p.natural = 15
    const j = sanitizeJudgment(state, p, { degree: 'critical' })
    expect(j.degree).toBe('success')
    expect(resolveAction(state, j).check?.degree).toBe('success')

    const plain = game(false)
    const q = prepareAction(plain, { kind: 'free', text: '在廣場上表演' })
    q.natural = 15
    expect(sanitizeJudgment(plain, q, { degree: 'critical' }).degree).toBe('critical')
  })

  it('tells the AI judge about the rule only when it is on', () => {
    const text = (on: boolean) => {
      const state = game(on)
      const p = prepareAction(state, { kind: 'free', text: '在廣場上表演' })
      const q = buildActionPrompt(state, p, '')
      return q.system + q.user
    }
    expect(text(true)).toContain('大成功只在自然骰 20')
    expect(text(false)).not.toContain('大成功只在自然骰 20')
  })
})
