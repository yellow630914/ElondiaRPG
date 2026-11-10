// 懷孕與泌乳設定（docs/FAMILY.md 第 12 節）：family.json 的數值，內容頁籤「🐛 寄生物」的「⚙️ 懷孕與泌乳設定」。
// 只有一筆（ContentMods.family 的 rules）。套用時直接改 family.json 載入的物件（各模組都讀同一份，lactation.ts 拿著 lactation 的參照，
// 所以一律原地改，不換掉物件）；恢復預設時套回模組載入時的快照。

import familyJson from '@data/rules/family.json'
import { classes } from './data'
import type { PregnancyStage } from './types'

/** 可以改的一個數值：路徑（陣列用數字）、名稱、範圍 */
export interface FamilyField {
  path: string
  label: string
  min: number
  max: number
  step: number
  hint?: string
}

export interface FamilyGroup { name: string; fields: FamilyField[] }

const f = (path: string, label: string, min: number, max: number, step: number, hint?: string): FamilyField => ({ path, label, min, max, step, ...(hint ? { hint } : {}) })

/** 設定頁的欄位（依分組） */
export const FAMILY_GROUPS: FamilyGroup[] = [
  { name: '受孕', fields: [
    f('conception.base', '基礎機率', 0, 1, 0.01, '每次親密場景（性交 1 次、同種族）的受孕機率'),
    f('conception.times.2', '性交 2 次的倍率', 1, 3, 0.05),
    f('conception.times.3', '性交 3 次以上的倍率', 1, 3, 0.05),
    f('conception.race.mixed', '不同種族的倍率', 0, 2, 0.05),
    f('conception.race.low_fertility.elf', '精靈的倍率', 0, 2, 0.05, '父母任一方是這個種族時再乘一次'),
    f('conception.race.low_fertility.demon', '魔族的倍率', 0, 2, 0.05),
    f('conception.race.low_fertility.hualong', '化龍族的倍率', 0, 2, 0.05),
    f('conception.max', '最高機率', 0, 1, 0.01),
    f('conception.brothel', '娼館接客的倍率', 0, 1, 0.05, '0 = 老鴇讓接客的人喝避子湯，不會受孕'),
  ] },
  { name: '階段與減值', fields: [
    f('stages.1.at', '初期從孕期的', 0.05, 0.9, 0.05, '比例：0.2 = 孕期的 20% 進入初期'),
    f('stages.2.at', '中期從孕期的', 0.1, 0.95, 0.05),
    f('stages.3.at', '後期從孕期的', 0.15, 0.99, 0.05),
    f('checks.mid.0.bonus', '中期的靈巧檢定', -5, 0, 1),
    f('checks.late.0.bonus', '後期的靈巧檢定', -5, 0, 1),
    f('morning_sickness.chance', '初期長休後孕吐的機率', 0, 1, 0.05),
  ] },
  { name: '察覺與懷孕的事件', fields: [
    f('event_rules.min_days', '受孕幾天後才有察覺事件', 0, 30, 1),
    f('event_rules.rest_chance', '察覺事件：長休之後', 0, 1, 0.05),
    f('event_rules.travel_chance', '察覺事件：旅途每天', 0, 1, 0.05),
    f('event_rules.stage.rest_chance', '孕期事件：長休之後', 0, 1, 0.05),
    f('event_rules.stage.travel_chance', '孕期事件：旅途每天', 0, 1, 0.05),
    f('event_rules.stage.step_chance', '孕期事件：走動每一步', 0, 0.2, 0.005),
    f('event_rules.cooldown_hours', '兩件事件之間至少隔幾小時', 0, 96, 1),
  ] },
  { name: '泌乳與苗床的事件', fields: [
    f('event_rules.lactation.rest_chance', '泌乳的事件：長休之後', 0, 1, 0.05, '泌乳中的主角或隊上的夥伴，每人各擲一次；和懷孕的事件共用冷卻'),
    f('event_rules.lactation.travel_chance', '泌乳的事件：旅途每天', 0, 1, 0.05),
    f('event_rules.lactation.step_chance', '泌乳的事件：走動每一步', 0, 0.2, 0.005),
    f('event_rules.brood.rest_chance', '苗床的事件：長休之後', 0, 1, 0.05, '主角身上每個苗床各擲一次（docs/FAMILY.md 第 13.3 節）'),
    f('event_rules.brood.travel_chance', '苗床的事件：旅途每天', 0, 1, 0.05),
    f('event_rules.brood.step_chance', '苗床的事件：走動每一步', 0, 0.2, 0.005),
  ] },
  { name: '生產', fields: [
    f('birth.temple_cc', '在神殿生的費用（白鸛）', 0, 10000, 10),
    f('birth.dc', '自己生的 DC', 5, 30, 1),
    f('birth.wild_dc', '在野外生的 DC', 5, 30, 1),
    f('birth.healer_bonus', '隊伍裡有治療職業時 DC 減', 0, 10, 1),
    f('birth.labor_hours', '陣痛幾小時後在原地生', 1, 96, 1),
    f('postpartum.days', '產後虛弱（順利）幾天', 0, 30, 1),
    f('postpartum.fail_days', '產後虛弱（不順利）幾天', 0, 30, 1),
    f('postpartum.check', '產後虛弱的檢定減值', 0, 5, 1),
    f('postpartum.combat_max_hp', '產後虛弱的戰鬥生命上限比例', 0.1, 1, 0.05),
  ] },
  { name: '育幼院', fields: [
    f('nursery.fee_cc', '每個孩子每天的寄養費（白鸛）', 0, 1000, 1),
    f('nursery.escort_cc_per_day', '護送到別的城，每天路程（白鸛）', 0, 1000, 1),
  ] },
  { name: '泌乳', fields: [
    f('lactation.after_birth_days', '生產後還泌乳幾天', 0, 120, 1),
    f('lactation.sensitivity', '敏感的有效值 +', 0, 30, 1),
    f('lactation.exposure', '城裡胸前真空或曝露時，曝露名聲每天 +', 0, 10, 1),
    f('lactation.combat.max', '戰鬥：慾望上限 +（比例）', 0, 1, 0.05, '修了流派、慾望戰鬥開著時'),
    f('lactation.combat.taken', '戰鬥：受到的慾望 +（比例）', 0, 1, 0.05),
    f('lactation.combat.flesh_mult', '戰鬥：肉體派的倍率', 1, 3, 0.05),
    f('lactation.consent.base', '說服自由的夥伴：DC 基準', 5, 30, 1),
    f('lactation.consent.lewd_div', '說服：淫亂每幾點 DC -1', 1, 100, 1),
    f('lactation.consent.affinity_div', '說服：親密度每幾點 DC -1', 1, 100, 1),
    f('lactation.consent.fail_affinity', '說服失敗的親密度', -20, 0, 1),
  ] },
  { name: '懷孕的雙面效應（修了流派、慾望戰鬥開著時）', fields: [
    f('two_face.early.save', '初期：豁免', 0, 5, 1),
    f('two_face.mid.save', '中期：豁免', 0, 5, 1),
    f('two_face.mid.dr', '中期：減傷', 0, 5, 1),
    f('two_face.late.save', '後期：豁免', 0, 5, 1),
    f('two_face.late.dr', '後期：減傷', 0, 5, 1),
    f('two_face.late_ally_down.damage', '後期：有隊友倒下時傷害', 0, 10, 1),
  ] },
]

export const FAMILY_FIELDS = FAMILY_GROUPS.flatMap((g) => g.fields)

/** 設定的內容：family.json 的數值與治療職業、自動察覺的階段（事件與說明不在這裡） */
export type FamilyRulesMod = Record<string, unknown> & { birth?: { healer_classes?: string[] }; discover?: { auto_stage?: PregnancyStage } }

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const data = familyJson as unknown as Record<string, unknown>
const snapshot = clone(data)

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

function set(obj: Record<string, unknown>, path: string, v: unknown) {
  const keys = path.split('.')
  let o: Record<string, unknown> = obj
  for (const k of keys.slice(0, -1)) o = ((o[k] ??= {}) as Record<string, unknown>)
  o[keys.at(-1)!] = v
}

/** 內建的設定（模組載入時的快照） */
export function builtinFamilyRules(): FamilyRulesMod {
  const { $comment: _c, ...rest } = clone(snapshot)
  return rest as FamilyRulesMod
}

/** 目前生效的設定 */
export function currentFamilyRules(): FamilyRulesMod {
  const { $comment: _c, ...rest } = clone(data)
  return rest as FamilyRulesMod
}

const STAGES: PregnancyStage[] = ['hidden', 'early', 'mid', 'late']

/** 整理：從內建的開始，只收欄位清單裡的數值（夾在範圍內）、治療職業、自動察覺的階段；階段的比例要由小到大 */
export function sanitizeFamilyRules(raw: unknown): FamilyRulesMod {
  const out = builtinFamilyRules()
  for (const fd of FAMILY_FIELDS) {
    const n = Number(get(raw, fd.path))
    if (get(raw, fd.path) === undefined || get(raw, fd.path) === '' || !Number.isFinite(n)) continue
    const v = Math.max(fd.min, Math.min(fd.max, n))
    set(out, fd.path, Number.isInteger(fd.step) ? Math.round(v) : Math.round(v * 1000) / 1000)
  }
  // 階段的比例由小到大（後面的至少比前面多 0.05）
  const at = [1, 2, 3].map((i) => Number(get(out, `stages.${i}.at`)))
  for (let i = 1; i < 3; i++) if (at[i]! <= at[i - 1]!) at[i] = Math.min(0.99, Math.round((at[i - 1]! + 0.05) * 100) / 100)
  at.forEach((v, i) => set(out, `stages.${i + 1}.at`, v))
  const healers = get(raw, 'birth.healer_classes')
  if (Array.isArray(healers)) set(out, 'birth.healer_classes', [...new Set(healers.filter((c): c is string => typeof c === 'string' && !!classes[c]))])
  const auto = get(raw, 'discover.auto_stage')
  if (typeof auto === 'string' && (STAGES as string[]).includes(auto) && auto !== 'hidden') set(out, 'discover.auto_stage', auto)
  return out
}

/** 原地把 src 的內容寫進 dst（物件與陣列都不換掉，其他模組拿著的參照才會看到新的值） */
function assignInPlace(dst: Record<string, unknown> | unknown[], src: Record<string, unknown> | unknown[]) {
  if (Array.isArray(dst) && Array.isArray(src)) {
    for (let i = 0; i < src.length; i++) {
      const s = src[i]
      if (s && typeof s === 'object' && dst[i] && typeof dst[i] === 'object' && Array.isArray(s) === Array.isArray(dst[i])) assignInPlace(dst[i] as Record<string, unknown>, s as Record<string, unknown>)
      else dst[i] = clone(s)
    }
    dst.length = src.length
    return
  }
  const d = dst as Record<string, unknown>
  const s = src as Record<string, unknown>
  for (const k of Object.keys(d)) if (!(k in s) && k !== '$comment') delete d[k]
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === 'object' && d[k] && typeof d[k] === 'object' && Array.isArray(v) === Array.isArray(d[k])) assignInPlace(d[k] as Record<string, unknown>, v as Record<string, unknown>)
    else d[k] = clone(v)
  }
}

/** 套用設定（自訂內容的「懷孕與泌乳設定」）；事件不在這裡（在 travel_events.json） */
export function applyFamilyRules(r: FamilyRulesMod) {
  assignInPlace(data, { $comment: data.$comment, ...r })
}

/** 恢復內建的設定 */
export function restoreFamilyRules() {
  assignInPlace(data, clone(snapshot))
}
