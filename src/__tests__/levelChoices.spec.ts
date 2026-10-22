import { describe, expect, it } from 'vitest'
import { gainXp, learnAbility, xpToNext } from '@/engine/character'
import { combatClasses } from '@/engine/data'
import { pcOf } from '@/engine/party'
import { newGame, withRng } from '@/engine/state'

/** 從 1 級升到 20 級、每次選第一個，記下每次升級有幾個選項 */
function choicesPerLevel(classId: string): number[] {
  const state = newGame({ name: '艾倫', race: 'human', classId, seed: 7 })
  const pc = pcOf(state)
  const out: number[] = []
  while (pc.level < 20) {
    withRng(state, (rng) => gainXp(pc, xpToNext(pc.level) - pc.xp, rng))
    const choices = pc.pendingAbilityChoices?.shift() ?? []
    out.push(choices.length)
    if (choices[0]) learnAbility(pc, choices[0])
  }
  return out
}

describe('level-up ability choices', () => {
  // 每個職業每次升級都要有三選一（非施法職業靠擴充書的技能補上中後期的空缺）
  for (const id of Object.keys(combatClasses)) {
    it(`${combatClasses[id]!.name} has three options at every level`, () => {
      expect(choicesPerLevel(id)).toEqual(Array(19).fill(3))
    })
  }
})
