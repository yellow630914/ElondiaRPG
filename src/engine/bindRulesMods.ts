// 雙面效應的設定（docs/LEWD_STATS.md 第 7 節；內容頁籤「🗡️ 裝備底材」的「⚙️ 雙面效應設定」）：
// lewd.json 的 two_face（各種拘束的檢定減值、受影響的檢定、戰鬥增益、免疫的狀態，忍耐與流派的倍率）與 locks.grades（鎖的倍率）。
// 存在世界的自訂內容（bindRules.rules 一筆），跟著世界匯出匯入；恢復預設時還原成內建的。

import { ATTR_IDS, BIND_KINDS, lewdRules, LOCK_GRADES, statuses, type AttrId, type BindKind, type CheckContext, type CheckFilter, type LockGrade, type Mods } from './data'

/** 戰鬥增益可以寫的項目（initiative 是先攻，其他是戰鬥修正） */
export const BIND_COMBAT_KEYS = ['initiative', 'hit', 'evade', 'save', 'damage', 'dr', 'ap_regen'] as const
export type BindCombatKey = (typeof BIND_COMBAT_KEYS)[number]
export const BIND_COMBAT_NAME: Record<BindCombatKey, string> = { initiative: '先攻', hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復' }
/** 減值可以指定的情境（非戰鬥的檢定） */
export const BIND_CONTEXTS: CheckContext[] = ['action', 'negotiation', 'master_event', 'gate', 'trap', 'lock', 'travel', 'road', 'quest', 'retreat', 'stealth']
export const BIND_CONTEXT_NAME: Record<string, string> = {
  action: '主動行動', negotiation: '談判', master_event: '主人的事件', gate: '城門盤查', trap: '陷阱', lock: '開鎖', travel: '旅途的危險', road: '旅途的事件',
  quest: '委託', retreat: '撤退', stealth: '潛行',
}

export interface BindKindRule {
  name: string
  checks: CheckFilter[]
  penalty: number[]
  combat: (Mods & { initiative?: number })[]
  immune?: string[]
}
export interface BindRulesMod {
  endurance_per: number
  fit: number
  servitude_master: number
  kinds: Record<BindKind, BindKindRule>
  locks: Record<LockGrade, { name: string; mult: number }>
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const num = (v: unknown, lo: number, hi: number, d: number, digits = 2) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return d
  const f = 10 ** digits
  return Math.round(Math.max(lo, Math.min(hi, n)) * f) / f
}
const str = (v: unknown, n: number, d: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d)

export function currentBindRules(): BindRulesMod {
  const t = lewdRules.two_face
  return clone({ endurance_per: t.endurance_per, fit: t.fit, servitude_master: t.servitude_master, kinds: t.kinds, locks: lewdRules.locks.grades })
}

/** 內建的設定（模組載入時的快照） */
const snapshot = currentBindRules()
export function builtinBindRules(): BindRulesMod {
  return clone(snapshot)
}

/** 一組檢定篩選：屬性與情境（其他欄位不用）；兩個都空是「所有檢定」 */
function filter(v: unknown): CheckFilter {
  const o = v && typeof v === 'object' ? v as CheckFilter : {}
  const attrs = (Array.isArray(o.attrs) ? o.attrs : []).filter((a): a is AttrId => ATTR_IDS.includes(a as AttrId))
  const contexts = (Array.isArray(o.contexts) ? o.contexts : []).filter((c) => BIND_CONTEXTS.includes(c))
  return { ...(attrs.length ? { attrs: [...new Set(attrs)] } : {}), ...(contexts.length ? { contexts: [...new Set(contexts)] } : {}) }
}

export function sanitizeBindRules(raw: Partial<BindRulesMod>, base: BindRulesMod = builtinBindRules()): BindRulesMod {
  const kinds = {} as Record<BindKind, BindKindRule>
  for (const k of BIND_KINDS) {
    const b = base.kinds[k] ?? { name: k, checks: [{}], penalty: [1, 2, 3], combat: [{}, {}, {}] }
    const r = (raw.kinds?.[k] ?? b) as Partial<BindKindRule>
    // 檢定篩選：符合任一組就算；空的組（所有檢定）只留一組，去掉重複
    const seen = new Set<string>()
    const checks = (Array.isArray(r.checks) ? r.checks : b.checks).map(filter).filter((f) => {
      const key = JSON.stringify(f)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 6)
    const penalty = [0, 1, 2].map((i) => Math.round(num(r.penalty?.[i], 0, 10, b.penalty[i] ?? 0)))
    const combat = [0, 1, 2].map((i) => {
      const row = (r.combat?.[i] ?? {}) as Record<string, unknown>
      return Object.fromEntries(BIND_COMBAT_KEYS.map((key) => [key, Math.round(num(row[key], -10, 10, 0))]).filter(([, v]) => v)) as Mods & { initiative?: number }
    })
    const immune = [...new Set((Array.isArray(r.immune) ? r.immune : []).filter((s) => typeof s === 'string' && !!statuses[s]))]
    kinds[k] = { name: str(r.name, 12, b.name), checks: checks.length ? checks : [{}], penalty, combat, ...(immune.length ? { immune } : {}) }
  }
  const locks = {} as Record<LockGrade, { name: string; mult: number }>
  for (const g of LOCK_GRADES) {
    const b = base.locks[g] ?? { name: g, mult: 1 }
    const r = raw.locks?.[g]
    locks[g] = { name: str(r?.name, 12, b.name), mult: num(r?.mult, 0, 5, b.mult) }
  }
  return {
    endurance_per: Math.round(num(raw.endurance_per, 1, 100, base.endurance_per)),
    fit: num(raw.fit, 0, 5, base.fit),
    servitude_master: num(raw.servitude_master, 0, 5, base.servitude_master),
    kinds,
    locks,
  }
}

export function applyBindRules(r: BindRulesMod) {
  const t = lewdRules.two_face
  t.endurance_per = r.endurance_per
  t.fit = r.fit
  t.servitude_master = r.servitude_master
  t.kinds = clone(r.kinds)
  lewdRules.locks.grades = clone(r.locks)
}

export function restoreBindRules() {
  applyBindRules(builtinBindRules())
}
