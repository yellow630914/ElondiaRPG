import { describe, expect, it } from 'vitest'
import { durabilityOff, durabilityRows } from './balanceSim'

// 怪物的耐打度（docs/MONSTERS.md「耐打度」）第 2 份：和怪物同等級的 4 人隊伍，小怪挨 3～5 下、層主撐 4～5.5 回合。
// 怪物照順序交錯分成四份（balanceSim.ts 的 durabilityRows），四個檔案平行跑；全部的報告在 balance.spec.ts（BALANCE_REPORT）。
describe('monster durability (2/4)', () => {
  it('minions take 3-5 hits and bosses last 4-5.5 rounds against a party of their level', () => {
    expect(durabilityOff(durabilityRows(1))).toEqual([])
  }, 120_000)
})
