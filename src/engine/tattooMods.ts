// 刺青的自訂內容（docs/CONTENT_EDITOR.md）：刺青圖樣（普通刺青、誓約印記）、奴隸印記的模板，以及印記的用途與權重。
// 內建的可以修改，自建的沒有被用到時可以刪除。角色身上的刺青與印記是刺上時存的一份，改模板只影響之後刺的。

import { ATTR_IDS, slaveryRules, stories, type AttrId, type ContractDef } from './data'
import { isTattooPlace, oathError, tattooRules, type TattooTemplate } from './tattoos'
import { storyEffects } from './usage'
import type { TattooPlace } from './types'

export interface TattooMod extends TattooTemplate {
  custom?: boolean
}

export interface MarkMod extends ContractDef {
  custom?: boolean
}

/** 印記的用途與權重（只有一筆，key 是 rules） */
export interface MarkRulesMod {
  roles: { default: string; madam: string }
  market_contracts: { public: Record<string, number>; black: Record<string, number> }
  /** 刻印檢定由輕到重的順序 */
  severity: string[]
  /** 自賣時印記的權重 */
  self_sale: Record<string, number>
}

/** 編輯器裡奴隸印記的數值範圍（比玩家自訂的寬） */
export const MARK_EDITOR_LIMITS = {
  income_share: [0, 1], negotiate_dc: [5, 35], escape_dc: [5, 35], exit_dc: [5, 30], recapture_chance: [0, 0.8],
  escape_hp_ratio: [0, 0.9], obedience_penalty: [0, 10], spell_cap: [0, 9],
  name_chars: 12, mark_chars: 160, side_effect_chars: 40, side_effects: 4,
} as const

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number, round = true) => {
  const n = Number(v)
  const x = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback
  return round ? Math.round(x) : Math.round(x * 100) / 100
}
const places = (v: unknown): TattooPlace[] => [...new Set((Array.isArray(v) ? v : []).filter(isTattooPlace))]

// ---- 刺青圖樣 ----

/** 整理刺青圖樣；誓約的加減不合規則時回傳 undefined（不收） */
export function sanitizeTattooMod(raw: Partial<TattooMod>, custom: boolean): TattooMod | undefined {
  const kind = raw.kind === 'oath' ? 'oath' : 'plain'
  const out: TattooMod = { kind, name: str(raw.name, 12) || '新的刺青', desc: str(raw.desc, 160) }
  const p = places(raw.places)
  if (p.length) out.places = p
  if (kind === 'oath') {
    const max = tattooRules.oath.max_change
    const attrs = Object.fromEntries(ATTR_IDS.map((a) => [a, clamp(raw.attrs?.[a], [-max, max], 0)]).filter(([, v]) => v)) as Partial<Record<AttrId, number>>
    if (oathError(attrs)) return undefined
    out.attrs = attrs
  }
  // 淫紋（普通刺青）：慾望上限的比例、造成的慾望；刺的時候另外加的價錢；成人向
  if (kind === 'plain' && raw.lust && typeof raw.lust === 'object') {
    const max = clamp(raw.lust.max, [0, 0.5], 0, false)
    const bonus = clamp(raw.lust.bonus, [0, 5], 0)
    if (max || bonus) out.lust = { ...(max ? { max } : {}), ...(bonus ? { bonus } : {}) }
  }
  const price = clamp(raw.price, [0, 10000], 0)
  if (price) out.price = price
  if (raw.adult) out.adult = true
  if (custom) out.custom = true
  return out
}

export function newTattooTemplate(kind: 'plain' | 'oath' = 'plain'): TattooMod {
  return kind === 'oath'
    ? { kind, name: '新的誓約', desc: '', attrs: { str: 1, int: -1 }, custom: true }
    : { kind, name: '新的刺青', desc: '', custom: true }
}

/** 哪些地方用到這個圖樣：特殊任務的效果、主人的事件 */
export function tattooUsage(id: string): string[] {
  const out: string[] = []
  for (const s of stories) if (storyEffects(s).some((e) => e.type === 'tattoo' && e.template === id)) out.push(`特殊任務「${s.title}」的效果`)
  for (const e of slaveryRules.master_events.events) {
    const all = e.options.flatMap((o) => [...(o.effects ?? []), ...(o.effects_success ?? []), ...(o.fail_effects ?? [])])
    if (all.some((x) => x.type === 'tattoo' && x.template === id)) out.push(`主人的事件「${e.id}」`)
  }
  return out
}

// ---- 奴隸印記的模板 ----

export function sanitizeMarkMod(raw: Partial<MarkMod>, custom: boolean): MarkMod {
  const L = MARK_EDITOR_LIMITS
  const out: MarkMod = {
    name: str(raw.name, L.name_chars) || '新的印記',
    mark: str(raw.mark, L.mark_chars),
    place: isTattooPlace(raw.place) ? raw.place : 'neck',
    income_share: clamp(raw.income_share, L.income_share, 0.5, false),
    negotiate_dc: clamp(raw.negotiate_dc, L.negotiate_dc, 18),
    escape_dc: clamp(raw.escape_dc, L.escape_dc, 17),
    exit_dc: clamp(raw.exit_dc, L.exit_dc, 12),
    recapture_chance: clamp(raw.recapture_chance, L.recapture_chance, 0.1, false),
    escape_effects: { hp_ratio: clamp(raw.escape_effects?.hp_ratio, L.escape_hp_ratio, 0.1, false) },
    obedience_penalty: clamp(raw.obedience_penalty, L.obedience_penalty, 2),
    side_effects: (Array.isArray(raw.side_effects) ? raw.side_effects : []).map((s) => str(s, L.side_effect_chars)).filter(Boolean).slice(0, L.side_effects),
  }
  if (raw.spell_cap !== undefined && raw.spell_cap !== null && Number.isFinite(Number(raw.spell_cap))) out.spell_cap = clamp(raw.spell_cap, L.spell_cap, 1)
  // 順從累積：每這麼多天順從 +1（0 是不累積）
  const every = clamp(raw.submission_every, [0, 7], 0)
  if (every) out.submission_every = every
  if (custom) out.custom = true
  return out
}

export function newMark(): MarkMod {
  return {
    name: '新的印記', mark: '', place: 'neck', income_share: 0.5, negotiate_dc: 18, escape_dc: 17, exit_dc: 12, recapture_chance: 0.1,
    escape_effects: { hp_ratio: 0.1 }, obedience_penalty: 2, side_effects: [], custom: true,
  }
}

/** 哪些地方用到這個印記模板：用途、刻印的輕重順序、市場與自賣的權重、特殊任務的淪為奴隸 */
export function markUsage(id: string): string[] {
  const out: string[] = []
  const r = slaveryRules
  if (r.roles.default === id) out.push('印記設定：預設的印記')
  if (r.roles.madam === id) out.push('印記設定：老鴇刻的印記')
  if (r.marking.severity.includes(id)) out.push('印記設定：刻印檢定的輕重順序')
  if (r.market_contracts.public[id] || r.market_contracts.black[id]) out.push('印記設定：奴隸市場的權重')
  if (r.self_sale.contract_weights[id]) out.push('印記設定：自賣的權重')
  for (const s of stories) if (storyEffects(s).some((e) => e.type === 'enslave_player' && e.contract === id)) out.push(`特殊任務「${s.title}」的淪為奴隸`)
  return out
}

// ---- 印記的用途與權重 ----

export function currentMarkRules(): MarkRulesMod {
  const r = slaveryRules
  return {
    roles: { ...r.roles },
    market_contracts: { public: { ...r.market_contracts.public }, black: { ...r.market_contracts.black } },
    severity: [...r.marking.severity],
    self_sale: { ...r.self_sale.contract_weights },
  }
}

/** 整理印記設定：只留存在的模板；權重 0～100（保留兩位小數，抽選依比例）；輕重順序至少一個。沒寫的欄位用 base（原版的設定） */
export function sanitizeMarkRules(raw: Partial<MarkRulesMod>, known: Set<string>, base: MarkRulesMod = currentMarkRules()): MarkRulesMod {
  const id = (v: unknown, fallback: string) => (typeof v === 'string' && known.has(v) ? v : known.has(fallback) ? fallback : [...known][0]!)
  const weights = (v: unknown, fallback: Record<string, number>) => {
    const src = v && typeof v === 'object' ? v as Record<string, unknown> : fallback
    const out = Object.fromEntries(Object.entries(src).filter(([k]) => known.has(k)).map(([k, w]) => [k, clamp(w, [0, 100], 0, false)]).filter(([, w]) => w))
    return Object.keys(out).length ? out : { [id(undefined, base.roles.default)]: 1 }
  }
  const severity = [...new Set((Array.isArray(raw.severity) ? raw.severity : base.severity).filter((x): x is string => typeof x === 'string' && known.has(x)))]
  return {
    roles: { default: id(raw.roles?.default, base.roles.default), madam: id(raw.roles?.madam, base.roles.madam) },
    market_contracts: { public: weights(raw.market_contracts?.public, base.market_contracts.public), black: weights(raw.market_contracts?.black, base.market_contracts.black) },
    severity: severity.length ? severity : [id(undefined, base.roles.default)],
    self_sale: weights(raw.self_sale, base.self_sale),
  }
}

/** 套用印記設定 */
export function applyMarkRules(m: MarkRulesMod) {
  const r = slaveryRules
  r.roles.default = m.roles.default
  r.roles.madam = m.roles.madam
  r.market_contracts.public = { ...m.market_contracts.public }
  r.market_contracts.black = { ...m.market_contracts.black }
  r.marking.severity = [...m.severity]
  r.self_sale.contract_weights = { ...m.self_sale }
}
