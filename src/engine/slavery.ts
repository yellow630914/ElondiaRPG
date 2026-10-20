// 奴隸契約印記與主角身為奴隸時的規則（見 docs/COMPANIONS.md 第 3、4 節，規則在 data/rules/slavery.json）。
//
// - 印記是一份「條款」：名稱、描述與數值（收益率、談判／逃離／出城 DC、被找到的機率、逃離反噬、服從懲罰）。
//   模板在 slavery.json 的 contracts；建立角色或買奴隸時也可以自訂，數值夾在 custom_mark 的範圍內。
// - 主角身為奴隸：出城、旅行前要主人同意（檢定依印記的 exit_dc）；成為奴隸時有刻印檢定，結果決定能選哪些印記；
//   移動與旅行時可能遇到主人的突發事件：主角從三種回應選一個，或自己輸入回應交給 AI 判定。

import { mod, proficiency, snapshot } from './character'
import { contractDef, locationById, regionById, slaveryRules, type ContractDef, type MasterEventDef } from './data'
import { applyEffects, type RewardEffect } from './effects'
import { currentArea, currentCell } from './grid'
import { generateNpc, registerNpc } from './npcs'
import { addAffinity, enslavePlayer, isBound, pcOf, punish } from './party'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newGame, newReportId, withRng } from './state'
import type { ContractRef, GameState, GameTime, MarkTerms, NpcRecord, PendingMasterEvent, Report } from './types'
import type { Degree } from './data'

// ---- 印記條款 ----

export function termsFromTemplate(kind: string): MarkTerms {
  const d: ContractDef = contractDef(kind)
  return {
    name: d.name,
    mark: d.mark,
    income_share: d.income_share,
    negotiate_dc: d.negotiate_dc,
    escape_dc: d.escape_dc,
    exit_dc: d.exit_dc,
    recapture_chance: d.recapture_chance,
    escape_hp_ratio: d.escape_effects.hp_ratio,
    obedience_penalty: d.obedience_penalty,
    side_effects: [...d.side_effects],
    functions: [...d.functions],
    ...(d.spell_cap !== undefined ? { spell_cap: d.spell_cap } : {}),
  }
}

/** 契約實際的條款：刻印時決定的版本，或模板 */
export function contractTerms(c: Pick<ContractRef, 'kind' | 'terms'>): MarkTerms {
  return c.terms ?? termsFromTemplate(c.kind)
}

/** 自訂印記：文字截斷、數值夾在範圍內；功能依數值推得 */
export function sanitizeTerms(raw: Partial<MarkTerms>, base: MarkTerms = termsFromTemplate('labor')): MarkTerms {
  const r = slaveryRules.custom_mark
  const num = (k: keyof typeof r & keyof MarkTerms, round: boolean) => {
    const range = r[k] as [number, number]
    const v = Number(raw[k] ?? base[k])
    const x = Number.isFinite(v) ? Math.max(range[0], Math.min(range[1], v)) : (base[k] as number)
    return round ? Math.round(x) : Math.round(x * 100) / 100
  }
  const text = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
  const terms: MarkTerms = {
    name: text(raw.name, r.name_chars) || base.name,
    mark: text(raw.mark, r.mark_chars) || base.mark,
    income_share: num('income_share', false),
    negotiate_dc: num('negotiate_dc', true),
    escape_dc: num('escape_dc', true),
    exit_dc: num('exit_dc', true),
    recapture_chance: num('recapture_chance', false),
    escape_hp_ratio: num('escape_hp_ratio', false),
    obedience_penalty: num('obedience_penalty', true),
    side_effects: (Array.isArray(raw.side_effects) ? raw.side_effects : base.side_effects)
      .map((s) => text(s, r.side_effect_chars)).filter(Boolean).slice(0, r.side_effects),
    functions: [],
  }
  terms.functions = [
    'identity', 'obedience',
    ...(terms.income_share > 0 ? ['income'] : []),
    ...(terms.recapture_chance > 0 ? ['tracking'] : []),
    ...(terms.escape_hp_ratio >= 0.3 ? ['tether'] : []),
    ...(base.spell_cap !== undefined && raw.spell_cap !== undefined ? ['spell_seal'] : []),
  ]
  if (terms.functions.includes('spell_seal')) terms.spell_cap = Math.max(0, Math.min(9, Math.round(Number(raw.spell_cap))))
  return terms
}

/** 印記的選擇：模板 id，或自訂的條款 */
export type MarkChoice = string | Partial<MarkTerms>

/** 建立契約（主人可以是空字串＝無主） */
export function makeContract(choice: MarkChoice, master: string, masterName: string, time: GameTime): ContractRef {
  const kind = typeof choice === 'string' ? choice : 'custom'
  const terms = typeof choice === 'string' ? termsFromTemplate(choice) : sanitizeTerms(choice)
  return { kind, master, masterName, obedience: terms.obedience_penalty, since: { ...time }, ...(kind === 'custom' ? { terms } : {}) }
}

/** 給 AI 與畫面的印記說明 */
export function markSummary(c: ContractRef): string {
  const t = contractTerms(c)
  const pct = (n: number) => `${Math.round(n * 100)}%`
  return [
    `${t.name}（主人：${c.masterName || '無主'}）`,
    `印記：${t.mark}`,
    `收益歸主人 ${pct(t.income_share)}・談判 DC ${t.negotiate_dc}・逃離 DC ${t.escape_dc}・出城 DC ${t.exit_dc}・逃亡時被找到 ${pct(t.recapture_chance)}・逃離反噬 ${pct(t.escape_hp_ratio)} 生命值・服從懲罰 -${c.obedience}`,
    t.side_effects.length ? `副作用：${t.side_effects.join('；')}` : '',
  ].filter(Boolean).join('\n')
}

// ---- 建立角色時的主人 ----

/**
 * 建立角色時可以選的主人：依出生地生成幾位（不影響之後的遊戲）。
 * 主人會帶著主角一起行動、一起戰鬥，所以都是冒險者，身分用標籤區分（貴族、神官、惡人……）。
 */
export function masterCandidates(birthplace: string, seed: number, count = 4): NpcRecord[] {
  const tmp = newGame({ name: '_', race: 'human', classId: 'fighter', seed, birthplace })
  const loc = locationById(birthplace)
  const tags = [['noble'], ['traveler'], ['priest'], ['villain']]
  return withRng(tmp, (rng) => tags.slice(0, count).map((t, i) => generateNpc(tmp, rng, {
    id: `mst_start_${i + 1}`, kind: 'adventurer', tags: t, level: rng.int(3, 8), location: loc.id,
    ...(loc.faction ? { faction: loc.faction } : {}),
  }, 'mst')))
}

/** 自訂的主人 */
export interface MasterSpec {
  name: string
  gender?: string
  race?: string
  class?: string
  level?: number
  personality?: string
  appearance?: string
  background?: string
}

/** 建立角色時以奴隸身分開始：主人（生成的候選人、自訂或無主）與印記 */
export interface SlaveStart {
  master: { type: 'none' } | { type: 'candidate'; rec: NpcRecord } | { type: 'custom'; spec: MasterSpec }
  mark: MarkChoice
}

export function startAsSlave(state: GameState, s: SlaveStart): Report {
  let master: NpcRecord | null = null
  if (s.master.type === 'candidate') {
    master = registerNpc(state, { ...s.master.rec, location: state.location })
  } else if (s.master.type === 'custom') {
    const spec = s.master.spec
    master = withRng(state, (rng) => generateNpc(state, rng, {
      kind: 'adventurer', location: state.location, level: Math.max(1, Math.min(20, Math.round(spec.level ?? 5))),
      ...(spec.name?.trim() ? { name: spec.name.trim().slice(0, 12) } : {}),
      ...(spec.gender ? { gender: spec.gender } : {}),
      ...(spec.race ? { race: spec.race } : {}),
      ...(spec.class ? { class: spec.class } : {}),
      ...(spec.personality?.trim() ? { personality: spec.personality.trim().slice(0, 120) } : {}),
      ...(spec.appearance?.trim() ? { appearance: spec.appearance.trim().slice(0, 200) } : {}),
      ...(spec.background?.trim() ? { background: spec.background.trim().slice(0, 200) } : {}),
    }, 'mst'))
  }
  const pc = pcOf(state)
  const loc = locationById(state.location)
  const start = { ...state.time }
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'social',
    time: { start, end: start },
    location: { at: state.location, region: loc.region, scene: loc.name },
    party: [],
    outcome: { result: 'neutral', summary: '' },
    changes: {},
    narration: { pov: 'second_person', length: 'medium', focus: ['主角身為奴隸的處境', '頸上的契約印記'] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  enslavePlayer(state, master, s.mark, report)
  if (master && state.relationships?.[master.id]) state.relationships[master.id]!.toPlayer = '主角的主人。'
  report.party = state.party.map((m) => snapshot(m, undefined, pc))
  const t = contractTerms(pc.contract!)
  report.outcome = {
    result: 'neutral',
    summary: master
      ? `你是${master.name}的奴隸，頸上刻著${t.name}：${t.mark}`
      : `你頸上刻著${t.name}：${t.mark}——但你的主人已經不在了，沒有人能命令你，印記卻還在。`,
    tags: ['奴隸出身'],
  }
  return commitReport(state, report)
}

// ---- 出城、旅行前請求主人同意 ----

/** 主角被主人帶著時，現在能不能出城：今天已經同意就可以 */
export function masterAllows(state: GameState): boolean {
  if (!isBound(state)) return true
  if (currentArea(state).kind !== 'settlement') return true
  return state.masterPass?.[state.location] === state.time.day
}

export function masterRefusedToday(state: GameState): boolean {
  return state.masterRefuse?.[state.location] === state.time.day
}

/** 出城前檢查：需要主人同意時丟出說明 */
export function assertMasterAllows(state: GameState) {
  if (masterAllows(state)) return
  const name = pcOf(state).contract!.masterName
  if (masterRefusedToday(state)) throw new Error(`${name}今天不准你離開這座城。`)
  throw new Error(`身為奴隸，出城前要先請求${name}同意（在主動行動裡「請求主人同意」）。`)
}

export function permitDc(state: GameState): number {
  const c = pcOf(state).contract!
  const aff = state.relationships?.[c.master]?.affinity ?? 0
  return contractTerms(c).exit_dc + c.obedience - Math.floor(aff / slaveryRules.master_permit.affinity_step)
}

export function setupPermit(state: GameState) {
  if (!isBound(state)) throw new Error('你不是被主人帶著的奴隸')
  if (currentArea(state).kind !== 'settlement') throw new Error('只有要出城時才需要主人同意')
  if (masterAllows(state)) throw new Error('主人今天已經同意你出城了')
  if (masterRefusedToday(state)) throw new Error('主人今天已經拒絕了，明天再問')
  const c = pcOf(state).contract!
  return {
    dc: permitDc(state), targetName: c.masterName, situational: [], scene: `${locationById(state.location).name}・向主人請求出城`,
    outcomes: {
      critical: '主人爽快答應（親密度 +2）', success: '主人同意今天出城', partial: '主人勉強同意，但要你早去早回',
      fail: '主人不准，今天不能出城', fumble: '主人不准，還覺得你想逃（輕度懲罰）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyPermit(state: GameState, report: Report, degree: Degree): string {
  const c = pcOf(state).contract!
  const day = state.time.day
  if (degree === 'critical' || degree === 'success' || degree === 'partial') {
    ;(state.masterPass ??= {})[state.location] = day
    if (degree === 'critical') addAffinity(state, report, c.master, 2, '主人心情不錯')
    return degree === 'partial' ? `${c.masterName}勉強點了頭。` : `${c.masterName}同意了。`
  }
  ;(state.masterRefuse ??= {})[state.location] = day
  if (degree === 'fumble') return `${c.masterName}起了疑心。${punish(state, 'light', report)}`
  return `${c.masterName}不准你出城。`
}

// ---- 成為奴隸時的刻印 ----

/** 成為奴隸後：等待刻印的檢定（主人原本打算的印記先刻上） */
export function startMarking(state: GameState, intended: string) {
  state.pendingMark = { intended }
}

export function setupMarking(state: GameState) {
  const pm = state.pendingMark
  if (!pm || pm.rolled) throw new Error('現在沒有在刻印')
  const c = pcOf(state).contract!
  const master = state.party.find((m) => m.id === c.master)
  const sev = slaveryRules.marking.severity
  const heavier = sev[Math.min(sev.length - 1, sev.indexOf(pm.intended) + 1)]!
  return {
    dc: slaveryRules.marking.base + Math.floor((master?.level ?? 1) / 2), targetName: c.masterName, situational: [],
    scene: `${locationById(state.location).name}・刻下契約印記`,
    outcomes: {
      critical: '可以自己選印記，甚至自訂', success: `可以選${contractDef(pm.intended).name}或更輕的印記`,
      partial: `刻上${contractDef(pm.intended).name}`, fail: `主人改用更重的${contractDef(heavier).name}`,
      fumble: `刻上最重的${contractDef(sev.at(-1)!).name}，服從懲罰 +1`,
    } as Partial<Record<Degree, string>>,
  }
}

export function applyMarking(state: GameState, degree: Degree): string {
  const pm = state.pendingMark
  if (!pm) return ''
  const sev = slaveryRules.marking.severity
  const i = Math.max(0, sev.indexOf(pm.intended))
  pm.rolled = true
  switch (degree) {
    case 'critical':
      pm.allowed = [...sev]
      pm.custom = true
      return '刻印的人被你說動了，讓你自己決定印記的樣子。'
    case 'success':
      pm.allowed = sev.slice(0, i + 1)
      return '你爭取到選擇印記的餘地。'
    case 'partial':
      pm.allowed = [pm.intended]
      return '主人照原本的打算刻印。'
    case 'fail':
      pm.allowed = [sev[Math.min(sev.length - 1, i + 1)]!]
      return '主人被惹惱了，改用更重的印記。'
    case 'fumble': {
      pm.allowed = [sev.at(-1)!]
      const c = pcOf(state).contract
      if (c) c.obedience = Math.min(slaveryRules.freedom.obedience_max, c.obedience + 1)
      return '主人勃然大怒，刻下最重的印記。'
    }
  }
}

/** 選定印記：換掉暫時刻上的印記。可以帶上 AI 依行為提議的名稱與描述（數值依模板） */
export function chooseMark(state: GameState, choice: MarkChoice): Report {
  const pm = state.pendingMark
  if (!pm?.rolled || !pm.allowed?.length) throw new Error('還沒有進行刻印的檢定')
  if (typeof choice === 'string' && !pm.allowed.includes(choice)) throw new Error('不能選這個印記')
  if (typeof choice !== 'string' && !pm.custom) throw new Error('不能自訂印記')
  const pc = pcOf(state)
  const old = pc.contract!
  const next = makeContract(choice, old.master, old.masterName, old.since)
  // 刻印前後受罰加重的服從懲罰保留
  next.obedience = Math.min(slaveryRules.freedom.obedience_max, next.obedience + Math.max(0, old.obedience - contractTerms(old).obedience_penalty))
  if (typeof choice === 'string' && pm.suggestion && (pm.suggestion.name || pm.suggestion.mark)) {
    const t = termsFromTemplate(choice)
    next.terms = { ...t, ...(pm.suggestion.name ? { name: pm.suggestion.name } : {}), ...(pm.suggestion.mark ? { mark: pm.suggestion.mark } : {}) }
  }
  pc.contract = next
  delete state.pendingMark
  const loc = locationById(state.location)
  const start = { ...state.time }
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'social',
    time: { start, end: addHours(start, 0.5) },
    location: { at: state.location, region: loc.region, scene: `${loc.name}・刻下契約印記` },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'neutral', summary: `頸上刻下了${contractTerms(next).name}：${contractTerms(next).mark}`, tags: ['契約印記'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short', focus: ['印記刻下的過程與感覺'] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  return commitReport(state, report)
}

// ---- 主人的突發事件 ----

function hoursOf(t: GameTime): number {
  return t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60
}

/** 移動或旅行之後：被主人帶著時，可能發生主人的突發事件（等待主角回應） */
export interface MasterEventOptions {
  /** 允許成人向事件（設定的「成人向」） */
  adult?: boolean
}

export function maybeMasterEvent(state: GameState, chance: number, opts: MasterEventOptions = {}): PendingMasterEvent | undefined {
  if (!isBound(state) || state.combat || state.pendingAction || state.standoff || state.pendingMark || state.pendingMasterEvent) return undefined
  const ev = slaveryRules.master_events
  const now = hoursOf(state.time)
  if (state.lastMasterEvent !== undefined && now - state.lastMasterEvent < ev.cooldown_hours) return undefined
  const events = ev.events.filter((e) => opts.adult || !e.adult)
  const picked = withRng(state, (rng) => (rng.chance(chance) ? pickEvent(rng, events) : undefined))
  if (!picked) return undefined
  return startMasterEvent(state, picked)
}

export function startMasterEvent(state: GameState, e: MasterEventDef): PendingMasterEvent {
  state.lastMasterEvent = hoursOf(state.time)
  state.pendingMasterEvent = { id: e.id, text: withMaster(state, e.text) }
  return state.pendingMasterEvent
}

function pickEvent(rng: Rng, list: MasterEventDef[]): MasterEventDef {
  let r = rng.next() * list.reduce((s, e) => s + e.weight, 0)
  for (const e of list) {
    r -= e.weight
    if (r < 0) return e
  }
  return list[list.length - 1]!
}

/** 把事件的效果裡的 master 換成主人的 id */
function forMaster(effects: RewardEffect[] | undefined, master: string): RewardEffect[] {
  return (effects ?? []).map((e) => ('npc' in e && e.npc === 'master' ? { ...e, npc: master } : e) as RewardEffect)
}

function withMaster(state: GameState, s: string): string {
  return s.split('{master}').join(pcOf(state).contract?.masterName ?? '主人')
}

/** 等待回應的事件定義 */
export function pendingEventDef(state: GameState): MasterEventDef {
  const pm = state.pendingMasterEvent
  const e = pm && slaveryRules.master_events.events.find((x) => x.id === pm.id)
  if (!e) throw new Error('現在沒有主人的要求')
  return e
}

/** 錢不夠時只花得起手上的 */
function affordable(state: GameState, effects: RewardEffect[]): RewardEffect[] {
  return effects
    .map((x) => (x.type === 'money' && x.amount < 0 ? { ...x, amount: -Math.min(-x.amount, state.money_cc) } : x))
    .filter((x) => x.type !== 'money' || x.amount !== 0)
}

/** 從三個回應裡選一個：有檢定的依規則擲骰 */
export function answerMasterEvent(state: GameState, index: number): Report {
  const e = pendingEventDef(state)
  const o = e.options[index]
  if (!o) throw new Error('沒有這個選項')
  const pc = pcOf(state)
  const c = pc.contract!
  const area = currentArea(state)
  const loc = locationById(area.location)
  const start = { ...state.time }
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, o.hours ?? e.hours) },
    location: { at: area.location, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'neutral', summary: `${state.pendingMasterEvent!.text}你選擇${o.label}。`, tags: ['主人'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short', focus: [`${c.masterName}的突發要求`, `主角的回應：${o.label}`] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  let effects = forMaster(o.effects, c.master)
  if (o.check) {
    const dice = withBonus('1d20', mod(pc.attrs[o.check.attr]) + proficiency(pc.level))
    const r = withRng(state, (rng) => roll(rng, dice))
    const ok = r.total >= o.check.dc
    report.timeline = [{ seq: 1, time: start, actor: 'pc', action: o.label, roll: { dice, value: r.total, dc: o.check.dc }, result: ok ? 'success' : 'fail' }]
    effects = [...effects, ...forMaster(ok ? o.effects_success : o.fail_effects, c.master)]
    report.outcome.result = ok ? 'success' : 'failure'
    const after = ok ? o.success : o.fail
    if (after) report.outcome.summary += withMaster(state, after)
  } else if (o.result) {
    report.outcome.summary += withMaster(state, o.result)
  }
  delete state.pendingMasterEvent
  const notes = applyEffects(state, report, affordable(state, effects))
  if (notes.length) report.outcome.summary += notes.join('，') + '。'
  return commitReport(state, report)
}

/** 自己輸入回應（主動行動 master_event） */
export function setupMasterEvent(state: GameState) {
  const e = pendingEventDef(state)
  const c = pcOf(state).contract!
  return {
    dc: e.free_dc ?? slaveryRules.master_events.free_dc, targetName: c.masterName, situational: [],
    scene: `${currentArea(state).name}・${state.pendingMasterEvent!.text}`,
    outcomes: {
      critical: '主人很滿意（親密度 +3）', success: '應付過去（親密度 +1）', partial: '勉強過關',
      fail: '惹主人不快（親密度 -2）', fumble: '觸怒主人（親密度 -4，挨打）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyMasterEventResponse(state: GameState) {
  delete state.pendingMasterEvent
}

/** 沒有 AI 判定時，自己輸入的回應依成功程度的效果 */
export function masterEventDefaults(state: GameState, report: Report, degree: Degree): string[] {
  const c = pcOf(state).contract
  if (!c?.master) return []
  return applyEffects(state, report, affordable(state, forMaster(slaveryRules.master_events.free_outcomes[degree], c.master)))
}

/** 談判只能在安全的地方（旅店、安全房、神殿） */
export function atSafeSpot(state: GameState): boolean {
  return slaveryRules.safe_spots.includes(currentCell(state).kind)
}
