// 「這是剛發生的嗎」：特效只在數值剛變、剛出現時播，打開對話框或讀檔時不重播。

import { toRaw } from 'vue'
import type { GameState } from '@/engine/types'

const memory = new Map<string, unknown>()

/** 上次記下的值（第一次是 undefined），並記下這次的值 */
export function lastSeen<T>(key: string, value: T): T | undefined {
  const prev = memory.get(key) as T | undefined
  memory.set(key, value)
  return prev
}

/** 這一份清單裡，上次看過之後才新出現的項目（第一次看時全部算看過） */
export function freshKeys(key: string, keys: string[]): Set<string> {
  const prev = memory.get(key) as Set<string> | undefined
  memory.set(key, new Set([...(prev ?? []), ...keys]))
  return prev ? new Set(keys.filter((k) => !prev.has(k))) : new Set()
}

// 每個存檔（遊戲狀態物件）載入時已經有的日誌不算新的
const known = new WeakMap<object, Set<string>>()

/** 這則日誌是這次遊玩中剛產生、還沒播過特效的（播一次就不再算新） */
export function isFreshReport(state: GameState, id: string): boolean {
  const raw = toRaw(state) as object
  let set = known.get(raw)
  if (!set) {
    set = new Set(state.reports.map((r) => r.report_id))
    known.set(raw, set)
  }
  if (set.has(id)) return false
  set.add(id)
  return true
}

// 每個載入的遊戲狀態一個編號：讀檔後的數值變化不算「剛發生」
const ids = new WeakMap<object, number>()
let nextId = 1
export function stateKey(state: GameState | null | undefined): string {
  if (!state) return '0'
  const raw = toRaw(state) as object
  let id = ids.get(raw)
  if (!id) ids.set(raw, (id = nextId++))
  return String(id)
}
