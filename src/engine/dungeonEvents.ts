// 地下城與近郊的事件（docs/ADULT_EVENTS.md）：觸發陷阱、打開寶箱、採集、在安全房長休之後，依機率遇到一件事。
// - 模板和旅途、城鎮事件共用（travel_events.json 的 templates，scope: dungeon），依觸發點、地點、地區、層數、內容標籤、主角體型篩選。
// - 機率與冷卻在 travel_events.json 的 dungeon；同一個事件隔 repeat_days 天（或 cooldown_days）才會再出現。
// - 內建模板有成人向的（色情陷阱、擬態寶箱、花粉、觸手植物、夜襲……，內容篩選關掉「主角非自願」時非自願的不會發生）與普通的（dn_ 開頭，每個主角都會遇到）。
// - 事件發生在主角身上：選項的檢定由主角自己擲（不是隊伍裡最擅長的人）。

import { gameRule } from './gameRules'
import { attrOf, mod, proficiency, snapshot } from './character'
import { pcBodyAllowed, tagsAllowed } from './content'
import { locationById, regionById } from './data'
import { currentArea, type Area } from './grid'
import { characterBody } from './look'
import { pcOf } from './party'
import { parasiteOf, parasiteRules, stageOf } from './parasites'
import { checkModifiers, modifierNote } from './perks'
import { applyPendingMove, applyRoadOutcome, sceneOn, travelEvents, type DungeonTrigger, type RoadOption, type RoadTemplate } from './road'
import { commitReport, newReportId, withRng } from './state'
import { condMet } from './storyFlags'
import type { GameState, GameTime, Report } from './types'
import { roll as diceRoll, withBonus } from './rng'

const hoursOf = (t: GameTime) => t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60

/** 事件選項寫的 DC 以這個為「普通」：14 以下比較容易、以上比較難（相對於這裡的難度） */
export const EVENT_DC_REF = 14
export const DEFAULT_LAYER_DC = [11, 13, 14, 16, 18]

/** 這件事普通難度的 DC：地下城事件、線索事件依層，寄生物的發作依主角等級與階段；其他事件就是 14 */
export function eventBaseDc(state: GameState, t: Pick<RoadTemplate, 'scope' | 'parasite'>): number {
  if (t.scope === 'dungeon' || t.scope === 'lead') {
    const area = currentArea(state)
    const layer = layerOf(area) ?? 0
    const table = travelEvents.dungeon?.dc ?? DEFAULT_LAYER_DC
    return table[Math.min(layer, table.length - 1)] ?? EVENT_DC_REF
  }
  if (t.scope === 'parasite') {
    const r = parasiteRules.dc ?? { base: 12, per_level: 0.4, stages: [0, 0, 1, 2] }
    const pc = pcOf(state)
    const p = t.parasite ? parasiteOf(pc, t.parasite) : undefined
    return r.base + Math.round(pc.level * r.per_level) + (r.stages[p ? stageOf(p.corruption) : 0] ?? 0)
  }
  return EVENT_DC_REF
}

/** 選項實際的 DC：這件事的普通難度 +（寫的 DC − 14）+ 存檔規則「事件檢定的難度」（只算發生在主角身上的事件） */
export function eventDc(state: GameState, t: Pick<RoadTemplate, 'scope' | 'parasite'>, dc: number): number {
  if (t.scope !== 'dungeon' && t.scope !== 'parasite' && t.scope !== 'lead') return dc
  return Math.max(5, Math.min(30, eventBaseDc(state, t) + (dc - EVENT_DC_REF) + gameRule(state, 'eventDc')))
}

export function dungeonTemplates(): RoadTemplate[] {
  return travelEvents.templates.filter((t) => t.scope === 'dungeon')
}

/** 這一層：城外的近郊與地下城的周邊 0，地下城 1 淺層 … 4 底層 */
function layerOf(area: Area): number | undefined {
  if (area.kind === 'wild') return 0
  if (area.kind === 'dungeon') return area.layer ?? 0
  return undefined
}

/** 這個觸發點、這個地方能出現的事件 */
export function dungeonCandidates(state: GameState, area: Area, trigger: DungeonTrigger): RoadTemplate[] {
  const layer = layerOf(area)
  if (layer === undefined) return []
  const loc = locationById(area.location)
  const body = characterBody(pcOf(state))
  const seen = state.dungeonEvents?.seen ?? {}
  const repeat = travelEvents.dungeon?.repeat_days ?? 3
  const day = state.time.day
  return dungeonTemplates().filter((t) =>
    (!t.triggers?.length || t.triggers.includes(trigger))
    && (!t.dungeons?.length || t.dungeons.includes(loc.id))
    && (!t.regions?.length || t.regions.includes(loc.region))
    && (!t.layers?.length || t.layers.includes(layer))
    && tagsAllowed(t.tags)
    && pcBodyAllowed(t.pc_body, body)
    && condMet(state, t.requires)
    && (seen[t.id] === undefined || day - seen[t.id]! >= (t.cooldown_days ?? repeat)))
}

/** 採集、長休時可以抽的事件少於這麼多件，觸發的機率照比例調低（一般地下城採集時只有兩三件可抽，不要一直遇到同一件）；陷阱與寶箱不調（事件取代陷阱的傷害、寶箱的擬態） */
export const FULL_POOL = 4
/** 最近出現過的事件權重比較低：沒出現過 1，出現過的照隔了幾天（到 FRESH_DAYS 天恢復成 1，最低 MIN_WEIGHT） */
export const FRESH_DAYS = 14
const MIN_WEIGHT = 0.2

/** 這件事被抽到的權重：越久沒出現越高 */
export function dungeonEventWeight(state: GameState, id: string): number {
  const seen = state.dungeonEvents?.seen?.[id]
  if (seen === undefined) return 1
  return Math.max(MIN_WEIGHT, Math.min(1, (state.time.day - seen) / FRESH_DAYS))
}

/**
 * 觸發點發生之後（陷阱沒察覺、打開寶箱、採集、安全房長休）：冷卻過了、機率中了，就遇到一件事，等主角回應。
 * 回傳有沒有開始事件（寶箱：成人向的事件取代寶箱，普通的事件在寶箱打開之後發生，見 grid.ts）。
 */
export function maybeDungeonEvent(state: GameState, trigger: DungeonTrigger): boolean {
  const rules = travelEvents.dungeon
  if (!rules || busy(state)) return false
  const area = currentArea(state)
  const last = state.dungeonEvents?.last
  if (last !== undefined && hoursOf(state.time) - last < rules.cooldown_hours) return false
  const list = dungeonCandidates(state, area, trigger)
  if (!list.length) return false
  const fresh = list.map((t) => dungeonEventWeight(state, t.id))
  const weights = list.map((t, i) => fresh[i]! * adultBoost(state, t))
  // 採集、長休可以抽的事件少時機率照比例調低；成人向的比重（存檔規則）拉高的那一份也算進機率
  const pool = trigger === 'gather' || trigger === 'rest' ? Math.min(1, list.length / FULL_POOL) : 1
  const boost = sum(weights) / sum(fresh)
  const chance = Math.min(1, (rules.chance[trigger] ?? 0) * gameRule(state, 'dungeonEventMult') * pool * boost)
  const pick = withRng(state, (rng) => (rng.chance(chance) ? weightedPick(rng.next(), list, weights) : undefined))
  if (!pick) return false
  startDungeonEvent(state, pick, trigger)
  return true
}

/** 有別的事情等著回應時不發生 */
function busy(state: GameState): boolean {
  return !!(state.dungeonEvent || state.parasiteEvent || state.leadEvent || state.combat || state.standoff || state.pendingMasterEvent || state.pendingAction || state.townEvent || state.trapLure)
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** 成人向的事件照存檔規則「成人地下城事件的比重」加權 */
function adultBoost(state: GameState, t: RoadTemplate): number {
  return t.tags?.includes('adult') ? gameRule(state, 'adultDungeonMult') : 1
}

/** 照權重抽一件（r 是 0～1 的亂數） */
function weightedPick<T>(r: number, list: T[], weights: number[]): T {
  let left = r * sum(weights)
  for (let i = 0; i < list.length; i++) if ((left -= weights[i]!) < 0) return list[i]!
  return list[list.length - 1]!
}

function startDungeonEvent(state: GameState, t: RoadTemplate, trigger: DungeonTrigger) {
  const log = (state.dungeonEvents ??= { seen: {} })
  log.last = hoursOf(state.time)
  log.seen[t.id] = state.time.day
  state.dungeonEvent = { template: t.id, trigger }
}

// ---- 主動觸發察覺到的陷阱（存檔規則 trapLure） ----

/** 察覺了陷阱：存檔規則開著、這裡有陷阱的事件可以遇到時，問主角要不要主動觸發 */
export function offerTrapLure(state: GameState): boolean {
  if (!state.options?.trapLure || busy(state)) return false
  const area = currentArea(state)
  if (!dungeonCandidates(state, area, 'trap').length) return false
  state.trapLure = { area: area.key }
  return true
}

/** 主動觸發：照權重抽一件陷阱的事件（不看機率與事件之間的冷卻；同一件事的不重複天數照舊） */
export function acceptTrapLure(state: GameState): boolean {
  if (!state.trapLure) throw new Error('沒有察覺到的陷阱')
  delete state.trapLure
  const list = dungeonCandidates(state, currentArea(state), 'trap')
  if (!list.length || busy(state)) return false
  const weights = list.map((t) => dungeonEventWeight(state, t.id) * adultBoost(state, t))
  startDungeonEvent(state, withRng(state, (rng) => weightedPick(rng.next(), list, weights)), 'trap')
  return true
}

/** 繞過察覺到的陷阱 */
export function declineTrapLure(state: GameState) {
  delete state.trapLure
}

/** 等待回應的地下城事件 */
export function pendingDungeonEvent(state: GameState): RoadTemplate | undefined {
  const id = state.dungeonEvent?.template
  return id ? dungeonTemplates().find((t) => t.id === id) : undefined
}

/** 自訂內容拿掉的事件：等待中的地下城事件作廢（讀檔時，以及自訂內容改變之後） */
export function pruneDungeonEvent(state: GameState) {
  if (state.dungeonEvent && !pendingDungeonEvent(state)) delete state.dungeonEvent
  // 察覺到的陷阱：已經不在那一區、或規則關掉了就不問了
  if (state.trapLure && (!state.options?.trapLure || state.position?.area !== state.trapLure.area)) delete state.trapLure
}

/** 發生在主角身上的事件的報告（地下城事件、寄生物發作） */
export function pcEventReport(state: GameState, title: string, tag: string): Report {
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
    outcome: { result: 'neutral', tags: [tag] },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

// 這個選項會不會進入親密場景（城鎮事件也用；定義在 road.ts，旅途事件也用）
export { sceneOn } from './road'

/** 主角回應一個選項：有檢定的由主角擲骰（非戰鬥狀態與特質也算），套用結果、寫進報告；回傳檢定有沒有成功 */
export function resolvePcOption(state: GameState, report: Report, t: RoadTemplate, o: RoadOption, tag: string, scene = t.scene): boolean {
  const pc = pcOf(state)
  let ok = true
  if (o.check) {
    const extra = checkModifiers(pc, { context: 'action', attr: o.check.attr })
    const dice = withBonus('1d20', mod(attrOf(pc, o.check.attr)) + proficiency(pc.level) + extra.reduce((s, x) => s + x.value, 0))
    const r = withRng(state, (rng) => diceRoll(rng, dice))
    const natural = r.rolls[0] ?? r.total
    const dc = eventDc(state, t, o.check.dc)
    ok = natural === 20 || (natural !== 1 && r.total >= dc)
    report.timeline = [{ seq: 1, time: { ...state.time }, actor: 'pc', action: `${t.title}：${o.label}${modifierNote(extra)}`, roll: { dice, value: r.total, dc }, result: ok ? 'success' : 'fail' }]
  }
  const lines = [`${t.text}你選擇${o.label}。`, ...applyRoadOutcome(state, report, ok ? o.success : o.fail)]
  report.outcome = { result: o.check ? (ok ? 'success' : 'failure') : 'neutral', summary: lines.join(''), tags: [tag] }
  report.narration = { ...report.narration, focus: [t.text, `主角的回應：${o.label}`] }
  if (scene && sceneOn(o, ok)) report.narration = { ...report.narration, length: 'medium', adult_scene: scene }
  if (t.pc_body?.length) report.narration = { ...report.narration, body_limited: true }
  return ok
}

/** 選一個回應 */
export function answerDungeonEvent(state: GameState, index: number): Report {
  const t = pendingDungeonEvent(state)
  const o = t?.options?.[index]
  if (!t || !o) throw new Error('沒有這個選項')
  const report = pcEventReport(state, t.title, '地下城事件')
  resolvePcOption(state, report, t, o, '地下城事件')
  delete state.dungeonEvent
  const committed = commitReport(state, report)
  applyPendingMove(state)
  return committed
}
