// 主動行動：玩家用文字描述行為，擲骰先發生，再把完整資料與骰值交給 AI 直接寫出結果。
//
// 1. prepareAction：檢查能不能做、算出參考 DC、先擲 1d20（存進 state.pendingAction，重新整理也不會重擲）。
// 2. AI 判定（AI 關閉時略過）：AI 看到隊伍狀態、屬性、裝備、技能、人際關係、共同記憶、骰值與參考 DC，
//    自己決定成功與否（骰值只是參考，可以出乎預料），直接寫出結果的經過，並提出效果（封閉清單）
//    與人際關係文字的更新提議。屬性與 DC 只是給玩家看的判定依據（DC 夾在參考值 ±3）。
// 3. resolveAction：採用 AI 的成功程度，套用機制結果（雇傭、殺價、邀請、談判、逃離……）
//    與夾住上限的 AI 效果，產生報告；AI 寫的經過直接作為這份報告的敘事。
//    AI 關閉時依規則：預設屬性、參考 DC 與骰值決定成功程度。
// 說明見 docs/RELATIONSHIP_MEMORY.md 第 5 節。

import { mod, proficiency, snapshot } from './character'
import { computeDegree, DEGREE_NAME } from './checks'
import {
  applyBlackMarket, applyEscape, applyHaggle, applyHire, applyInvite, applyNegotiate, setupFor, type MarketKind,
} from './companions'
import {
  actionRules, ATTR_IDS, attrName, locationById, regionById, slaveryRules, type ActionKind, type AttrId, type Degree, type EffectKind,
} from './data'
import { applyEffects, type RewardEffect } from './effects'
import { applyStandoff } from './encounters'
import { applyMarking, applyMasterEventResponse, applyPermit, applyReturn, applySeekMaster, applyUnmark, masterEventDefaults } from './slavery'
import { applyInteraction } from './interactions'
import { applyPatron } from './brothel'
import { applyWork } from './work'
import { applyCraft, parseCraftTarget } from './craft'
import { adultContent, type AdultScene } from './content'
import { applyDefeatResponse } from './defeat'
import { gearRules, sanitizeGearSpec, shiftRarity } from './gear'
import { npcRecord, type NpcSpec } from './npcs'
import { presentHere } from './population'
import { addAffinity, conditionPenalty, pcOf } from './party'
import { applyNegotiationOutcome } from './negotiation'
import { addSuggestions } from './social'
import { applyBargain } from './trade'
import { roll } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import { useAbilityOutOfCombat, type AbilityUse } from './resources'
import type { Character, CheckInfo, GameState, GameTime, GearSpec, Report, ResourceChange } from './types'

export interface ActionInput {
  kind: ActionKind
  /** 玩家描述的行為 */
  text: string
  /** 對象：NPC id；殺價為 "public:npc" / "black:npc" */
  target?: string
  /** 雇傭談判的出價 */
  offer_cc?: number
  /** 搭配使用的能力（例如用魅惑術幫談判）：花資源換檢定加值 */
  use?: { member: string; ability: string }
  /** 送禮：送出的物品名稱 */
  item?: string
}

export interface ActionPending extends ActionInput {
  /** 耗時（小時；沒有時用 actions.json 的設定，例如工作的時數） */
  hours?: number
  id: string
  natural: number
  /** 擲兩次取高（優勢）時的兩個骰值 */
  rolls?: number[]
  /** 優勢的原因 */
  advantage?: string
  base_dc: number
  /** 規則判定時使用的屬性 */
  attr: AttrId
  /** 各屬性的檢定修正 = mod + 熟練 */
  modifiers: Record<AttrId, number>
  situational: { label: string; value: number }[]
  outcomes: Partial<Record<Degree, string>>
  targetName?: string
  scene: string
  time: GameTime
  location: string
  /** 使用能力花掉的資源（擲骰時就已扣除） */
  spent?: ResourceChange[]
  /** 使用的能力，給 AI 參考 */
  usedAbility?: { member: string; name: string; desc: string; cost: string }
  /** 成人向：可能進入的親密場景 */
  adultScene?: AdultScene
}

export interface RelationshipUpdate { id: string; to_player: string }

export interface Judgment {
  attr: AttrId
  dc: number
  rationale?: string
  /** AI 決定的成功程度（骰值只是參考）；沒有給時依骰值與 DC 計算 */
  degree?: Degree
  /** 出乎預料的轉折（AI 讓結果偏離骰值時說明） */
  twist?: string
  summary?: string
  /** AI 直接寫出的結果經過（作為報告的敘事） */
  narrative?: string
  /** AI 認為這次的經過包含親密場景（只在開啟成人向時採用）：場景是什麼 */
  adult_scene?: string
  effects: RewardEffect[]
  relationship_updates: RelationshipUpdate[]
}

export { computeDegree, DEGREE_NAME }

export function situationalTotal(p: ActionPending): number {
  return p.situational.reduce((s, x) => s + x.value, 0)
}

export function prepareAction(state: GameState, input: ActionInput): ActionPending {
  if (state.combat) throw new Error('戰鬥中不能這麼做')
  if (state.pendingAction) throw new Error('還有一個行動等待判定')
  if (state.pendingMasterEvent && input.kind !== 'master_event') throw new Error('先回應主人的要求')
  if (state.pendingDefeat && input.kind !== 'defeat_event') throw new Error('先應付眼前的處境')
  const kind = actionRules.kinds[input.kind]
  if (!kind) throw new Error('沒有這種行動')
  const text = input.text.trim().slice(0, 400)
  if (input.kind === 'free' && !text) throw new Error('請描述你要做什麼')
  const setup = setupFor(state, input.kind, input.target, input.offer_cc, input.item)
  const pc = pcOf(state)
  const penalty = conditionPenalty(pc)
  const situational = [...setup.situational, ...(penalty ? [{ label: penalty > 0 ? '受罰' : '祝福', value: -penalty }] : [])].filter((x) => x.value !== 0)
  // 搭配能力：檢查並扣除資源（和擲骰一樣在判定前發生，判定失敗也不會退回）
  let used: AbilityUse | undefined
  let user: Character | undefined
  if (input.use) {
    user = state.party.find((m) => m.id === input.use!.member)
    if (!user) throw new Error('隊伍中沒有這位角色')
    used = useAbilityOutOfCombat(user, input.use.ability)
    situational.push({ label: `${user.name}的【${used.ability.name}】`, value: used.bonus })
  }
  // 對自己的奴隸行動：奴隸抗拒時處於劣勢，主角擲兩次取較高的
  const ownSlave = !!input.target && state.party.some((m) => m.id === input.target && m.bond === 'slave' && m.contract?.master === 'pc')
  const rolls = withRng(state, (rng) => (ownSlave ? [roll(rng, '1d20').total, roll(rng, '1d20').total] : [roll(rng, '1d20').total]))
  const natural = Math.max(...rolls)
  const pending: ActionPending = {
    ...input,
    text,
    id: `a-${state.nextReportNo}`,
    natural,
    ...(ownSlave ? { rolls, advantage: '對方是主角的奴隸，抗拒時處於劣勢' } : {}),
    base_dc: setup.dc,
    attr: setup.attr ?? kind.attr,
    ...(setup.hours ? { hours: setup.hours } : {}),
    modifiers: Object.fromEntries(ATTR_IDS.map((a) => [a, mod(pc.attrs[a]) + proficiency(pc.level)])) as Record<AttrId, number>,
    situational,
    outcomes: setup.outcomes,
    ...(setup.targetName ? { targetName: setup.targetName } : {}),
    ...(setup.adultScene ? { adultScene: setup.adultScene } : {}),
    scene: setup.scene,
    time: { ...state.time },
    location: state.location,
    ...(used?.change ? { spent: [used.change] } : {}),
    ...(used && user ? { usedAbility: { member: user.id, name: used.ability.name, desc: used.ability.desc, cost: used.cost } } : {}),
  }
  state.pendingAction = pending
  return pending
}

// ---- 驗證 AI 的回傳 ----

const clipText = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const EFFECT_OF: Partial<Record<RewardEffect['type'], EffectKind>> = {
  affinity: 'affinity', relationship_text: 'relationship_text', flag: 'flag', reputation: 'reputation',
  money: 'money', item: 'item', xp: 'xp', meet: 'meet', ability: 'ability', hp: 'hp', mark: 'mark',
  free: 'release', change_master: 'change_master', gear: 'gear',
}

/**
 * 把 AI 回傳的 JSON 轉成判定：屬性不合法時用預設屬性，DC 夾在參考 DC ±dc_adjust，
 * 效果只保留這種行動允許的種類，數值夾在上限內。結構完全不對時丟出錯誤。
 */
export function sanitizeJudgment(state: GameState, p: ActionPending, raw: unknown): Judgment {
  if (!raw || typeof raw !== 'object') throw new Error('AI 回傳的不是 JSON 物件')
  const r = raw as Record<string, unknown>
  const caps = actionRules.caps
  const adj = actionRules.dc_adjust
  const attr = (ATTR_IDS as string[]).includes(String(r.attr)) ? (r.attr as AttrId) : p.attr
  const dcRaw = num(r.dc)
  const dc = Number.isNaN(dcRaw) ? p.base_dc : clamp(Math.round(dcRaw), p.base_dc - adj, p.base_dc + adj)
  const degree = (Object.keys(DEGREE_NAME) as Degree[]).includes(r.degree as Degree) ? (r.degree as Degree) : undefined
  const allowed = new Set(actionRules.kinds[p.kind].effects)
  const pc = pcOf(state)
  const known = (id: string) => !!state.relationships?.[id]
  const effects: RewardEffect[] = []
  const affinitySeen = new Map<string, number>()
  let items = 0
  let flags = 0
  let money = 0
  for (const e of Array.isArray(r.effects) ? r.effects : []) {
    if (!e || typeof e !== 'object') continue
    const x = e as Record<string, unknown>
    const type = String(x.type) as RewardEffect['type']
    const kind = EFFECT_OF[type]
    if (!kind || !allowed.has(kind)) continue
    switch (type) {
      case 'affinity': {
        const npc = String(x.npc ?? '')
        const delta = num(x.delta)
        if (!known(npc) || Number.isNaN(delta)) break
        const used = affinitySeen.get(npc) ?? 0
        const d = clamp(Math.round(delta), -caps.affinity - used, caps.affinity - used)
        if (d === 0) break
        affinitySeen.set(npc, used + d)
        effects.push({ type, npc, delta: d, ...(x.reason ? { reason: clipText(x.reason, 40) } : {}) })
        break
      }
      case 'relationship_text': {
        const npc = String(x.npc ?? '')
        const text = clipText(x.text, caps.relationship_text_chars)
        if (known(npc) && text) effects.push({ type, npc, text })
        break
      }
      case 'flag': {
        const key = clipText(x.key, 40).replace(/[^\w:\-\u4e00-\u9fff]/g, '_')
        if (!key || flags >= caps.flags || key.startsWith('black_market:') || key.startsWith('invite_wait:') || key === 'negotiate_bonus') break
        const value = typeof x.value === 'boolean' || typeof x.value === 'number' ? x.value : clipText(x.value, 60) || true
        effects.push({ type, key: `ai:${key}`, value })
        flags++
        break
      }
      case 'reputation': {
        const faction = clipText(x.faction, 30)
        const delta = num(x.delta)
        if (!faction || Number.isNaN(delta)) break
        const d = clamp(Math.round(delta), -caps.reputation, caps.reputation)
        if (d) effects.push({ type, faction, delta: d })
        break
      }
      case 'money': {
        const amount = num(x.amount)
        if (Number.isNaN(amount)) break
        const cap = caps.money_cc_per_level * pc.level
        // 只能賺取上限內的錢；花錢不能超過持有的金額
        const a = clamp(Math.round(amount), -Math.max(0, state.money_cc - money), cap - Math.max(0, money))
        if (a) {
          money += a
          effects.push({ type, amount: a })
        }
        break
      }
      case 'item': {
        const name = clipText(x.name, 20)
        const qty = num(x.qty)
        if (!name || Number.isNaN(qty) || items >= caps.items) break
        const q = Math.round(qty)
        const have = state.inventory.find((i) => i.name === name)?.qty ?? 0
        const n = q > 0 ? Math.min(q, caps.item_qty) : -Math.min(-q, have)
        if (n) {
          effects.push({ type, name, qty: n })
          items++
        }
        break
      }
      case 'hp': {
        // 受傷或治療：每人最多失去 hp_loss_ratio、回復 hp_gain_ratio 的最大生命值，不會因此倒下
        const target = String(x.target ?? 'pc')
        const who = target === 'pc' ? pc : state.party.find((m) => m.id === target)
        const amount = num(x.amount)
        if (!who || Number.isNaN(amount) || effects.some((y) => y.type === 'hp' && y.target === who.id)) break
        const a = clamp(Math.round(amount), -Math.ceil(who.maxHp * caps.hp_loss_ratio), Math.ceil(who.maxHp * caps.hp_gain_ratio))
        if (a) effects.push({ type: 'hp', target: who.id, amount: a })
        break
      }
      case 'ability': {
        // 技能報酬只在 AI 判定為大成功時採用，最多一項
        if (degree !== 'critical' || effects.some((y) => y.type === 'ability')) break
        const target = String(x.target ?? 'pc')
        if (target !== 'pc' && !state.party.some((m) => m.id === target)) break
        const ability = clipText(x.ability, 30)
        effects.push({ type: 'ability', target, ...(ability ? { ability } : {}) })
        break
      }
      case 'mark': {
        // 刻印時 AI 依主角的行為提議的印記名稱與描述（只是文字）
        if (effects.some((y) => y.type === 'mark')) break
        const name = clipText(x.name, slaveryRules.custom_mark.name_chars)
        const text = clipText(x.text ?? x.mark, slaveryRules.custom_mark.mark_chars)
        if (name || text) effects.push({ type: 'mark', ...(name ? { name } : {}), ...(text ? { text } : {}) })
        break
      }
      case 'free': {
        // 解除主角的契約：只在大成功時採用；自由行動要有對象（例如施術者、願意出手的大人物）
        if (degree !== 'critical' || !pc.contract || state.pendingMark || effects.some((y) => y.type === 'free')) break
        if (p.kind === 'free' && !p.target) break
        effects.push({ type: 'free', npc: 'pc' })
        break
      }
      case 'change_master': {
        // 對象成為主角的新主人：成功以上、主角是奴隸、對象就是這次行動的對象而且在身邊
        if (!degree || !['critical', 'success'].includes(degree) || !pc.contract || state.pendingMark || !p.target) break
        if (String(x.npc ?? p.target) !== p.target || p.target === pc.contract.master || effects.some((y) => y.type === 'change_master')) break
        const rec = npcRecord(state, p.target)
        if (!rec || rec.dead || !presentHere(state, rec.id)) break
        effects.push({ type: 'change_master', master: rec.id })
        break
      }
      case 'gear': {
        // 裝備：打造時是成品的名稱、描述與附魔（底材與材料固定，稀有度依成功程度）；
        // 自由行動時是事件得到的裝備：成功以上、材料不超過主角等級、稀有度不超過材料原本的（大成功可以高一級），最多一件
        if (effects.some((y) => y.type === 'gear')) break
        const name = clipText(x.name, 20) || undefined
        const desc = clipText(x.desc, 80) || undefined
        let spec: GearSpec | undefined
        if (p.kind === 'craft') {
          const { base, material } = parseCraftTarget(p.target)
          spec = sanitizeGearSpec(x, { maxLevel: 99, maxRarity: 'legendary', base, material })
        } else {
          if (degree !== 'critical' && degree !== 'success') break
          const probe = sanitizeGearSpec({ ...x, rarity: undefined, enchants: undefined }, { maxLevel: pc.level })
          if (!probe) break
          const natural = gearRules.materials[probe.material]!.rarity
          spec = sanitizeGearSpec(x, { maxLevel: pc.level, maxRarity: degree === 'critical' ? shiftRarity(natural, 1) : natural })
        }
        if (spec) effects.push({ type: 'gear', spec, ...(name ? { name } : {}), ...(desc ? { desc } : {}) })
        break
      }
      case 'meet': {
        // 只有在旅店長休、對象是同旅館的人時才能認識新的人
        if (p.target !== 'guests' || effects.some((y) => y.type === 'meet')) break
        const spec = (x.npc && typeof x.npc === 'object' ? x.npc : {}) as Record<string, unknown>
        const str = (v: unknown, n: number) => clipText(v, n) || undefined
        const level = Math.max(1, Math.min(pc.level + 2, Math.round(num(spec.level) || pc.level)))
        const affinity = clamp(Math.round(num(x.affinity) || 0), -caps.meet_affinity, caps.meet_affinity)
        const npc: NpcSpec = { level, location: state.location }
        for (const [k, n] of [['name', 12], ['gender', 10], ['race', 12], ['class', 12], ['personality', 80], ['appearance', 120], ['background', 120]] as const) {
          const v = str(spec[k], n)
          if (v) npc[k] = v
        }
        effects.push({ type: 'meet', npc, spot: 'inn', ...(affinity ? { affinity } : {}), ...(str(x.to_player, caps.relationship_text_chars) ? { to_player: str(x.to_player, caps.relationship_text_chars)! } : {}) })
        break
      }
      case 'xp': {
        const amount = num(x.amount)
        if (Number.isNaN(amount) || amount <= 0) break
        effects.push({ type, amount: clamp(Math.round(amount), 0, caps.xp_per_level * pc.level) })
        break
      }
    }
  }
  const updates: RelationshipUpdate[] = []
  for (const u of Array.isArray(r.relationship_updates) ? r.relationship_updates : []) {
    const id = String((u as Record<string, unknown>)?.id ?? '')
    const text = clipText((u as Record<string, unknown>)?.to_player, caps.relationship_text_chars)
    if (known(id) && text) updates.push({ id, to_player: text })
  }
  return {
    attr, dc,
    ...(clipText(r.rationale, 200) ? { rationale: clipText(r.rationale, 200) } : {}),
    ...(degree ? { degree } : {}),
    ...(clipText(r.summary, caps.summary_chars) ? { summary: clipText(r.summary, caps.summary_chars) } : {}),
    ...(clipText(r.twist, 120) ? { twist: clipText(r.twist, 120) } : {}),
    ...(clipText(r.narrative, caps.narrative_chars) ? { narrative: clipText(r.narrative, caps.narrative_chars) } : {}),
    ...(adultContent() && clipText(r.adult_scene, 40) ? { adult_scene: clipText(r.adult_scene, 40) } : {}),
    effects,
    relationship_updates: updates,
  }
}

// ---- 判定 ----

function actionReport(state: GameState, p: ActionPending, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: p.kind === 'free' || p.kind === 'craft' ? 'action' : 'social',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: p.scene },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'neutral' },
    changes: {},
    narration: { pov: 'second_person', length: 'short', ...(p.text ? { player_intent: p.text } : {}) },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

/** 依判定（AI 或規則）結算等待中的行動。 */
export function resolveAction(state: GameState, judgment: Judgment | null): Report {
  const p = state.pendingAction
  if (!p) throw new Error('沒有等待判定的行動')
  const kind = actionRules.kinds[p.kind]
  const attr = judgment?.attr ?? p.attr
  const dc = judgment?.dc ?? p.base_dc
  const modifier = p.modifiers[attr] + situationalTotal(p)
  const total = p.natural + modifier
  // 參考：骰值對 DC 算出的成功程度；實際結果由 AI 決定
  const reference = computeDegree(p.natural, total, dc)
  const degree = judgment?.degree ?? reference
  delete state.pendingAction

  const report = actionReport(state, p, p.hours ?? kind.hours)
  const check: CheckInfo = {
    action: kind.name, attr, base_dc: p.base_dc, dc, natural: p.natural, modifier, total, degree,
    ...(degree !== reference ? { reference_degree: reference } : {}),
    source: judgment ? 'ai' : 'rules',
    ...(judgment?.rationale ? { rationale: judgment.rationale } : {}),
    ...(judgment?.twist ? { twist: judgment.twist } : {}),
  }
  report.check = check
  if (p.spent?.length) report.changes.resources = [...p.spent]
  if (p.usedAbility) {
    const who = state.party.find((m) => m.id === p.usedAbility!.member)?.name ?? ''
    report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), `${who}使用了【${p.usedAbility.name}】`] }
  }
  if (p.kind === 'rest_talk') {
    // 長休時的互動：把剛結束的長休一起交給 AI 描寫（長休本身不另外寫敘事）
    const restReport = [...state.reports].reverse().find((r) => r.kind === 'rest')
    if (restReport?.outcome.summary) {
      report.narration = { ...report.narration, length: 'medium', focus: [`長休的經過：${restReport.outcome.summary}`, '入睡前或清晨與對象的互動', ...(report.narration?.focus ?? [])] }
    }
  }
  if (p.target && state.relationships?.[p.target]) {
    const rel = state.relationships[p.target]!
    if (!report.party.some((x) => x.id === rel.id)) report.others = [{ id: rel.id, name: rel.name }]
  }
  report.timeline = [{
    seq: 1, time: report.time.start, actor: 'pc', action: `${kind.name}（${attrName(attr)}${p.rolls ? `・優勢 ${p.rolls.join('、')}` : ''}）`,
    ...(p.target && !p.target.includes(':') ? { target: p.target } : {}),
    roll: { dice: `1d20${modifier >= 0 ? '+' : ''}${modifier}`, value: total, dc },
    result: degree === 'fail' ? 'fail' : degree,
  }]

  // 打造：AI 提出的成品交給打造的機制處理（不另外給一件）
  const crafted = p.kind === 'craft' ? judgment?.effects.find((e) => e.type === 'gear') : undefined
  if (crafted && judgment) judgment.effects = judgment.effects.filter((e) => e !== crafted)
  const mechanical = applyMechanics(state, report, p, degree, crafted as Extract<RewardEffect, { type: 'gear' }> | undefined)
  const notes = judgment ? applyEffects(state, report, judgment.effects) : defaultEffects(state, report, p, degree)
  if (judgment) addSuggestions(state, judgment.relationship_updates, report.report_id)
  if (judgment?.narrative) report.narration = { ...report.narration, focus: ['AI 已直接寫出經過'] }
  const scene = adultSceneFor(p, degree, judgment)
  if (scene) report.narration = { ...report.narration, length: report.narration?.length === 'long' ? 'long' : 'medium', adult_scene: scene }
  const success = degree === 'critical' || degree === 'success'
  const lead = `${kind.name}${p.targetName ? `（${p.targetName}）` : ''}：${DEGREE_NAME[degree]}。`
  report.outcome = {
    result: success ? 'success' : degree === 'partial' ? 'neutral' : 'failure',
    summary: [lead, mechanical, judgment?.summary ?? '', ...notes].filter(Boolean).join(''),
    tags: [kind.name, DEGREE_NAME[degree], ...(judgment?.twist ? ['出乎預料'] : [])],
  }
  return commitReport(state, report)
}

/**
 * 這次的經過有沒有親密場景（只在開啟成人向時）：行動本身會進入場景（娼館、戰敗事件沒能脫身），
 * 或 AI 判定認為有（主人的要求、自由行動、長休的互動……）。
 */
export function adultSceneFor(p: ActionPending, degree: Degree, judgment: Judgment | null): string | undefined {
  if (!adultContent()) return undefined
  const s = p.adultScene
  if (s && (!s.on || s.on.includes(degree))) return s.label
  return judgment?.adult_scene
}

function applyMechanics(state: GameState, report: Report, p: ActionPending, degree: Degree, crafted?: Extract<RewardEffect, { type: 'gear' }>): string {
  switch (p.kind) {
    case 'hire': return applyHire(state, report, p.target!, p.offer_cc ?? 0, degree)
    case 'haggle': {
      const [mk, id] = p.target!.split(':') as [MarketKind, string]
      return applyHaggle(state, report, mk, id, degree)
    }
    case 'invite': return applyInvite(state, report, p.target!, degree)
    case 'black_market': return applyBlackMarket(state, report, degree)
    case 'negotiate': return applyNegotiate(state, report, degree)
    case 'escape': return applyEscape(state, report, degree)
    case 'bargain': return applyBargain(state, report, p.target!, degree)
    case 'negotiation': return applyNegotiationOutcome(state, report, p.target!, degree)
    case 'chat':
    case 'gift':
    case 'flatter':
    case 'steal':
    case 'attack': return applyInteraction(state, report, p.kind, p.target!, degree, p.item)
    case 'bluff':
    case 'intimidate': return applyStandoff(state, degree)
    case 'master_permit': return applyPermit(state, report, degree)
    case 'marking': return applyMarking(state, degree)
    case 'master_event': applyMasterEventResponse(state); return ''
    case 'master_return': return applyReturn(state, report, degree)
    case 'seek_master': return applySeekMaster(state, report, p.target!, degree)
    case 'unmark': return applyUnmark(state, report, p.target!, degree)
    case 'work': return applyWork(state, report, p.target!, degree)
    case 'patron': return applyPatron(state, report, p.target, degree)
    case 'craft': return applyCraft(state, report, p.target!, degree, crafted)
    case 'defeat_event': return applyDefeatResponse(state, report, degree)
    case 'free':
    case 'rest_talk': return ''
  }
}

/** 沒有 AI（或 AI 的判斷與骰值不符）時的預設效果：自由行動依成功程度小幅改變對象的親密度。 */
function defaultEffects(state: GameState, report: Report, p: ActionPending, degree: Degree): string[] {
  if (p.kind === 'rest_talk') return restTalkDefaults(state, report, p, degree)
  if (p.kind === 'master_event') return masterEventDefaults(state, report, degree)
  if (p.kind !== 'free' || !p.target || !state.relationships?.[p.target]) return []
  const delta = { critical: 4, success: 2, partial: 0, fail: -2, fumble: -4 }[degree]
  addAffinity(state, report, p.target, delta, p.text.slice(0, 30))
  return []
}

/** 長休時的互動（依規則）：和隊友聊天親密度小幅變化；和同旅館的人相處愉快時會認識一位新朋友。 */
function restTalkDefaults(state: GameState, report: Report, p: ActionPending, degree: Degree): string[] {
  const delta = { critical: 3, success: 2, partial: 1, fail: -1, fumble: -3 }[degree]
  if (p.target === 'guests') {
    if (degree !== 'critical' && degree !== 'success') return []
    return applyEffects(state, report, [{ type: 'meet', npc: { level: pcOf(state).level, location: state.location }, spot: 'inn', affinity: delta * 3 }])
  }
  const targets = p.target ? [p.target] : state.party.filter((m) => !m.isPlayer).map((m) => m.id)
  for (const id of targets) addAffinity(state, report, id, delta, '長休時的相處')
  return []
}
