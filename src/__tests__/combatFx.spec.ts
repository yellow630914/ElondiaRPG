import { describe, expect, it } from 'vitest'
import { CRIT_COLOR, PHYSICAL_COLOR, cuesFor, elementColor, unplayedHpDelta } from '@/fx/combatFx'
import type { TimelineEntry } from '@/engine/types'

const entry = (x: Partial<TimelineEntry>): TimelineEntry => ({ seq: 1, actor: 'a', action: '攻擊', result: 'success', ...x })

describe('戰鬥特效', () => {
  it('傷害依類型上色，同一個目標的多段傷害合成一個數字', () => {
    const cues = cuesFor(entry({
      target: 'e1',
      effects: [
        { type: 'damage', target: 'e1', amount: 3, element: '斬擊' },
        { type: 'damage', target: 'e1', amount: 5, element: '火焰' },
      ],
    }))
    expect(cues).toEqual([{ kind: 'damage', target: 'e1', amount: 8, color: elementColor('火焰'), crit: false, area: false }])
    expect(elementColor('斬擊')).toBe(PHYSICAL_COLOR)
  })

  it('範圍攻擊：每個目標各自一個數字，標成範圍', () => {
    const cues = cuesFor(entry({
      action: '雷光彈',
      effects: [
        { type: 'damage', target: 'e1', amount: 4, element: '閃電' },
        { type: 'damage', target: 'e2', amount: 6, element: '閃電' },
      ],
    }))
    expect(cues.filter((c) => c.kind === 'damage').map((c) => c.kind === 'damage' && c.area)).toEqual([true, true])
  })

  it('幸運一擊、失手、大失敗、倒下', () => {
    const crit = cuesFor(entry({ target: 'e1', result: 'critical', effects: [{ type: 'damage', target: 'e1', amount: 12 }, { type: 'status_add', target: 'e1', status: '死亡' }] }))
    expect(crit.map((c) => c.kind)).toEqual(['damage', 'crit', 'down'])
    expect(crit.find((c) => c.kind === 'down')).toMatchObject({ enemy: true })
    expect(CRIT_COLOR).toBeTruthy()
    expect(cuesFor(entry({ target: 'e1', result: 'fail' })).map((c) => c.kind)).toEqual(['miss'])
    expect(cuesFor(entry({ target: 'e1', result: 'fumble' })).map((c) => c.kind)).toEqual(['miss', 'fumble'])
    // 豁免成功不是「失手」
    expect(cuesFor(entry({ target: 'e1', result: 'fail', roll: { value: 15, dc: 12, save: true } }))).toEqual([])
  })

  it('還沒播到的紀錄先不扣 HP', () => {
    const d = unplayedHpDelta([
      entry({ effects: [{ type: 'damage', target: 'p1', amount: 5 }, { type: 'heal', target: 'p2', amount: 3 }] }),
      entry({ effects: [{ type: 'damage', target: 'p1', amount: 2 }] }),
    ])
    expect(d).toEqual({ p1: 7, p2: -3 })
  })
})
