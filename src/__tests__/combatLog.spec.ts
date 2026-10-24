import { describe, expect, it } from 'vitest'
import { act, combatant, itemNeedsTarget, startCombat } from '@/engine/combat'
import { maxHpFor } from '@/engine/character'
import { newGame } from '@/engine/state'
import { describeCombatLine } from '@/narrator/describe'
import type { TimelineEntry } from '@/engine/types'

const names = { a: '莉娜', x: '盜賊 A', y: '哥布林 B' }

describe('combat log lines', () => {
  it('moves damage multipliers into the tooltip', () => {
    const t: TimelineEntry = {
      seq: 1, round: 2, actor: 'a', action: '長弓', target: 'x', result: 'success', roll: { value: 15, dc: 10 },
      effects: [{ type: 'damage', target: 'x', amount: 6, element: '穿刺', text: '攻擊削弱 ×0.72，減傷 -1' }],
    }
    const line = describeCombatLine(t, names)
    expect(line.text).toBe('莉娜：長弓 → 盜賊 A（15 vs 10） 成功｜盜賊 A 受到 6 點穿刺傷害')
    expect(line.text).not.toContain('第2回合')
    expect(line.detail).toBe('盜賊 A：攻擊削弱 ×0.72，減傷 -1')
    expect(line.targets).toBeUndefined()
  })

  it('puts each target of an area action on its own line', () => {
    const t: TimelineEntry = {
      seq: 2, round: 1, actor: 'a', action: '使用雷光彈', result: 'success',
      effects: [
        { type: 'damage', target: 'x', amount: 6, element: '閃電' },
        { type: 'status_add', target: 'x', status: '電擊' },
        { type: 'damage', target: 'y', amount: 3, element: '閃電', text: '減傷 -1' },
        { type: 'note', target: 'y', text: '豁免成功' },
      ],
    }
    const line = describeCombatLine(t, names)
    expect(line.text).toBe('莉娜：使用雷光彈 成功')
    expect(line.targets?.map((x) => x.text)).toEqual([
      '盜賊 A 受到 6 點閃電傷害，盜賊 A 陷入「電擊」',
      '哥布林 B 受到 3 點閃電傷害，哥布林 B：豁免成功',
    ])
    expect(line.targets?.[1]?.detail).toBe('哥布林 B：減傷 -1')
  })
})

describe('area items', () => {
  it('do not ask for a target', () => {
    expect(itemNeedsTarget('雷光彈')).toBe(false)
    expect(itemNeedsTarget('止血繃帶')).toBe(true)
  })

  it('hit every enemy and log no single target', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    const pc = state.party[0]!
    pc.maxHp = maxHpFor(1, pc.attrs) * 10
    pc.hp = pc.maxHp
    state.inventory.push({ name: '雷光彈', qty: 1 })
    startCombat(state, [['giant_rat', 3]])
    const combat = state.combat!
    for (const c of combat.combatants) if (c.side === 'enemy') c.hp = c.maxHp = 999
    combat.turn = combat.order.indexOf(pc.id)
    combatant(combat, pc.id).ap = 10
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    act(state, { type: 'item', item: '雷光彈', target: foe.id })
    const entry = combat.timeline.find((t) => t.action === '使用雷光彈')!
    expect(entry.target).toBeUndefined()
    const hit = new Set(entry.effects!.filter((e) => e.type === 'damage').map((e) => e.target))
    expect(hit.size).toBe(3)
  })
})
