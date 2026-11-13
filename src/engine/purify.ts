// 神殿的淨身（docs/LEWD_STATS.md 第 4.1 節）：付錢、花時間，把一位隊員的一項慾望指標降幾點；
// 曝露名聲是這一帶的。降到預設值以下的部分比較貴（lewd.json 的 purify）。每人每天一次。

import { lewdRules, locationById, type LewdKey } from './data'
import { nurseryRefusal } from './children'
import { addLewd, baseLewd, currentRegion, lewdName } from './lewd'
import { formatMoney } from './money'
import { isFugitive } from './party'
import { commitReport, player } from './state'
import { snapshot } from './character'
import { baseReport } from './town'
import type { Character, GameState, Report } from './types'

export const purifyRules = () => lewdRules.purify

/** 這一項現在的基本值（曝露名聲是這一帶的） */
export function purifyValue(state: GameState, c: Character, key: LewdKey): number {
  if (key === 'exposure') return state.exposure?.[c.id]?.[currentRegion(state)] ?? 0
  return baseLewd(c)[key]
}

/** 這一項最多能降幾點（一次最多 max_points，不會降到 0 以下） */
export function purifyMax(state: GameState, c: Character, key: LewdKey): number {
  return Math.max(0, Math.min(purifyRules().max_points, purifyValue(state, c, key)))
}

/** 降 points 點的費用：預設值以上每點 per_point_cc，降到預設值以下的部分 × below_default_mult（曝露名聲的預設是 0） */
export function purifyCost(state: GameState, c: Character, key: LewdKey, points: number): number {
  const r = purifyRules()
  const v = purifyValue(state, c, key)
  const floor = key === 'exposure' ? 0 : lewdRules.defaults[key]
  let cost = 0
  for (let i = 0; i < points; i++) cost += r.per_point_cc * (v - i > floor ? 1 : r.below_default_mult)
  return cost
}

export function purifiedToday(state: GameState, c: Character): boolean {
  return c.lewd?.purified === state.time.day
}

/** 不能淨身的原因（沒有時是空字串） */
export function purifyBlocked(state: GameState, c: Character, key: LewdKey, points: number): string {
  if (isFugitive(state)) return '神殿的人認出了你身上的契約印記，拒絕接待'
  const owed = nurseryRefusal(state)
  if (owed) return owed
  if (state.combat) return '戰鬥中不能淨身'
  if (!purifyRules().stats.includes(key)) return `神殿不替人淨化「${lewdName(key)}」`
  if (purifiedToday(state, c)) return `${c.name}今天已經淨身過了，明天再來`
  const max = purifyMax(state, c, key)
  if (!max) return `${c.name}的${lewdName(key)}已經降不下去了`
  if (points < 1 || points > max) return `一次最多降 ${max} 點`
  if (state.money_cc < purifyCost(state, c, key, points)) return '金錢不足'
  return ''
}

/** 在神殿淨身：付錢、花 hours 小時，這一項降 points 點 */
export function templePurify(state: GameState, memberId: string, key: LewdKey, points: number): Report {
  const c = state.party.find((m) => m.id === memberId)
  if (!c) throw new Error('找不到這位隊員')
  const why = purifyBlocked(state, c, key, points)
  if (why) throw new Error(why)
  const cost = purifyCost(state, c, key, points)
  const report = baseReport(state, 'action', purifyRules().hours)
  report.location.scene = `${locationById(state.location).name}的神殿`
  report.party = [snapshot(c, undefined, player(state))]
  const d = addLewd(state, c, key, -points, report)
  ;(c.lewd ??= { ...lewdRules.defaults }).purified = state.time.day
  report.changes.money_cc = -cost
  report.outcome.summary = `${c.name}在神殿淨身：在聖水池裡靜坐、聽神官誦經，${key === 'exposure' ? '這一帶的' : ''}${lewdName(key)} ${d}（奉獻 ${formatMoney(cost)}）。`
  report.narration = { pov: 'second_person', length: 'short' }
  return commitReport(state, report)
}
