import { afterEach, describe, expect, it } from 'vitest'
import { companionRules, itemRules, perkDef } from '@/engine/data'
import { enterLocation, goOutskirts } from '@/engine/grid'
import { sanitizePerkMod } from '@/engine/mods'
import { learnablePerks } from '@/engine/perks'
import { campRest, canCampHere, longRestBlocked, partyCamps } from '@/engine/rest'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

const ambush = { ...companionRules.rest.ambush }
afterEach(() => Object.assign(companionRules.rest.ambush, ambush))

/** 在近郊，帶著乾糧 */
function outside(camper = true): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'druid', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  goOutskirts(state)
  if (camper) state.party[0]!.perks = [...(state.party[0]!.perks ?? []), 'star_sleeper']
  addItem(state.inventory, '乾糧', 5)
  // 剛開局：長休的間隔已經過了
  delete state.lastLongRest
  return state
}

const rations = (s: GameState) => s.inventory.find((i) => i.name === '乾糧')?.qty ?? 0

describe('camping with 星夜露宿', () => {
  it('is a perk you can learn, train or read about', () => {
    const p = perkDef('star_sleeper')!
    expect(p.camp).toBe(true)
    expect(p.train?.cells).toContain('guild')
    expect(itemRules.items.find((i) => i.name === '《行旅手札》')?.use?.perks).toContain('star_sleeper')
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
    expect(learnablePerks(state.party[0]!).some((x) => x.id === 'star_sleeper')).toBe(true)
    // 世界編輯器存檔時留著
    expect(sanitizePerkMod('star_sleeper', { ...p }, false)?.camp).toBe(true)
  })

  it('needs someone who can camp, outside town', () => {
    const none = outside(false)
    expect(partyCamps(none)).toBe(false)
    expect(longRestBlocked(none, 'camp')).toContain('星夜露宿')
    expect(() => campRest(none)).toThrow('星夜露宿')
    const town = newGame({ name: '艾倫', race: 'human', classId: 'druid', seed: 3, birthplace: 'rhineburg' })
    enterLocation(town)
    town.party[0]!.perks = ['star_sleeper']
    expect(canCampHere(town)).toBe(false)
    expect(longRestBlocked(town, 'camp')).toContain('野外')
  })

  it('sleeps through the night for a ration each', () => {
    companionRules.rest.ambush.wild = 0
    const state = outside()
    expect(canCampHere(state)).toBe(true)
    const pc = state.party[0]!
    pc.hp = 1
    const before = rations(state)
    const r = campRest(state)
    expect('report_id' in r).toBe(true)
    if (!('report_id' in r)) return
    expect(r.outcome.tags).toContain('紮營')
    expect(r.location.scene).toContain('營地')
    expect(pc.hp).toBe(pc.maxHp)
    expect(rations(state)).toBe(before - state.party.length)
    // 長休的間隔照舊
    expect(longRestBlocked(state, 'camp')).toContain('才能再長休')
  })

  it('can be ambushed: a fight starts, no rest and no rations spent', () => {
    companionRules.rest.ambush.wild = 1
    const state = outside()
    const before = rations(state)
    const r = campRest(state)
    expect('report_id' in r).toBe(false)
    expect(state.combat).toBeTruthy()
    expect(rations(state)).toBe(before)
    expect(state.lastLongRest).toBeUndefined()
  })

  it('needs enough rations', () => {
    companionRules.rest.ambush.wild = 0
    const state = outside()
    state.inventory = state.inventory.filter((i) => i.name !== '乾糧')
    expect(() => campRest(state)).toThrow('乾糧')
  })
})
