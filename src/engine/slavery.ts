// 奴隸契約印記與主角身為奴隸時的規則（見 docs/COMPANIONS.md 第 3、4 節，規則在 data/rules/slavery.json）。
//
// - 印記是一份「條款」：名稱、描述與數值（收益率、談判／逃離／出城 DC、被找到的機率、逃離反噬、服從懲罰）。
//   模板在 slavery.json 的 contracts；建立角色或買奴隸時也可以自訂，數值夾在 custom_mark 的範圍內。
// - 主角身為奴隸：出城、旅行前要主人同意（檢定依印記的 exit_dc）；成為奴隸時有刻印檢定，結果決定能選哪些印記；
//   移動與旅行時可能遇到主人的突發事件：主角從三種回應選一個，或自己輸入回應交給 AI 判定。

import { checkModifiers, modifierNote } from './perks'
import { attrOf, lifeTier, mod, proficiency, snapshot } from './character'
import { contractDef, locationById, regionById, slaveryRules, tagDef, type AttrId, type ContractDef, type ContractFunction, type MasterEventDef, type UnmarkServiceDef } from './data'
import { isMadam, nearBrothel } from './brothel'
import { adultContent, adultScene, safeText, tagsAllowed } from './content'
import { addTattoo, contractOf, freePlaces, isTattooPlace, placeName, setContract, tattooAt, tattooName, tattoosOf } from './tattoos'
import { reputationOf } from './security'
import { forcedGearPool } from './forcedGear'
import { applyEffects, type RewardEffect } from './effects'
import { formatMoney } from './money'
import { currentArea, currentCell, getArea } from './grid'
import { generateNpc, npcKind, npcRecord, registerNpc, weightedPick } from './npcs'
import {
  addAffinity, changeMaster, enslavePlayer, freePlayer, isBound, isEnslaved, isFugitive, pcOf, punish, recapturePlayer, setHp,
} from './party'
import { areaOf, isHostile, nearbyPeople, presentHere } from './population'
import { addStrict, atMasterHome, extendDeadline, overdueChance, sendToMasterHome, strictPoints, syncMasterHome } from './masterHome'
import { ensureRelationship } from './social'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newGame, newReportId, withRng } from './state'
import type { ContractRef, GameState, GameTime, MarkTerms, NpcRecord, PendingMasterEvent, Report, Tattoo, TattooPlace } from './types'
import type { Degree, NpcKind } from './data'
import { gameRule } from './gameRules'

// ---- 印記條款 ----

/** 印記模板的 id：沒有這個模板時（例如自訂內容刪掉了）用預設的（slavery.json 的 roles.default） */
export function contractKind(kind: string): string {
  return slaveryRules.contracts[kind] ? kind : slaveryRules.roles.default
}

/** 依數值推得的功能：身分標示與服從一定有；收益比例 > 0 有收益歸屬、被找到 > 0 有追蹤、反噬 ≥ 30% 有距離束縛、有法術環上限有魔力封印 */
export function deriveFunctions(t: Omit<MarkTerms, 'functions'>): ContractFunction[] {
  return [
    'identity', 'obedience',
    ...(t.income_share > 0 ? ['income' as const] : []),
    ...(t.recapture_chance > 0 ? ['tracking' as const] : []),
    ...(t.escape_hp_ratio >= 0.3 ? ['tether' as const] : []),
    ...(t.spell_cap !== undefined ? ['spell_seal' as const] : []),
  ]
}

/** 模板的條款（原始文字，不依成人向開關替換；顯示時由 contractTerms 處理） */
export function termsFromTemplate(kind: string): MarkTerms {
  const d: ContractDef = slaveryRules.contracts[contractKind(kind)]!
  const t: Omit<MarkTerms, 'functions'> = {
    name: d.name,
    mark: d.mark,
    place: isTattooPlace(d.place) ? d.place : 'neck',
    income_share: d.income_share,
    negotiate_dc: d.negotiate_dc,
    escape_dc: d.escape_dc,
    exit_dc: d.exit_dc,
    recapture_chance: d.recapture_chance,
    escape_hp_ratio: d.escape_effects.hp_ratio,
    obedience_penalty: d.obedience_penalty,
    side_effects: [...d.side_effects],
    ...(d.spell_cap !== undefined ? { spell_cap: d.spell_cap } : {}),
  }
  return { ...t, functions: deriveFunctions(t) }
}

/** 模板的條款，給畫面顯示（關閉成人向時文字換成一般用語） */
export function templateTerms(kind: string): MarkTerms {
  return contractTerms({ terms: termsFromTemplate(kind) })
}

/** 契約的條款（刻印時存的那一份）；關閉成人向時文字換成一般用語 */
export function contractTerms(c: Pick<ContractRef, 'terms'>): MarkTerms {
  const t = c.terms
  return adultContent() ? t : { ...t, name: safeText(t.name), mark: safeText(t.mark), side_effects: t.side_effects.map(safeText) }
}

/** 自訂印記：文字截斷、數值夾在範圍內；功能依數值推得。魔力封印只有從有封印的模板改起、而且有給上限時才有 */
export function sanitizeTerms(raw: Partial<MarkTerms>, base: MarkTerms = termsFromTemplate(slaveryRules.roles.default)): MarkTerms {
  const r = slaveryRules.custom_mark
  const num = (k: keyof typeof r & keyof MarkTerms, round: boolean) => {
    const range = r[k] as [number, number]
    const v = Number(raw[k] ?? base[k])
    const x = Number.isFinite(v) ? Math.max(range[0], Math.min(range[1], v)) : (base[k] as number)
    return round ? Math.round(x) : Math.round(x * 100) / 100
  }
  const text = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
  const sealed = base.spell_cap !== undefined && raw.spell_cap !== undefined && Number.isFinite(Number(raw.spell_cap))
  const terms: Omit<MarkTerms, 'functions'> = {
    name: text(raw.name, r.name_chars) || base.name,
    mark: text(raw.mark, r.mark_chars) || base.mark,
    place: isTattooPlace(raw.place) ? raw.place : base.place,
    income_share: num('income_share', false),
    negotiate_dc: num('negotiate_dc', true),
    escape_dc: num('escape_dc', true),
    exit_dc: num('exit_dc', true),
    recapture_chance: num('recapture_chance', false),
    escape_hp_ratio: num('escape_hp_ratio', false),
    obedience_penalty: num('obedience_penalty', true),
    side_effects: (Array.isArray(raw.side_effects) ? raw.side_effects : base.side_effects)
      .map((s) => text(s, r.side_effect_chars)).filter(Boolean).slice(0, r.side_effects),
    ...(sealed ? { spell_cap: Math.max(0, Math.min(9, Math.round(Number(raw.spell_cap)))) } : {}),
  }
  return { ...terms, functions: deriveFunctions(terms) }
}

/** 印記的選擇：模板 id，或自訂的條款 */
export type MarkChoice = string | Partial<MarkTerms>

/** 建立契約（主人可以是空字串＝無主） */
export function makeContract(choice: MarkChoice, master: string, masterName: string, time: GameTime): ContractRef {
  const kind = typeof choice === 'string' ? contractKind(choice) : 'custom'
  const terms = typeof choice === 'string' ? termsFromTemplate(kind) : sanitizeTerms(choice)
  return { kind, master, masterName, obedience: terms.obedience_penalty, since: { ...time }, terms }
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
export function masterCandidates(birthplace: string, seed: number, count = 5): NpcRecord[] {
  const tmp = newGame({ name: '_', race: 'human', classId: 'fighter', seed, birthplace })
  const loc = locationById(birthplace)
  const tags = [['noble'], ['traveler'], ['priest'], ['villain'], ['good']]
  return withRng(tmp, (rng) => tags.slice(0, count).map((t, i) => generateNpc(tmp, rng, {
    id: `mst_start_${i + 1}`, kind: 'adventurer', tags: t, level: rng.int(3, 8), location: loc.id,
    ...(loc.faction ? { faction: loc.faction } : {}),
  }, 'mst')))
}

/** 主人可以有的身分標籤（slavery.json 的 master_tags） */
export function masterTagIds(): string[] {
  return Object.keys(slaveryRules.master_tags.tags)
}

/**
 * 隨機生成一位主人（特殊任務的「隨機的主人」）：在目前的地點、比主角高 1～4 級。
 * tag 指定身分（不寫＝依公開市場出價的權重抽）；娼妓標籤是老鴇（店主兼娼妓）。
 */
export function randomMaster(state: GameState, tag?: string): NpcRecord {
  const t = slaveryRules.master_tags
  const pc = pcOf(state)
  return withRng(state, (rng) => {
    const picked = tag && t.tags[tag] ? tag : weightedPick(rng, Object.fromEntries(Object.entries(t.tags).map(([id, x]) => [id, x.public])))
    const kinds = (tagDef(picked)?.kinds ?? ['adventurer']) as NpcKind[]
    const kind = weightedPick(rng, Object.fromEntries(kinds.map((k) => [k, t.kinds[k].market]))) as NpcKind
    const madam = picked === 'prostitute'
    return registerNpc(state, generateNpc(state, rng, {
      level: Math.min(20, pc.level + rng.int(1, 4)), kind, location: state.location,
      tags: madam ? ['prostitute', 'merchant'] : [picked], ...(madam ? { occupation: '老鴇' } : {}),
    }, 'mst'))
  })
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
  /** 身分：冒險者（有職業、一起戰鬥）或普通人（沒有職業、同行但不戰鬥）；不寫是冒險者 */
  kind?: NpcKind
  /** 身分標籤（slavery.json 的 master_tags：貴族、商人、惡人……） */
  tags?: string[]
  /** 普通人的職業描述（例如「酒館老闆」） */
  occupation?: string
}

/** 整理自訂主人的身分與標籤：只收主人可以有的標籤（不能是奴隸），最多 3 個 */
export function masterSpecIdentity(spec: Pick<MasterSpec, 'kind' | 'tags' | 'occupation'>): { kind: NpcKind; tags: string[]; occupation?: string } {
  const kind: NpcKind = spec.kind === 'commoner' ? 'commoner' : 'adventurer'
  const allowed = masterTagIds()
  const tags = [...new Set((spec.tags ?? []).filter((t) => allowed.includes(t)))].slice(0, 3)
  const occupation = kind === 'commoner' ? spec.occupation?.trim().slice(0, 12) : undefined
  return { kind, tags, ...(occupation ? { occupation } : {}) }
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
    const id = masterSpecIdentity(spec)
    master = withRng(state, (rng) => generateNpc(state, rng, {
      kind: id.kind, location: state.location, level: Math.max(1, Math.min(20, Math.round(spec.level ?? 5))),
      ...(id.tags.length ? { tags: id.tags } : {}),
      ...(id.occupation ? { occupation: id.occupation } : {}),
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
    narration: { pov: 'second_person', length: 'medium', focus: ['主角身為奴隸的處境', '身上的契約印記'] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  enslavePlayer(state, master, s.mark, report)
  if (master && state.relationships?.[master.id]) state.relationships[master.id]!.toPlayer = '主角的主人。'
  report.party = state.party.map((m) => snapshot(m, undefined, pc))
  const t = contractTerms(contractOf(pc)!)
  report.outcome = {
    result: 'neutral',
    summary: master
      ? `你是${master.name}的奴隸，${placeName(t.place)}刻著${t.name}：${t.mark}`
      : `你的${placeName(t.place)}刻著${t.name}：${t.mark}——但你的主人已經不在了，沒有人能命令你，印記卻還在。`,
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
  const name = contractOf(pcOf(state))!.masterName
  if (masterRefusedToday(state)) throw new Error(`${name}今天不准你離開這座城。`)
  throw new Error(`身為奴隸，出城前要先請求${name}同意（工具列的「契約」→「請求主人同意出城」）。`)
}

export function permitDc(state: GameState): number {
  const c = contractOf(pcOf(state))!
  const aff = state.relationships?.[c.master]?.affinity ?? 0
  return contractTerms(c).exit_dc + c.obedience + strictPoints(state) - Math.floor(aff / slaveryRules.master_permit.affinity_step)
}

export function setupPermit(state: GameState) {
  if (!isBound(state)) throw new Error('你不是被主人帶著的奴隸')
  if (currentArea(state).kind !== 'settlement') throw new Error('只有要出城時才需要主人同意')
  if (masterAllows(state)) throw new Error('主人今天已經同意你出城了')
  if (masterRefusedToday(state)) throw new Error('主人今天已經拒絕了，明天再問')
  const c = contractOf(pcOf(state))!
  return {
    dc: permitDc(state), targetName: c.masterName, situational: [], scene: `${locationById(state.location).name}・向主人請求出城`,
    outcomes: {
      critical: '主人爽快答應（親密度 +2）', success: '主人同意今天出城', partial: '主人勉強同意，但要你早去早回',
      fail: '主人不准，今天不能出城', fumble: '主人不准，還覺得你想逃（輕度懲罰）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyPermit(state: GameState, report: Report, degree: Degree): string {
  const c = contractOf(pcOf(state))!
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
  const c = contractOf(pcOf(state))!
  const master = state.party.find((m) => m.id === c.master)
  const sev = slaveryRules.marking.severity
  const heavier = sev[Math.min(sev.length - 1, sev.indexOf(pm.intended) + 1)]!
  const dc = slaveryRules.marking.base + Math.floor((master?.level ?? 1) / 2)
  const scene = `${locationById(state.location).name}・刻下契約印記`
  // 不在輕重順序裡的印記（例如老鴇的娼妓契約）：主人只會刻這一種，表現好可以換成最輕的
  if (!sev.includes(pm.intended)) {
    const name = contractDef(pm.intended).name
    return {
      dc, targetName: c.masterName, situational: [], scene,
      outcomes: {
        critical: '可以自己選印記，甚至自訂', success: `可以選${name}或${contractDef(sev[0]!).name}`,
        partial: `刻上${name}`, fail: `刻上${name}`, fumble: `刻上${name}，服從懲罰 +1`,
      } as Partial<Record<Degree, string>>,
    }
  }
  return {
    dc, targetName: c.masterName, situational: [], scene,
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
  if (!sev.includes(pm.intended)) {
    pm.allowed = degree === 'critical' ? [...sev, pm.intended] : degree === 'success' ? [pm.intended, sev[0]!] : [pm.intended]
    if (degree === 'critical') pm.custom = true
    if (degree === 'fumble') {
      const c = contractOf(pcOf(state))
      if (c) c.obedience = Math.min(slaveryRules.freedom.obedience_max, c.obedience + 1)
    }
    return { critical: '刻印的人被你說動了，讓你自己決定印記的樣子。', success: '你爭取到選擇印記的餘地。', partial: '主人照原本的打算刻印。', fail: '主人照原本的打算刻印。', fumble: '主人勃然大怒，下手更重。' }[degree]
  }
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
      const c = contractOf(pcOf(state))
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
  const old = contractOf(pc)!
  const next = makeContract(choice, old.master, old.masterName, old.since)
  // 刻印前後受罰加重的服從懲罰保留
  next.obedience = Math.min(slaveryRules.freedom.obedience_max, next.obedience + Math.max(0, old.obedience - contractTerms(old).obedience_penalty))
  if (typeof choice === 'string' && pm.suggestion && (pm.suggestion.name || pm.suggestion.mark)) {
    const t = termsFromTemplate(choice)
    next.terms = { ...t, ...(pm.suggestion.name ? { name: pm.suggestion.name } : {}), ...(pm.suggestion.mark ? { mark: pm.suggestion.mark } : {}) }
  }
  setContract(pc, next, state.time, old.masterName)
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
    outcome: { result: 'neutral', summary: `${placeName(next.terms.place)}刻下了${contractTerms(next).name}：${contractTerms(next).mark}`, tags: ['契約印記'] },
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
  if (!isBound(state) || state.combat || state.pendingAction || state.standoff || state.pendingMark || state.pendingMasterEvent || state.dungeonEvent || state.parasiteEvent) return undefined
  // 主人不在身邊（戰敗時逃開了）時沒有突發事件
  const master = state.party.find((m) => m.id === contractOf(pcOf(state))!.master)
  if (!master || master.status.includes('away')) return undefined
  const ev = slaveryRules.master_events
  const now = hoursOf(state.time)
  if (state.lastMasterEvent !== undefined && now - state.lastMasterEvent < ev.cooldown_hours) return undefined
  // 主人的家（舊存檔第一次走動時建立）
  syncMasterHome(state)
  // 主人的標籤在 NPC 登錄裡
  const rec = npcRecord(state, master.id) ?? { id: master.id }
  // 主人的性邀約與被推進娼館接客都算「主角非自願」：設定裡關掉時不發生
  const unwilling = tagsAllowed(['pc_unwilling'])
  const events = ev.events.filter((e) => (!e.adult || (opts.adult && unwilling)) && (e.cell !== 'brothel' || unwilling) && eventFits(state, rec, e))
  // 離家太久：主人想回家（逾期越久越容易），先擲
  const overdue = events.filter((e) => e.overdue)
  const home = overdueChance(state)
  // 經過特定設施（娼館）時的事件：有自己的機率，先擲；沒發生才擲一般的事件
  const local = events.filter((e) => e.cell === 'brothel' && nearBrothel(state))
  const general = events.filter((e) => !e.cell && !e.overdue)
  const picked = withRng(state, (rng) => (overdue.length && rng.chance(home) ? pickEvent(rng, overdue) : undefined)
    ?? local.find((e) => rng.chance(e.chance ?? 0))
    ?? (general.length && rng.chance(Math.min(1, chance * gameRule(state, 'masterEventMult'))) ? pickEvent(rng, general) : undefined))
  if (!picked) return undefined
  return startMasterEvent(state, picked)
}

/** 事件的條件：主人的親密度、標籤、在不在主人的家裡 */
export function eventFits(state: GameState, master: Pick<NpcRecord, 'id' | 'tags'>, e: MasterEventDef): boolean {
  const aff = state.relationships?.[master.id]?.affinity ?? 0
  if (e.affinity_min !== undefined && aff < e.affinity_min) return false
  if (e.affinity_max !== undefined && aff > e.affinity_max) return false
  const tags = master.tags ?? []
  if (e.tags?.length && !e.tags.some((t) => tags.includes(t))) return false
  if (e.tags_none?.some((t) => tags.includes(t))) return false
  if (e.at_home !== undefined && e.at_home !== atMasterHome(state)) return false
  // 主人刺青只刺在空著的部位
  if (e.free_place && !freePlaces(pcOf(state)).length) return false
  // 主人強制裝備：要有這位主人會用、主角還能戴上的東西
  if (e.forced_gear && !forcedGearPool(state, tags).length) return false
  return true
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
/** 事件效果裡的 master 換成主人的 id；刺青的名稱、外觀與刺的人裡的 {master} 換成主人的名字 */
function forMaster(effects: RewardEffect[] | undefined, master: string, masterName = '主人'): RewardEffect[] {
  const sub = (x: string) => x.split('{master}').join(masterName)
  return (effects ?? []).map((e) => {
    if ('npc' in e && e.npc === 'master') return { ...e, npc: master } as RewardEffect
    if (e.type === 'tattoo') return { ...e, ...(e.name ? { name: sub(e.name) } : {}), ...(e.text ? { text: sub(e.text) } : {}), ...(e.by ? { by: sub(e.by) } : {}) }
    return e
  })
}

function withMaster(state: GameState, s: string): string {
  return safeText(s.split('{master}').join(contractOf(pcOf(state))?.masterName ?? '主人'))
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
  const c = contractOf(pc)!
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
    outcome: { result: 'neutral', summary: `${state.pendingMasterEvent!.text}你選擇${safeText(o.label)}。`, tags: ['主人'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short', focus: [`${c.masterName}的突發要求`, `主角的回應：${safeText(o.label)}`] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  let effects = forMaster(o.effects, c.master, c.masterName)
  if (o.check) {
    // 非戰鬥狀態與特質（主人的標籤也算）
    const extra = checkModifiers(pc, { context: 'master_event', attr: o.check.attr, vsTags: npcRecord(state, c.master)?.tags ?? [] })
    const dice = withBonus('1d20', mod(attrOf(pc, o.check.attr)) + proficiency(pc.level) + extra.reduce((s, x) => s + x.value, 0))
    const r = withRng(state, (rng) => roll(rng, dice))
    const ok = r.total >= o.check.dc
    report.timeline = [{ seq: 1, time: start, actor: 'pc', action: `${o.label}${modifierNote(extra)}`, roll: { dice, value: r.total, dc: o.check.dc }, result: ok ? 'success' : 'fail' }]
    effects = [...effects, ...forMaster(ok ? o.effects_success : o.fail_effects, c.master, c.masterName)]
    report.outcome.result = ok ? 'success' : 'failure'
    const after = ok ? o.success : o.fail
    if (after) report.outcome.summary += withMaster(state, after)
  } else if (o.result) {
    report.outcome.summary += withMaster(state, o.result)
  }
  // 成人向：這個回應進入親密場景時，敘事要詳細描寫
  const ok = report.outcome.result === 'success'
  if (adultContent() && e.scene && (o.adult_scene === 'always' || (o.check && o.adult_scene === (ok ? 'success' : 'fail')))) {
    report.narration = { ...report.narration, length: 'medium', adult_scene: withMaster(state, e.scene) }
  }
  delete state.pendingMasterEvent
  const notes = applyEffects(state, report, affordable(state, effects))
  if (notes.length) report.outcome.summary += notes.join('，') + '。'
  return commitReport(state, report)
}

/** 自己輸入回應（主動行動 master_event） */
export function setupMasterEvent(state: GameState) {
  const e = pendingEventDef(state)
  const c = contractOf(pcOf(state))!
  return {
    // 可能進入親密場景的事件：自己描述的回應由 AI 判定是否進入
    ...(e.scene ? adultScene(withMaster(state, e.scene), []) : {}),
    dc: e.free_dc ?? slaveryRules.master_events.free_dc, targetName: c.masterName, situational: [],
    scene: `${currentArea(state).name}・${state.pendingMasterEvent!.text}`,
    outcomes: {
      critical: '主人很滿意（親密度 +3）', success: '應付過去（親密度 +1）', partial: '勉強過關',
      fail: '惹主人不快（親密度 -2）', fumble: '觸怒主人（親密度 -4，挨打）',
    } as Partial<Record<Degree, string>>,
  }
}

/**
 * 自己輸入的回應判定完：結束事件。「主人要回家」事件：成功以上主人多寬限一天，
 * 部分成功乖乖被帶回家，失敗以下被帶回家而且嚴加看管。
 */
export function applyMasterEventResponse(state: GameState, report: Report, degree: Degree): string {
  const e = slaveryRules.master_events.events.find((x) => x.id === state.pendingMasterEvent?.id)
  delete state.pendingMasterEvent
  if (!e?.overdue) return ''
  if (degree === 'critical' || degree === 'success') {
    extendDeadline(state, 24)
    return `${contractOf(pcOf(state))?.masterName ?? '主人'}答應再多待一天。`
  }
  if (degree === 'fail' || degree === 'fumble') addStrict(state, slaveryRules.master_home.strict.overdue)
  return sendToMasterHome(state, report)
}

/** 沒有 AI 判定時，自己輸入的回應依成功程度的效果 */
export function masterEventDefaults(state: GameState, report: Report, degree: Degree): string[] {
  const c = contractOf(pcOf(state))
  if (!c?.master) return []
  return applyEffects(state, report, affordable(state, forMaster(slaveryRules.master_events.free_outcomes[degree], c.master, c.masterName)))
}

// ---- 逃亡之後：找到主人、投靠新主人、解除印記 ----

/** 主角契約上的主人（無主時沒有） */
export function masterOf(state: GameState): NpcRecord | undefined {
  const c = contractOf(pcOf(state))
  return c?.master ? npcRecord(state, c.master) : undefined
}

/** 逃亡奴隸的主人就在身邊（同一格或相鄰） */
export function masterNearby(state: GameState): boolean {
  const rec = masterOf(state)
  return isFugitive(state) && !!rec && !rec.dead && presentHere(state, rec.id)
}

/** 逃亡奴隸的主人今天在哪裡（印記隱約感應得到） */
export function masterWhereabouts(state: GameState): string | undefined {
  const c = contractOf(pcOf(state))
  if (!c?.master || !isFugitive(state)) return undefined
  const rec = npcRecord(state, c.master)
  if (!rec || rec.dead) return `${c.masterName}已經不在人世了。`
  if (presentHere(state, rec.id)) return `${c.masterName}就在你身邊。`
  const key = areaOf(state, rec)
  const locId = key?.split('/')[0] ?? rec.location
  if (locId !== state.location) return `${c.masterName}今天在${locationById(locId).name}。`
  return `${c.masterName}今天就在這座城裡${key ? `的${getArea(state, key).name}` : ''}（在「這裡的人」裡找到他，走到旁邊）。`
}

export function setupReturn(state: GameState) {
  if (!isFugitive(state)) throw new Error('你不是逃亡奴隸')
  const c = contractOf(pcOf(state))!
  if (!masterNearby(state)) throw new Error(`${c.masterName}不在你身邊`)
  const r = slaveryRules.fugitive_master.return
  const aff = state.relationships?.[c.master]?.affinity ?? 0
  return {
    dc: r.base - Math.floor(aff / r.affinity_step), targetName: c.masterName, situational: [],
    scene: `${currentArea(state).name}・回到${c.masterName}身邊`,
    outcomes: {
      critical: '主人收回你，不追究（親密度 +2）', success: '主人收回你，只冷冷看了你一眼（親密度 -2）',
      partial: '主人收回你，輕度懲罰', fail: '主人收回你，嚴厲懲罰', fumble: '主人收回你，嚴厲懲罰，服從懲罰再 +1',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyReturn(state: GameState, report: Report, degree: Degree): string {
  const c = contractOf(pcOf(state))!
  // 主動回去：一樣被帶回主人的家；除了大成功，之後都會被看得緊一點
  const sent = recapturePlayer(state, report, degree === 'critical' ? 0 : slaveryRules.master_home.strict.overdue)
  switch (degree) {
    case 'critical':
      addAffinity(state, report, c.master, 2, '主動回來')
      return `${c.masterName}沒有追究，讓你回到身邊。${sent}`
    case 'success':
      addAffinity(state, report, c.master, -2, '逃跑過')
      return `${c.masterName}收回了你，只冷冷看了你一眼。${sent}`
    case 'partial':
      return `${c.masterName}收回了你。${punish(state, 'light', report)}${sent}`
    case 'fail':
      return `${c.masterName}收回了你。${punish(state, 'heavy', report)}${sent}`
    case 'fumble': {
      const line = punish(state, 'heavy', report)
      c.obedience = Math.min(slaveryRules.freedom.obedience_max, c.obedience + 1)
      return `${c.masterName}收回了你，怒氣未消。${line}${sent}`
    }
  }
}

/** 投靠新主人：無主或逃亡時，對身邊的冒險者 */
function seekTarget(state: GameState, target?: string): NpcRecord {
  if (!isEnslaved(state)) throw new Error('你不是奴隸')
  if (isBound(state)) throw new Error('你已經有主人帶著了')
  const rec = target ? npcRecord(state, target) : undefined
  if (!rec || rec.dead) throw new Error('要投靠誰？')
  if (rec.id === contractOf(pcOf(state))!.master) throw new Error('要回到原本的主人身邊，請用「回到主人身邊」')
  if (state.party.some((m) => m.id === rec.id)) throw new Error('要請同伴當主人，請用自由行動')
  if (!presentHere(state, rec.id)) throw new Error('對方不在身邊')
  if (rec.tags?.includes('slave')) throw new Error(`${rec.name}自己也是奴隸`)
  if (isHostile(state, rec)) throw new Error(`${rec.name}對你充滿敵意`)
  return rec
}

/** 對方的身分對「收下主角」的 DC 修正：種類加上最有利的一個標籤 */
export function masterTagDc(rec: Pick<NpcRecord, 'kind' | 'class' | 'tags'>): number {
  const t = slaveryRules.master_tags
  const tagDcs = (rec.tags ?? []).map((x) => t.tags[x]?.dc).filter((x): x is number => x !== undefined)
  return t.kinds[npcKind(rec)].dc + (tagDcs.length ? Math.min(...tagDcs) : 0)
}

export function seekMasterDc(state: GameState, rec: NpcRecord): number {
  const r = slaveryRules.seek_master
  const aff = state.relationships?.[rec.id]?.affinity ?? 0
  return r.base + 2 * Math.max(0, lifeTier(rec.level) - lifeTier(pcOf(state).level)) - Math.floor(aff / r.affinity_step) + masterTagDc(rec)
}

export function setupSeekMaster(state: GameState, target?: string) {
  const rec = seekTarget(state, target)
  ensureRelationship(state, rec)
  const stays = (npcKind(rec) === 'commoner' ? '（普通人主人同行，但不參與戰鬥）' : '')
    + (isMadam(rec) ? safeText(`（老鴇會把印記改刻成${contractDef(slaveryRules.roles.madam).name}）`) : '')
  return {
    dc: seekMasterDc(state, rec), targetName: rec.name, situational: [],
    scene: `${currentArea(state).name}・請${rec.name}收下自己`,
    outcomes: {
      critical: `${rec.name}成為新主人，服從懲罰 -1（親密度 +3）${stays}`, success: `${rec.name}成為新主人${stays}`,
      partial: '對方沒有答應，但對你有些好感（親密度 +1）', fail: '被拒絕（親密度 -2）', fumble: '對方覺得被冒犯（親密度 -5）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applySeekMaster(state: GameState, report: Report, target: string, degree: Degree): string {
  const rec = npcRecord(state, target)!
  switch (degree) {
    case 'critical':
    case 'success': {
      changeMaster(state, rec, report, '投靠')
      const remarked = remarkByMadam(state, rec)
      const c = contractOf(pcOf(state))!
      if (degree === 'critical') {
        c.obedience = Math.max(0, c.obedience - 1)
        addAffinity(state, report, rec.id, 3, '收下了主角')
      }
      return `${rec.name}收下了你，成為你的新主人。${remarked ? safeText(`${rec.name}把你的印記改刻成了${contractDef(slaveryRules.roles.madam).name}。`) : ''}`
    }
    case 'partial':
      addAffinity(state, report, rec.id, 1, '對主角有些好感')
      return `${rec.name}沒有答應，但對你多了幾分好感。`
    case 'fail':
      addAffinity(state, report, rec.id, -2, '拒絕收下主角')
      return `${rec.name}拒絕了。`
    case 'fumble':
      addAffinity(state, report, rec.id, -5, '覺得被冒犯')
      return `${rec.name}覺得被冒犯，冷冷地拒絕了你。`
  }
}

/** 老鴇收下主角：改刻老鴇用的印記（slavery.json 的 roles.madam；服從懲罰至少是那個模板的） */
export function remarkByMadam(state: GameState, master: Pick<NpcRecord, 'tags'>): boolean {
  if (!isMadam(master)) return false
  const pc = pcOf(state)
  const c = contractOf(pc)
  const kind = contractKind(slaveryRules.roles.madam)
  if (!c || c.kind === kind) return false
  const terms = termsFromTemplate(kind)
  setContract(pc, { ...c, kind, terms, obedience: Math.max(c.obedience, terms.obedience_penalty) }, state.time)
  return true
}

// 解除印記：神殿、刻印師、法師（法師把契約或誓約拆掉，紋樣留下來變成普通刺青）

export type UnmarkServiceId = keyof typeof slaveryRules.unmark.services

export interface UnmarkOffer {
  /** 主動行動的 target：服務 id，法師為 mage:<id>；拆誓約印記再加 @<部位> */
  target: string
  service: UnmarkServiceId
  name: string
  desc: string
  attr: AttrId
  dc: number
  fee_cc: number
  /** 法師的名字 */
  helper?: string
  /** 拆的是這個部位的誓約印記（沒有時是奴隸印記） */
  place?: TattooPlace
}

/** 印記強度：談判與逃離 DC 的平均，加上目前的服從懲罰 */
export function markStrength(c: ContractRef): number {
  const t = contractTerms(c)
  return Math.round((t.negotiate_dc + t.escape_dc) / 2) + c.obedience
}

/** 誓約印記的強度：10 + 加的總點數 × 2 */
export function oathStrength(t: Tattoo): number {
  return 10 + Object.values(t.attrs ?? {}).filter((v) => (v ?? 0) > 0).reduce((sum, v) => sum + v!, 0) * 2
}

function blackMarketKnown(state: GameState): boolean {
  return !!slaveryRules.markets[state.location]?.black && !!state.flags[`black_market:${state.location}`]
}

/** 這個服務在這裡的聲望夠不夠（神殿） */
export function unmarkRepOk(state: GameState, def: UnmarkServiceDef): boolean {
  return !def.min_reputation || reputationOf(state, locationById(state.location).faction) >= def.min_reputation
}

/** 身邊（隊伍裡或附近）有這些職業的人 */
function castersFor(state: GameState, def: UnmarkServiceDef) {
  return [
    ...state.party.filter((m) => !m.isPlayer && def.classes?.includes(m.class)).map((m) => ({ id: m.id, name: m.name, free: true })),
    ...nearbyPeople(state).filter((p) => def.classes?.includes(p.rec.class) && !isHostile(state, p.rec)).map((p) => ({ id: p.rec.id, name: p.rec.name, free: false })),
  ]
}

/** 現在找得到的解除印記服務：奴隸印記（被主人帶著時沒有），以及請法師拆誓約印記 */
export function unmarkOffers(state: GameState): UnmarkOffer[] {
  const pc = pcOf(state)
  const contract = contractOf(pc)
  const out: UnmarkOffer[] = []
  const u = slaveryRules.unmark
  const cell = currentCell(state).kind
  if (contract && !isBound(state) && !state.pendingMark) {
    const strength = markStrength(contract)
    const sealed = contractTerms(contract).functions.includes('spell_seal')
    for (const [id, def] of Object.entries(u.services) as [UnmarkServiceId, UnmarkServiceDef][]) {
      const base = { service: id, name: def.name, desc: def.desc, attr: def.attr }
      const dc = strength - def.dc_offset + (isFugitive(state) ? def.fugitive_dc ?? 0 : 0) - (sealed ? def.arcane_bonus ?? 0 : 0)
      const fee = strength * def.price_per_point
      if (!unmarkRepOk(state, def)) continue
      if (def.where === 'cell' && cell === def.cell) out.push({ ...base, target: id, dc, fee_cc: fee })
      if (def.where === 'black_market' && cell === def.cell && blackMarketKnown(state)) out.push({ ...base, target: id, dc, fee_cc: fee })
      if (def.where === 'caster') for (const c of castersFor(state, def)) out.push({ ...base, target: `mage:${c.id}`, dc, fee_cc: c.free ? 0 : fee, helper: c.name })
    }
  }
  // 誓約印記：只有會轉換的服務（法師）能拆，紋樣留下來
  for (const [id, def] of Object.entries(u.services) as [UnmarkServiceId, UnmarkServiceDef][]) {
    if (!def.convert || def.where !== 'caster' || state.pendingMark) continue
    for (const t of tattoosOf(pc).filter((x) => x.kind === 'oath')) {
      const strength = oathStrength(t)
      for (const c of castersFor(state, def)) {
        out.push({
          service: id, name: `${def.name}：${placeName(t.place)}的${tattooName(t)}`, desc: '拆掉誓約的術式（屬性的加減消失），紋樣留下來變成普通刺青。',
          attr: def.attr, target: `mage:${c.id}@${t.place}`, dc: strength - def.dc_offset, fee_cc: c.free ? 0 : strength * def.price_per_point, helper: c.name, place: t.place,
        })
      }
    }
  }
  return out
}

function unmarkOffer(state: GameState, target?: string): UnmarkOffer {
  if (!target?.includes('@')) {
    if (isBound(state)) throw new Error('被主人帶著時，要先談判或逃離')
    if (!contractOf(pcOf(state))) throw new Error('你身上沒有契約印記')
  }
  const offer = unmarkOffers(state).find((o) => o.target === target)
  if (!offer) throw new Error(target?.includes('@') ? '這裡沒有人能拆這個誓約印記' : '這裡沒有人能解除你的印記')
  return offer
}

export function setupUnmark(state: GameState, target?: string) {
  const o = unmarkOffer(state, target)
  if (state.money_cc < o.fee_cc) throw new Error(`錢不夠（要 ${formatMoney(o.fee_cc)}）`)
  const def = slaveryRules.unmark.services[o.service]
  const fee = (d: Degree) => Math.round(o.fee_cc * slaveryRules.unmark.fee_ratio[d])
  const bad = def.fumble === 'betray' ? '被出賣給主人（有主人時當場被抓回去）' : `術式反噬，失去 ${Math.round((def.backlash_hp_ratio ?? 0) * 100)}% 生命值`
  const done = o.place ? '誓約的術式被拆掉，紋樣留下來' : def.convert ? '契約解除，紋樣留下來變成普通刺青' : '印記被抹去'
  return {
    attr: o.attr, dc: o.dc, targetName: o.helper ?? o.name, situational: [],
    scene: `${currentArea(state).name}・${o.name}`,
    outcomes: {
      critical: `${done}（收費 ${fee('critical')}）`, success: `${done}（收費 ${fee('success')}）`,
      partial: o.place ? `術式鬆動了，但沒有拆掉（收費 ${fee('partial')}）` : `印記淡了一些，服從懲罰 -1（收費 ${fee('partial')}）`,
      fail: `沒有成功（收費 ${fee('fail')}）`,
      fumble: `${bad}（收費 ${fee('fumble')}）`,
    } as Partial<Record<Degree, string>>,
  }
}

export function applyUnmark(state: GameState, report: Report, target: string, degree: Degree): string {
  const o = unmarkOffer(state, target)
  const def = slaveryRules.unmark.services[o.service]
  const pc = pcOf(state)
  const fee = Math.min(state.money_cc, Math.round(o.fee_cc * slaveryRules.unmark.fee_ratio[degree]))
  const lines: string[] = []
  if (fee > 0) applyEffects(state, report, [{ type: 'money', amount: -fee }])
  const who = o.helper ?? o.name
  if (o.place) {
    // 拆誓約印記
    const t = tattooAt(pc, o.place)!
    if (degree === 'critical' || degree === 'success') {
      const name = t.name ?? ''
      delete t.attrs
      t.kind = 'plain'
      ;(report.changes.tattoos ??= []).push({ actor: 'pc', place: t.place, kind: 'oath', name, added: false })
      lines.push(`${who}拆掉了${placeName(t.place)}的${name}的術式，屬性的加減消失了，紋樣留了下來。`)
    } else if (degree === 'partial') lines.push('誓約的術式鬆動了一下，又穩了回去。')
    else if (degree === 'fail') lines.push('誓約的術式紋絲不動。')
    else {
      const loss = Math.max(1, Math.ceil(pc.maxHp * (def.backlash_hp_ratio ?? 0.2)))
      setHp(state, pc, pc.hp - loss, report)
      lines.push(`誓約的術式反噬，失去 ${loss} 點生命值。`)
    }
    if (fee > 0) lines.push(`付了 ${formatMoney(fee)}。`)
    return lines.join('')
  }
  const c = contractOf(pc)!
  switch (degree) {
    case 'critical':
    case 'success': {
      const terms = contractTerms(c)
      freePlayer(state, report, o.name)
      if (def.convert) {
        // 契約拆掉，紋樣留下來變成普通刺青
        addTattoo(pc, { kind: 'plain', place: c.terms.place, name: terms.name, desc: terms.mark, by: who }, state.time)
        lines.push(`${who}拆掉了${placeName(c.terms.place)}的${terms.name}的術式，你恢復了自由；紋樣留了下來，只是普通的刺青了。`)
      } else lines.push(`${who}抹去了你${placeName(c.terms.place)}的${terms.name}，你恢復了自由。`)
      break
    }
    case 'partial':
      c.obedience = Math.max(0, c.obedience - 1)
      lines.push('印記淡了一些，但沒有完全消失。')
      break
    case 'fail':
      lines.push('印記紋絲不動。')
      break
    case 'fumble':
      if (def.fumble === 'betray' && masterOf(state) && !masterOf(state)!.dead) {
        recapturePlayer(state, report)
        lines.push(`${who}把你出賣給了${c.masterName}。`, punish(state, 'heavy', report))
      } else {
        const loss = Math.max(1, Math.ceil(pc.maxHp * (def.backlash_hp_ratio ?? 0.2)))
        setHp(state, pc, pc.hp - loss, report)
        lines.push(`印記的術式反噬，失去 ${loss} 點生命值。`)
      }
      break
  }
  if (fee > 0) lines.push(`付了 ${formatMoney(fee)}。`)
  return lines.join('')
}

/** 談判只能在安全的地方（旅店、安全房、神殿） */
export function atSafeSpot(state: GameState): boolean {
  return slaveryRules.safe_spots.includes(currentCell(state).kind) || atMasterHome(state)
}
