// 神殿的洗點（docs/COMBAT_SYSTEM.md「升級」；data/rules/attributes.json 的 respec）：隊員的屬性退回職業與種族的基本值（baseAttrs），
// 建角時自由加的點、升級給的點與經驗換來的點全部變回未分配的屬性點，之後照平常一樣自己分配。
// 主角與自己隊上的夥伴（自願同行、雇傭、奴隸）都可以；NPC 的屬性不一定是照基本值加點組出來的（固定 NPC 有自己的數值），
// 只退回高於基本值的部分，低於基本值的項目不動。

import { baseAttrs, recalc, snapshot } from './character'
import { nurseryRefusal } from './children'
import { ATTR_IDS, attributeRules, locationById } from './data'
import { formatMoney } from './money'
import { isFugitive, pcOf } from './party'
import { restEventBlock } from './rest'
import { commitReport, player } from './state'
import { baseReport } from './town'
import type { Character, GameState, Report } from './types'

const rules = () => attributeRules.respec

/** 能在神殿洗點的隊員：主角，以及自己隊上的夥伴（自願同行、雇傭、奴隸；跟著別人隊伍的隊長與盟友不行，暫時離隊的不行） */
export function respecMembers(state: GameState): Character[] {
  return state.party.filter((m) => m.isPlayer || ((m.bond === 'voluntary' || m.bond === 'hired' || m.bond === 'slave') && !m.status.includes('away')))
}

function memberOf(state: GameState, memberId?: string): Character {
  if (!memberId) return pcOf(state)
  const m = respecMembers(state).find((x) => x.id === memberId)
  if (!m) throw new Error('這位隊員不能在這裡洗點')
  return m
}

/** 會退回幾點：每項屬性高於基本值的部分 */
export function respecPoints(state: GameState, memberId?: string): number {
  const c = memberOf(state, memberId)
  const base = baseAttrs(c.class, c.race)
  return ATTR_IDS.reduce((n, a) => n + Math.max(0, c.attrs[a] - base[a]), 0)
}

/** 洗點的費用：洗點那位的每級 cost_per_level */
export function respecCost(state: GameState, memberId?: string): number {
  return rules().cost_per_level * memberOf(state, memberId).level
}

/** 不能洗點的原因（可以時是 undefined） */
export function respecBlocked(state: GameState, memberId?: string): string | undefined {
  if (isFugitive(state)) return '神殿的人認出了你身上的契約印記，拒絕接待'
  const owed = nurseryRefusal(state)
  if (owed) return owed
  if (state.combat || state.pendingAction) return '現在不能這麼做'
  // 主人的要求、戰敗後的處境、刻印、生產……這些等著處理的事先處理（和等待、休息一樣）
  const event = restEventBlock(state)
  if (event) return event
  if (!respecPoints(state, memberId)) return '屬性都還是基本值，沒有可以重新分配的點'
  if (state.money_cc < respecCost(state, memberId)) return `要奉獻 ${formatMoney(respecCost(state, memberId))}，金錢不足`
  return undefined
}

/** 在神殿洗點：屬性退回基本值，退回的點加進未分配的屬性點 */
export function templeRespec(state: GameState, memberId?: string): Report {
  const why = respecBlocked(state, memberId)
  if (why) throw new Error(why)
  const c = memberOf(state, memberId)
  const base = baseAttrs(c.class, c.race)
  const points = respecPoints(state, memberId)
  const cost = respecCost(state, memberId)
  const before = { ...c, attrs: { ...c.attrs } }
  for (const a of ATTR_IDS) c.attrs[a] = Math.min(c.attrs[a], base[a])
  c.attrPoints += points
  c.respecPoints = (c.respecPoints ?? 0) + points
  recalc(c)
  const report = baseReport(state, 'action', rules().hours)
  report.location.scene = `${locationById(state.location).name}的神殿`
  report.party = [snapshot(c, before, player(state))]
  report.changes.money_cc = -cost
  const who = c.isPlayer ? '你' : c.name
  report.outcome.summary = `${who}在神殿的冥想室裡靜坐了 ${rules().hours} 小時，讓神官洗去身上的鍛鍊：屬性退回最初的樣子，${points} 點屬性點可以重新分配（奉獻 ${formatMoney(cost)}）。`
  report.outcome.tags = ['洗點']
  report.narration = { pov: 'second_person', length: 'short' }
  return commitReport(state, report)
}
