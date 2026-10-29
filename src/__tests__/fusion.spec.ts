import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { weaponFor } from '@/engine/character'
import { itemDef } from '@/engine/data'
import { gearStats } from '@/engine/gear'
import { fuseGear, fusionCandidates, fusionMult, splitGear, wornDaysOf } from '@/engine/fusion'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, unequipItem } from '@/engine/inventory'
import { lewdDaily } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { bindModifiers } from '@/engine/schools'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg' })
  enterLocation(state)
  standOn(state, 'smithy')
  state.money_cc = 10000
  addItem(state.inventory, '鐵長劍', 1)
  addItem(state.inventory, '皮眼罩', 1)
  return state
}

describe('淫器合煉', () => {
  it('武器和拘束具合成淫器，可以拆回原本的兩件', () => {
    const state = game()
    expect(fusionCandidates(state)).toMatchObject({ weapons: expect.arrayContaining(['鐵長劍']), restraints: ['皮眼罩'] })
    fuseGear(state, '鐵長劍', '皮眼罩')
    expect(state.money_cc).toBe(10000 - 400)
    expect(state.inventory.some((i) => i.name === '鐵長劍' || i.name === '皮眼罩')).toBe(false)
    expect(fusionCandidates(state).fused).toEqual(['淫器・皮眼罩'])
    splitGear(state, '淫器・皮眼罩')
    expect(state.inventory.find((i) => i.name === '鐵長劍')?.qty).toBe(1)
    expect(state.inventory.find((i) => i.name === '皮眼罩')?.qty).toBe(1)
    expect(fusionCandidates(state).fused).toEqual([])
  })

  it('平常是拘束具（減值加重）；穿夠天數，戰鬥時展開成武器', () => {
    const state = game()
    const pc = pcOf(state)
    equipItem(state, '皮眼罩', pc.id)
    const plain = bindModifiers(pc, { context: 'action', attr: 'int' })[0]!.value
    unequipItem(state, pc.id, Object.entries(pc.gear!).find(([, g]) => g?.name === '皮眼罩')![0] as never)
    fuseGear(state, '鐵長劍', '皮眼罩')
    equipItem(state, '淫器・皮眼罩', pc.id)
    expect(bindModifiers(pc, { context: 'action', attr: 'int' })[0]!.value).toBe(Math.round(plain * 1.5))
    expect(fusionMult(3)).toBe(0)
    const plainWeapon = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect(plainWeapon.weaponMult).toBeUndefined()
    delete state.combat
    lewdDaily(state, state.time.day - 9, state.time.day)
    expect(wornDaysOf(state, pc, '淫器・皮眼罩')).toBe(9)
    const me = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect(me.weaponMult).toBe(1.5)
    expect(me.weapon.dice).toBe(weaponFor({ weapon: gearStats(itemDef('鐵長劍')!.gear!).weapon!, level: pc.level }).dice)
  })
})
