// 固定 NPC 的小隊（說明見 docs/NPC_SYSTEM.md 的「小隊」）。
//
// - 小隊寫在隊長的 NpcDef.squad：隊名、隊員（含隊長 2–4 人）、每天同行的機率、成立的條件。
// - 隊員每天依同行機率跟著隊長（「隊員 id＋日期」的固定亂數），站在隊長旁邊；沒跟著的那天照自己的活躍地點。
// - 小隊不能拆開：隊員不會單獨出現在雇用與邀請名單，只能整隊邀請入隊，或請他們帶主角同行。
// - 整隊入隊的人身上記著 squad（隊長的 id）：親密度太低離隊、遣散時整隊一起走。

import { companionRules, npcs as namedNpcs, tagDcMod, type StoryCond } from './data'
import { hashString, npcRecord } from './npcs'
import { pcOf } from './party'
import { condMet } from './storyFlags'
import type { Character, GameState, NpcRecord } from './types'

export interface Squad {
  leader: string
  name: string
  members: string[]
  together: number
  requires?: StoryCond
}

/** 所有小隊（內容頁籤的設定）：隊長不能是別隊的隊員，同一個人只算進第一個列出他的小隊，不存在的 id 略過 */
export function squads(): Squad[] {
  const ids = new Set(namedNpcs.map((n) => n.id))
  const leaders = new Set(namedNpcs.filter((n) => n.squad?.members.length).map((n) => n.id))
  const taken = new Set<string>()
  const out: Squad[] = []
  for (const n of namedNpcs) {
    if (!n.squad?.members.length || taken.has(n.id)) continue
    const members = n.squad.members.filter((m) => m !== n.id && ids.has(m) && !leaders.has(m) && !taken.has(m))
    if (!members.length) continue
    for (const m of members) taken.add(m)
    taken.add(n.id)
    out.push({ leader: n.id, name: n.squad.name, members, together: n.squad.together ?? 1, ...(n.squad.requires ? { requires: n.squad.requires } : {}) })
  }
  return out
}

/** 這個人所屬的小隊（隊長或隊員） */
export function squadOf(id: string): Squad | undefined {
  return squads().find((s) => s.leader === id || s.members.includes(id))
}

export function squadIds(s: Squad): string[] {
  return [s.leader, ...s.members]
}

/** 小隊現在成立：條件符合、隊長還活著 */
export function squadActive(state: GameState, s: Squad): boolean {
  return condMet(state, s.requires) && !npcRecord(state, s.leader)?.dead
}

/** 這個人屬於一支成立中的小隊（不能單獨雇用或邀請） */
export function inActiveSquad(state: GameState, id: string): Squad | undefined {
  const s = squadOf(id)
  return s && squadActive(state, s) ? s : undefined
}

/**
 * 隊員今天跟著隊長：回傳隊長的紀錄。隊長自己、隊長已經入隊（或在主角家）、今天沒跟上時為 undefined。
 */
export function followsLeader(state: GameState, rec: Pick<NpcRecord, 'id'>, day = state.time.day): NpcRecord | undefined {
  const s = squadOf(rec.id)
  if (!s || s.leader === rec.id || !squadActive(state, s)) return undefined
  if (state.party.some((m) => m.id === s.leader)) return undefined
  const leader = npcRecord(state, s.leader)
  if (!leader || leader.dead || leader.staying) return undefined
  if (s.together < 1 && (hashString(`${rec.id}@${day}:squad`) % 1000) / 1000 >= s.together) return undefined
  return leader
}

/** 今天跟在隊長身邊的隊員（不含已經在隊伍裡、死掉的人） */
export function squadWithLeader(state: GameState, s: Squad): NpcRecord[] {
  return s.members
    .map((id) => npcRecord(state, id))
    .filter((r): r is NpcRecord => !!r && !r.dead && !state.party.some((m) => m.id === r.id) && !!followsLeader(state, r))
}

/** 今天沒跟著隊長的隊員名字（整隊邀請時要等人到齊）；已經在主角隊上、留在主角家或寄放在酒館的隊員不算缺席 */
export function squadMissing(state: GameState, s: Squad): string[] {
  const here = new Set(squadWithLeader(state, s).map((r) => r.id))
  return s.members.filter((id) => {
    const rec = npcRecord(state, id)
    return !here.has(id) && !rec?.dead && !rec?.staying && !state.party.some((m) => m.id === id)
  }).map((id) => npcRecord(state, id)?.name ?? id)
}

/** 隊伍裡同一支小隊的人（整隊邀請入隊的） */
export function squadMates(state: GameState, member: Pick<Character, 'squad'>): Character[] {
  return member.squad ? state.party.filter((m) => m.squad === member.squad) : []
}

// ---- 請小隊帶主角同行 ----

/** 請小隊帶主角同行的參考 DC：隊長的親密度越高越容易；主角帶的同伴越多、等級比隊長低越多越難 */
export function squadJoinDc(state: GameState, s: Squad): number {
  const rel = state.relationships?.[s.leader]
  const leader = npcRecord(state, s.leader)
  if (!rel || !leader) throw new Error('你不認識這支小隊的隊長')
  const j = companionRules.squad.join
  const companions = state.party.filter((m) => !m.isPlayer && m.bond !== 'guest').length
  const gap = Math.max(0, leader.level - pcOf(state).level)
  return Math.max(j.min, j.base - Math.floor(rel.affinity / j.affinity_step) + j.per_companion * companions + j.level_gap * gap + tagDcMod(leader, 'invite'))
}
