import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { dungeonEncounters, enemies } from '@/engine/data'
import { lustBossRows, lustFight, lustMinionRows } from './lustBalanceSim'

// 慾望戰鬥的平衡（docs/COMBAT_SYSTEM.md 第 8.5 節）：走引爆路線的隊員不該一個人扛下大半的輸出。
// 平常只抽 3 個 5～12 級的層主各打幾場（幾秒）；完整的報告（所有層主與小怪、普通與史詩）用 LUST_REPORT=路徑 才跑。

/** 5～12 級的層主，照 id 排序取前幾個（固定的抽樣） */
function sampleBosses(n: number) {
  const out: { group: [string, number][]; level: number }[] = []
  for (const enc of Object.values(dungeonEncounters)) for (const group of Object.values(enc.bosses ?? {})) {
    const id = group?.[0]?.[0]
    const lv = id ? enemies[id]?.level ?? 0 : 0
    if (group && lv >= 5 && lv <= 12) out.push({ group, level: lv })
  }
  return out.sort((a, b) => a.group[0]![0].localeCompare(b.group[0]![0])).slice(0, n)
}

describe('慾望戰鬥的平衡（抽樣）', () => {
  it('練滿的引爆路線在層主戰的傷害占比不超過一半', () => {
    const shares: number[] = []
    for (const { group, level } of sampleBosses(3)) {
      for (let t = 0; t < 4; t++) shares.push(lustFight(group, level, 2000 + t, ['fighter', 'rogue', 'cleric', 'bard'], 3, 'max', 'burst').share)
    }
    const avg = shares.reduce((s, x) => s + x, 0) / shares.length
    expect(avg).toBeLessThan(0.5)
  })
})

describe.skipIf(!process.env.LUST_REPORT)('慾望戰鬥的平衡報告', () => {
  it('writes every boss and minion (normal and epic)', () => {
    const rows = (['normal', 'epic'] as const).flatMap((d) => [...lustBossRows(12, d), ...lustMinionRows(4, d)])
    writeFileSync(process.env.LUST_REPORT!, JSON.stringify(rows, null, 1))
  }, 3_600_000)
})
