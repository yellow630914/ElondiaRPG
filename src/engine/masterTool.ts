// 主角當奴隸時，主人是工具人（成人向；計畫 docs/plan/LUST_COMBAT_PLAN.md 第 7.2 節、docs/COMPANIONS.md 2.4 節）：
// 系統上主人只是讓隸從派生效的條件，主角保有主導權。和主人的親密度夠高時，契約面板可以直接解約、換主人（不擲骰、不付錢）；
// 敘事上仍然寫成主人的決定（主人准許、主人安排、把主角轉讓出去）。數值在 data/rules/lewd.json 的 master_tool。

import { lewdRules } from './data'
import { changeMaster, freePlayer, isBound, pcOf } from './party'
import { isHostile, isUnhireable, peopleHere } from './population'
import { commitReport } from './state'
import { contractOf } from './tattoos'
import { baseReport } from './town'
import type { GameState, NpcRecord, Report } from './types'

const rules = () => lewdRules.master_tool

/** 和主人的親密度 */
function masterAffinity(state: GameState): number {
  const c = contractOf(pcOf(state))
  return c?.master ? state.relationships?.[c.master]?.affinity ?? 0 : 0
}

/** 現在能不能直接解約、換主人：被主人帶著，而且和主人的親密度夠高 */
export function masterToolReady(state: GameState): boolean {
  return isBound(state) && masterAffinity(state) >= rules().release_affinity
}

/** 契約面板的說明：還差多少親密度 */
export function masterToolStatus(state: GameState): { affinity: number; need: number; ready: boolean } {
  return { affinity: masterAffinity(state), need: rules().release_affinity, ready: masterToolReady(state) }
}

/** 可以換成的新主人：在這一區、認識（親密度夠）、不是奴隸、沒有敵意 */
export function newMasterCandidates(state: GameState): NpcRecord[] {
  const current = contractOf(pcOf(state))?.master
  return peopleHere(state)
    .map((p) => p.rec)
    .filter((r) => r.id !== current && !r.dead && !isUnhireable(r.id) && !r.tags?.includes('slave') && !isHostile(state, r))
    .filter((r) => (state.relationships?.[r.id]?.affinity ?? 0) >= rules().new_master_affinity)
}

function toolReport(state: GameState, focus: string[]): Report {
  const report = baseReport(state, 'action', rules().hours)
  report.narration = {
    pov: 'second_person', length: 'short',
    // 這是主角的要求，敘事上寫成主人的決定
    focus: [...focus, '這是主角開口提的，但要寫成主人自己的決定（主人准許、主人安排）；主人仍然是主導的一方'],
  }
  return report
}

/** 主人准許解約：親密度夠高時直接成功 */
export function masterRelease(state: GameState): Report {
  if (!masterToolReady(state)) throw new Error('和主人還不夠親近，只能談判或逃走')
  const name = contractOf(pcOf(state))!.masterName
  const report = toolReport(state, [`${name}准許解除契約，親手抹去主角身上的印記`])
  freePlayer(state, report, '主人准許')
  report.outcome.summary = `${name}答應了你的請求，抹去了你身上的契約印記。`
  return commitReport(state, report)
}

/** 主人把主角轉讓給另一位主人（契約與條款沿用） */
export function masterTransfer(state: GameState, npcId: string): Report {
  if (!masterToolReady(state)) throw new Error('和主人還不夠親近，主人不會答應')
  const next = newMasterCandidates(state).find((r) => r.id === npcId)
  if (!next) throw new Error('這個人不能成為新主人（要在附近、夠熟、不是奴隸、會收人）')
  const old = contractOf(pcOf(state))!.masterName
  const report = toolReport(state, [`${old}安排把主角轉讓給${next.name}`, `${next.name}成為主角的新主人`])
  changeMaster(state, next, report, `${old}把主角轉讓給${next.name}`)
  report.outcome.summary = `${old}答應了，把你轉讓給${next.name}。`
  return commitReport(state, report)
}
