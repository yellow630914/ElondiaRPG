import { describe, expect, it } from 'vitest'
import { act, currentActor, finishCombat, startCombat } from '@/engine/combat'
import { companionRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { setAffinity } from '@/engine/social'
import { newGame, withRng } from '@/engine/state'
import type { Character, GameState } from '@/engine/types'

function game(classId = 'fighter'): { state: GameState; mate: Character } {
  const state = newGame({ name: '艾倫', race: 'human', classId, seed: 5 })
  enterLocation(state)
  const mate = joinParty(state, withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', class: 'fighter', location: state.location })), 'voluntary')
  return { state, mate }
}

/** 直接打贏（敵人全倒） */
function win(state: GameState) {
  for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
  state.combat!.status = 'victory'
  return finishCombat(state)
}

const cap = companionRules.combat_affinity_cap

describe('戰鬥給的親密度', () => {
  it('並肩作戰獲勝 +2，但最多推到「友好」的上緣', () => {
    const { state, mate } = game()
    setAffinity(state, mate.id, cap - 1)
    startCombat(state, [['goblin', 1]])
    const r = win(state)
    expect(r.changes.affinity?.find((a) => a.npc === mate.id)).toMatchObject({ delta: 1, after: cap })
    expect(mate.affinity).toBe(cap)
  })

  it('已經在上緣以上：戰鬥不再加，也不寫一筆 +0', () => {
    const { state, mate } = game()
    setAffinity(state, mate.id, 60)
    startCombat(state, [['goblin', 1]])
    const r = win(state)
    expect(r.changes.affinity?.some((a) => a.npc === mate.id)).toBeFalsy()
    expect(mate.affinity).toBe(60)
  })

  it('上緣以下照舊 +2；扣的照扣', () => {
    const { state, mate } = game()
    setAffinity(state, mate.id, 10)
    startCombat(state, [['goblin', 1]])
    win(state)
    expect(mate.affinity).toBe(12)
    setAffinity(state, mate.id, 60)
    startCombat(state, [['goblin', 1]])
    state.combat!.affinity[mate.id] = { delta: -3, reasons: ['測試'] }
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    finishCombat(state)
    expect(mate.affinity).toBe(59)
  })

  it('主角在一場戰鬥裡治療好幾次，只算一次 +1', () => {
    const { state, mate } = game('cleric')
    const pc = state.party.find((m) => m.isPlayer)!
    if (!pc.abilities.includes('healing_word')) pc.abilities.push('healing_word')
    setAffinity(state, mate.id, 0)
    startCombat(state, [['goblin', 3]])
    let heals = 0
    for (let turn = 0; turn < 40 && heals < 3 && state.combat?.status === 'ongoing'; turn++) {
      const who = currentActor(state.combat)
      if (!who) break
      if (who.id === pc.id) {
        const before = state.combat.timeline.length
        act(state, { type: 'ability', ability: 'healing_word', target: mate.id })
        if (state.combat.timeline.length > before) heals++
      } else act(state, { type: 'defend' })
    }
    expect(heals).toBeGreaterThanOrEqual(2)
    const healed = state.combat!.affinity[mate.id]!
    expect(healed.reasons.filter((r) => r === '主角在戰鬥中為其治療')).toHaveLength(1)
    expect(healed.delta).toBe(1 + (healed.reasons.includes('在戰鬥中倒下') ? -1 : 0))
  })
})
