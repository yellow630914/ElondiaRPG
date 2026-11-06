import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { startCombat } from '@/engine/combat'
import { proficiency } from '@/engine/character'
import { roll as eventRoll } from '@/engine/road'
import { sumParts } from '@/engine/rollParts'
import { newGame } from '@/engine/state'
import type { GameState, TimelineEntry, TimelineRoll } from '@/engine/types'
import { describeEntry, rollDetail } from '@/narrator/describe'
import { fightToEnd } from './helpers/fight'

function game(seed = 4): GameState {
  return newGame({ name: '測試者', race: 'human', classId: 'fighter', seed, birthplace: 'soriel' })
}

/** 拆解要對得上：骰面 + 加值 = 總值，DC 的組成加起來 = DC */
function expectConsistent(r: TimelineRoll | undefined) {
  expect(r?.natural).toBeTypeOf('number')
  expect(r!.natural! + sumParts(r!.parts ?? [])).toBe(r!.value)
  if (r!.dc_parts) expect(sumParts(r!.dc_parts)).toBe(r!.dc)
  // 拆得對時不會冒出「其他」
  expect(rollDetail(r)).not.toContain('其他')
}

describe('擲骰的加值拆解', () => {
  it('writes the sum the way a player reads it', () => {
    expect(rollDetail({ dice: '1d20+3', value: 14, dc: 12, natural: 11, parts: [{ label: '魅力', value: 1 }, { label: '熟練', value: 2 }] }))
      .toBe('骰 11 + 魅力 +1 + 熟練 +2 = 14，對 DC 12')
    expect(rollDetail({ value: 9, dc: 13, natural: 10, naturals: [10, 4], parts: [{ label: '受罰', value: -1 }], dc_parts: [{ label: '基礎', value: 10 }, { label: '警戒 1', value: 3 }] }))
      .toBe('骰 10、4 取 10 + 受罰 -1 = 9，對 DC 13（基礎 10 + 警戒 1 +3）')
    expect(rollDetail({ value: 15, dc: 14, save: true, natural: 13, parts: [{ label: '靈巧', value: 2 }] })).toBe('豁免：骰 13 + 靈巧 +2 = 15，對 DC 14')
    expect(rollDetail({ value: 17, dc: 15, natural: 15, parts: [{ label: '熟練', value: 2 }], dc_name: '迴避' })).toBe('骰 15 + 熟練 +2 = 17，對迴避 15')
    // 拆解對不上總值：差額列成「其他」
    expect(rollDetail({ value: 16, dc: 12, natural: 11, parts: [{ label: '魅力', value: 1 }] })).toBe('骰 11 + 魅力 +1 + 其他 +4 = 16，對 DC 12')
  })

  it('calls a critical check outside combat 大成功, and 幸運一擊 in combat', () => {
    const names = { pc: '莉雅' }
    expect(describeEntry({ seq: 1, actor: 'pc', action: '自由行動（魅力）', roll: { value: 23, dc: 12 }, result: 'critical' }, names)).toBe('莉雅：自由行動（魅力）（23 vs 12） 大成功！')
    expect(describeEntry({ seq: 1, round: 2, actor: 'pc', action: '長劍', roll: { value: 23, dc: 12 }, result: 'critical' }, names)).toContain('幸運一擊！')
  })

  it('records both dice and the status name when a fight roll has advantage or a luck die', () => {
    let both = 0
    let named = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = game(seed)
      startCombat(state, [['goblin', 2]])
      // 祝福（幸運骰）＋目標被定身類的攻擊優勢：讓攻擊擲兩次、帶狀態名字的加值
      const c = state.combat!
      for (const x of c.combatants) {
        if (x.side === 'party') x.statuses.push({ id: 'blessed', turns: 9, source: x.id } as never)
        else x.statuses.push({ id: 'blinded', turns: 9, source: x.id } as never)
      }
      const report = fightToEnd(state)
      for (const t of report.timeline ?? []) {
        if (t.roll?.natural === undefined) continue
        expectConsistent(t.roll)
        if (t.roll.naturals) {
          both++
          expect(t.roll.naturals).toContain(t.roll.natural)
          expect(rollDetail(t.roll)).toMatch(/^(豁免：)?骰 \d+、\d+ 取 \d+/)
        }
        if (t.roll.parts?.some((p) => p.label === '祝福')) named++
        expect(t.roll.parts?.some((p) => p.label === '運氣')).toBeFalsy()
      }
    }
    expect(both).toBeGreaterThan(0)
    expect(named).toBeGreaterThan(0)
  })

  it('shows nothing for old saves without the breakdown', () => {
    expect(rollDetail({ dice: '1d20+2', value: 13, dc: 12 })).toBeUndefined()
    expect(rollDetail(undefined)).toBeUndefined()
  })

  it('splits the main action check into attribute, proficiency and situational modifiers', () => {
    const state = game()
    const pc = state.party[0]!
    const p = prepareAction(state, { kind: 'free', text: '在城裡散步' })
    state.pendingAction!.natural = 11
    const r = resolveAction(state, null)
    const t = r.timeline![0]!
    expectConsistent(t.roll)
    expect(t.roll!.natural).toBe(11)
    // 規則判定：自由行動用魅力
    expect(t.roll!.parts?.find((x) => x.label === '熟練')?.value).toBe(proficiency(pc.level))
    expect(p.attr).toBe('cha')
    expect(rollDetail(t.roll)).toMatch(/^骰 11 \+ .*熟練 \+\d/)
  })

  it('records the AI changing the DC', () => {
    const state = game()
    prepareAction(state, { kind: 'free', text: '撬開倉庫的門' })
    state.pendingAction!.natural = 9
    const base = state.pendingAction!.base_dc
    const r = resolveAction(state, sanitizeJudgment(state, state.pendingAction!, { degree: 'fail', attr: 'dex', dc: base + 2, effects: [] }))
    const roll = r.timeline![0]!.roll!
    expectConsistent(roll)
    expect(roll.parts?.some((x) => x.label === '靈巧')).toBe(true)
    expect(roll.dc_parts).toEqual([{ label: '參考 DC', value: base }, { label: 'AI 調整', value: 2 }])
  })

  it('breaks down travel event checks', () => {
    const state = game()
    const { entry } = eventRoll(state, { attr: 'dex', dc: 12 }, 7)
    expectConsistent(entry.roll)
    expect(entry.roll!.natural).toBe(7)
  })

  it('breaks down every attack, save and flee roll of a fight', () => {
    for (const seed of [1, 2, 3]) {
      const state = game(seed)
      startCombat(state, [['goblin', 2]])
      const report = fightToEnd(state)
      const rolled = (report.timeline ?? []).filter((t: TimelineEntry) => t.roll?.value !== undefined && t.roll.natural !== undefined)
      expect(rolled.length).toBeGreaterThan(0)
      for (const t of rolled) expectConsistent(t.roll)
      // 攻擊對的是目標的迴避
      expect(rolled.some((t) => t.roll!.dc_name === '迴避' && (t.roll!.dc_parts?.[0]?.label === '迴避骰'))).toBe(true)
    }
  })
})
