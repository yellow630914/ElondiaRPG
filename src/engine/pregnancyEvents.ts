// 懷孕的察覺劇情（docs/FAMILY.md 第 5 節）：還沒察覺的人（主角、隊上的夥伴），受孕幾天之後，
// 長休之後、旅途每天依機率跳一件察覺事件（family.json 的 events，格式和旅途事件的模板一樣），在事件視窗回應。
// - 主角的事件由主角擲骰；夥伴的事件是主角看出夥伴的異樣，文字的 {a} 換成那位夥伴、效果的 $a 是那位夥伴。
// - 選項的 reveal：always 選了就察覺、success 檢定成功才察覺；沒察覺的之後還會再擲，到中期一律自動察覺（pregnancy.ts）。
// - 內容篩選關掉「懷孕」時不出現（事件帶 pregnancy 標籤），懷孕照樣到中期自動察覺。

import familyJson from '@data/rules/family.json'
import { tagsAllowed } from './content'
import { pcEventReport, resolvePcOption } from './dungeonEvents'
import { isSettlement, locationById } from './data'
import { personOf, stageOf, syncPregnancyMarks } from './pregnancy'
import { applyPendingMove, type RoadOption, type RoadTemplate } from './road'
import { commitReport, withRng } from './state'
import type { GameState, GameTime, PregnancyStage, Report } from './types'

export interface PregnancyOption extends RoadOption {
  /** 選了就察覺（always），或檢定成功才察覺（success） */
  reveal?: 'always' | 'success'
}

export interface PregnancyTemplate extends Omit<RoadTemplate, 'options' | 'moments'> {
  /** 誰的事：主角，或隊上的夥伴（{a}、$a） */
  subject: 'pc' | 'companion'
  moments?: ('rest' | 'travel')[]
  /** 只在聚落裡 */
  in_settlement?: boolean
  options?: PregnancyOption[]
}

interface EventRules { rest_chance: number; travel_chance: number; min_days: number; cooldown_hours: number }

const data = familyJson as unknown as { events: PregnancyTemplate[]; event_rules: EventRules }
export const pregnancyTemplates = (): PregnancyTemplate[] => data.events
const rules = () => data.event_rules

const TAG = '懷孕'
const EARLY: PregnancyStage[] = ['hidden', 'early']
const hoursOf = (t: GameTime) => t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60

export type PregnancyMoment = 'rest' | 'travel'

/** 有別的事情等著處理的時候不跳 */
function busy(state: GameState): boolean {
  return !!(state.pregnancyEvent || state.pendingBirth || state.parasiteEvent || state.dungeonEvent || state.leadEvent || state.trapLure || state.townEvent || state.roadEvent
    || state.combat || state.standoff || state.pendingMasterEvent || state.pendingAction || state.pendingMark || state.pendingDefeat)
}

/** 隊伍裡還沒察覺、受孕夠久、還在未察覺或初期的人（主角是 pc） */
export function unawareMothers(state: GameState): string[] {
  const out: string[] = []
  for (const m of state.party) {
    const key = m.isPlayer ? 'pc' : m.id
    const p = state.pregnancies?.[key]
    if (!p || p.known) continue
    if (state.time.day - p.conceived < rules().min_days) continue
    if (!EARLY.includes(stageOf(p, state.time.day))) continue
    out.push(key)
  }
  return out
}

function inSettlement(state: GameState): boolean {
  return !state.road && !state.expedition && isSettlement(locationById(state.location))
}

/** 這個人、這個時機能出現的察覺事件 */
export function pregnancyCandidates(state: GameState, mother: string, moment: PregnancyMoment): PregnancyTemplate[] {
  const subject = mother === 'pc' ? 'pc' : 'companion'
  return pregnancyTemplates().filter((t) =>
    t.subject === subject
    && (!t.moments?.length || t.moments.includes(moment))
    && (!t.in_settlement || inSettlement(state))
    && tagsAllowed(t.tags))
}

/**
 * 依時機擲察覺事件（長休之後、旅途每天）：冷卻過了，每位還沒察覺的人各擲一次，中了就從候選裡挑一件（避開最近出現過的）。
 * 回傳有沒有開始事件
 */
export function maybePregnancyEvent(state: GameState, moment: PregnancyMoment): boolean {
  if (!tagsAllowed(['pregnancy']) || busy(state)) return false
  const mothers = unawareMothers(state)
  if (!mothers.length) return false
  const r = rules()
  const now = hoursOf(state.time)
  const log = state.pregnancyEvents
  if (log?.last !== undefined && now - log.last < r.cooldown_hours) return false
  const chance = moment === 'rest' ? r.rest_chance : r.travel_chance
  const recent = log?.recent ?? []
  for (const mother of mothers) {
    const list = pregnancyCandidates(state, mother, moment)
    if (!list.length) continue
    const fresh = list.filter((t) => !recent.includes(t.id))
    const pick = withRng(state, (rng) => (rng.chance(chance) ? rng.pick(fresh.length ? fresh : list) : undefined))
    if (!pick) continue
    state.pregnancyEvents = { last: now, recent: [pick.id, ...recent.filter((x) => x !== pick.id)].slice(0, 4) }
    state.pregnancyEvent = { template: pick.id, mother }
    return true
  }
  return false
}

/** 把夥伴的名字、id 代進去（文字的 {a}、效果的 $a） */
function cast<T>(value: T, name: string, id: string): T {
  return JSON.parse(JSON.stringify(value), (_k, v: unknown) => (typeof v === 'string' ? (v === '$a' ? id : v.replaceAll('{a}', name)) : v)) as T
}

/** 等待回應的察覺事件（夥伴的名字已經代進去） */
export function pendingPregnancyEvent(state: GameState): PregnancyTemplate | undefined {
  const ev = state.pregnancyEvent
  if (!ev) return undefined
  const t = pregnancyTemplates().find((x) => x.id === ev.template)
  if (!t) return undefined
  if (ev.mother === 'pc') return t
  const who = personOf(state, ev.mother)
  return who ? cast(t, who.name, ev.mother) : undefined
}

/** 事件已經不成立（那個人不在隊上了、已經察覺、生了、自訂內容拿掉了）：作廢 */
export function prunePregnancyEvent(state: GameState) {
  const ev = state.pregnancyEvent
  if (!ev) return
  const p = state.pregnancies?.[ev.mother]
  const inParty = ev.mother === 'pc' || state.party.some((m) => m.id === ev.mother)
  if (!pendingPregnancyEvent(state) || !p || p.known || !inParty) delete state.pregnancyEvent
}

/** 回應察覺事件：檢定由主角擲；reveal 的選項（或檢定成功）讓這個人察覺懷孕 */
export function answerPregnancyEvent(state: GameState, index: number): Report {
  const ev = state.pregnancyEvent
  const t = pendingPregnancyEvent(state)
  const o = t?.options?.[index]
  if (!ev || !t || !o) throw new Error('沒有這個選項')
  const report = pcEventReport(state, t.title, TAG)
  const ok = resolvePcOption(state, report, t as unknown as RoadTemplate, o, TAG)
  const p = state.pregnancies?.[ev.mother]
  if (p && !p.known && (o.reveal === 'always' || (o.reveal === 'success' && ok))) {
    p.known = true
    p.knownDay = state.time.day
    const who = ev.mother === 'pc' ? '你' : personOf(state, ev.mother)?.name ?? ''
    report.outcome.summary = `${report.outcome.summary ?? ''}${who}懷孕了（預產第 ${p.due} 天）。`
    report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), `${who === '你' ? '主角' : who}察覺自己懷孕了：一般的描寫，不是親密場景`] }
  }
  delete state.pregnancyEvent
  const committed = commitReport(state, report)
  syncPregnancyMarks(state)
  applyPendingMove(state)
  return committed
}
