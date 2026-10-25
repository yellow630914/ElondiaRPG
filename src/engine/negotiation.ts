// 談判。說明見 docs/TRADE.md。
//
// 談判 = 目標 + 各成功程度的結果（報酬模板的效果：任務旗標、報酬、懲罰……）+ 可選的談判方式。
// - 選擇清單上的方式：依該方式的屬性與 DC 檢定，不需要 AI（AI 判定開啟時，清單本身由 AI 依對象與情境生成）。
// - 自己描述做法：主動行動（kind = negotiation），擲骰後交給 AI 判定。
// 兩種做法的結果都套用同一張結果表；部分成功時可以再談一次（最多 max_attempts 次）。

import { checkModifiers, modifierNote } from './perks'
import { attrOf, mod, proficiency, snapshot } from './character'
import { computeDegree, DEGREE_NAME } from './checks'
import {
  actionRules, ATTR_IDS, attrName, locationById, negotiationRules, regionById,
  type AttrId, type Degree, type NegotiationTemplate, type ShopType,
} from './data'
import { applyEffects, type RewardEffect } from './effects'
import { formatMoney } from './money'
import { generateNpc, npcRecord } from './npcs'
import { pcOf } from './party'
import { roll } from './rng'
import { ensureRelationship } from './social'
import { currentCell } from './grid'
import { addHours, commitReport, newReportId, withRng } from './state'
import { expandTokens, shopKey, shopState } from './trade'
import type { CheckInfo, GameState, Negotiation, NegotiationOption, Quest, Report } from './types'

const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S']

export interface NegotiationContext {
  quest?: string
  shop?: ShopType
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

function fillEffects(effects: RewardEffect[], vars: Record<string, string>): RewardEffect[] {
  return JSON.parse(fill(JSON.stringify(effects), vars)) as RewardEffect[]
}

function counterpartFor(state: GameState, tpl: NegotiationTemplate, ctx: NegotiationContext, quest?: Quest): string {
  if (tpl.counterpart === 'keeper') return shopState(state, ctx.shop!).keeper
  const id = tpl.counterpart === 'guild_clerk' ? `clerk_${state.location}` : `inf_${state.location}_${quest?.template ?? 'x'}`
  if (!npcRecord(state, id)) {
    withRng(state, (rng) => generateNpc(state, rng, tpl.counterpart === 'guild_clerk'
      ? { id, kind: 'commoner', tags: ['commoner'], occupation: '公會職員', level: rng.int(1, 3) }
      : { id, class: 'rogue', level: rng.int(1, 3) }))
  }
  return id
}

/** 現在可以開始哪些談判（給 UI 顯示按鈕）。 */
export function canNegotiate(state: GameState, template: string, ctx: NegotiationContext): string | null {
  try {
    validate(state, template, ctx)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function validate(state: GameState, template: string, ctx: NegotiationContext): { tpl: NegotiationTemplate; quest?: Quest } {
  const tpl = negotiationRules.templates[template]
  if (!tpl) throw new Error('沒有這種談判')
  const done = (state.negotiations ?? []).find((n) => n.template === template && n.status === 'done' && n.quest === ctx.quest && n.shop === (ctx.shop ? shopKey(state, ctx.shop) : undefined))
  if (done) throw new Error('已經談過了')
  if (template === 'quest_reward') {
    const quest = state.quests.find((q) => q.id === ctx.quest)
    if (!quest) throw new Error('找不到這個委託')
    if (quest.giver !== state.location) throw new Error('要在發布委託的城鎮談')
    if (quest.status !== 'available' && quest.status !== 'accepted') throw new Error('這個委託已經不能談了')
    if (quest.flags?.negotiated !== undefined) throw new Error('報酬已經談過了')
    if (currentCell(state).kind !== 'guild') throw new Error('要在冒險者公會談')
    return { tpl, quest }
  }
  if (template === 'shop_discount') {
    if (!ctx.shop) throw new Error('要在商店談')
    if (state.flags[`discount:${shopKey(state, ctx.shop)}`]) throw new Error('已經有折扣了')
  }
  return { tpl }
}

/** 開始（或繼續）一場談判。 */
export function startNegotiation(state: GameState, template: string, ctx: NegotiationContext = {}): Negotiation {
  const shop = ctx.shop ? shopKey(state, ctx.shop) : undefined
  const open = (state.negotiations ?? []).find((n) => n.template === template && n.status === 'open' && n.quest === ctx.quest && n.shop === shop)
  if (open) return open
  const { tpl, quest } = validate(state, template, ctx)
  const counterpart = counterpartFor(state, tpl, ctx, quest)
  const rec = npcRecord(state, counterpart)!
  const vars: Record<string, string> = {
    quest: quest?.title ?? '', quest_id: quest?.id ?? '', shop: shop ?? '', keeper: rec.name,
  }
  const base = tpl.base + tpl.rank_dc * Math.max(0, RANKS.indexOf(quest?.rank ?? 'F'))
  const options: NegotiationOption[] = tpl.options.map((o, i) => {
    const cost = o.cost_cc ?? (o.cost_ratio && quest ? Math.round(quest.reward_cc * o.cost_ratio) : 0)
    return { id: `o${i}`, label: o.label, attr: o.attr, dc: base + o.dc, ...(cost ? { cost_cc: cost } : {}) }
  })
  const outcomes = Object.fromEntries(
    (Object.keys(tpl.outcomes) as Degree[]).map((d) => [d, { text: tpl.outcomes[d].text, effects: fillEffects(tpl.outcomes[d].effects, vars) }]),
  ) as Negotiation['outcomes']
  const n: Negotiation = {
    id: `n-${state.nextReportNo}-${(state.negotiations ?? []).length}`,
    template, title: tpl.title, goal: fill(tpl.goal, vars), counterpart, location: state.location,
    base_dc: base, options, outcomes, attempts: negotiationRules.max_attempts, status: 'open',
    ...(quest ? { quest: quest.id } : {}), ...(shop ? { shop } : {}),
  }
  ;(state.negotiations ??= []).push(n)
  return n
}

export function negotiation(state: GameState, id: string): Negotiation {
  const n = state.negotiations?.find((x) => x.id === id && x.status === 'open')
  if (!n) throw new Error('這場談判已經結束了')
  if (n.location !== state.location) throw new Error('談判對象不在這裡')
  return n
}

export function openNegotiationsHere(state: GameState): Negotiation[] {
  return (state.negotiations ?? []).filter((n) => n.status === 'open' && n.location === state.location)
}

/** 放棄談判：還沒真的談過（一次都沒檢定）就當作沒開始，之後可以再談；談過了才算結束 */
export function abandonNegotiation(state: GameState, id: string) {
  const n = state.negotiations?.find((x) => x.id === id)
  if (!n) return
  if (n.attempts >= negotiationRules.max_attempts) state.negotiations = state.negotiations!.filter((x) => x !== n)
  else n.status = 'done'
}

/** 套用結果表；部分成功且還有次數時談判繼續。回傳結果說明。 */
export function applyNegotiationOutcome(state: GameState, report: Report, id: string, degree: Degree): string {
  const n = negotiation(state, id)
  const shopKeeper = n.shop ? state.shops?.[n.shop]?.keeper : undefined
  const effects = expandTokens(state, n.outcomes[degree].effects, shopKeeper ?? n.counterpart)
  const notes = applyEffects(state, report, effects)
  n.attempts -= 1
  if (degree !== 'partial' || n.attempts <= 0) {
    n.status = 'done'
    n.result = degree
  }
  const more = n.status === 'open' ? `（還可以再談 ${n.attempts} 次）` : ''
  return `${n.outcomes[degree].text}${more}。${notes.join('；')}`
}

function negotiationReport(state: GameState, n: Negotiation, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  const rec = npcRecord(state, n.counterpart)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'social',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: `${loc.name}・${n.title}` },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    ...(rec ? { others: [{ id: rec.id, name: rec.name, race: rec.race, class: rec.class, level: rec.level, personality: rec.personality }] } : {}),
    outcome: { result: 'success' },
    changes: {},
    narration: { pov: 'second_person', length: 'short', focus: [n.goal] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

/** 選擇清單上的談判方式：依規則檢定，不需要 AI。 */
export function chooseOption(state: GameState, id: string, optionId: string): Report {
  const n = negotiation(state, id)
  const o = n.options.find((x) => x.id === optionId)
  if (!o) throw new Error('沒有這個選項')
  if (o.cost_cc && state.money_cc < o.cost_cc) throw new Error('錢不夠')
  const pc = pcOf(state)
  ensureRelationship(state, npcRecord(state, n.counterpart)!)
  const natural = withRng(state, (rng) => roll(rng, '1d20').total)
  // 非戰鬥狀態與特質（對方的標籤也算）
  const extra = checkModifiers(pc, { context: 'negotiation', attr: o.attr, vsTags: npcRecord(state, n.counterpart)?.tags ?? [] })
  const modifier = mod(attrOf(pc, o.attr)) + proficiency(pc.level) + extra.reduce((s, x) => s + x.value, 0)
  const total = natural + modifier
  const degree = computeDegree(natural, total, o.dc)
  const report = negotiationReport(state, n, actionRules.kinds.negotiation.hours)
  if (o.cost_cc) report.changes.money_cc = -o.cost_cc
  const check: CheckInfo = { action: `${n.title}：${o.label}`, attr: o.attr, base_dc: n.base_dc, dc: o.dc, natural, modifier, total, degree, source: 'rules' }
  report.check = check
  report.timeline = [{
    seq: 1, time: report.time.start, actor: 'pc', action: `${o.label}${modifierNote(extra)}`, target: n.counterpart,
    roll: { dice: `1d20${modifier >= 0 ? '+' : ''}${modifier}`, value: total, dc: o.dc }, result: degree,
  }]
  report.narration = { ...report.narration, player_intent: o.label }
  const text = applyNegotiationOutcome(state, report, id, degree)
  const success = degree === 'critical' || degree === 'success'
  report.outcome = {
    result: success ? 'success' : degree === 'partial' ? 'neutral' : 'failure',
    summary: `${n.title}（${o.label}${o.cost_cc ? `，付出 ${formatMoney(o.cost_cc)}` : ''}）：${DEGREE_NAME[degree]}。${text}`,
    tags: ['談判', DEGREE_NAME[degree]],
  }
  return commitReport(state, report)
}

/** 主動行動用：參考 DC、對象名稱、各結果說明 */
export function negotiationSetup(state: GameState, id: string) {
  const n = negotiation(state, id)
  const rec = npcRecord(state, n.counterpart)!
  ensureRelationship(state, rec)
  return {
    dc: n.base_dc, targetName: rec.name, scene: `${locationById(state.location).name}・${n.title}`,
    outcomes: Object.fromEntries((Object.keys(n.outcomes) as Degree[]).map((d) => [d, n.outcomes[d].text])) as Record<Degree, string>,
    goal: n.goal,
  }
}

// ---- AI 生成的談判方式 ----

/** 驗證 AI 生成的談判方式：最多 5 個，屬性合法，DC 夾在基準 ±3，代價不超過上限。 */
export function applyAiOptions(state: GameState, id: string, raw: unknown): number {
  const n = negotiation(state, id)
  const list = Array.isArray((raw as { options?: unknown })?.options) ? (raw as { options: unknown[] }).options : []
  const adj = actionRules.dc_adjust
  const quest = state.quests.find((q) => q.id === n.quest)
  const maxCost = quest ? Math.round(quest.reward_cc * 0.3) : 100
  const options: NegotiationOption[] = []
  for (const r of list) {
    if (options.length >= 5 || !r || typeof r !== 'object') continue
    const x = r as Record<string, unknown>
    const label = typeof x.label === 'string' ? x.label.trim().slice(0, 30) : ''
    const attr = (ATTR_IDS as string[]).includes(String(x.attr)) ? (x.attr as AttrId) : null
    if (!label || !attr) continue
    const dc = Math.max(n.base_dc - adj, Math.min(n.base_dc + adj, Math.round(Number(x.dc) || n.base_dc)))
    const cost = Math.max(0, Math.min(maxCost, Math.round(Number(x.cost_cc) || 0)))
    options.push({ id: `ai${options.length}`, label, attr, dc, ...(cost ? { cost_cc: cost } : {}) })
  }
  if (options.length < 2) return 0
  n.options = options
  return options.length
}

export function optionText(o: NegotiationOption): string {
  return `${attrName(o.attr)} DC ${o.dc}${o.cost_cc ? `・代價 ${formatMoney(o.cost_cc)}` : ''}`
}
