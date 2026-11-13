// 多出來的經驗的用途（docs/PERKS.md 4.3 節；engine/xpSinks.ts）
import { describe, expect, it } from 'vitest'
import { attributeRules, progression } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { newGame, withRng } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { attrRoom, refundSpareAttrPoints, spendXp, xpSinkBlocked, xpSinkCost } from '@/engine/xpSinks'
import { migrate } from '@/engine/state'

const r = progression.xp_sinks

function game(level = 20): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 4, birthplace: 'albena' })
  enterLocation(state)
  const pc = pcOf(state)
  pc.level = level
  pc.xp = 1_000_000
  pc.attrPoints = 0
  return state
}
const spend = (state: GameState, kind: 'perk' | 'attr' | 'ability') => withRng(state, (rng) => spendXp(pcOf(state), kind, rng))

describe('經驗的用途', () => {
  it('花費指數遞增，三種各算各的', () => {
    const state = game()
    const pc = pcOf(state)
    expect(xpSinkCost(pc, 'attr')).toBe(r.attr.base)
    spend(state, 'attr')
    spend(state, 'attr')
    expect(xpSinkCost(pc, 'attr')).toBe(r.attr.base * r.attr.mult ** 2)
    expect(pc.attrPoints).toBe(2)
    // 鑽研技能、特質的花費沒有跟著變
    expect(xpSinkCost(pc, 'ability')).toBe(r.ability.base)
    expect(xpSinkCost(pc, 'perk')).toBe(r.perk.base)
    expect(pc.xp).toBe(1_000_000 - r.attr.base - r.attr.base * r.attr.mult)
  })

  it('起始花費與倍率照存檔規則', () => {
    const state = game()
    const pc = pcOf(state)
    Object.assign(state.options as object, { xpAttrBase: 1000, xpAttrMult: 3 })
    expect(xpSinkCost(pc, 'attr', state)).toBe(1000)
    withRng(state, (rng) => spendXp(pc, 'attr', rng, state))
    expect(xpSinkCost(pc, 'attr', state)).toBe(3000)
    expect(pc.xp).toBe(1_000_000 - 1000)
    // 沒改的照預設
    expect(xpSinkCost(pc, 'perk', state)).toBe(r.perk.base)
  })

  it('苦練屬性要 20 級；屬性都到上限時不行', () => {
    const state = game(19)
    const pc = pcOf(state)
    expect(xpSinkBlocked(pc, 'attr')).toContain(`${r.attr.min_level} 級`)
    pc.level = 20
    expect(xpSinkBlocked(pc, 'attr')).toBeUndefined()
    for (const a of attributeRules.attributes) pc.attrs[a.id] = attributeRules.score.max
    expect(xpSinkBlocked(pc, 'attr')).toContain('上限')
  })

  it('手上的屬性點夠把屬性加滿時不能再苦練；多出來的退回經驗', () => {
    const state = game()
    const pc = pcOf(state)
    for (const a of attributeRules.attributes) pc.attrs[a.id] = attributeRules.score.max
    pc.attrs.str = attributeRules.score.max - 2
    expect(attrRoom(pc)).toBe(2)
    spend(state, 'attr')
    spend(state, 'attr')
    expect(xpSinkBlocked(pc, 'attr')).toContain('加滿')
    // 舊版沒擋：多換了 3 點，屬性只剩 2 點可以加
    const xp = pc.xp
    pc.attrPoints += 3
    pc.xpSinkPending = { attr: 5 }
    pc.xpSinks = { attr: 5 }
    const back = refundSpareAttrPoints(pc)
    expect(pc.attrPoints).toBe(2)
    expect(pc.xpSinks.attr).toBe(2)
    expect(back).toBe(r.attr.base * (r.attr.mult ** 2 + r.attr.mult ** 3 + r.attr.mult ** 4))
    expect(pc.xp).toBe(xp + back)
  })

  it('讀檔時把加不上去的屬性點收回，升級給的不退經驗', () => {
    const state = game()
    const pc = pcOf(state)
    for (const a of attributeRules.attributes) pc.attrs[a.id] = attributeRules.score.max
    pc.attrPoints = 4
    const xp = pc.xp
    migrate(state)
    expect(pc.attrPoints).toBe(0)
    expect(pc.xp).toBe(xp)
  })

  it('鑽研特質給一次機會（三選一），處理完才能再換；鑽研技能給一組三選一', () => {
    const state = game(8)
    const pc = pcOf(state)
    pc.perkOffers = []
    pc.pendingAbilityChoices = []
    spend(state, 'perk')
    expect(pc.perkOffers!.at(-1)).toMatchObject({ source: `${r.perk.name}（第 1 次）`, pitch: true })
    expect(pc.perkOffers!.at(-1)!.options.length).toBeGreaterThan(0)
    expect(xpSinkBlocked(pc, 'perk')).toContain('先處理')
    spend(state, 'ability')
    expect(pc.pendingAbilityChoices!.length).toBe(1)
    expect(xpSinkBlocked(pc, 'ability')).toContain('先選完')
  })

  it('經驗不夠時不行，也不會扣', () => {
    const state = game()
    const pc = pcOf(state)
    pc.xp = r.attr.base - 1
    expect(xpSinkBlocked(pc, 'attr')).toContain('經驗不夠')
    expect(() => spend(state, 'attr')).toThrow('經驗不夠')
    expect(pc.xp).toBe(r.attr.base - 1)
    expect(pc.xpSinks).toBeUndefined()
  })
})
