// 正文的前後銜接：上一段正文的結尾，以及上一段正文之後、這次事件之前發生而沒有寫成正文的事（幕間）。
// 從日誌、敘事與走過的地方（state.trail，見 engine/grid.ts 的 noteSpot）整理；放在提示詞的後段（每次不同），不影響前段的快取。

import { formatTime } from '@/engine/state'
import type { GameState, GameTime, Report } from '@/engine/types'
import { locationName } from './describe'

/** 日誌的敘事（畫面那邊的資料，見 stores/game.ts 的 NarrationState） */
export interface NarrationLike {
  text: string
  status: string
  placeholder?: boolean
}

export interface Continuity {
  /** 上一段正文的結尾 */
  previous?: string
  /** 上一段正文之後、這次事件之前發生的事（一行一件） */
  interlude: string[]
}

/** 往回找上一段正文時最多看幾則日誌 */
const LOOKBACK = 20
/** 幕間最多列幾則日誌（取最近的） */
const MAX_INTERLUDE = 8
/** 上一段正文的結尾取多少字 */
const TAIL_CHARS = 300
const SUMMARY_CHARS = 120

function minutesOf(t: GameTime): number {
  return ((t.day - 1) * 24 + (t.hour ?? 0)) * 60 + (t.minute ?? 0)
}

function timeOf(minutes: number): GameTime {
  return { day: Math.floor(minutes / 1440) + 1, hour: Math.floor((minutes % 1440) / 60), minute: minutes % 60 }
}

/** 正文的最後一段：從段落或句子的開頭切，前面加「……」 */
export function tailOf(text: string, chars = TAIL_CHARS): string {
  const t = text.trim()
  if (t.length <= chars) return t
  const rest = t.slice(t.length - chars)
  const cut = Math.max(rest.indexOf('\n'), rest.search(/[。！？」』]/))
  const body = cut >= 0 && cut < chars / 2 ? rest.slice(cut + 1) : rest
  return `……${body.trim()}`
}

/**
 * 某一則日誌（或還沒成為日誌的行動）之前的銜接資料。
 * index：這次事件在 state.reports 的位置（還沒成為日誌時是 reports.length）；now：這次事件開始的時間。
 * 幕間依時間排列：沒有正文的日誌各一行，中間走過的地方（state.trail）合成一行「移動：來到 A，再到 B」。
 */
export function continuityBefore(state: GameState, narrations: Record<string, NarrationLike>, index: number, now: GameTime): Continuity {
  const reports = state.reports
  const skipped: Report[] = []
  let prev: Report | undefined
  for (let i = index - 1; i >= 0 && i >= index - LOOKBACK; i--) {
    const r = reports[i]!
    const n = narrations[r.report_id]
    if (n?.status === 'done' && !n.placeholder && n.text.trim()) {
      prev = r
      break
    }
    skipped.unshift(r)
  }
  const recent = skipped.slice(-MAX_INTERLUDE)
  // 從哪個時間點開始算幕間：上一段正文結束時；沒有上一段正文時從列出的第一則日誌開始
  const from = prev ? minutesOf(prev.time.end) : recent[0] ? minutesOf(recent[0].time.start) : undefined
  const until = minutesOf(now)
  type Row = { at: number; order: number; move?: string; text?: string }
  const rows: Row[] = recent.map((r, i) => {
    // 主動行動的摘要只有成功程度時，玩家描述的事讓 AI 知道做了什麼
    const intent = r.narration?.player_intent ? `（${r.narration.player_intent.slice(0, 60)}）` : ''
    const summary = `${(r.outcome.summary ?? '').trim().slice(0, SUMMARY_CHARS)}${intent}`
    const town = locationName(r.location.at)
    const scene = r.location.scene && r.location.scene !== town ? `・${r.location.scene.slice(0, 40)}` : ''
    return { at: minutesOf(r.time.start), order: i, ...(summary ? { text: `${formatTime(r.time.start)}｜${town}${scene}｜${summary}` } : {}) }
  })
  if (from !== undefined) {
    for (const t of state.trail ?? []) {
      const m = minutesOf(t.time)
      if (m >= from && m <= until) rows.push({ at: m, order: -1, move: t.spot })
    }
  }
  rows.sort((a, b) => a.at - b.at || a.order - b.order)
  const interlude: string[] = []
  let moves: string[] = []
  let moveAt = 0
  const flush = () => {
    if (moves.length) interlude.push(`${formatTime(timeOf(moveAt))}｜移動：來到${moves.join('，再到')}`)
    moves = []
  }
  for (const row of rows) {
    if (row.move) {
      if (!moves.length) moveAt = row.at
      if (moves.at(-1) !== row.move) moves.push(row.move)
      continue
    }
    flush()
    if (row.text) interlude.push(row.text)
  }
  flush()
  if (prev && interlude.length) {
    const hours = Math.floor((until - minutesOf(prev.time.end)) / 60)
    if (hours >= 1) interlude.push(`（從上一段正文結束到這次事件，大約過了 ${hours} 小時）`)
  }
  return { ...(prev ? { previous: tailOf(narrations[prev.report_id]!.text) } : {}), interlude }
}

/** 已經是日誌的事件 */
export function continuityForReport(state: GameState, narrations: Record<string, NarrationLike>, report: Report): Continuity {
  const index = state.reports.findIndex((r) => r.report_id === report.report_id)
  return continuityBefore(state, narrations, index < 0 ? state.reports.length : index, report.time.start)
}
