import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { bossFights } from './balanceSim'

// 層主戰的完整模擬（docs/MONSTERS.md「層主戰」）。很慢，只在 FIGHT_REPORT=路徑 時跑，把結果寫成 JSON；
// FIGHT_TRIALS 是每一組的場數（預設 20），FIGHT_LEVEL 是隊伍等級和層主的差（預設 0）。
describe.skipIf(!process.env.FIGHT_REPORT)('boss fights', () => {
  it('simulates every layer boss against a party of its level', () => {
    const rows = bossFights(Number(process.env.FIGHT_TRIALS ?? 20), Number(process.env.FIGHT_LEVEL ?? 0))
    writeFileSync(process.env.FIGHT_REPORT!, JSON.stringify(rows, null, 1))
    expect(rows.length).toBeGreaterThan(0)
  }, 3_600_000)
})
