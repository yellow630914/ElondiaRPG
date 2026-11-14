// 魔力封印（魔導束縛契約）：和主人越親近，能施放的環數越多
import { describe, expect, it } from 'vitest'
import { maxHpFor } from '@/engine/character'
import { combatant, startCombat } from '@/engine/combat'
import { slaveryRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { masterCandidates, spellCapFor, startAsSlave } from '@/engine/slavery'
import { newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import { takeVoluntarySlave } from '@/engine/voluntarySlave'

const step = slaveryRules.spell_seal.affinity_step

function wizardSlave() {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'wizard', seed: 4, birthplace: 'rhineburg' })
  enterLocation(state)
  const pc = pcOf(state)
  pc.level = 9
  pc.maxHp = pc.hp = maxHpFor(9, pc.attrs)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'arcane' })
  return { state, master: contractOf(pc)!.master }
}

describe('魔力封印', () => {
  it('親密度 0 以下照印記寫的 1 環；每 20 多 1 環，最多 9 環', () => {
    const { state, master } = wizardSlave()
    const pc = pcOf(state)
    state.relationships![master]!.affinity = -30
    expect(spellCapFor(state, pc)).toBe(1)
    state.relationships![master]!.affinity = step * 2 + 5
    expect(spellCapFor(state, pc)).toBe(3)
    state.relationships![master]!.affinity = 100
    expect(spellCapFor(state, pc)).toBe(1 + Math.floor(100 / step))
  })

  it('戰鬥中的法術環照放寬後的環數', () => {
    const { state, master } = wizardSlave()
    state.relationships![master]!.affinity = 0
    expect(combatant(startCombat(state, [['goblin', 1]]), 'pc').slotMax.length).toBe(1)
    delete state.combat
    state.relationships![master]!.affinity = step * 2
    expect(combatant(startCombat(state, [['goblin', 1]]), 'pc').slotMax.length).toBe(3)
  })

  it('主角的奴隸看他對主角的親密度；沒有封印是 9 環', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: 'albena' })
    enterLocation(state)
    state.money_cc = 10_000
    const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', class: 'wizard', level: 5, location: 'albena' }, 'ss'))
    registerNpc(state, rec)
    const m = joinParty(state, rec, 'voluntary')
    expect(spellCapFor(state, m)).toBe(9)
    state.relationships![rec.id]!.affinity = 60
    expect(standOn(state, 'carver')).toBe(true)
    takeVoluntarySlave(state, rec.id, 'arcane')
    expect(spellCapFor(state, m)).toBe(1 + Math.floor(60 / step))
  })
})
