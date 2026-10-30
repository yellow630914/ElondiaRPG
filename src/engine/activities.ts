// NPC 正在做什麼：不用 AI，依 data/rules/npc_activities.json 的規則與「NPC id＋日期＋時段」的固定亂數挑一句。
// 不存額外資料，重新整理也不會變；只替「這裡的人」列出的人算，結果依時段記住，主角每走一步不重算。
// 見 docs/NPC_SYSTEM.md 第 7.1 節。

import { landmarkDef, npcActivities, type ActivityPeriod, type ActivityRule } from './data'
import { cellAt, cellName, currentArea, type Area } from './grid'
import { hashString, npcKind, npcTitle, weightedPick } from './npcs'
import { isHostile, nearbyPeople, type PresentNpc } from './population'
import { Rng } from './rng'
import type { GameState, Report } from './types'

/** 現在是哪個時段（凌晨跨日的時段寫成 [21, 5]） */
export function activityPeriod(hour: number): ActivityPeriod {
  for (const [p, [from, to]] of Object.entries(npcActivities.periods) as [ActivityPeriod, [number, number]][]) {
    if (from <= to ? hour >= from && hour < to : hour >= from || hour < to) return p
  }
  return 'day'
}

/** 格子的種類 → 規則的 at：自建的商店也算 shop，地標格是 landmark 與 landmark:<類型> */
function placesOf(kind: string): string[] {
  if (kind.startsWith('shop_')) return [kind, 'shop']
  const l = kind.startsWith('lm_') ? landmarkDef(kind) : undefined
  if (l) return [kind, 'landmark', ...l.types.map((t) => `landmark:${t}`)]
  return [kind]
}

interface Context {
  places: string[]
  area: string
  kind: string
  staff: boolean
  tags: string[]
  occupation: string
  personality: string
  period: ActivityPeriod
  hostile: boolean
}

const hasWord = (text: string, words: string[]) => words.some((w) => text.includes(w))

/** 這條規則符合幾個條件；有一個不符合就是 -1 */
function score(r: ActivityRule, c: Context): number {
  const checks: (boolean | undefined)[] = [
    r.at && r.at.some((a) => c.places.includes(a)),
    r.area && r.area.includes(c.area),
    r.kind && r.kind === c.kind,
    r.staff === undefined ? undefined : r.staff === c.staff,
    r.tags && r.tags.some((t) => c.tags.includes(t)),
    r.occupation && hasWord(c.occupation, r.occupation),
    r.personality && hasWord(c.personality, r.personality),
    r.when && r.when.includes(c.period),
    r.hostile === undefined ? undefined : r.hostile === c.hostile,
  ]
  const used = checks.filter((x) => x !== undefined)
  return used.every(Boolean) ? used.length : -1
}

/** 依時段記住的結果（key 含 NPC、日期、時段、位置與會影響結果的資料） */
const cache = new Map<string, string>()
const CACHE_MAX = 2000

/** 這個人現在在做什麼（一句，沒有主詞），例如「在吧台邊炫耀上次的戰利品」 */
export function npcActivity(state: GameState, p: PresentNpc, area: Area = currentArea(state)): string {
  const rec = p.rec
  const hour = state.time.hour ?? 0
  const slot = Math.floor(hour / Math.max(1, npcActivities.slot_hours))
  const cell = cellAt(area, p.x, p.y)?.kind ?? 'floor'
  const hostile = isHostile(state, rec, area.kind)
  const key = [rec.id, state.time.day, slot, area.key, cell, p.staff, hostile, rec.occupation, rec.personality, (rec.tags ?? []).join(',')].join('|')
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const ctx: Context = {
    places: placesOf(cell), area: area.kind, kind: npcKind(rec), staff: p.staff, tags: rec.tags ?? [],
    occupation: rec.occupation ?? '', personality: rec.personality ?? '', period: activityPeriod(hour), hostile,
  }
  // 敵對的人只用寫了 hostile 的規則（不會一邊盯著你、一邊悠閒地曬太陽）
  const options: Record<string, number> = {}
  npcActivities.rules.forEach((r, i) => {
    if (!r.list.length || (hostile && r.hostile !== true)) return
    const n = score(r, ctx)
    if (n >= 0) options[String(i)] = (r.weight ?? 1) * 2 ** n
  })
  let text = ''
  if (Object.keys(options).length) {
    const rng = new Rng(hashString(`${rec.id}@${state.time.day}#${slot}:doing`))
    const rule = npcActivities.rules[Number(weightedPick(rng, options))]!
    text = rng.pick(rule.list).replaceAll('{place}', cellName(cell) || area.name)
  }
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, text)
  return text
}

/** 會附上旁邊的人的日誌：主動行動、交流、事件、委託（戰鬥、旅行、休息、交易不附） */
export const BYSTANDER_KINDS: readonly Report['kind'][] = ['action', 'social', 'event', 'quest']
/** 最多附幾個人 */
export const BYSTANDER_MAX = 4

/**
 * 報告附上身邊（同一格或相鄰）不參與這次事件的人和他們正在做的事，讓敘事當背景帶過。
 * 已經有的不重算（重寫經過時照產生報告當下的樣子）。
 */
export function noteBystanders(state: GameState, report: Report) {
  if (!BYSTANDER_KINDS.includes(report.kind) || report.bystanders) return
  const skip = new Set([...report.party, ...(report.others ?? [])].map((a) => a.id))
  for (const id of state.captives?.npcs ?? []) skip.add(id)
  const area = currentArea(state)
  const list = nearbyPeople(state).filter((p) => !skip.has(p.rec.id)).slice(0, BYSTANDER_MAX)
    .map((p) => ({ id: p.rec.id, name: p.rec.name, role: npcTitle(p.rec), doing: npcActivity(state, p, area) }))
    .filter((b) => b.doing)
  if (list.length) report.bystanders = list
}
