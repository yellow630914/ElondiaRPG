import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { enemies } from '@/engine/data'
import { bossIds, durability } from './balanceSim'

// 怪物的耐打度（docs/MONSTERS.md「耐打度」）：和怪物同等級的 4 人隊伍，小怪挨 2～3 下、層主撐 3～4 回合。
// 模擬有亂數（固定種子），容許一點誤差。BALANCE_REPORT=路徑 時把每隻怪的結果寫成 JSON。
describe('monster durability', () => {
  it('minions take 2-3 hits and bosses last 3-4 rounds against a party of their level', () => {
    const bosses = bossIds()
    // 頭目：地下城的層主，加上有大招（ability_hp_below）的特殊任務頭目
    const rows = Object.keys(enemies).map((id) => durability(id, Number(process.env.BALANCE_TRIALS ?? 12), bosses.has(id) || !!enemies[id]!.ability_hp_below))
    if (process.env.BALANCE_REPORT) writeFileSync(process.env.BALANCE_REPORT, JSON.stringify(rows, null, 1))
    const off = rows.filter((r) => (r.boss ? r.roundsToKill < 2.9 || r.roundsToKill > 4.1 : r.hitsToKill < 1.8 || r.hitsToKill > 3.2))
    expect(off.map((r) => `${r.name}（${r.level} 級${r.boss ? '層主' : ''}）${r.boss ? `${r.roundsToKill} 回合` : `${r.hitsToKill} 下`}`)).toEqual([])
  }, 120000)
})
