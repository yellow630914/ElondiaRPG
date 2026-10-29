import { describe, expect, it } from 'vitest'
import { act, finishCombat, startCombat } from '@/engine/combat'
import { auxElements } from '@/engine/craft'
import { enemies, lewdRules } from '@/engine/data'
import { rollEnchants } from '@/engine/gear'
import { enterLocation } from '@/engine/grid'
import { addCondition, pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
function fight(state: GameState, foes: [string, number][] = [['goblin', 1]]) {
  const combat = startCombat(state, foes)
  const pc = pcOf(state)
  combat.turn = combat.order.indexOf(pc.id)
  const me = combat.combatants.find((c) => c.id === pc.id)!
  me.ap = me.apMax
  return { combat, me }
}

describe('慾望的消耗品與料理', () => {
  it('清心茶：慾望 −30', () => {
    const state = game()
    addItem(state.inventory, '清心茶', 1)
    const { me } = fight(state)
    me.lust = 50
    act(state, { type: 'item', item: '清心茶', target: me.id })
    expect(me.lust).toBe(20)
  })

  it('精力藥：下一次高潮不扣生命', () => {
    const state = game()
    addItem(state.inventory, '精力藥', 1)
    const { me } = fight(state)
    act(state, { type: 'item', item: '精力藥', target: me.id })
    expect(me.statuses.some((s) => s.id === 'vigor_draught')).toBe(true)
    // 自我挑逗推到高潮：不扣生命，精力藥用掉
    pcOf(state).abilities.push('lust_self_tease')
    me.abilities.push('lust_self_tease')
    me.lust = me.lustMax! - 1
    me.ap = me.apMax
    const hp = me.hp
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    expect(me.climaxes).toBe(1)
    expect(me.hp).toBe(hp)
    expect(me.statuses.some((s) => s.id === 'vigor_draught')).toBe(false)
  })

  it('壯陽燉肉：每場戰鬥的慾望上限 +20%', () => {
    const plain = fight(game()).me.lustMax!
    const state = game()
    addCondition(pcOf(state), 'virile')
    expect(fight(state).me.lustMax).toBe(Math.round(plain * 1.2))
  })

  it('媚藥瓶：所有敵人受到慾望', () => {
    const state = game()
    addItem(state.inventory, '媚藥瓶', 1)
    const { combat, me } = fight(state, [['goblin', 2]])
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    act(state, { type: 'item', item: '媚藥瓶', target: foe.id })
    expect(combat.combatants.filter((c) => c.side === 'enemy').some((c) => (c.lust ?? 0) > 0)).toBe(true)
    void me
  })
})

describe('征服掉落與魅惑的附魔', () => {
  it('在高潮中屈服的淫獸多掉淫獸的媚腺', () => {
    const before = lewdRules.conquest.chance
    lewdRules.conquest.chance = 1
    const state = game()
    const id = Object.keys(enemies).find((x) => enemies[x]!.kind === 'beast' && x.startsWith('lp_'))!
    const { combat } = fight(state, [[id, 1]])
    for (const c of combat.combatants) if (c.side === 'enemy') { c.hp = 0; c.lustDefeated = true }
    combat.status = 'victory'
    const report = finishCombat(state)
    expect(report.changes.items_gained?.some((i) => i.name === '淫獸的媚腺')).toBe(true)
    lewdRules.conquest.chance = before
  })

  it('輔料帶「媚、淫、慾、魅、情」：附魔偏向魅惑', () => {
    expect(auxElements([{ name: '淫獸的媚腺', qty: 1 }])).toContain('lust')
    const e = rollEnchants('longsword', 6, new Rng(3), ['lust'])
    expect(e?.offense?.lust).toBeGreaterThan(0)
  })
})
