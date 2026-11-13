// 自願為奴（docs/COMPANIONS.md 2.3.1 節；data/rules/slavery.json 的 voluntary）：
// 在刻印師那裡，問親密度夠高的同伴（自願同行或雇傭的）願不願意成為主角的奴隸。答應就刻上主角選的印記（模板或自訂），
// 入隊方式改成奴隸，並預先說好兩人的主僕關係（bondStyle.ts 的 bond_styles）。不擲骰；親密度不夠時對方不會答應。

import { BOND_STYLES, slaveryRules, type BondStyle } from './data'
import { bondName } from './bondStyle'
import { currentCell } from './grid'
import { formatMoney } from './money'
import { isEnslaved, pcOf } from './party'
import { makeContract, type MarkChoice } from './slavery'
import { commitReport } from './state'
import { contractOf, setContract } from './tattoos'
import { baseReport } from './town'
import type { Character, GameState, Report } from './types'

const rules = () => slaveryRules.voluntary

/** 在刻印師這裡嗎 */
export function atVolunteerPlace(state: GameState): boolean {
  return rules().cells.includes(currentCell(state).kind)
}

/** 可以問的同伴：自願同行、雇傭的（主角、奴隸、隊長與隊員、任務同行的不算） */
export function volunteerCandidates(state: GameState): Character[] {
  return state.party.filter((m) => !m.isPlayer && rules().bonds.includes(m.bond ?? 'hired') && !contractOf(m))
}

const affinityOf = (state: GameState, id: string) => state.relationships?.[id]?.affinity ?? 0

/** 不能問的原因（可以時是 undefined） */
export function volunteerBlocked(state: GameState, memberId: string): string | undefined {
  const m = state.party.find((x) => x.id === memberId)
  if (!m) return '這個人不在隊伍裡'
  if (isEnslaved(state)) return '你身上還有奴隸印記，不能擁有奴隸'
  if (!atVolunteerPlace(state)) return '要在刻印師那裡才能刻奴隸印記'
  if (state.combat || state.pendingAction) return '現在不能這麼做'
  if (!volunteerCandidates(state).includes(m)) return `${m.name}不是自願同行或雇傭的同伴`
  const need = rules().min_affinity
  const aff = affinityOf(state, m.id)
  if (aff < need) return `${m.name}還不夠信任你（親密度 ${need} 以上才會答應，現在 ${aff}）`
  if (state.money_cc < rules().fee_cc) return `刻印費 ${formatMoney(rules().fee_cc)}，金錢不足`
  return undefined
}

/** 同伴答應了：刻上印記、成為主角的奴隸，並說好主僕關係 */
export function takeVoluntarySlave(state: GameState, memberId: string, mark: MarkChoice, style: BondStyle = 'strict'): Report {
  const why = volunteerBlocked(state, memberId)
  if (why) throw new Error(why)
  if (!BOND_STYLES.includes(style)) throw new Error('沒有這種主僕關係')
  const m = state.party.find((x) => x.id === memberId)!
  const pc = pcOf(state)
  const report = baseReport(state, 'action', rules().hours)
  const contract = makeContract(mark, 'pc', pc.name, state.time)
  if (style !== 'strict') contract.style = style
  setContract(m, contract, state.time, pc.name)
  if (!m.status.includes('slave_mark')) m.status.push('slave_mark')
  const before = m.bond
  m.bond = 'slave'
  const rel = state.relationships?.[m.id]
  if (rel) rel.toPlayer = `自願成為主角的奴隸，身上刻著主角的印記（${bondName(style)}）。`
  report.changes.money_cc = -rules().fee_cc
  ;(report.changes.companions ??= []).push({ npc: m.id, name: m.name, change: 'enslaved', bond: 'slave', reason: '自願為奴' })
  const terms = contract.terms
  report.outcome.summary = `${m.name}自願成為你的奴隸，在刻印師那裡刻上「${terms.name}」（${before === 'hired' ? '原本是雇傭的同伴' : '原本是自願同行的夥伴'}；刻印費 ${formatMoney(rules().fee_cc)}）。兩人說好的關係：${bondName(style)}。`
  report.outcome.tags = ['自願為奴']
  const def = slaveryRules.bond_styles.styles[style]
  report.narration = {
    pov: 'second_person', length: 'medium',
    focus: [
      `主角在刻印師那裡問${m.name}願不願意成為自己的奴隸；${m.name}信任主角，自願答應`,
      `刻印師把「${terms.name}」刻在${m.name}身上：${terms.mark}`,
      style === 'strict' ? '兩人說好就是名實相符的主人與奴隸' : `兩人事先說好，名義上是主奴，實際的關係是「${def.name}」：${def.prompt}`,
      slaveryRules.bond_styles.personality_rule,
    ],
  }
  return commitReport(state, report)
}
