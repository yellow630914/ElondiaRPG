// 隨機事件不要一直重複（主人的突發事件、奴隸主動找主角）：記下每件事最近一次發生的日子，
// 抽事件時跳過 repeat_days 天內發生過的；全部都發生過時照常抽（不會因此完全沒事件）。
// 記在 state.eventSeen（鍵是「事件庫:事件 id」，值是第幾天），超過 30 天的自動清掉。

import type { GameState } from './types'

const KEEP_DAYS = 30

/** 記下這件事今天發生了 */
export function markSeen(state: GameState, key: string) {
  const seen = (state.eventSeen ??= {})
  seen[key] = state.time.day
  for (const [k, d] of Object.entries(seen)) if (state.time.day - d > KEEP_DAYS) delete seen[k]
}

/** days 天內發生過 */
export function seenWithin(state: GameState, key: string, days: number): boolean {
  const d = state.eventSeen?.[key]
  return d !== undefined && state.time.day - d < days
}

/** 跳過最近發生過的；全部都發生過時回傳原本的清單 */
export function freshFirst<T>(state: GameState, list: T[], keyOf: (x: T) => string, days: number): T[] {
  if (days <= 0) return list
  const fresh = list.filter((x) => !seenWithin(state, keyOf(x), days))
  return fresh.length ? fresh : list
}
