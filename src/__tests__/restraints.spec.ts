import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { act, currentActor, keyForLevel, startCombat, struggleDc, struggleTargets, type Combatant } from '@/engine/combat'
import { forceEquip } from '@/engine/forcedGear'
import { enterLocation } from '@/engine/grid'
import { unequipItem, useKey } from '@/engine/inventory'
import { lewdOf } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { keyFits, keysFor, stuckRestraint, unbindDc } from '@/engine/restraints'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { addItem, newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import type { GameState, GearSlot } from '@/engine/types'

/** 主角當奴隸，主人替主角戴上腕鐐（用主人的鎖鎖上） */
function enslaved(): { state: GameState; slot: GearSlot } {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  forceEquip(state, baseReport(state, 'event', 0), rec!.id, '腕鐐')
  const pc = pcOf(state)
  const slot = (Object.keys(pc.gear!) as GearSlot[]).find((s) => pc.gear![s]?.name === '腕鐐')!
  return { state, slot }
}

describe('嘗試脫縛', () => {
  it('主人鎖上的拘束具掙不開；DC 看鎖、拘束程度、忍耐', () => {
    const { state, slot } = enslaved()
    const pc = pcOf(state)
    const s = stuckRestraint(pc, slot)!
    expect(s.name).toBe('腕鐐')
    expect(() => unequipItem(state, pc.id, slot)).toThrow()
    pc.lewd = { ...lewdOf(pc), endurance: 0 }
    const { dc, parts } = unbindDc(pc, slot)
    expect(dc).toBe(10 + parts.reduce((a, p) => a + p.value, 0))
    expect(parts.some((p) => p.label === '拘束程度 1')).toBe(true)
    pc.lewd = { ...lewdOf(pc), endurance: 60 }
    expect(unbindDc(pc, slot).dc).toBe(dc - 3)
  })

  it('成功時鎖被弄壞，拘束具可以卸下', () => {
    const { state, slot } = enslaved()
    const pc = pcOf(state)
    const p = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    expect(p.attr).toBe('dex')
    p.natural = 20
    resolveAction(state, null)
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(pc.gear?.[slot]?.lock).toBeUndefined()
    unequipItem(state, pc.id, slot)
    expect(pc.gear?.[slot]).toBeUndefined()
  })

  it('大失敗：越掙越緊（順從 +1），主人在身邊時被嚴厲懲罰', () => {
    const { state, slot } = enslaved()
    const pc = pcOf(state)
    const before = lewdOf(pc).submission
    const p = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    p.natural = 1
    const r = resolveAction(state, null)
    expect(r.check?.degree).toBe('fumble')
    expect(lewdOf(pc).submission).toBe(before + 1)
    expect(pc.status).toContain('punished')
    expect(stuckRestraint(pc, slot)).toBeDefined()
  })

  it('鑰匙打開同等級以下的鎖，用掉鑰匙、鎖歸自己', () => {
    expect(keyFits('blue', 'white')).toBe(true)
    expect(keyFits('white', 'rune')).toBe(false)
    const { state, slot } = enslaved()
    const pc = pcOf(state)
    const lock = stuckRestraint(pc, slot)!.lock
    addItem(state.inventory, '黃金鑰匙', 1)
    expect(keysFor(state, pc, slot)).toEqual(['黃金鑰匙'])
    const r = useKey(state, pc.id, slot, '黃金鑰匙')
    expect(state.inventory.find((i) => i.name === '黃金鑰匙')).toBeUndefined()
    expect(r.changes.items_gained?.[0]?.name).toBe({ white: '白鐵鎖', blue: '藍鋼鎖', rune: '符文鎖', gold: '黃金鎖' }[lock])
    expect(stuckRestraint(pc, slot)).toBeUndefined()
  })

  it('人形敵人身上的鑰匙依等級', () => {
    expect(keyForLevel(3)).toBe('白鐵鑰匙')
    expect(keyForLevel(8)).toBe('藍鋼鑰匙')
    expect(keyForLevel(20)).toBe('黃金鑰匙')
  })
})

describe('戰鬥中的拘束', () => {
  function fight() {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 11 })
    const pc = pcOf(state)
    pc.level = 5
    pc.hp = pc.maxHp = 200
    const combat = startCombat(state, [['goblin', 1]])
    const me = combat.combatants.find((c) => c.id === pc.id)!
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
    foe.hp = foe.maxHp = 500
    return { state, combat, me, foe }
  }

  it('束縛可以自己掙脫；雙手被綁的比較難', () => {
    const { state, combat, me, foe } = fight()
    me.statuses.push({ id: 'restrained', turns: 2, source: foe.id })
    expect(struggleTargets(combat, me)).toEqual([me])
    const dc = struggleDc(combat, me, me)
    me.handsBound = true
    expect(struggleDc(combat, me, me)).toBe(dc + 2)
    me.handsBound = false
    me.attrs.str = 40
    const ap = me.ap
    act(state, { type: 'struggle', target: me.id })
    expect(me.statuses.some((s) => s.id === 'restrained')).toBe(false)
    expect(me.ap).toBe(ap - 1)
    expect(combat.timeline.some((t) => t.action === '掙脫' && t.result === 'success')).toBe(true)
  })

  it('被膠膜黏住的隊友動不了，可以替他撕開', () => {
    const { state, combat, me, foe } = fight()
    const ally: Combatant = { ...me, id: 'ally', name: '隊友', statuses: [{ id: 'glued', turns: 2, source: foe.id }], usedTurn: {}, usedCombat: {}, usedRest: {} }
    combat.combatants.push(ally)
    expect(struggleTargets(combat, me).map((c) => c.id)).toEqual(['ally'])
    me.attrs.dex = 40
    act(state, { type: 'struggle', target: 'ally' })
    expect(ally.statuses).toEqual([])
    expect(combat.timeline.some((t) => t.action === '撕開')).toBe(true)
    expect(() => act(state, { type: 'struggle', target: me.id })).toThrow('沒有可以掙脫的拘束')
  })
})
