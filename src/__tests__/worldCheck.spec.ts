import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { checkWorld, reportMarkdown } from './worldCheck'

// 世界檢查（worldgen/balance/README.md）：WORLD=世界包或內容檔的路徑 時執行，把報告寫到同一個資料夾的 check-report.md
// （WORLD_REPORT 可以指定別的路徑）。WORLD_TRIALS 是每一組戰鬥模擬的場數（預設 20）。有錯誤時測試失敗。
describe.skipIf(!process.env.WORLD)('world check', () => {
  it('checks a world package or content file', () => {
    const path = process.env.WORLD!
    const result = checkWorld(JSON.parse(readFileSync(path, 'utf8')), { trials: Number(process.env.WORLD_TRIALS ?? 20) })
    const out = process.env.WORLD_REPORT ?? join(dirname(path), 'check-report.md')
    writeFileSync(out, reportMarkdown(result))
    expect(result.findings.filter((f) => f.level === 'error').map((f) => `${f.section}：${f.text}`)).toEqual([])
  }, 3_600_000)
})
