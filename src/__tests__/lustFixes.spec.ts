import { afterEach, describe, expect, it } from 'vitest'
import { startArena } from '@/engine/arena'
import { consignable } from '@/engine/auction'
import { act, currentActor, effectiveLustMax, finishCombat, lustMaxFor, startCombat, type Combatant } from '@/engine/combat'
import { setContentFilters } from '@/engine/content'
import { enemies } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { isUnhireable } from '@/engine/population'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function fight(abilities: string[], group: [string, number][]) {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
  const pc = pcOf(state)
  pc.abilities.push(...abilities)
  pc.loadout = undefined
  pc.level = 13
  pc.hp = pc.maxHp = 200
  const combat = startCombat(state, group)
  const me = combat.combatants.find((c) => c.id === pc.id)!
  return { state, combat, me }
}

function myTurn(state: GameState, me: Combatant) {
  for (let i = 0; i < 20 && state.combat?.status === 'ongoing' && currentActor(state.combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
}

afterEach(() => setContentFilters({ pc_unwilling: true }))

describe('慾望戰鬥的修正', () => {
  it('獻祭的契紋：多目標的引爆只放一次', () => {
    const { state, combat, me } = fight(['lust_sacrifice_sigil', 'burst_bliss'], [['goblin', 4]])
    myTurn(state, me)
    for (const c of combat.combatants) if (c.side === 'enemy') c.hp = c.maxHp = 9999
    act(state, { type: 'ability', ability: 'lust_sacrifice_sigil' })
    me.lust = effectiveLustMax(me) - 1
    const n0 = combat.timeline.length
    act(state, { type: 'ability', ability: 'burst_bliss' })
    expect(combat.timeline.slice(n0).filter((t) => t.action === '獻祭的契紋')).toHaveLength(1)
  })

  it('緋夢樂園的怪與魔族不會擲到年幼', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed })
      const combat = startCombat(state, [['lp_succ_dancer', 3], ['lp_lewd_cat', 3]])
      for (const c of combat.combatants.filter((x) => x.side === 'enemy')) expect(c.traits ?? []).not.toContain('young')
    }
  })

  it('層主的慾望上限照生命比例放大，一般怪物不變', () => {
    const { combat } = fight([], [['lp_boss_queen', 1], ['lp_succ_dancer', 1]])
    const boss = combat.combatants.find((c) => c.defId === 'lp_boss_queen')!
    const minion = combat.combatants.find((c) => c.defId === 'lp_succ_dancer')!
    expect(boss.boss).toBe(true)
    // 1170 HP 對同等級一般怪物（約 87 HP）
    expect(boss.lustMax!).toBeGreaterThan(lustMaxFor(enemies.lp_boss_queen!.level) * 10)
    expect(minion.lustMax).toBe(lustMaxFor(minion.level))
  })
})

describe('性戰場', () => {
  function arena() {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: 'albena' })
    enterLocation(state)
    standOn(state, 'tavern')
    state.money_cc = 10000
    const pc = pcOf(state)
    pc.level = 17
    pc.loadout = undefined
    pc.abilities.push('power_word_kill')
    startArena(state, 'lust')
    const me = state.combat!.combatants.find((c) => c.id === pc.id)!
    const foe = state.combat!.combatants.find((c) => c.side === 'enemy')!
    myTurn(state, me)
    return { state, me, foe }
  }

  it('律令：死不殺人，改成讓對手立刻高潮一次', () => {
    const { state, me, foe } = arena()
    me.slots = [9, 9, 9, 9, 9, 9, 9, 9, 9]
    const hp = foe.hp
    act(state, { type: 'ability', ability: 'power_word_kill', target: foe.id })
    expect(foe.hp).toBe(hp)
    expect(foe.climaxes).toBe(1)
  })

  it('對手第三次高潮倒下，不標「隊員倒下」', () => {
    const { state, foe } = arena()
    foe.climaxes = 2
    foe.lust = effectiveLustMax(foe) - 1
    const me = state.combat!.combatants.find((c) => c.side === 'party')!
    me.slots = [9, 9, 9, 9, 9, 9, 9, 9, 9]
    act(state, { type: 'ability', ability: 'power_word_kill', target: foe.id })
    expect(state.combat!.status).toBe('victory')
    expect(foe.lustDefeated).toBe(true)
    const report = finishCombat(state)
    expect(report.outcome.tags).not.toContain('隊員倒下')
    expect(report.outcome.tags).toContain('慾望勝利')
  })
})

describe('任務戰鬥的慾望勝利', () => {
  it('被慾望勝利打倒的具名 NPC 不會死，戰報寫被制伏', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const id = 'npc_lina'
    const combat = startCombat(state, [], { npcs: [id], story: { id: 'none', node: 'none' } })
    const foe = combat.combatants.find((c) => c.npcId === id)!
    foe.hp = 0
    foe.lustDefeated = true
    combat.status = 'victory'
    const report = finishCombat(state)
    expect(npcRecord(state, id)?.dead).toBeFalsy()
    expect(report.others?.find((o) => o.name === foe.name)?.status).toContain('在高潮中屈服、被制伏')
  })
})

describe('附屬系統的修正', () => {
  it('蜜菈不受雇用', () => {
    expect(isUnhireable('npc_park_greeter')).toBe(true)
  })

  it('拍賣會和商店一樣不收獨特裝備', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    addItem(state.inventory, '看板娘的圍裙', 1)
    addItem(state.inventory, '媚藥瓶', 1)
    expect(consignable(state)).not.toContain('看板娘的圍裙')
    expect(consignable(state)).toContain('媚藥瓶')
  })
})
