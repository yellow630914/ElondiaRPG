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
  /** 更早的幾段正文（由舊到新，各一則：時間、地點、摘要與結尾）；前文只要一段時沒有 */
  earlier?: string[]
  /** 上一段正文的結尾 */
  previous?: string
  /** 上一段正文之後、這次事件之前發生的事（一行一件） */
  interlude: string[]
}

/** 往回找上一段正文時最多看幾則日誌（前文要好幾段時，每多一段多看 LOOKBACK_PER） */
const LOOKBACK = 20
const LOOKBACK_PER = 10
/** 前文最多幾段（提示詞設定的 continuityCount） */
export const MAX_CONTINUITY = 10
/** 前文不只一段時，最近一段送長一點的結尾 */
const LATEST_CHARS = 1000
/** 幕間最多列幾則日誌（取最近的） */
const MAX_INTERLUDE = 8
/** 上一段正文的結尾取多少字 */
const TAIL_CHARS = 300
const SUMMARY_CHARS = 120

/** 送往一般來源時，成人場景的正文與摘要換成這句（成人向的內容只送「成人場景正文」的來源） */
export const ADULT_PLACEHOLDER = '（一段私密的時光，已經結束）'

/** 帶親密場景的日誌（和 prompt.ts 的 adultSceneOf 相同） */
function isAdult(r: Report): boolean {
  return !!r.narration?.adult_scene
}

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
 * adult：這次是送往「成人場景」的請求；不是時，成人場景的正文結尾與摘要換成一句中性的說明（ADULT_PLACEHOLDER）。
 * count：前文要幾段（提示詞設定的「前文段數」）。1 段時只有上一段的結尾（約 300 字）；
 * 2 段以上時上一段送長一點的結尾（約 1000 字），更早的幾段放在 earlier（各自的時間、地點、摘要與約 300 字的結尾）。
 */
export function continuityBefore(state: GameState, narrations: Record<string, NarrationLike>, index: number, now: GameTime, adult = false, count = 1): Continuity {
  const reports = state.reports
  const want = Math.max(1, Math.min(MAX_CONTINUITY, Math.round(count)))
  const skipped: Report[] = []
  let prev: Report | undefined
  const older: Report[] = []
  const written = (r: Report) => {
    const n = narrations[r.report_id]
    return n?.status === 'done' && !n.placeholder && !!n.text.trim()
  }
  const lookback = LOOKBACK + LOOKBACK_PER * (want - 1)
  for (let i = index - 1; i >= 0 && i >= index - lookback; i--) {
    const r = reports[i]!
    if (prev) {
      if (older.length >= want - 1) break
      if (written(r)) older.unshift(r)
      continue
    }
    if (written(r)) {
      prev = r
      if (want === 1) break
      continue
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
    const summary = !adult && isAdult(r) ? ADULT_PLACEHOLDER : `${(r.outcome.summary ?? '').trim().slice(0, SUMMARY_CHARS)}${intent}`
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
  const previous = prev ? (!adult && isAdult(prev) ? ADULT_PLACEHOLDER : tailOf(narrations[prev.report_id]!.text, want > 1 ? LATEST_CHARS : TAIL_CHARS)) : undefined
  // 更早的幾段：時間、地點、摘要與結尾（成人場景的照樣換成中性的說明）
  const earlier = older.map((r) => {
    const town = locationName(r.location.at)
    const head = `${formatTime(r.time.start)}｜${town}`
    if (!adult && isAdult(r)) return `${head}\n${ADULT_PLACEHOLDER}`
    const summary = (r.outcome.summary ?? '').trim().slice(0, SUMMARY_CHARS)
    return `${head}${summary ? `｜${summary}` : ''}\n${tailOf(narrations[r.report_id]!.text)}`
  })
  return { ...(earlier.length ? { earlier } : {}), ...(previous ? { previous } : {}), interlude }
}

/** 已經是日誌的事件 */
export function continuityForReport(state: GameState, narrations: Record<string, NarrationLike>, report: Report, count = 1): Continuity {
  const index = state.reports.findIndex((r) => r.report_id === report.report_id)
  return continuityBefore(state, narrations, index < 0 ? state.reports.length : index, report.time.start, isAdult(report), count)
}
