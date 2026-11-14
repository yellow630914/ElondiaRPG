// 神殿的洗點（docs/COMBAT_SYSTEM.md「升級」；data/rules/attributes.json 的 respec）：主角的屬性退回職業與種族的基本值（baseAttrs），
// 建角時自由加的點、升級給的點與經驗換來的點全部變回未分配的屬性點，之後照平常一樣自己分配。
// 只給主角：NPC 的屬性不是照基本值加點組出來的，算不出哪些是加上去的。

import { baseAttrs, recalc, snapshot } from './character'
import { nurseryRefusal } from './children'
import { ATTR_IDS, attributeRules, locationById } from './data'
import { formatMoney } from './money'
import { isFugitive, pcOf } from './party'
import { commitReport, player } from './state'
import { baseReport } from './town'
import type { GameState, Report } from './types'

const rules = () => attributeRules.respec

/** 會退回幾點：每項屬性高於基本值的部分 */
export function respecPoints(state: GameState): number {
  const pc = pcOf(state)
  const base = baseAttrs(pc.class, pc.race)
  return ATTR_IDS.reduce((n, a) => n + Math.max(0, pc.attrs[a] - base[a]), 0)
}

/** 洗點的費用：每級 cost_per_level */
export function respecCost(state: GameState): number {
  return rules().cost_per_level * pcOf(state).level
}

/** 不能洗點的原因（可以時是 undefined） */
export function respecBlocked(state: GameState): string | undefined {
  if (isFugitive(state)) return '神殿的人認出了你身上的契約印記，拒絕接待'
  const owed = nurseryRefusal(state)
  if (owed) return owed
  if (state.combat || state.pendingAction) return '現在不能這麼做'
  if (!respecPoints(state)) return '屬性都還是基本值，沒有可以重新分配的點'
  if (state.money_cc < respecCost(state)) return `要奉獻 ${formatMoney(respecCost(state))}，金錢不足`
  return undefined
}

/** 在神殿洗點：屬性退回基本值，退回的點加進未分配的屬性點 */
export function templeRespec(state: GameState): Report {
  const why = respecBlocked(state)
  if (why) throw new Error(why)
  const pc = pcOf(state)
  const base = baseAttrs(pc.class, pc.race)
  const points = respecPoints(state)
  const cost = respecCost(state)
  const before = { ...pc, attrs: { ...pc.attrs } }
  for (const a of ATTR_IDS) pc.attrs[a] = Math.min(pc.attrs[a], base[a])
  pc.attrPoints += points
  recalc(pc)
  const report = baseReport(state, 'action', rules().hours)
  report.location.scene = `${locationById(state.location).name}的神殿`
  report.party = [snapshot(pc, before, player(state))]
  report.changes.money_cc = -cost
  report.outcome.summary = `你在神殿的冥想室裡靜坐了 ${rules().hours} 小時，讓神官替你洗去身上的鍛鍊：屬性退回最初的樣子，${points} 點屬性點可以重新分配（奉獻 ${formatMoney(cost)}）。`
  report.outcome.tags = ['洗點']
  report.narration = { pov: 'second_person', length: 'short' }
  return commitReport(state, report)
}
