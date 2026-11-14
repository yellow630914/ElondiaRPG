// 還沒接的特殊任務（冒險筆記的「可以接」、人物的角色線；docs/STORY_QUESTS.md 第 5 節）：
// - 現在就能接：條件都符合（和公會、固定 NPC、情報商開頭時的檢查一樣，canStart），寫出去哪裡接。
// - 快要能接：只差數字的條件（等級、和某人的親密度、冒險者階級），其他條件（前一段劇情的旗標……）都符合。
// - 只列見過的人（人際關係裡有、或在隊伍裡）的任務、去過的城鎮的公會與情報商；旅途、手動、自動開頭的不列。
// - 內容篩選關掉的、這個體型接不到的、要穿主角的種族穿不了的、要找的人已經死了的不列。

import { tagsAllowed, pcBodyAllowed } from './content'
import { locationById, stories, type StoryDef } from './data'
import { playerRank } from './guild'
import { characterBody } from './look'
import { RANK_ORDER } from './materialQuests'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { pcOf } from './party'
import { canStart, neededNpcs, storyWearUnfit } from './story'
import { condMet } from './storyFlags'
import type { GameState } from './types'

/** 冒險筆記顯示還沒接的特殊任務：不顯示、只顯示現在能接的、也顯示快要能接的（介面設定） */
export type StoryBoardMode = 'off' | 'now' | 'soon'

/** 一項還差的條件：label 是要求（等級 11），have 是現在的值 */
export interface StoryNeed { label: string; have: string; ok: boolean; ratio?: number }

export interface BoardEntry {
  def: StoryDef
  state: 'now' | 'soon'
  /** 去哪裡接 */
  where: string
  /** 角色線的第幾段（固定 NPC 開頭的） */
  line?: { npc: string; name: string; index: number }
  /** 快要能接時：每一項數字條件（符合的也列，打勾） */
  needs: StoryNeed[]
}

const npcName = (state: GameState, id: string) => state.party.find((m) => m.id === id)?.name ?? npcRecord(state, id)?.name ?? id

/** 見過這個人：人際關係裡有，或在隊伍裡 */
function metNpc(state: GameState, id: string): boolean {
  return !!state.relationships?.[id] || state.party.some((m) => m.id === id)
}

/** 去過這座城：現在在這裡，或存檔裡有這座城的區塊 */
function visited(state: GameState, location: string): boolean {
  if (state.location === location) return true
  const prefix = `${location}/`
  return Object.keys(state.areas ?? {}).some((k) => k.startsWith(prefix))
}

/** 固定 NPC 開頭的任務依 NPC 分組（照任務清單的順序） */
function linesByNpc(): Map<string, StoryDef[]> {
  const out = new Map<string, StoryDef[]>()
  for (const def of stories) if (def.start.kind === 'npc' && def.start.npc) out.set(def.start.npc, [...(out.get(def.start.npc) ?? []), def])
  return out
}

/** 根本接不到的（不列、角色線也不算）：內容篩選、體型、穿著、要找的人死了 */
function excluded(state: GameState, def: StoryDef): boolean {
  if (!tagsAllowed(def.tags)) return true
  if (!pcBodyAllowed(def.start.pc_body, characterBody(pcOf(state)))) return true
  if (storyWearUnfit(state, def).length) return true
  return neededNpcs(def, { done: [] }).some((id) => npcRecord(state, id)?.dead)
}

/**
 * 還沒接的任務現在的狀態：now（現在就能接）、soon（只差數字的條件）或 null（還有別的條件不符合，例如前一段劇情）。
 * soon 時 needs 列出每一項數字條件
 */
export function storyReadiness(state: GameState, def: StoryDef): { state: 'now' | 'soon'; needs: StoryNeed[] } | null {
  if (state.stories?.[def.id] || excluded(state, def)) return null
  const needs: StoryNeed[] = []
  const st = def.start
  const level = pcOf(state).level
  if (st.min_level) needs.push({ label: `等級 ${st.min_level}`, have: `現在 ${level}`, ok: level >= st.min_level })
  const aff = (id: string) => state.relationships?.[id]?.affinity ?? 0
  const affNeed = (id: string, n: number) => {
    const have = aff(id)
    needs.push({ label: `和${npcName(state, id)}的親密度 ${n}`, have: `現在 ${have}`, ok: have >= n, ratio: n > 0 ? Math.max(0, Math.min(1, have / n)) : 1 })
  }
  if (st.kind === 'npc' && st.npc && st.min_affinity !== undefined) affNeed(st.npc, st.min_affinity)
  const { affinity, ...rest } = st.requires ?? {}
  for (const [id, n] of Object.entries(affinity ?? {})) affNeed(id, n)
  if (def.rank) {
    const mine = playerRank(state)
    const i = RANK_ORDER.indexOf(def.rank)
    const ok = i <= RANK_ORDER.indexOf(mine) || (state.party.length > 1 && i === RANK_ORDER.indexOf(mine) + 1)
    if (!ok) needs.push({ label: `冒險者階級 ${def.rank}（組隊時可以低一階）`, have: `現在 ${mine}`, ok })
  }
  // 數字以外的條件（前一段的旗標、計數……）不符合：還不能列
  if (!condMet(state, rest)) return null
  if (canStart(state, def)) return { state: 'now', needs: [] }
  return needs.some((n) => !n.ok) ? { state: 'soon', needs } : null
}

/** 去哪裡接；見過的人、去過的城才回傳（否則 undefined，不列） */
function whereOf(state: GameState, def: StoryDef): string | undefined {
  const st = def.start
  if (st.kind === 'npc' && st.npc) {
    if (!metNpc(state, st.npc)) return undefined
    const rec = npcRecord(state, st.npc)
    if (rec?.hostile) return undefined
    if (state.party.some((m) => m.id === st.npc)) return `找${npcName(state, st.npc)}（在隊伍裡）`
    return `找${npcName(state, st.npc)}${rec?.location ? `（${locationById(rec.location).name}）` : ''}`
  }
  if (st.kind === 'guild') {
    if (st.location && !visited(state, st.location)) return undefined
    return st.location ? `${locationById(st.location).name}的冒險者公會` : '任何一座城的冒險者公會'
  }
  if (st.kind === 'informant') {
    if (st.location && !visited(state, st.location)) return undefined
    return `${st.location ? `${locationById(st.location).name}的` : ''}情報商打聽（約 ${formatMoney(st.price ?? 100)}）`
  }
  return undefined
}

/** 冒險筆記「可以接」：現在就能接的在前，再來是快要能接的（mode 是 soon 時） */
export function storyBoard(state: GameState, mode: StoryBoardMode): BoardEntry[] {
  if (mode === 'off') return []
  const lines = linesByNpc()
  const out: BoardEntry[] = []
  for (const def of stories) {
    const r = storyReadiness(state, def)
    if (!r || (r.state === 'soon' && mode !== 'soon')) continue
    const where = whereOf(state, def)
    if (!where) continue
    const npc = def.start.kind === 'npc' ? def.start.npc : undefined
    const list = npc ? lines.get(npc)!.filter((d) => !excluded(state, d)) : []
    out.push({
      def, state: r.state, where, needs: r.needs,
      ...(npc ? { line: { npc, name: npcName(state, npc), index: list.indexOf(def) + 1 } } : {}),
    })
  }
  return out.sort((a, b) => (a.state === b.state ? 0 : a.state === 'now' ? -1 : 1))
}

export type LineStep = { def: StoryDef; status: 'done' | 'failed' | 'active' | 'now' | 'soon' | 'locked'; needs: StoryNeed[] }

/**
 * 人物的角色線：這個人開頭的特殊任務，依任務清單的順序。完成、失敗、進行中、可以接、快要能接、之後（還沒解鎖，只算數量）。
 * 接不到的（內容篩選、體型……）不算進去；沒有任何一段時回傳 undefined
 */
export function npcLine(state: GameState, npc: string, mode: StoryBoardMode): LineStep[] | undefined {
  if (mode === 'off') return undefined
  const list = (linesByNpc().get(npc) ?? []).filter((d) => !excluded(state, d) || state.stories?.[d.id])
  if (!list.length) return undefined
  return list.map((def) => {
    const p = state.stories?.[def.id]
    if (p) return { def, status: p.status === 'completed' ? 'done' : p.status === 'failed' ? 'failed' : 'active', needs: [] }
    const r = storyReadiness(state, def)
    if (r?.state === 'now') return { def, status: 'now', needs: [] }
    if (r?.state === 'soon' && mode === 'soon') return { def, status: 'soon', needs: r.needs }
    return { def, status: 'locked', needs: [] }
  })
}
