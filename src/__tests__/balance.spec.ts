import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { durabilityOff, durabilityRows } from './balanceSim'

// 怪物的耐打度（docs/MONSTERS.md「耐打度」）：平常的檢查分成四份在 balance.1～4.spec.ts 平行跑。
// 這裡只在要輸出報告時跑全部：BALANCE_REPORT=路徑 時把每隻怪的結果寫成 JSON（也一起檢查範圍）。
describe.skipIf(!process.env.BALANCE_REPORT)('monster durability report', () => {
  it('writes every monster and checks the range', () => {
    const rows = durabilityRows()
    writeFileSync(process.env.BALANCE_REPORT!, JSON.stringify(rows, null, 1))
    expect(durabilityOff(rows)).toEqual([])
  }, 300_000)
})
