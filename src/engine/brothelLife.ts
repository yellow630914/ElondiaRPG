// 娼館的生活（成人向；docs/LEWD_STATS.md 第 10 節）：打工事件、受訓、頭牌等級、光顧娼婦時學技能、提議夥伴去接客。
// 打工與受訓的事件是主人事件格式（slavery.json 的 brothel_events），由接客或受訓的人自己擲骰（「誰擲骰就用誰的」）。
// 規則與數值在 data/rules/lewd.json 的 brothel。

import { abilities, attrName, lewdRules, masterEventPool, npcs as namedNpcs, type AbilityDef, type Degree, type MasterEventDef } from './data'
import { attrOf, mod, proficiency } from './character'
import { applyEffects, teachAbility } from './effects'
import { lewdOf, npcLewd } from './lewd'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { madamId } from './population'
import { addAffinity, pcOf } from './party'
import { checkModifiers, modifierNote } from './perks'
import { roll, withBonus } from './rng'
import { addMemory } from './social'
import { commitReport, withRng } from './state'
import { baseReport } from './town'
import type { Character, GameState, NpcRecord, PendingMasterEvent, Report } from './types'

const rules = () => lewdRules.brothel

// ---- 頭牌等級 ----

/** 這個人在這座城的娼館累積的次數 */
export function rankPoints(state: GameState, who: string, place = state.location): number {
  return state.brothelRank?.[who]?.[place] ?? 0
}

/** 頭牌等級（0 起）與名稱 */
export function rankOf(state: GameState, who: string, place = state.location): { level: number; name: string; points: number; next?: number } {
  const points = rankPoints(state, who, place)
  const ranks = rules().ranks
  let level = 0
  for (let i = 0; i < ranks.length; i++) if (points >= ranks[i]!.min) level = i
  return { level, name: ranks[level]!.name, points, ...(ranks[level + 1] ? { next: ranks[level + 1]!.min } : {}) }
}

export function addRank(state: GameState, who: string, delta: number, place = state.location) {
  const map = ((state.brothelRank ??= {})[who] ??= {})
  map[place] = (map[place] ?? 0) + delta
}

/** 娼館的時薪倍率（頭牌等級每級 +wage_per_rank） */
export function rankWage(state: GameState, who: string): number {
  return 1 + rankOf(state, who).level * rules().wage_per_rank
}

// ---- 打工事件 ----

/** 打工結束時發生事件的機率：淫亂越高越容易 */
export function workEventChance(c: Character): number {
  const r = rules().work_event
  return Math.min(r.max, r.base + lewdOf(c).lewdness * r.per_lewd)
}

/** 這個人能抽到的打工事件：頭牌等級夠，掛的技能還沒全學過（不掛技能的事件也算） */
export function workEventsFor(state: GameState, who: Character): MasterEventDef[] {
  const level = rankOf(state, who.id).level
  return masterEventPool('brothel_work').filter((e) => e.weight > 0 && (e.rank_min ?? 0) <= level
    && (!e.teaches?.length || e.teaches.some((id) => !who.abilities.includes(id))))
}

function pickWeighted(state: GameState, list: MasterEventDef[]): MasterEventDef {
  return withRng(state, (rng) => {
    let r = rng.next() * list.reduce((s, x) => s + x.weight, 0)
    return list.find((x) => (r -= x.weight) < 0) ?? list[list.length - 1]!
  })
}

function textFor(state: GameState, e: MasterEventDef, who: Character): string {
  const madam = madamName(state)
  return e.text.split('{actor}').join(who.name).split('{master}').join(madam)
}

function madamName(state: GameState): string {
  const rec = npcRecord(state, madamId(state.location))
  return rec?.name ?? '老鴇'
}

/**
 * 娼館打工結束時（work.ts 的 applyWork）：頭牌等級 +1，擲一次打工事件；發生時頭牌等級再 +2，等這個人選怎麼應對。
 * 回傳日誌的一句（沒有事件時是空字串）
 */
export function afterBrothelWork(state: GameState, who: Character): string {
  addRank(state, who.id, rules().rank_gain.work)
  const list = workEventsFor(state, who)
  if (!list.length || state.pendingMasterEvent) return ''
  if (!withRng(state, (rng) => rng.chance(workEventChance(who)))) return ''
  const e = pickWeighted(state, list)
  addRank(state, who.id, rules().rank_gain.event)
  state.pendingMasterEvent = { id: e.id, pool: 'brothel_work', ...(who.isPlayer ? {} : { actor: who.id }), place: state.location, text: textFor(state, e, who) }
  return '接客時遇到了一件事'
}

// ---- 受訓 ----

/** 受訓的費用：學費 = 基本 + 每級解鎖等級，依頭牌等級打折 */
export function trainingFee(state: GameState, who: Character, ability: AbilityDef): number {
  const r = rules().train
  const base = r.price_base + r.price_per_unlock * (ability.unlock ?? 1)
  return Math.round(base * Math.max(0, 1 - r.discount_per_rank * rankOf(state, who.id).level))
}

/** 這個人受訓能學的：頭牌等級夠的受訓事件裡、還沒學的技能（事件, 技能） */
export function trainingOptions(state: GameState, who: Character): { event: MasterEventDef; ability: AbilityDef }[] {
  const level = rankOf(state, who.id).level
  return masterEventPool('brothel_train').filter((e) => e.weight > 0 && (e.rank_min ?? 0) <= level).flatMap((event) =>
    (event.teaches ?? []).filter((id) => abilities[id]?.classes.includes('lewd') && !who.abilities.includes(id)).map((id) => ({ event, ability: abilities[id]! })))
}

/** 受訓的預覽：能學幾種、學費的範圍；全部學過時是複習（學費最低） */
export function trainingPreview(state: GameState, who: Character): { count: number; min: number; max: number; review: boolean } {
  const opts = trainingOptions(state, who)
  const fees = opts.map((o) => trainingFee(state, who, o.ability))
  const review = !opts.length
  const reviewFee = Math.round(rules().train.price_base * Math.max(0, 1 - rules().train.discount_per_rank * rankOf(state, who.id).level))
  return { count: opts.length, min: review ? reviewFee : Math.min(...fees), max: review ? reviewFee : Math.max(...fees), review }
}

/** 可以去娼館受訓、接客的人：主角，和派得動的夥伴（work.ts 的 workers） */
function trainee(state: GameState, id?: string): Character {
  const who = id ? state.party.find((m) => m.id === id) : pcOf(state)
  if (!who) throw new Error('隊伍裡沒有這個人')
  return who
}

/** 到娼館受訓：付學費，抽一件受訓事件（一定學會一個還沒學的技能；全部學過時複習） */
export function startBrothelTraining(state: GameState, whoId?: string): Report {
  if (state.combat || state.pendingAction || state.pendingMasterEvent) throw new Error('現在不能這麼做')
  const who = trainee(state, whoId)
  const opts = trainingOptions(state, who)
  const pool = masterEventPool('brothel_train').filter((e) => e.weight > 0 && (e.rank_min ?? 0) <= rankOf(state, who.id).level)
  if (!pool.length) throw new Error('這裡現在沒有能上的課')
  const pick = opts.length ? withRng(state, (rng) => rng.pick(opts)) : undefined
  const event = pick?.event ?? pickWeighted(state, pool)
  const fee = pick ? trainingFee(state, who, pick.ability) : trainingPreview(state, who).min
  if (state.money_cc < fee) throw new Error(`錢不夠（這次的學費要 ${formatMoney(fee)}）`)
  const report = baseReport(state, 'trade', 0)
  report.changes.money_cc = -fee
  report.outcome.summary = `付給${madamName(state)} ${formatMoney(fee)}，讓${who.isPlayer ? '你' : who.name}在娼館受訓${pick ? '' : '（該學的都學過了，這次是複習）'}。`
  report.narration = undefined
  const out = commitReport(state, report)
  state.pendingMasterEvent = {
    id: event.id, pool: 'brothel_train', place: state.location, ...(who.isPlayer ? {} : { actor: who.id }), ...(pick ? { teach: pick.ability.id } : {}),
    text: textFor(state, event, who),
  }
  return out
}

/** 受訓事件的結果：一定學會預先抽好的技能；沒有時（全部學過）是複習 */
export function afterBrothelTraining(state: GameState, report: Report, who: Character, pm: PendingMasterEvent): string[] {
  if (pm.teach && abilities[pm.teach] && !who.abilities.includes(pm.teach)) return [teachAbility(state, report, who, pm.teach)]
  return applyEffects(state, report, rules().train.review.map((e) => (e.type === 'lewd' && !who.isPlayer ? { ...e, target: who.id } : e)))
}

// ---- 光顧娼婦時學技能 ----

/** 她能教的技能：固定 NPC 寫的 teaches，沒有時用預設；她的淫亂決定能教到幾級 */
export function patronTeaches(rec: NpcRecord): string[] {
  const def = namedNpcs.find((n) => n.id === rec.id)
  const list = def?.teaches?.length ? def.teaches : rules().patron.default
  const lewd = npcLewd({ id: rec.id, tags: rec.tags, ...(def?.lewd ? { lewd: def.lewd } : {}) }).lewdness
  const cap = [...rules().patron.tiers].reverse().find((t) => lewd >= t.lewd)?.unlock ?? 1
  return list.filter((id) => abilities[id]?.classes.includes('lewd') && (abilities[id]!.unlock ?? 1) <= cap)
}

/** 光顧成功之後：親密度夠的娼婦有機會教主角一個還沒學的技能 */
export function patronTeach(state: GameState, report: Report, rec: NpcRecord, degree: Degree): string | undefined {
  if (degree !== 'critical' && degree !== 'success') return undefined
  const r = rules().patron
  if ((state.relationships?.[rec.id]?.affinity ?? 0) < r.affinity_min) return undefined
  const pc = pcOf(state)
  const open = patronTeaches(rec).filter((id) => !pc.abilities.includes(id))
  if (!open.length || !withRng(state, (rng) => rng.chance(r.chance))) return undefined
  return `${rec.name}教了你一手：${teachAbility(state, report, pc, withRng(state, (rng) => rng.pick(open)))}`
}

// ---- 提議夥伴去接客 ----

/** 自由的夥伴（不是奴隸）：要先答應才能派去娼館接客 */
export function needsConsent(m: Character): boolean {
  return !m.isPlayer && (m.bond === 'voluntary' || m.bond === 'hired')
}

export function consentedToday(state: GameState, id: string): boolean {
  return state.workConsent?.[id] === state.time.day
}

/** 提議的 DC：對方越淫亂、越親近越容易，身分（貴族、神官難，娼婦容易） */
export function proposeDc(state: GameState, m: Character): number {
  const r = rules().propose
  const rec = npcRecord(state, m.id)
  const aff = state.relationships?.[m.id]?.affinity ?? 0
  const tags = (rec?.tags ?? []).reduce((s, t) => s + (r.tags[t] ?? 0), 0)
  return Math.round(r.dc - lewdOf(m).lewdness / r.lewd_div - aff / r.affinity_div + tags)
}

/** 提議一位自由的夥伴今天去娼館接客：主角擲魅力；成功時今天都可以派，失敗親密度下降 */
export function proposeWork(state: GameState, id: string): Report {
  const m = state.party.find((x) => x.id === id)
  if (!m || !needsConsent(m)) throw new Error('隊伍裡沒有這位夥伴')
  if (state.combat || state.pendingAction || state.pendingMasterEvent) throw new Error('現在不能這麼做')
  const r = rules().propose
  const pc = pcOf(state)
  const dc = proposeDc(state, m)
  const extra = checkModifiers(pc, { context: 'action', kind: 'flatter', attr: r.attr, vsTags: npcRecord(state, m.id)?.tags ?? [] })
  const dice = withBonus('1d20', mod(attrOf(pc, r.attr)) + proficiency(pc.level) + extra.reduce((s, x) => s + x.value, 0))
  const res = withRng(state, (rng) => roll(rng, dice))
  const natural = res.rolls?.[0]
  const fumble = natural === 1 || res.total <= dc - 10
  const ok = res.total >= dc
  const report = baseReport(state, 'action', 0.25)
  report.timeline = [{ seq: 1, time: { ...state.time }, actor: pc.id, action: `提議${m.name}去娼館接客${modifierNote(extra)}`, roll: { dice, value: res.total, dc }, result: ok ? 'success' : 'fail' }]
  report.outcome.result = ok ? 'success' : 'failure'
  if (ok) {
    ;(state.workConsent ??= {})[m.id] = state.time.day
    report.outcome.summary = `${m.name}想了想，答應今天去娼館幫忙（${attrName(r.attr)}檢定成功）。`
  } else {
    addAffinity(state, report, m.id, fumble ? r.fumble_affinity : r.fail_affinity, fumble ? '被要求去接客，覺得受到侮辱' : '不想去接客')
    if (fumble) {
      addMemory(state, {
        time: { ...report.time.start }, location: report.location.at, participants: ['pc', m.id], report: report.report_id,
        summary: `${pc.name}要${m.name}去娼館接客，${m.name}覺得受到侮辱`, importance: 2,
      })
    }
    report.outcome.summary = fumble ? `${m.name}臉色一沉，覺得你把他當成了什麼人。` : `${m.name}搖搖頭，不想去。`
  }
  return commitReport(state, report)
}
