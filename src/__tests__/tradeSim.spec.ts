// 跑商的平衡模擬（docs/TRADE.md 3.4 節、worldgen/balance/trade.md）：
// 在每座聚落把店裡今天的一般商品整批買下，走最短的路到另一座聚落、在最好的店賣掉，估算一趟賺多少、每天賺多少。
//   TRADE_SIM=1 npx vitest run src/__tests__/tradeSim.spec.ts
// 結果寫到 worldgen/balance/trade-sim.md（TRADE_SIM_OUT 可以改）。平常的測試會略過。
import { writeFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { geography, shopDef, shopRules, type ShopType } from '@/engine/data'
import { blockKeys, settlementArea } from '@/engine/grid'
import { tradeCategory, tradeCategoryName } from '@/engine/market'
import { formatMoney } from '@/engine/money'
import { newGame } from '@/engine/state'
import { dealMoney, isItemDeal, itemCategory, sellTotalOf, shopKey, shopState, shopTypeForCell } from '@/engine/trade'
import type { GameState } from '@/engine/types'
import { shortestPath } from '@/engine/world'

const SEEDS = [1, 2, 3]
const DAYS = [1, 8, 15, 22, 29, 36]
const towns = geography.locations.filter((l) => l.type !== 'dungeon' && !l.park && !l.requires)

/** 這座聚落有哪些商店（地圖格子） */
const shopsAt = new Map<string, ShopType[]>()
function shopTypes(loc: string): ShopType[] {
  if (!shopsAt.has(loc)) {
    const set = new Set<ShopType>()
    for (const k of blockKeys(loc)) for (const c of settlementArea(k)?.cells ?? []) {
      const t = shopTypeForCell(c.kind)
      if (t && t in shopRules.types) set.add(t)
    }
    shopsAt.set(loc, [...set])
  }
  return shopsAt.get(loc)!
}

function at(s: GameState, loc: string, day: number) {
  s.location = loc
  s.time.day = day
  delete s.side
  s.sales = {}
}

interface Lot { name: string; qty: number; cost: number; cat: string }
interface Run { seed: number; day: number; from: string; to: string; days: number; cost: number; revenue: number; profit: number; perDay: number; lots: { name: string; qty: number; profit: number }[] }

function simulate(glutPct: number): Run[] {
  const runs: Run[] = []
  for (const seed of SEEDS) {
    const s = newGame({ name: '商人', race: 'human', classId: 'fighter', seed })
    s.options = { defeatLoot: 'half', ...s.options, sellGlutPct: glutPct }
    for (const day of DAYS) {
      for (const a of towns) {
        // 整批買下今天各店的一般商品
        at(s, a.id, day)
        const lots: Lot[] = []
        for (const t of shopTypes(a.id)) {
          const shop = shopState(s, t)
          const key = shopKey(s, t)
          for (const d of shop.deals) {
            if (!isItemDeal(d) || d.stock <= 0 || d.stock >= 20) continue // 20 份的是日用品與糧食的「買不完」，另外看
            const name = d.id.slice(5)
            const cat = tradeCategory(s, name)
            if (!cat) continue
            lots.push({ name, qty: d.stock, cost: dealMoney(s, key, d), cat })
          }
        }
        let best: Run | undefined
        for (const b of towns) {
          if (b.id === a.id) continue
          const path = shortestPath(a.id, b.id)
          if (!path) continue
          const days = Math.max(0.5, path.days[0])
          if (days > 10) continue
          at(s, b.id, day + Math.ceil(days))
          const sell: Run['lots'] = []
          let cost = 0
          let revenue = 0
          // 同一間店同一類越賣越便宜：照順序一批一批賣，每批挑收得最好的那間店
          const extra: Record<string, number> = {}
          for (const lot of lots) {
            let top = 0
            let topShop = ''
            for (const t of shopTypes(b.id)) {
              if (!shopDef(t).buys.includes(itemCategory(s, lot.name)!)) continue
              const k = shopKey(s, t)
              const v = sellTotalOf(s, k, lot.name, lot.qty, extra[`${k}|${lot.cat}`] ?? 0) ?? 0
              if (v > top) { top = v; topShop = k }
            }
            const p = top - lot.cost * lot.qty
            if (p <= 0) continue
            extra[`${topShop}|${lot.cat}`] = (extra[`${topShop}|${lot.cat}`] ?? 0) + lot.qty
            cost += lot.cost * lot.qty
            revenue += top
            sell.push({ name: lot.name, qty: lot.qty, profit: p })
          }
          const profit = revenue - cost
          const run: Run = { seed, day, from: a.id, to: b.id, days, cost, revenue, profit, perDay: profit / days, lots: sell.sort((x, y) => y.profit - x.profit) }
          if (!best || run.perDay > best.perDay) best = run
        }
        if (best) runs.push(best)
      }
    }
  }
  return runs
}

const name = (id: string) => geography.locations.find((l) => l.id === id)?.name ?? id
const pctl = (xs: number[], p: number) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0 }
const m = (n: number) => formatMoney(Math.round(n))

describe.skipIf(!process.env.TRADE_SIM)('trade run simulation', () => {
  it('writes the report', () => {
    const lines: string[] = []
    const summary: string[] = []
    for (const g of [0, 3, 5]) {
      const runs = simulate(g)
      const per = runs.map((r) => r.perDay)
      const prof = runs.map((r) => r.profit)
      summary.push(`| ${g}% | ${m(pctl(per, 0.5))} | ${m(pctl(per, 0.9))} | ${m(Math.max(...per))} | ${m(pctl(prof, 0.5))} | ${m(pctl(prof, 0.9))} | ${m(pctl(runs.map((r) => r.cost), 0.5))} |`)
      if (g === 3) {
        lines.push('## 每天賺最多的 15 趟（收購遞減 3%）', '', '| 從 | 到 | 路程 | 本錢 | 賺 | 每天 | 賺最多的貨 |', '|---|---|---|---|---|---|---|')
        for (const r of [...runs].sort((x, y) => y.perDay - x.perDay).slice(0, 15)) {
          lines.push(`| ${name(r.from)}（第 ${r.day} 天） | ${name(r.to)} | ${r.days} 天 | ${m(r.cost)} | ${m(r.profit)} | ${m(r.perDay)} | ${r.lots.slice(0, 3).map((x) => `${x.name}×${x.qty}（${m(x.profit)}）`).join('、')} |`)
        }
        const byCat: Record<string, number> = {}
        const s0 = newGame({ name: '商人', race: 'human', classId: 'fighter', seed: 1 })
        for (const r of runs) for (const x of r.lots) { const c = tradeCategoryName(tradeCategory(s0, x.name)); byCat[c] = (byCat[c] ?? 0) + x.profit }
        const total = Object.values(byCat).reduce((a, b) => a + b, 0) || 1
        lines.push('', '## 利潤來自哪些貿易類別（收購遞減 3%）', '', '| 類別 | 佔利潤 |', '|---|---|')
        for (const [c, v] of Object.entries(byCat).sort((x, y) => y[1] - x[1])) lines.push(`| ${c} | ${Math.round((v / total) * 100)}% |`)
      }
    }
    const out = process.env.TRADE_SIM_OUT ?? 'worldgen/balance/trade-sim.md'
    writeFileSync(out, [
      '# 跑商模擬結果',
      '',
      `> 由 \`TRADE_SIM=1 npx vitest run src/__tests__/tradeSim.spec.ts\` 產生。種子 ${SEEDS.join('、')}，第 ${DAYS.join('、')} 天出發；每座聚落把各店今天的一般商品（裝備、材料、消耗品……，不含一次 20 份的日用品與糧食）整批買下，走最短的路到 10 天內的另一座聚落，賣給收得最好的店（同一間店同一類越賣越便宜）。只買賣得賺的貨；每座聚落只記最好的一趟。沒有算交涉、親密度、聲望與身分，也沒有算路上的花費與風險。`,
      '',
      '## 每座聚落最好的一趟',
      '',
      '| 收購遞減 | 每天（中位數） | 每天（前 10%） | 每天（最多） | 一趟（中位數） | 一趟（前 10%） | 本錢（中位數） |',
      '|---|---|---|---|---|---|---|',
      ...summary,
      '',
      ...lines,
      '',
    ].join('\n'))
    expect(summary.length).toBe(3)
  }, 600000)
})
