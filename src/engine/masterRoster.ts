// 主人帶著主角時，向主人提議安排隊伍（docs/COMPANIONS.md 第 2.4 節）：
// - 請主人讓 X 離隊（主人雇來的、不是奴隸的隊員）
// - 請主人把 X 留在酒館（不是奴隸的隊員；這座城要有酒館）。之後可以再提議帶上
// - 請主人把 X 留在家裡（主人的奴隸；要在主人的家所在的城）。之後在那座城可以再提議帶上
// - 請主人帶上 X（留在這座城的酒館或主人家裡的隊員，隊伍要有空位）
// 和提議雇人一樣是魅力檢定（slavery.json 的 propose：主人親密度、服從懲罰、主人身分 tag_dc）。
// 大成功照做、主人覺得提議得體；成功照做；部分成功主人勉強答應、有點不高興（請離改成留在酒館，沒有酒館時照樣離隊）；
// 失敗今天不再提這個人；大失敗主人不高興。
// 主人離開隊伍（主角逃走、獲釋、換主人）時，留在酒館與主人家裡的隊員也不再等主角（party.ts 的 leaveParty）。

import { slaveryRules, type Degree } from './data'
import { tavernSpot } from './grid'
import { parkMember, unparkMember } from './homes'
import { currentMasterHome } from './masterHome'
import { npcRecord } from './npcs'
import { addAffinity, isBound, leaderOf, leaveParty, partyMax, partyRoom, pcOf } from './party'
import { contractOf } from './tattoos'
import type { Character, GameState, Home, NpcRecord, Report } from './types'

export type RosterKind = 'dismiss' | 'lodge' | 'home' | 'take'
export const ROSTER_KINDS: RosterKind[] = ['dismiss', 'lodge', 'home', 'take']

export const ROSTER_LABEL: Record<RosterKind, string> = {
  dismiss: '請主人讓他離隊',
  lodge: '請主人把他留在酒館',
  home: '請主人把他留在家裡',
  take: '請主人帶上他',
}

const tavernKey = (location: string) => `tavern:${location}`
const homeKey = (master: string) => `m-${master}`
export const proposeFlag = (npc: string) => `propose_no:${npc}`

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0
  return h
}

/** 帶著主角的主人；沒有時 undefined */
export function rosterMaster(state: GameState): Character | undefined {
  const m = leaderOf(state)
  return isBound(state) && m && m.id === contractOf(pcOf(state))?.master ? m : undefined
}

/** 主人的奴隸（契約的主人是他） */
export function isMastersSlave(m: Character, master: string): boolean {
  return contractOf(m)?.master === master
}

/** 主人的家在主角現在這座城時，回傳那棟房子 */
function masterHomeHere(state: GameState): Home | undefined {
  const home = currentMasterHome(state)
  return home && home.location === state.location ? home : undefined
}

/** 留在這座城（酒館或主人家裡）、等主人帶上的隊員 */
export function rosterWaiting(state: GameState): { rec: NpcRecord; character: Character; place: 'tavern' | 'home' }[] {
  const master = rosterMaster(state)
  if (!master) return []
  const tavern = tavernKey(state.location)
  const home = masterHomeHere(state) ? homeKey(master.id) : undefined
  return Object.values(state.npcs ?? {})
    .filter((r) => r.character?.group === master.id && (r.staying === tavern || (!!home && r.staying === home)))
    .map((r) => ({ rec: r, character: r.character!, place: r.staying === tavern ? 'tavern' as const : 'home' as const }))
}

/** 現在不能向主人提這件事的原因（可以時是 undefined） */
export function rosterBlocked(state: GameState, kind: RosterKind, npc: string): string | undefined {
  const master = rosterMaster(state)
  if (!master) return '你沒有被主人帶著'
  if (state.combat) return '戰鬥中'
  if (state.flags[proposeFlag(npc)] === state.time.day) return '主人今天不想再聽你提這個人'
  if (kind === 'take') {
    const w = rosterWaiting(state).find((x) => x.rec.id === npc)
    if (!w) return '這個人沒有在這座城等主人'
    if (partyRoom(state) < 1) return `隊伍已滿（${partyMax(state)} 人）`
    return undefined
  }
  const m = state.party.find((x) => x.id === npc)
  if (!m || m.isPlayer || m.id === master.id) return '不是主人的隊員'
  if (m.group !== master.id || m.bond === 'guest') return '不是主人的隊員'
  const slave = isMastersSlave(m, master.id)
  if (kind === 'dismiss') return slave ? '主人不會放走自己的奴隸，只能請主人留在家裡' : undefined
  if (kind === 'lodge') {
    if (slave) return '奴隸只能留在主人的家（酒館沒人看管）'
    return tavernSpot(state.location) ? undefined : '這裡沒有酒館'
  }
  if (!slave) return '只有主人的奴隸會留在主人家裡'
  const home = currentMasterHome(state)
  if (!home) return '主人沒有家'
  return home.location === state.location ? undefined : '要在主人的家所在的城'
}

/** 參考 DC：和提議雇人一樣，主人親密度高比較容易；主人的身分（slavery.json 的 propose.tag_dc） */
export function rosterDc(state: GameState, kind: RosterKind): number {
  const p = slaveryRules.propose
  const master = rosterMaster(state)
  if (!master) return p.base
  const affinity = state.relationships?.[master.id]?.affinity ?? 0
  const tags = npcRecord(state, master.id)?.tags ?? []
  const tagDc = tags.reduce((s, tag) => s + (p.tag_dc[kind]?.[tag] ?? 0), 0)
  return Math.max(5, p.base - Math.floor(affinity / p.affinity_step) + tagDc)
}

function nameOf(state: GameState, npc: string): string {
  return state.party.find((m) => m.id === npc)?.name ?? npcRecord(state, npc)?.name ?? npc
}

/** 各成功程度的機制結果（給 AI 與玩家參考） */
export function rosterOutcomes(state: GameState, kind: RosterKind, npc: string): Record<Degree, string> {
  const p = slaveryRules.propose
  const who = nameOf(state, npc)
  const done = { dismiss: `${who}離開隊伍`, lodge: `${who}留在這座城的酒館`, home: `${who}留在主人的家`, take: `${who}回到隊伍` }[kind]
  const partial = kind === 'dismiss'
    ? (tavernSpot(state.location) ? `主人不肯讓${who}走，只答應先把他留在酒館（親密度 ${p.partial_affinity}）` : `${done}，但主人有點不高興（親密度 ${p.partial_affinity}）`)
    : `${done}，但主人有點不高興（親密度 ${p.partial_affinity}）`
  return {
    critical: `${done}，主人覺得你的提議得體（親密度 +${p.critical_affinity}）`,
    success: done,
    partial,
    fail: '主人不答應，今天不再提這個人',
    fumble: `主人覺得你多管閒事（親密度 ${p.fumble_affinity}）`,
  }
}

/** 場景說明（主動行動的開頭） */
export function rosterScene(state: GameState, kind: RosterKind, npc: string): string {
  const master = rosterMaster(state)?.name ?? '主人'
  const who = nameOf(state, npc)
  return {
    dismiss: `向${master}提議讓${who}離開隊伍`,
    lodge: `向${master}提議把${who}留在這座城的酒館`,
    home: `向${master}提議把${who}留在家裡`,
    take: `向${master}提議帶上留在這裡的${who}`,
  }[kind]
}

function lodge(state: GameState, m: Character, report: Report) {
  parkMember(state, m, state.location, tavernKey(state.location), tavernSpot(state.location)!)
  ;(report.changes.companions ??= []).push({ npc: m.id, name: m.name, change: 'left', reason: '主人把他留在酒館' })
}

/** 留在主人的家：站在地下室（沒有時一樓）的某一格 */
function leaveAtHome(state: GameState, m: Character, home: Home, report: Report) {
  const floors = home.floors.map((k) => home.areas[k]!)
  const basement = floors.filter((a) => a.homeFloor === 'basement')
  const areas = basement.length ? basement : floors.filter((a) => a.homeFloor === 'ground')
  const spots = areas.flatMap((a) => a.cells.map((c, i) => ({ a, c, i }))).filter(({ c }) => c.kind === 'floor' && !c.furniture)
  const pick = spots[hash(m.id) % Math.max(1, spots.length)]
  const at = pick ? { area: pick.a.key, x: pick.i % pick.a.width, y: Math.floor(pick.i / pick.a.width) } : { area: areas[0]!.key, x: 1, y: 1 }
  parkMember(state, m, home.location, home.id, at)
  ;(report.changes.companions ??= []).push({ npc: m.id, name: m.name, change: 'left', reason: '主人把他留在家裡' })
}

/** 結算向主人提議安排隊伍 */
export function applyRosterProposal(state: GameState, report: Report, kind: RosterKind, npc: string, degree: Degree): string {
  const why = rosterBlocked(state, kind, npc)
  if (why) throw new Error(why)
  const p = slaveryRules.propose
  const master = rosterMaster(state)!
  const who = nameOf(state, npc)
  if (!report.others?.some((o) => o.id === npc)) {
    const c = state.party.find((m) => m.id === npc) ?? npcRecord(state, npc)?.character
    if (c) report.others = [...(report.others ?? []), { id: npc, name: c.name, race: c.race, class: c.class, level: c.level }]
  }
  if (degree === 'fail' || degree === 'fumble') {
    ;(report.changes.flags ??= {})[proposeFlag(npc)] = state.time.day
    if (degree === 'fumble') addAffinity(state, report, master.id, p.fumble_affinity, '奴隸多管閒事')
    return degree === 'fumble' ? `${master.name}覺得你多管閒事，臉色很難看。` : `${master.name}不答應。`
  }
  if (degree === 'critical') addAffinity(state, report, master.id, p.critical_affinity, '提議得體')
  if (degree === 'partial') addAffinity(state, report, master.id, p.partial_affinity, '勉強答應奴隸的提議')
  const grudging = degree === 'partial' ? '勉強' : ''
  if (kind === 'take') {
    const stowed: string[] = []
    const place = rosterWaiting(state).find((x) => x.rec.id === npc)!.place
    const m = unparkMember(state, npc, stowed)
    if (stowed.length) report.stowed = [...(report.stowed ?? []), ...stowed]
    ;(report.changes.companions ??= []).push({ npc: m.id, name: m.name, change: 'joined', ...(m.bond ? { bond: m.bond } : {}), reason: place === 'tavern' ? '主人從酒館帶上' : '主人從家裡帶上' })
    return `${master.name}${grudging}答應，${who}回到了隊伍。`
  }
  const m = state.party.find((x) => x.id === npc)!
  if (kind === 'dismiss') {
    if (degree === 'partial' && tavernSpot(state.location)) {
      lodge(state, m, report)
      return `${master.name}不肯讓${who}走，只答應先把${who}留在這座城的酒館。`
    }
    leaveParty(state, npc, report, `${master.name}讓他離隊`)
    return `${master.name}${grudging}答應，${who}離開了隊伍。`
  }
  if (kind === 'lodge') {
    lodge(state, m, report)
    return `${master.name}${grudging}答應，${who}留在這座城的酒館等著。`
  }
  leaveAtHome(state, m, masterHomeHere(state)!, report)
  return `${master.name}${grudging}答應，${who}留在家裡。`
}
