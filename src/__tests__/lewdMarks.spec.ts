import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { lewdRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { lewdDaily } from '@/engine/lewd'
import { attachParasite, changeCorruption, parasiteAbilities, tameParasite } from '@/engine/parasites'
import { pcOf } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { inkPrice } from '@/engine/tattooShop'
import { addTattoo, tattooTemplate } from '@/engine/tattoos'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
const me = (state: GameState) => startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pcOf(state).id)!

describe('淫紋', () => {
  it('慾望上限、造成的慾望；刺青店另外加價', () => {
    const plain = me(game())
    const state = game()
    const pc = pcOf(state)
    addTattoo(pc, { kind: 'plain', place: 'belly', name: '淫紋・子宮', desc: '', template: 'lewd_womb' }, state.time)
    addTattoo(pc, { kind: 'plain', place: 'hips', name: '淫紋・心鎖', desc: '', template: 'lewd_heart' }, state.time)
    const f = me(state)
    expect(f.lustMax).toBe(Math.round(plain.lustMax! * 1.15))
    expect(f.lustMods!.bonus - plain.lustMods!.bonus).toBe(2)
    expect(inkPrice('parlor', { kind: 'plain', template: 'lewd_womb' })).toBe(200 + tattooTemplate('lewd_womb')!.price!)
  })
})

describe('寄生物', () => {
  it('侵蝕度每跨過 10 點，淫亂、敏感 +1', () => {
    const state = game()
    const pc = pcOf(state)
    attachParasite(pc, 'succubus_mark', state.time)
    const before = { ...lewdRules.defaults, ...pc.lewd }
    changeCorruption(pc, 'succubus_mark', 25)
    expect(pc.lewd!.lewdness).toBe(before.lewdness + 2)
    expect(pc.lewd!.sensitivity).toBe(before.sensitivity + 2)
  })

  it('魅魔的契紋：共生給魅惑之吻、支配再給傾國一笑並失控；馴服後獸蟲派得到每次長休一次的技能', () => {
    const state = game()
    const pc = pcOf(state)
    attachParasite(pc, 'succubus_mark', state.time)
    changeCorruption(pc, 'succubus_mark', 60)
    expect(parasiteAbilities(pc)).toEqual(['lust_kiss'])
    changeCorruption(pc, 'succubus_mark', 30)
    expect(parasiteAbilities(pc)).toEqual(['lust_kiss', 'lust_smile'])
    const f = me(state)
    expect(f.abilities).toContain('lust_smile')
    // 失控：帶著慾望開戰（沒有寄生物時是 0；輪到自己時會先消退一點）
    expect(f.lust).toBeGreaterThan(0)
    tameParasite(pc, 'succubus_mark')
    expect(parasiteAbilities(pc)).toEqual([])
    pc.perks = [...(pc.perks ?? []), 'school_beast']
    expect(parasiteAbilities(pc)).toEqual(['para_mark_surge'])
  })
})

describe('奴隸印記的順從累積', () => {
  it('娼妓契約每天順從 +1', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'brothel' })
    const pc = pcOf(state)
    pc.lewd = { ...pc.lewd!, submission: 20 }
    lewdDaily(state, 1, 3)
    expect(pc.lewd!.submission).toBe(22)
  })
})
