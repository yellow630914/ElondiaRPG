import { act, currentActor, finishCombat, validTargets } from '@/engine/combat'
import { combatRules } from '@/engine/data'
import type { GameState } from '@/engine/types'

/** 每位隊員都用武器攻擊第一個敵人，行動點不夠就結束回合，直到戰鬥結束。 */
export function fightToEnd(state: GameState) {
  for (let i = 0; i < 500 && state.combat?.status === 'ongoing'; i++) {
    const actor = currentActor(state.combat)!
    if (actor.ap < combatRules.action_costs.weapon_attack) {
      act(state, { type: 'end_turn' })
      continue
    }
    const target = validTargets(state.combat, actor.id)[0]!
    act(state, { type: 'attack', target: target.id })
  }
  if (state.combat?.status === 'ongoing') throw new Error('combat did not end')
  return finishCombat(state)
}
