import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { enemies } from '@/engine/data'
import { bossIds, durability } from './balanceSim'

// 怪物的耐打度（docs/MONSTERS.md「耐打度」）：和怪物同等級的 4 人隊伍，小怪 2～3 下、層主 10～15 下。
// 模擬有亂數（固定種子），容許一點誤差。BALANCE_REPORT=路徑 時把每隻怪的結果寫成 JSON。
describe('monster durability', () => {
  it('minions take 2-3 hits and bosses 10-15 hits from a party of their level', () => {
    const bosses = bossIds()
    const rows = Object.keys(enemies).map((id) => durability(id, Number(process.env.BALANCE_TRIALS ?? 12), bosses.has(id)))
    if (process.env.BALANCE_REPORT) writeFileSync(process.env.BALANCE_REPORT, JSON.stringify(rows, null, 1))
    const off = rows.filter((r) => (r.boss ? r.hitsToKill < 9.5 || r.hitsToKill > 15.5 : r.hitsToKill < 1.8 || r.hitsToKill > 3.2))
    expect(off.map((r) => `${r.name}（${r.level} 級${r.boss ? '層主' : ''}）${r.hitsToKill} 下`)).toEqual([])
  }, 120000)
})
