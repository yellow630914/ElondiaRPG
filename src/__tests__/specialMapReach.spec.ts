import { describe, expect, it } from 'vitest'
import { specialMaps } from '@/engine/data'

// 內建的特殊地圖：從入口（entry，沒有時是第一個 E）上下左右走得到每一格可以站的地方。
// 伯爵夫人的沙龍曾經把入口正上方畫成牆，走不進去。
const BLOCKED = new Set(['#', '~'])

describe('built-in special maps', () => {
  it('every walkable cell can be reached from the entrance', () => {
    const problems: string[] = []
    for (const m of Object.values(specialMaps)) {
      const g = m.grid
      if (!g?.length) continue // 隨機生成的地圖沒有固定的格子
      const h = g.length
      const w = g[0]!.length
      let start = m.entry ? [m.entry.x, m.entry.y] as const : undefined
      if (!start) {
        const y = g.findIndex((row) => row.includes('E'))
        if (y >= 0) start = [g[y]!.indexOf('E'), y] as const
      }
      // 只從別張圖的通道進來的（例如下水道深處的蓄水池）：從通道接過來的那一格開始
      const incoming = Object.values(specialMaps).flatMap((o) => o.connections ?? []).find((c) => c.to.area === `sm/${m.id}`)
      start ??= incoming ? [incoming.to.x, incoming.to.y] as const : undefined
      if (!start) {
        problems.push(`${m.name}：沒有入口`)
        continue
      }
      const seen = new Set<string>()
      const stack: [number, number][] = [[start[0], start[1]]]
      while (stack.length) {
        const [x, y] = stack.pop()!
        const k = `${x},${y}`
        if (seen.has(k) || x < 0 || y < 0 || x >= w || y >= h || BLOCKED.has(g[y]![x]!)) continue
        seen.add(k)
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
      }
      const missing: string[] = []
      g.forEach((row, y) => [...row].forEach((c, x) => { if (!BLOCKED.has(c) && !seen.has(`${x},${y}`)) missing.push(`(${x},${y})`) }))
      if (missing.length) problems.push(`${m.name}：走不到 ${missing.slice(0, 6).join(' ')}${missing.length > 6 ? ` 等 ${missing.length} 格` : ''}`)
    }
    expect(problems).toEqual([])
  })
})
