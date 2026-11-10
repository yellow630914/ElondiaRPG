// 懷孕的事件（docs/FAMILY.md 第 5 節）：travel_events.json 的 templates 裡 scope: pregnancy 的事件，分兩種：
// - 察覺事件（known 沒寫）：還沒察覺的人（主角、隊上的夥伴），受孕滿 min_days、未察覺或初期時，長休之後、旅途每天依機率出現；
//   選項的 reveal：always 選了就察覺、success 檢定成功才察覺；沒察覺的之後還會再擲，到中期一律自動察覺（pregnancy.ts）。
// - 孕期事件（known: true）：已經察覺的人，依階段（preg_stages）在長休之後、旅途每天、走動時依另一組機率出現（胎動、乾嘔……）。
// 共同：subject 是主角或隊上懷孕的夥伴（文字 {a}、效果 $a）；父親的文字 {f}、效果 $f；可以篩選父親（不明、在不在隊上、種族、混血）、
// 是不是非自願懷上的、只在聚落裡、劇情條件、時段、主角的體型、內容標籤。檢定由主角擲（DC 照寫的）。
// 選項的 birth_bonus：這次生產的 DC 減多少（產婆的叮囑）。內容篩選關掉「懷孕」時都不出現。
//
// 同一套也跑另外兩種（docs/FAMILY.md 第 10.4、13.3 節），共用冷卻與「最近出現過」：
// - 泌乳的事件（scope: lactation）：泌乳中的主角（就是條件「泌乳」）或隊上泌乳的夥伴（{a}、$a）；篩選「泌乳」要開。
// - 苗床的事件（scope: brood）：主角身上的苗床，依種類（brood_kinds）與階段（stages）；文字 {m} 是留下苗床的怪物，
//   交給 AI 時附上那隻怪物的樣子。篩選「怪物的苗床」要開。

import familyJson from '@data/rules/family.json'
import { pcBodyAllowed, tagsAllowed } from './content'
import { pcEventReport, resolvePcOption } from './dungeonEvents'
import { characterBody } from './look'
import { personOf, stageOf, syncPregnancyMarks } from './pregnancy'
import { broodOf, broodsOf, broodMonster, BROOD_KIND_NAME } from './brood'
import { isLactating } from './lactation'
import { inSettlementArea } from './grid'
import { parasiteDef, parasiteOf, stageName as parasiteStageName, stageOf as parasiteStage } from './parasites'
import { pcOf } from './party'
import { applyPendingMove, travelEvents, type RoadTemplate } from './road'
import { commitReport, withRng } from './state'
import { condMet } from './storyFlags'
import { dayPartOk } from './timeOfDay'
import type { GameState, GameTime, PregnancyStage, PregnancyState, Report } from './types'

/** 舊名字（P2 的察覺事件模板）；現在就是事件模板 */
export type PregnancyTemplate = RoadTemplate

type Chances = { rest_chance?: number; travel_chance?: number; step_chance?: number }
interface EventRules {
  rest_chance: number; travel_chance: number; min_days: number; cooldown_hours: number
  /** 夥伴的事件有和主角的親密場景時，夥伴對主角的親密度至少要多少 */
  intimate_affinity?: number
  /** 孕期事件（已經察覺的人）的機率 */
  stage?: Chances
  /** 泌乳的事件、苗床的事件的機率 */
  lactation?: Chances
  brood?: Chances
}

const rules = () => (familyJson as unknown as { event_rules: EventRules }).event_rules
export const pregnancyTemplates = (): RoadTemplate[] => travelEvents.templates.filter((t) => t.scope === 'pregnancy')
/** 這一套跑的三種：懷孕、泌乳、苗床 */
const FAMILY_SCOPES = ['pregnancy', 'lactation', 'brood']
export const familyTemplates = (): RoadTemplate[] => travelEvents.templates.filter((t) => FAMILY_SCOPES.includes(t.scope ?? ''))
export const lactationTemplates = (): RoadTemplate[] => travelEvents.templates.filter((t) => t.scope === 'lactation')
export const broodTemplates = (): RoadTemplate[] => travelEvents.templates.filter((t) => t.scope === 'brood')

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
  return inSettlementArea(state)
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
    && commonOk(state, t, moment, at, body)
    && intimateOk(state, t, mother)
    && pregnancyMatches(state, t, mother, p))
}

/** 夥伴的事件有和主角的親密場景（選項的 adult_scene）時：夥伴對主角的親密度要夠（雇來的陌生人不會主動求歡） */
function intimateOk(state: GameState, t: RoadTemplate, who: string): boolean {
  if (who === 'pc' || !t.options?.some((o) => o.adult_scene)) return true
  return (state.relationships?.[who]?.affinity ?? 0) >= (rules().intimate_affinity ?? 0)
}

/** 共同的條件：時機、聚落、內容標籤、體型、劇情條件、時段 */
function commonOk(state: GameState, t: RoadTemplate, moment: PregnancyMoment, at: GameTime, body: ReturnType<typeof characterBody> | undefined): boolean {
  return (!t.moments?.length || t.moments.includes(moment))
    && (!t.in_settlement || inSettlement(state))
    && tagsAllowed(t.tags)
    && (!body || pcBodyAllowed(t.pc_body, body))
    && condMet(state, t.requires)
    && (moment === 'travel' || dayPartOk(at, t.hours))
}

/** 隊伍裡泌乳的人（主角是 pc） */
export function lactatingMembers(state: GameState): string[] {
  if (!tagsAllowed(['lactation'])) return []
  return state.party.filter((m) => isLactating(state, m)).map((m) => (m.isPlayer ? 'pc' : m.id))
}

/** 泌乳的事件：這個人（泌乳中）、這個時機能出現的 */
export function lactationCandidates(state: GameState, who: string, moment: PregnancyMoment, at: GameTime = state.time): RoadTemplate[] {
  const p = personOf(state, who)
  if (!p?.character || !isLactating(state, p.character)) return []
  const subject = who === 'pc' ? 'pc' : 'companion'
  const body = characterBody(p.character)
  return lactationTemplates().filter((t) => (t.subject ?? 'pc') === subject && commonOk(state, t, moment, at, body) && intimateOk(state, t, who))
}

/** 苗床的事件：主角身上的這個苗床（種類、階段）、這個時機能出現的 */
export function broodCandidates(state: GameState, parasite: string, moment: PregnancyMoment, at: GameTime = state.time): RoadTemplate[] {
  const pc = pcOf(state)
  const p = parasiteOf(pc, parasite)
  const b = broodOf(parasite)
  if (!p || !b || !tagsAllowed(['monster_brood'])) return []
  const stage = parasiteStage(p.corruption)
  const body = characterBody(pc)
  return broodTemplates().filter((t) => (!t.brood_kinds?.length || t.brood_kinds.includes(b.kind))
    && (!t.stages?.length || t.stages.includes(stage)) && commonOk(state, t, moment, at, body))
}

function pick(c: Chances | undefined, moment: PregnancyMoment): number {
  return (moment === 'rest' ? c?.rest_chance : moment === 'travel' ? c?.travel_chance : c?.step_chance) ?? 0
}

function chanceFor(known: boolean, moment: PregnancyMoment): number {
  const r = rules()
  if (!known) return moment === 'rest' ? r.rest_chance : moment === 'travel' ? r.travel_chance : 0
  return pick(r.stage, moment)
}

/**
 * 依時機擲懷孕的事件（長休之後、旅途每天、走動）：冷卻過了，每位懷孕的人各擲一次（還沒察覺的先），
 * 中了就從候選裡挑一件（避開最近出現過的）。回傳有沒有開始事件
 */
export function maybePregnancyEvent(state: GameState, moment: PregnancyMoment, at: GameTime = state.time): boolean {
  if (busy(state)) return false
  // 擲的順序：還沒察覺的懷孕、已經察覺的懷孕、泌乳的人、主角的苗床
  const r = rules()
  const rolls: { who: string; chance: number; list: () => RoadTemplate[]; parasite?: string }[] = []
  if (tagsAllowed(['pregnancy'])) {
    for (const known of [false, true]) {
      for (const m of partyMothers(state, known)) rolls.push({ who: m, chance: chanceFor(known, moment), list: () => pregnancyCandidates(state, m, moment, at) })
    }
  }
  for (const m of lactatingMembers(state)) rolls.push({ who: m, chance: pick(r.lactation, moment), list: () => lactationCandidates(state, m, moment, at) })
  if (tagsAllowed(['monster_brood'])) {
    for (const b of broodsOf(pcOf(state))) rolls.push({ who: 'pc', parasite: b.id, chance: pick(r.brood, moment), list: () => broodCandidates(state, b.id, moment, at) })
  }
  if (!rolls.length) return false
  const now = hoursOf(state.time)
  const log = state.pregnancyEvents
  if (log?.last !== undefined && now - log.last < r.cooldown_hours) return false
  const recent = log?.recent ?? []
  for (const { who, chance, list: candidates, parasite } of rolls) {
    if (chance <= 0) continue
    const list = candidates()
    if (!list.length) continue
    const fresh = list.filter((t) => !recent.includes(t.id))
    const picked = withRng(state, (rng) => (rng.chance(chance) ? rng.pick(fresh.length ? fresh : list) : undefined))
    if (!picked) continue
    state.pregnancyEvents = { last: now, recent: [picked.id, ...recent.filter((x) => x !== picked.id)].slice(0, 6) }
    state.pregnancyEvent = { template: picked.id, mother: who, ...(parasite ? { parasite } : {}) }
    return true
  }
  return false
}

/** 把夥伴（{a}、$a）、父親（{f}、$f）與留下苗床的怪物（{m}）代進去 */
function cast<T>(value: T, a?: { name: string; id: string }, f?: { name: string; id?: string }, m?: string): T {
  return JSON.parse(JSON.stringify(value), (_k, v: unknown) => {
    if (typeof v !== 'string') return v
    if (v === '$a' && a) return a.id
    if (v === '$f') return f?.id && f.id !== 'pc' ? f.id : ''
    let s = v
    if (a) s = s.replaceAll('{a}', a.name)
    if (f) s = s.replaceAll('{f}', f.id === 'pc' ? '你' : f.name)
    if (m) s = s.replaceAll('{m}', m)
    return s
  }) as T
}

/** 等待回應的懷孕事件（夥伴與父親的名字已經代進去） */
export function pendingPregnancyEvent(state: GameState): RoadTemplate | undefined {
  const ev = state.pregnancyEvent
  if (!ev) return undefined
  const t = familyTemplates().find((x) => x.id === ev.template)
  if (!t) return undefined
  if (t.scope === 'brood') return ev.parasite && parasiteOf(pcOf(state), ev.parasite) ? cast(t, undefined, undefined, broodMonster(state, ev.parasite).name) : undefined
  if (t.scope === 'lactation') {
    const who = ev.mother === 'pc' ? undefined : personOf(state, ev.mother)
    if (ev.mother !== 'pc' && !who) return undefined
    return cast(t, who ? { name: who.name, id: ev.mother } : undefined)
  }
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
  const t = familyTemplates().find((x) => x.id === ev.template)
  const inParty = ev.mother === 'pc' || state.party.some((m) => m.id === ev.mother)
  if (!pendingPregnancyEvent(state) || !t || !inParty) {
    delete state.pregnancyEvent
    return
  }
  if (t.scope === 'pregnancy') {
    const p = state.pregnancies?.[ev.mother]
    if (!p || !!p.known !== !!t.known) delete state.pregnancyEvent
  }
}

/** 回應懷孕的事件：檢定由主角擲；reveal 的選項（或檢定成功）讓這個人察覺懷孕，birth_bonus 讓這次生產容易一點 */
export function answerPregnancyEvent(state: GameState, index: number): Report {
  const ev = state.pregnancyEvent
  const t = pendingPregnancyEvent(state)
  const o = t?.options?.[index]
  if (!ev || !t || !o) throw new Error('沒有這個選項')
  const tag = t.scope === 'lactation' ? '泌乳' : t.scope === 'brood' ? '苗床' : TAG
  const report = pcEventReport(state, t.title, tag)
  // 苗床：把苗床的種類、階段與留下它的怪物交給 AI（怪物的樣子讓 AI 發揮）
  if (t.scope === 'brood' && ev.parasite) report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), broodFocus(state, ev.parasite)] }
  if (t.scope === 'lactation') {
    const who = ev.mother === 'pc' ? '主角' : personOf(state, ev.mother)?.name ?? ''
    report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), `${who}正在泌乳（胸部脹滿、會溢出乳汁）`] }
  }
  const ok = resolvePcOption(state, report, t, o, tag)
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

/** 苗床的事件交給 AI 的一句：哪一種苗床、什麼階段、哪一隻怪物留下的（附上怪物的樣子） */
export function broodFocus(state: GameState, parasite: string): string {
  const def = parasiteDef(parasite)
  const b = broodOf(parasite)
  const p = parasiteOf(pcOf(state), parasite)
  const m = broodMonster(state, parasite)
  const kind = b ? BROOD_KIND_NAME[b.kind] : ''
  return `主角體內有${def?.name ?? '魔物的苗床'}（${kind}的苗床，${p ? parasiteStageName(p.corruption) : ''}），是${m.name}留下的${m.desc ? `（${m.name}：${m.desc}）` : ''}；照這隻怪物的特徵描寫體內的東西`
}
