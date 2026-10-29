import { describe, expect, it } from 'vitest'
import { arenaBlocked, arenaPurse, arenaRules, arenaTier, startArena } from '@/engine/arena'
import { act, currentActor, effectiveLustMax, finishCombat } from '@/engine/combat'
import { enterLocation, standOn } from '@/engine/grid'
import { lewdOf } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(location = 'albena'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: location })
  enterLocation(state)
  standOn(state, 'tavern')
  state.money_cc = 10000
  return state
}

function win(state: GameState) {
  for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
  state.combat!.status = 'victory'
  return finishCombat(state)
}

function lose(state: GameState) {
  for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = 0
  state.combat!.status = 'defeat'
  return finishCombat(state)
}

describe('淫鬥場', () => {
  it('魅氣濃的城鎮，娼館或酒館才能報名', () => {
    expect(arenaBlocked(game())).toBeUndefined()
    expect(arenaBlocked(game('rhineburg'))).toContain('沒有淫鬥場')
  })

  it('贏了發獎金、記連勝，贏夠了換更強的對手；輸了不損失錢、沒有戰敗事件', () => {
    const state = game()
    const fee = arenaRules().fee
    for (let i = 0; i < arenaRules().streak_per_tier; i++) {
      const money = state.money_cc
      startArena(state, 'beast')
      expect(state.combat?.arena?.ring).toBe('beast')
      const r = win(state)
      expect(r.outcome.tags).toContain('淫鬥場')
      expect(state.money_cc).toBeGreaterThanOrEqual(money - fee + arenaPurse(0).prize)
    }
    expect(arenaTier(state, 'beast')).toBe(1)
    startArena(state, 'beast')
    const money = state.money_cc
    lose(state)
    expect(state.money_cc).toBe(money)
    expect(state.pendingDefeat).toBeUndefined()
    expect(arenaTier(state, 'beast')).toBe(0)
    expect(state.arena?.albena?.beast?.best).toBe(2)
  })

  it('拘束戰鬥場：上場前戴上鎖好的拘束具，打完拿回行囊', () => {
    const state = game()
    expect(() => startArena(state, 'bound')).toThrow('拘束具')
    addItem(state.inventory, '皮眼罩', 1)
    startArena(state, 'bound', { restraint: '皮眼罩' })
    const pc = pcOf(state)
    const slot = state.combat!.arena!.restraint!.slot
    expect(pc.gear?.[slot]).toMatchObject({ name: '皮眼罩', lock: 'white' })
    expect(state.inventory.some((i) => i.name === '皮眼罩')).toBe(false)
    win(state)
    expect(pc.gear?.[slot]?.name).not.toBe('皮眼罩')
    expect(state.inventory.find((i) => i.name === '皮眼罩')?.qty).toBe(1)
  })

  it('賭注賽輸了曝露名聲、順從上升', () => {
    const state = game()
    const pc = pcOf(state)
    const before = lewdOf(pc).submission
    startArena(state, 'beast', { wager: true })
    expect(state.combat!.arena!.fee).toBe(arenaRules().fee * arenaRules().wager.mult)
    lose(state)
    expect(lewdOf(pc).submission).toBe(before + 1)
  })

  it('性戰場：生命傷害改成慾望，對手第三次高潮就倒下', () => {
    const state = game()
    const pc = pcOf(state)
    pc.level = 8
    startArena(state, 'lust')
    const combat = state.combat!
    expect(combat.lustOnly).toBe(true)
    const me = combat.combatants.find((c) => c.id === pc.id)!
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
    expect(me.hp).toBe(me.maxHp)
    me.attrs.str = 40
    me.attrs.dex = 40
    const hp = foe.hp
    foe.lust = 0
    act(state, { type: 'attack', target: foe.id })
    expect(foe.hp).toBe(hp)
    expect(foe.lust).toBeGreaterThan(0)
    // 已經高潮兩次：第三次就倒下（慾望勝利），不扣真實傷害
    for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
    foe.climaxes = 2
    foe.lust = effectiveLustMax(foe) - 1
    foe.statuses = []
    me.ap = me.apMax
    act(state, { type: 'attack', target: foe.id })
    expect(foe.hp).toBe(0)
    expect(foe.lustDefeated).toBe(true)
    expect(combat.status).toBe('victory')
  })
})
