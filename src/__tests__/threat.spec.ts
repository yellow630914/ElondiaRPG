import { describe, expect, it } from 'vitest'
import { act, addThreat, combatant, pickByThreat, startCombat, threatMultOf, threatShares, type Combatant } from '@/engine/combat'
import { createNpc } from '@/engine/character'
import { combatRules, enemies, type NpcDef } from '@/engine/data'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

const ENEMY = Object.keys(enemies)[0]!

/** 戰士主角＋一位同伴，對上一隻敵人 */
function fight(companion: Partial<NpcDef> = {}, race = 'human'): GameState {
  const state = newGame({ name: '測試者', race, classId: 'fighter', seed: 1 })
  const def = { id: 'mate', name: '同伴', race: 'human', class: 'wizard', level: 1, personality: '', ...companion } as NpcDef
  state.party.push({ ...createNpc(def, new Rng(1)), bond: 'voluntary' })
  startCombat(state, [[ENEMY, 1]])
  return state
}

function makeCurrent(state: GameState, id: string): Combatant {
  const combat = state.combat!
  combat.turn = combat.order.indexOf(id)
  return combatant(combat, id)
}

describe('threat', () => {
  it('starts from class, armour, weapon and talent', () => {
    const state = fight()
    const pc = combatant(state.combat!, 'pc')
    const mate = combatant(state.combat!, 'mate')
    // 戰士：起始 8 × 1.3 × (1 + 鍊甲與盾 0.15)；法師：1 × 0.9 × (1 - 布衣 0.1)
    expect(pc.threat).toBe(Math.round(8 * 1.3 * 1.15))
    expect(mate.threat).toBe(Math.round(1 * 0.9 * 0.9))
    expect(threatMultOf(pc)).toBeCloseTo(1.3 * 1.15)
    // 貓魅族的天賦：仇恨 -15%
    const cat = combatant(fight({}, 'catfolk').combat!, 'pc')
    expect(threatMultOf(cat)).toBeCloseTo(1.3 * 1.15 * 0.85)
  })

  it('builds up from damage dealt and fades at the end of each round', () => {
    const state = fight()
    const combat = state.combat!
    const pc = makeCurrent(state, 'pc')
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    foe.hp = foe.maxHp = 999
    const before = pc.threat
    act(state, { type: 'attack', target: foe.id })
    const entry = combat.timeline.at(-1)!
    const dealt = (entry.effects ?? []).filter((e) => e.type === 'damage').reduce((n, e) => n + (e.amount ?? 0), 0)
    const g = combatRules.threat.gains
    const gain = dealt > 0 ? dealt * g.damage : entry.result === 'fail' ? g.miss : 0
    expect(pc.threat).toBeCloseTo(before + gain * threatMultOf(pc))
    // 一直結束回合，直到下一回合開始：仇恨乘上 decay
    const round = combat.round
    const kept = pc.threat
    for (let i = 0; i < 20 && combat.round === round && combat.status === 'ongoing'; i++) act(state, { type: 'end_turn' })
    expect(combat.round).toBe(round + 1)
    expect(pc.threat).toBeCloseTo(Math.round(kept * combatRules.threat.decay * 10) / 10, 0)
  })

  it('makes heavy hitters likelier targets, but never certain', () => {
    const state = fight()
    const combat = state.combat!
    const pc = combatant(combat, 'pc')
    const mate = combatant(combat, 'mate')
    pc.threat = 0
    mate.threat = 0
    expect(threatShares(combat).pc).toBeCloseTo(0.5)
    addThreat(mate, 40)
    const shares = threatShares(combat)
    expect(shares.mate).toBeGreaterThan(0.8)
    expect(shares.pc).toBeGreaterThan(0)
    const rng = new Rng(7)
    const picks = Array.from({ length: 400 }, () => pickByThreat(rng, [pc, mate]).id)
    const mateHits = picks.filter((id) => id === 'mate').length
    expect(mateHits).toBeGreaterThan(300)
    expect(mateHits).toBeLessThan(400)
  })

  it('lets abilities add or shed threat', () => {
    const state = fight({ class: 'rogue' })
    const rogue = makeCurrent(state, 'mate')
    rogue.threat = 12
    act(state, { type: 'ability', ability: 'cunning_action' })
    expect(combatant(state.combat!, 'mate').threat).toBeLessThanOrEqual(2)
  })
})
