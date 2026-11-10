// 懷孕的事件（docs/FAMILY.md 第 5 節）：travel_events.json 的 templates 裡 scope: pregnancy 的事件，分兩種：
// - 察覺事件（known 沒寫）：還沒察覺的人（主角、隊上的夥伴），受孕滿 min_days、未察覺或初期時，長休之後、旅途每天依機率出現；
//   選項的 reveal：always 選了就察覺、success 檢定成功才察覺；沒察覺的之後還會再擲，到中期一律自動察覺（pregnancy.ts）。
// - 孕期事件（known: true）：已經察覺的人，依階段（preg_stages）在長休之後、旅途每天、走動時依另一組機率出現（胎動、乾嘔……）。
// 共同：subject 是主角或隊上懷孕的夥伴（文字 {a}、效果 $a）；父親的文字 {f}、效果 $f；可以篩選父親（不明、在不在隊上、種族、混血）、
// 是不是非自願懷上的、只在聚落裡、劇情條件、時段、主角的體型、內容標籤。檢定由主角擲（DC 照寫的）。
// 選項的 birth_bonus：這次生產的 DC 減多少（產婆的叮囑）。內容篩選關掉「懷孕」時都不出現。

import familyJson from '@data/rules/family.json'
import { pcBodyAllowed, tagsAllowed } from './content'
import { pcEventReport, resolvePcOption } from './dungeonEvents'
import { isSettlement, locationById } from './data'
import { characterBody } from './look'
import { personOf, stageOf, syncPregnancyMarks } from './pregnancy'
import { applyPendingMove, travelEvents, type RoadTemplate } from './road'
import { commitReport, withRng } from './state'
import { condMet } from './storyFlags'
import { dayPartOk } from './timeOfDay'
import type { GameState, GameTime, PregnancyStage, PregnancyState, Report } from './types'

/** 舊名字（P2 的察覺事件模板）；現在就是事件模板 */
export type PregnancyTemplate = RoadTemplate

interface EventRules {
  rest_chance: number; travel_chance: number; min_days: number; cooldown_hours: number
  /** 孕期事件（已經察覺的人）的機率 */
  stage?: { rest_chance?: number; travel_chance?: number; step_chance?: number }
}

const rules = () => (familyJson as unknown as { event_rules: EventRules }).event_rules
export const pregnancyTemplates = (): RoadTemplate[] => travelEvents.templates.filter((t) => t.scope === 'pregnancy')

const TAG = '懷孕'
const UNAWARE: PregnancyStage[] = ['hidden', 'early']
const hoursOf = (t: GameTime) => t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60

export type PregnancyMoment = 'rest' | 'travel' | 'step'

/** 有別的事情等著處理的時候不跳 */
function busy(state: GameState): boolean {
  return !!(state.pregnancyEvent || state.pendingBirth || state.pendingBroodBirth || state.parasiteEvent || state.dungeonEvent || state.leadEvent || state.trapLure || state.townEvent || state.roadEvent
    || state.combat || state.standoff || state.pendingMasterEvent || state.pendingAction || state.pendingMark || state.pendingDefeat)
}

/** 隊伍裡懷孕的人（主角是 pc）：察覺事件要還沒察覺、受孕夠久、還在未察覺或初期；孕期事件要已經察覺 */
export function partyMothers(state: GameState, known: boolean): string[] {
  const out: string[] = []
  for (const m of state.party) {
    const key = m.isPlayer ? 'pc' : m.id
    const p = state.pregnancies?.[key]
    if (!p || !!p.known !== known) continue
    if (!known && (state.time.day - p.conceived < rules().min_days || !UNAWARE.includes(stageOf(p, state.time.day)))) continue
    out.push(key)
  }
  return out
}

/** 還沒察覺的人（察覺事件的對象） */
export function unawareMothers(state: GameState): string[] {
  return partyMothers(state, false)
}

function inSettlement(state: GameState): boolean {
  return !state.road && !state.expedition && isSettlement(locationById(state.location))
}

/** 父親在不在隊上（父親是主角也算） */
function fatherInParty(state: GameState, p: PregnancyState): boolean {
  const id = p.father?.id
  return !!id && (id === 'pc' || state.party.some((m) => m.id === id))
}

/** 這件事件的懷孕條件（父親、種族、混血、非自願、階段）成立嗎 */
function pregnancyMatches(state: GameState, t: RoadTemplate, mother: string, p: PregnancyState): boolean {
  if (t.preg_stages?.length && !t.preg_stages.includes(stageOf(p, state.time.day))) return false
  if (t.father === 'unknown' && p.father) return false
  if (t.father === 'known' && !p.father) return false
  if (t.father === 'in_party' && !fatherInParty(state, p)) return false
  if (t.father === 'not_in_party' && (!p.father || fatherInParty(state, p))) return false
  const motherRace = personOf(state, mother)?.race
  if (t.father_races?.length && !(p.father?.race && t.father_races.includes(p.father.race))) return false
  if (t.mixed !== undefined && (!p.father?.race || (p.father.race !== motherRace) !== t.mixed)) return false
  if (t.forced !== undefined && !!p.forced !== t.forced) return false
  return true
}

/** 這個人、這個時機能出現的事件（察覺事件或孕期事件，看這個人察覺了沒） */
export function pregnancyCandidates(state: GameState, mother: string, moment: PregnancyMoment, at: GameTime = state.time): RoadTemplate[] {
  const p = state.pregnancies?.[mother]
  if (!p) return []
  const subject = mother === 'pc' ? 'pc' : 'companion'
  const who = personOf(state, mother)
  const body = who?.character ? characterBody(who.character) : undefined
  return pregnancyTemplates().filter((t) =>
    (t.subject ?? 'pc') === subject
    && !!t.known === !!p.known
    && (!t.moments?.length || t.moments.includes(moment))
    && (!t.in_settlement || inSettlement(state))
    && tagsAllowed(t.tags)
    && (!body || pcBodyAllowed(t.pc_body, body))
    && condMet(state, t.requires)
    && (moment === 'travel' || dayPartOk(at, t.hours))
    && pregnancyMatches(state, t, mother, p))
}

function chanceFor(known: boolean, moment: PregnancyMoment): number {
  const r = rules()
  if (!known) return moment === 'rest' ? r.rest_chance : moment === 'travel' ? r.travel_chance : 0
  const s = r.stage ?? {}
  return (moment === 'rest' ? s.rest_chance : moment === 'travel' ? s.travel_chance : s.step_chance) ?? 0
}

/**
 * 依時機擲懷孕的事件（長休之後、旅途每天、走動）：冷卻過了，每位懷孕的人各擲一次（還沒察覺的先），
 * 中了就從候選裡挑一件（避開最近出現過的）。回傳有沒有開始事件
 */
export function maybePregnancyEvent(state: GameState, moment: PregnancyMoment, at: GameTime = state.time): boolean {
  if (!tagsAllowed(['pregnancy']) || busy(state)) return false
  const mothers = [...partyMothers(state, false).map((m) => ({ m, known: false })), ...partyMothers(state, true).map((m) => ({ m, known: true }))]
  if (!mothers.length) return false
  const r = rules()
  const now = hoursOf(state.time)
  const log = state.pregnancyEvents
  if (log?.last !== undefined && now - log.last < r.cooldown_hours) return false
  const recent = log?.recent ?? []
  for (const { m, known } of mothers) {
    const chance = chanceFor(known, moment)
    if (chance <= 0) continue
    const list = pregnancyCandidates(state, m, moment, at)
    if (!list.length) continue
    const fresh = list.filter((t) => !recent.includes(t.id))
    const pick = withRng(state, (rng) => (rng.chance(chance) ? rng.pick(fresh.length ? fresh : list) : undefined))
    if (!pick) continue
    state.pregnancyEvents = { last: now, recent: [pick.id, ...recent.filter((x) => x !== pick.id)].slice(0, 6) }
    state.pregnancyEvent = { template: pick.id, mother: m }
    return true
  }
  return false
}

/** 把夥伴（{a}、$a）與父親（{f}、$f）代進去 */
function cast<T>(value: T, a?: { name: string; id: string }, f?: { name: string; id?: string }): T {
  return JSON.parse(JSON.stringify(value), (_k, v: unknown) => {
    if (typeof v !== 'string') return v
    if (v === '$a' && a) return a.id
    if (v === '$f') return f?.id && f.id !== 'pc' ? f.id : ''
    let s = v
    if (a) s = s.replaceAll('{a}', a.name)
    if (f) s = s.replaceAll('{f}', f.id === 'pc' ? '你' : f.name)
    return s
  }) as T
}

/** 等待回應的懷孕事件（夥伴與父親的名字已經代進去） */
export function pendingPregnancyEvent(state: GameState): RoadTemplate | undefined {
  const ev = state.pregnancyEvent
  if (!ev) return undefined
  const t = pregnancyTemplates().find((x) => x.id === ev.template)
  if (!t) return undefined
  const p = state.pregnancies?.[ev.mother]
  const who = ev.mother === 'pc' ? undefined : personOf(state, ev.mother)
  if (ev.mother !== 'pc' && !who) return undefined
  const father = p?.father ? { name: p.father.name, ...(p.father.id ? { id: p.father.id } : {}) } : { name: '孩子的父親' }
  const out = cast(t, who ? { name: who.name, id: ev.mother } : undefined, father)
  // 父親不在、沒有 id（效果的 $f 代成空字串）：拿掉指向父親的效果
  for (const o of out.options ?? []) for (const r of [o.success, o.fail]) if (r?.effects) r.effects = r.effects.filter((e) => !('npc' in e) || e.npc)
  return out
}

/** 事件已經不成立（那個人不在隊上了、察覺狀態變了、生了、自訂內容拿掉了）：作廢 */
export function prunePregnancyEvent(state: GameState) {
  const ev = state.pregnancyEvent
  if (!ev) return
  const p = state.pregnancies?.[ev.mother]
  const t = pregnancyTemplates().find((x) => x.id === ev.template)
  const inParty = ev.mother === 'pc' || state.party.some((m) => m.id === ev.mother)
  if (!pendingPregnancyEvent(state) || !p || !t || !!p.known !== !!t.known || !inParty) delete state.pregnancyEvent
}

/** 回應懷孕的事件：檢定由主角擲；reveal 的選項（或檢定成功）讓這個人察覺懷孕，birth_bonus 讓這次生產容易一點 */
export function answerPregnancyEvent(state: GameState, index: number): Report {
  const ev = state.pregnancyEvent
  const t = pendingPregnancyEvent(state)
  const o = t?.options?.[index]
  if (!ev || !t || !o) throw new Error('沒有這個選項')
  const report = pcEventReport(state, t.title, TAG)
  const ok = resolvePcOption(state, report, t, o, TAG)
  const p = state.pregnancies?.[ev.mother]
  if (p && !p.known && (o.reveal === 'always' || (o.reveal === 'success' && ok))) {
    p.known = true
    p.knownDay = state.time.day
    const who = ev.mother === 'pc' ? '你' : personOf(state, ev.mother)?.name ?? ''
    report.outcome.summary = `${report.outcome.summary ?? ''}${who}懷孕了（預產第 ${p.due} 天）。`
    report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), `${who === '你' ? '主角' : who}察覺自己懷孕了：一般的描寫，不是親密場景`] }
  }
  if (p && o.birth_bonus && ok) p.birth_dc = (p.birth_dc ?? 0) + o.birth_bonus
  delete state.pregnancyEvent
  const committed = commitReport(state, report)
  syncPregnancyMarks(state)
  applyPendingMove(state)
  return committed
}
