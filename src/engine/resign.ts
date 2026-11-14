// 說服主人重簽契約（docs/COMPANIONS.md 2.4 節；data/rules/slavery.json 的 resign）：
// 被主人帶著、對主人的親密度夠高時，主角在「🔒 契約」提出新的條款（名稱、描述與數值，範圍照自訂印記），魅力檢定。
// 成功照提出的改，部分成功數值各改一半；主人、部位與服從懲罰不變。印記改成自訂印記（kind custom），刻在原本的位置。

import { slaveryRules, type Degree } from './data'
import { negotiateDc } from './companions'
import { addAffinity, isBound, pcOf } from './party'
import { contractTerms, sanitizeTerms } from './slavery'
import { contractOf } from './tattoos'
import type { GameState, MarkTerms, Report } from './types'

const rules = () => slaveryRules.resign
const refusedFlag = 'resign_no'

/** 可以改的數值（部位與服從懲罰不能改） */
export const RESIGN_FIELDS = ['income_share', 'negotiate_dc', 'escape_dc', 'exit_dc', 'recapture_chance', 'escape_hp_ratio'] as const
type Field = (typeof RESIGN_FIELDS)[number]
/** 比例（0～1）的欄位：改一半時取到 0.01；其他是整數 */
const RATIO: Field[] = ['income_share', 'recapture_chance', 'escape_hp_ratio']

function masterAffinity(state: GameState): number {
  const c = contractOf(pcOf(state))
  return c ? state.relationships?.[c.master]?.affinity ?? 0 : 0
}

/** 不能提重簽的原因（可以時是 undefined） */
export function resignBlocked(state: GameState): string | undefined {
  const c = contractOf(pcOf(state))
  if (!c || !isBound(state)) return '你沒有被主人帶著'
  const need = rules().min_affinity
  const aff = masterAffinity(state)
  if (aff < need) return `${c.masterName}還不夠信任你（親密度 ${need} 以上才肯談，現在 ${aff}）`
  if (state.flags[refusedFlag] === state.time.day) return `${c.masterName}今天不想再聽你提契約的事`
  if (state.combat || state.pendingAction) return '現在不能這麼做'
  return undefined
}

/** 重簽的參考 DC：談判解除契約的 DC 減 dc_discount（不是要求自由，比較好談），至少 5 */
export function resignDc(state: GameState): number {
  return Math.max(5, negotiateDc(state) - rules().dc_discount)
}

/** 提出的條款整理過：範圍照自訂印記，部位、服從懲罰、法術環上限與順從累積沿用現在的契約 */
export function resignTerms(state: GameState, raw: Partial<MarkTerms> = {}): MarkTerms {
  const now = contractTerms(contractOf(pcOf(state))!)
  const picked: Partial<MarkTerms> = { name: raw.name, mark: raw.mark, side_effects: raw.side_effects ?? now.side_effects }
  for (const k of RESIGN_FIELDS) if (raw[k] !== undefined) picked[k] = raw[k] as never
  const t = sanitizeTerms({ ...picked, place: now.place, obedience_penalty: now.obedience_penalty, ...(now.spell_cap !== undefined ? { spell_cap: now.spell_cap } : {}) }, now)
  return t
}

/** 部分成功：數值各往提出的方向改一半，名稱與描述不變 */
export function halfwayTerms(now: MarkTerms, wanted: MarkTerms): MarkTerms {
  const out: Partial<MarkTerms> = { ...now }
  for (const k of RESIGN_FIELDS) {
    const mid = (now[k] + wanted[k]) / 2
    out[k] = RATIO.includes(k) ? Math.round(mid * 100) / 100 : Math.round(mid)
  }
  return sanitizeTerms(out, now)
}

/** 這次改了哪些條款（「收益 100% → 60%」，一項一句） */
export function termChanges(before: MarkTerms, after: MarkTerms): string[] {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const names: Record<Field, [string, (n: number) => string]> = {
    income_share: ['收益歸主人', pct], negotiate_dc: ['談判解除 DC', String], escape_dc: ['逃離 DC', String],
    exit_dc: ['出城 DC', String], recapture_chance: ['逃亡時被找到', pct], escape_hp_ratio: ['逃離反噬', pct],
  }
  const out = RESIGN_FIELDS.filter((k) => before[k] !== after[k]).map((k) => `${names[k][0]} ${names[k][1](before[k])} → ${names[k][1](after[k])}`)
  if (before.name !== after.name) out.unshift(`名稱「${before.name}」→「${after.name}」`)
  if (before.mark !== after.mark) out.push('印記的樣子改了')
  return out
}

/** 行動的設定：參考 DC 與各結果 */
export function setupResign(state: GameState, raw?: Partial<MarkTerms>) {
  const why = resignBlocked(state)
  if (why) throw new Error(why)
  const c = contractOf(pcOf(state))!
  const now = contractTerms(c)
  const wanted = resignTerms(state, raw)
  const changes = termChanges(now, wanted)
  if (!changes.length) throw new Error('新的條款和現在的一樣')
  return {
    dc: resignDc(state), targetName: c.masterName, situational: [{ label: '契約的服從懲罰', value: -c.obedience }],
    scene: `向${c.masterName}提出重簽契約：${changes.join('；')}`,
    outcomes: {
      critical: `${c.masterName}照你提的重簽契約（親密度 +${rules().critical_affinity}）`,
      success: `${c.masterName}照你提的重簽契約`,
      partial: `${c.masterName}只肯各讓一半：數值往你提的方向改一半，名稱與描述不變`,
      fail: `${c.masterName}不答應，今天不能再提`,
      fumble: `${c.masterName}覺得你得寸進尺（親密度 ${rules().fumble_affinity}），今天不能再提`,
    } as Partial<Record<Degree, string>>,
  }
}

/** 結算重簽：成功照提出的改，部分成功改一半；印記改成自訂印記，刻在原本的位置 */
export function applyResign(state: GameState, report: Report, degree: Degree, raw?: Partial<MarkTerms>): string {
  const c = contractOf(pcOf(state))!
  const master = c.masterName
  if (degree === 'fail' || degree === 'fumble') {
    ;(report.changes.flags ??= {})[refusedFlag] = state.time.day
    if (degree === 'fumble') addAffinity(state, report, c.master, rules().fumble_affinity, '奴隸得寸進尺')
    return degree === 'fumble' ? `${master}沉下臉：奴隸還敢討價還價。` : `${master}不答應重簽契約。`
  }
  const before = contractTerms(c)
  const wanted = resignTerms(state, raw)
  const after = degree === 'partial' ? halfwayTerms(before, wanted) : wanted
  c.kind = 'custom'
  c.terms = after
  if (degree === 'critical') addAffinity(state, report, c.master, rules().critical_affinity, '重簽時談得愉快')
  const changes = termChanges(before, after)
  const lead = degree === 'partial' ? `${master}只肯各讓一半` : `${master}答應重簽契約`
  const income = before.income_share !== after.income_share ? `從現在起賺到的錢你自己留 ${Math.round((1 - after.income_share) * 100)}%。` : ''
  return `${lead}：${changes.length ? changes.join('；') : '條款沒有改變'}。${income}`
}
