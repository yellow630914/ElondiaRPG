// 日誌瘦身（見 docs/SAVES.md 第 6 節）：完整保留最近幾則日誌，更早的封存成簡短的紀錄。
// - 封存的紀錄只留時間、地點、簡述與 AI 寫的經過；隊伍快照、經過的時間軸、變化清單都拿掉。
// - token 用量分開算：封存的日誌的用量（含依來源分開的明細）併進 ARCHIVE_USAGE，本局的合計不會變少；
//   每則封存的紀錄另外記下自己用了多少，給畫面顯示。

import type { GameState, LogArchiveEntry } from '@/engine/types'
import type { NarrationState, UsageEntry, UsagePart } from './game'

/** 封存的日誌合計的 token 用量 */
export const ARCHIVE_USAGE = '_archive'
/** 超過保留數量這麼多則才整理一次（不必每走一步都整理） */
export const ARCHIVE_BATCH = 50

/** 把一筆用量（含明細）加到另一筆 */
export function mergeUsage(into: UsageEntry, from: UsageEntry) {
  into.input += from.input
  into.output += from.output
  into.calls += from.calls
  if (from.cached) into.cached = (into.cached ?? 0) + from.cached
  // 舊紀錄沒有明細：當成「未記錄來源」的敘事正文
  const parts: UsagePart[] = from.by?.length
    ? from.by
    : [{ feature: 'narration', source: '', provider: '' as UsagePart['provider'], model: '', input: from.input, output: from.output, calls: from.calls, ...(from.cached ? { cached: from.cached } : {}) }]
  const by = (into.by ??= [])
  for (const p of parts) {
    let t = by.find((x) => x.feature === p.feature && x.source === p.source && x.provider === p.provider && x.model === p.model)
    if (!t) by.push((t = { feature: p.feature, source: p.source, provider: p.provider, model: p.model, input: 0, output: 0, calls: 0 }))
    t.input += p.input
    t.output += p.output
    t.calls += p.calls
    if (p.cached) t.cached = (t.cached ?? 0) + p.cached
  }
}

/**
 * 日誌超過 keep + ARCHIVE_BATCH 則時，把最舊的封存到只剩 keep 則。
 * narrations 與 usage 是畫面那邊的資料（依日誌 id），一起整理；回傳封存了幾則
 */
export function archiveOldReports(
  state: GameState,
  keep: number,
  narrations: Record<string, NarrationState>,
  usage: Record<string, UsageEntry>,
): number {
  const extra = state.reports.length - keep
  if (extra < ARCHIVE_BATCH) return 0
  const old = state.reports.splice(0, extra)
  const archive = (state.logArchive ??= [])
  for (const r of old) {
    const n = narrations[r.report_id]
    const u = usage[r.report_id]
    const story = n?.status === 'done' && !n.placeholder && n.text.trim() ? n.text : undefined
    const entry: LogArchiveEntry = {
      id: r.report_id, kind: r.kind, time: { ...r.time.start },
      scene: r.location.scene ?? '', summary: r.outcome.summary ?? '',
      ...(story ? { story } : {}),
      ...(u ? { tokens: u.input + u.output } : {}),
    }
    archive.push(entry)
    if (u) {
      mergeUsage((usage[ARCHIVE_USAGE] ??= { input: 0, output: 0, calls: 0 }), u)
      delete usage[r.report_id]
    }
    delete narrations[r.report_id]
  }
  return old.length
}
