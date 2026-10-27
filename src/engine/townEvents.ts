// 城鎮事件（事件導演，docs/TRAVEL_EVENTS.md 第 6 節）：走上聚落裡的設施時，依機率遇到一件事。
// - 模板和旅途事件共用（travel_events.json 的 templates，scope: town），依設施、聚落規模、地點、劇情旗標篩選。
// - 冷卻：兩次城鎮事件之間至少隔 town.cooldown_hours；同一個事件隔 cooldown_days（或 town.repeat_days）天才會再出現。
// - 類型平衡：最近發生過的種類（category）權重乘上 recent_penalty，同一種不會一直出現。
// - check 的事件走到時直接擲骰揭曉；choice 的事件等玩家選（state.townEvent）。

import { snapshot } from './character'
import { locationById, regionById, shopRules } from './data'
import { currentArea, position, type Area } from './grid'
import { pcOf } from './party'
import { applyPendingMove, applyRoadOutcome, roll, travelEvents, type RoadTemplate } from './road'
import { commitReport, newReportId, withRng } from './state'
import { condMet } from './storyFlags'
import type { GameState, GameTime, Report } from './types'

/** 可以遇到事件的設施（自建商店另外算） */
export const TOWN_EVENT_CELLS = ['inn', 'guild', 'tavern', 'shop', 'temple', 'gate', 'brothel', 'smithy', 'tailor', 'jeweler', 'magic', 'informant', 'tattoo', 'carver']

const hoursOf = (t: GameTime) => t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60

export function townTemplates(): RoadTemplate[] {
  return travelEvents.templates.filter((t) => t.scope === 'town')
}

function isFacility(kind: string): boolean {
  return TOWN_EVENT_CELLS.includes(kind) || !!shopRules.types[kind as never]?.custom
}

/** 這一格、這個時候能出現的城鎮事件 */
export function townCandidates(state: GameState, area: Area, cellKind: string): RoadTemplate[] {
  const loc = locationById(area.location)
  const day = state.time.day
  const seen = state.townEvents?.seen ?? {}
  const repeat = travelEvents.town?.repeat_days ?? 7
  return townTemplates().filter((t) =>
    (!t.cells?.length || t.cells.includes(cellKind))
    && (!t.location_types?.length || t.location_types.includes(loc.type))
    && (!t.locations?.length || t.locations.includes(loc.id))
    && condMet(state, t.requires)
    && (seen[t.id] === undefined || day - seen[t.id]! >= (t.cooldown_days ?? repeat)))
}

/** 種類的權重：最近發生過幾次就乘幾次 recent_penalty */
export function townWeight(state: GameState, t: RoadTemplate): number {
  const rules = travelEvents.town
  const recent = state.townEvents?.recent ?? []
  const times = t.category ? recent.filter((c) => c === t.category).length : 0
  return Math.pow(rules?.recent_penalty ?? 0.4, times)
}

/**
 * 走上設施之後（store 的 afterMove）：在聚落裡、冷卻過了、機率中了，就遇到一件事。
 * 回傳揭曉的報告（check），或 undefined（沒有事件、或等玩家選）。
 */
export function maybeTownEvent(state: GameState): { report?: Report } {
  const rules = travelEvents.town
  if (!rules || state.townEvent || state.parasiteEvent || state.combat || state.standoff || state.pendingMasterEvent || state.pendingAction || state.road) return {}
  const area = currentArea(state)
  if (area.kind !== 'settlement') return {}
  const p = position(state)
  const cell = area.cells[p.y * area.width + p.x]
  if (!cell || !isFacility(cell.kind)) return {}
  const now = hoursOf(state.time)
  const last = state.townEvents?.last
  if (last !== undefined && now - last < rules.cooldown_hours) return {}
  const list = townCandidates(state, area, cell.kind)
  if (!list.length) return {}
  const pick = withRng(state, (rng) => {
    if (!rng.chance(rules.chance)) return undefined
    const weights = list.map((t) => townWeight(state, t))
    let r = rng.next() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < list.length; i++) if ((r -= weights[i]!) < 0) return { t: list[i]!, natural: rng.int(1, 20) }
    return { t: list.at(-1)!, natural: rng.int(1, 20) }
  })
  if (!pick) return {}
  remember(state, pick.t)
  if (pick.t.kind === 'check' && pick.t.check) return { report: revealCheck(state, pick.t, pick.natural) }
  state.townEvent = { template: pick.t.id }
  return {}
}

function remember(state: GameState, t: RoadTemplate) {
  const log = (state.townEvents ??= { seen: {}, recent: [] })
  log.last = hoursOf(state.time)
  log.seen[t.id] = state.time.day
  if (t.category) {
    log.recent.push(t.category)
    const size = travelEvents.town?.recent_size ?? 4
    if (log.recent.length > size) log.recent.splice(0, log.recent.length - size)
  }
}

function townReport(state: GameState, title: string): Report {
  const area = currentArea(state)
  const loc = locationById(area.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } },
    location: { at: loc.id, region: loc.region, scene: `${area.name}・${title}` },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'neutral', tags: ['城鎮事件'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short', tone: '日常' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

/** check 的事件：擲骰揭曉 */
function revealCheck(state: GameState, t: RoadTemplate, natural: number): Report {
  const r = roll(state, t.check!, natural, 'town')
  const report = townReport(state, t.title)
  report.timeline = [{ seq: 1, ...r.entry, action: t.title }]
  const lines = [t.text, ...applyRoadOutcome(state, report, r.ok ? t.success : t.fail)]
  report.outcome = { result: r.ok ? 'success' : 'failure', summary: lines.join(''), tags: ['城鎮事件'] }
  report.narration = { ...report.narration, focus: [t.text] }
  const committed = commitReport(state, report)
  applyPendingMove(state)
  return committed
}

/** 等待回應的城鎮事件 */
export function pendingTownEvent(state: GameState): RoadTemplate | undefined {
  const id = state.townEvent?.template
  return id ? travelEvents.templates.find((t) => t.id === id && t.scope === 'town') : undefined
}

/** 選一個選項（有檢定的依規則擲骰） */
export function answerTownEvent(state: GameState, index: number): Report {
  const t = pendingTownEvent(state)
  const o = t?.options?.[index]
  if (!t || !o) throw new Error('沒有這個選項')
  const report = townReport(state, t.title)
  let ok = true
  if (o.check) {
    const r = roll(state, o.check, withRng(state, (rng) => rng.int(1, 20)), 'town')
    ok = r.ok
    report.timeline = [{ seq: 1, ...r.entry, action: `${t.title}：${o.label}` }]
  }
  const lines = [`${t.title}：${o.label}。`, ...applyRoadOutcome(state, report, ok ? o.success : o.fail)]
  report.outcome = { result: o.check ? (ok ? 'success' : 'failure') : 'neutral', summary: lines.join(''), tags: ['城鎮事件'] }
  report.narration = { ...report.narration, focus: [t.text, `主角的選擇：${o.label}`] }
  delete state.townEvent
  const committed = commitReport(state, report)
  applyPendingMove(state)
  return committed
}

/** 自訂內容拿掉的事件：等待中的城鎮事件作廢（讀檔時，以及自訂內容改變之後） */
export function pruneTownEvent(state: GameState) {
  if (state.townEvent && !pendingTownEvent(state)) delete state.townEvent
}
