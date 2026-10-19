// 從世界書挑選要注入提示詞的條目。
// 世界書正文是簡體、遊戲資料是繁體，比對關鍵字前先把報告文字轉成簡體。

import { Converter } from 'opencc-js/t2cn'
import type { Report } from '@/engine/types'

export interface WorldbookEntry {
  uid: number
  key: string[]
  comment: string
  content: string
  constant: boolean
  order: number
  disable?: boolean
}

export interface Worldbook {
  entries: Record<string, WorldbookEntry>
}

export interface LoreOptions {
  /** 是否注入成人向條目（敘事傾向、情色喜劇法則、相關價格參考） */
  adult: boolean
  /** 注入字數上限 */
  budgetChars: number
  playerName: string
}

// 世界觀、勢力概述、神祇：每次都注入
const ALWAYS = [0, 28, 44]
// 視角和文風：注入，但把寫死的玩家名改掉
const STYLE = 5
const STYLE_HARDCODED_NAME = '沈頤'
// 地標相對位置：旅行報告才注入
const TRAVEL_ONLY = [46]
// 改由引擎實作或與遊戲 UI 衝突的條目：一律不注入
const EXCLUDED = new Set([1, 2, 3, 4, 8, 10, 11, 29, 30, 31])
// 成人向條目：設定開啟才注入
const ADULT = new Set([16, 17, 18, 38, 39])
// 巨龍條目沒有關鍵字，以「龍」觸發
const DRAGON = 45

const toSimplified = Converter({ from: 'tw', to: 'cn' })

let cached: Promise<Worldbook> | null = null

export function loadWorldbook(): Promise<Worldbook> {
  cached ??= import('@data/worldbook/elondia.worldbook.json').then((m) => m.default as unknown as Worldbook)
  return cached
}

function reportText(report: Report): string {
  return [
    ...(report.lore_keys ?? []),
    report.location.scene ?? '',
    report.outcome.summary ?? '',
    ...(report.others ?? []).map((o) => o.name),
    ...(report.party ?? []).map((p) => p.personality ?? ''),
  ].join('\n')
}

export function selectLore(book: Worldbook, report: Report, opts: LoreOptions): WorldbookEntry[] {
  const raw = reportText(report)
  const haystack = raw + '\n' + toSimplified(raw)
  const entries = Object.values(book.entries).filter((e) => e.content.trim() && !e.disable)

  const picked: WorldbookEntry[] = []
  const add = (e: WorldbookEntry | undefined) => {
    if (e && !picked.includes(e)) picked.push(e)
  }
  const byUid = (uid: number) => entries.find((e) => e.uid === uid)

  for (const uid of ALWAYS) add(byUid(uid))
  const style = byUid(STYLE)
  if (style) add({ ...style, content: style.content.split(STYLE_HARDCODED_NAME).join(opts.playerName) })
  if (report.kind === 'travel') for (const uid of TRAVEL_ONLY) add(byUid(uid))
  if (/[龍龙]/.test(haystack)) add(byUid(DRAGON))

  const keyed = entries
    .filter((e) => !EXCLUDED.has(e.uid) && (opts.adult || !ADULT.has(e.uid)))
    .filter((e) => e.key.some((k) => k && haystack.includes(k)))
    .sort((a, b) => a.order - b.order)
  for (const e of keyed) add(e)
  if (opts.adult) for (const uid of [38, 39]) add(byUid(uid))

  // 依加入順序裁切到字數上限；必注入的條目排在前面，所以會優先保留
  const result: WorldbookEntry[] = []
  let used = 0
  for (const e of picked) {
    if (used + e.content.length > opts.budgetChars && result.length > 0) continue
    result.push(e)
    used += e.content.length
  }
  return result
}
