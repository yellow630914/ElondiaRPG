// 人際關係與共同記憶。
//
// - 人際關係：主角與每個認識的角色之間的條目（親密度、外貌、與主角的關係、與其他角色的關係）。
//   不只限於隊友；隊友的 Character.affinity 是這裡的同步副本。
// - 共同記憶：主角經歷過的事件（時間、地點、參與人、簡述），由報告自動記錄，玩家也可以編輯或手動新增。
// - 檢索：事件發生或生成文本時，依「參與人、地點、時間」找出相關的人際關係與記憶，一起交給 AI 參考。
// 說明見 docs/RELATIONSHIP_MEMORY.md。

import { affinityStage } from './character'
import { locationById, npcs, progression, type NpcDef } from './data'
import type { GameState, GameTime, Report } from './types'

export interface Relationship {
  id: string
  name: string
  /** -100 ~ 100，由遊戲規則變動 */
  affinity: number
  appearance: string
  /** 與主角的關係（文字） */
  toPlayer: string
  /** 與其他角色的關係：角色 id → 文字 */
  toOthers: Record<string, string>
  /** 比對用的別名（例如稱號、暱稱） */
  aliases?: string[]
  personality?: string
  faction?: string
  firstMet?: { time: GameTime; location: string }
  lastSeen?: { time: GameTime; location: string }
}

export interface Memory {
  id: string
  time: GameTime
  location: string
  /** 細部場景，例如「蛇溪洞窟・淺層」 */
  scene?: string
  /** 參與人的 id（主角為 pc） */
  participants: string[]
  summary: string
  /** 1 = 日常、2 = 重要、3 = 難忘 */
  importance: 1 | 2 | 3
  pinned?: boolean
  /** 來源報告；手動新增的記憶沒有 */
  report?: string
  /** 合併了幾筆舊記憶 */
  merged?: number
}

export interface ContextQuery {
  participants: string[]
  location?: string
  time?: GameTime
  /** 排除的記憶（例如正在描寫的這份報告本身） */
  excludeReport?: string
  maxMemories?: number
}

export interface ContextResult {
  relationships: Relationship[]
  memories: Memory[]
}

const MAX_MEMORIES = 6
/** 記憶超過這個數量時，把舊的日常記憶合併成摘要 */
export const MEMORY_CAP = 200
/** 合併時保留最近的這幾筆不動 */
const KEEP_RECENT = 50
const MERGED_SUMMARY_CHARS = 200

// ---- 人際關係 ----

function relationsOf(state: GameState): Record<string, Relationship> {
  return (state.relationships ??= {})
}

/** 取得角色的人際關係條目；第一次見面時從 NPC 資料建立。 */
export function ensureRelationship(state: GameState, who: NpcDef | { id: string; name: string }): Relationship {
  const rels = relationsOf(state)
  const existing = rels[who.id]
  const place = { time: { ...state.time }, location: state.location }
  if (existing) {
    existing.lastSeen = place
    return existing
  }
  const def = 'personality' in who ? who : (state.npcs?.[who.id] ?? npcs.find((n) => n.id === who.id))
  const rel: Relationship = {
    id: who.id,
    name: who.name,
    affinity: progression.affinity.initial,
    appearance: def?.appearance ?? '',
    toPlayer: '初次見面。',
    toOthers: { ...(def?.relations ?? {}) },
    ...(def?.personality ? { personality: def.personality } : {}),
    ...(def?.faction ? { faction: def.faction } : {}),
    firstMet: place,
    lastSeen: place,
  }
  rels[who.id] = rel
  return rel
}

/** 設定親密度，並同步到隊伍中的同一角色。 */
export function setAffinity(state: GameState, id: string, value: number) {
  const v = Math.max(progression.affinity.min, Math.min(progression.affinity.max, Math.round(value)))
  const rel = relationsOf(state)[id]
  if (rel) rel.affinity = v
  const member = state.party.find((m) => m.id === id)
  if (member) member.affinity = v
}

export type RelationshipPatch = Partial<Pick<Relationship, 'appearance' | 'toPlayer' | 'toOthers' | 'aliases'>>

/** 玩家可以編輯的文字欄位（親密度由遊戲規則決定，不開放直接修改）。 */
export function editRelationship(state: GameState, id: string, patch: RelationshipPatch) {
  const rel = relationsOf(state)[id]
  if (!rel) throw new Error('沒有這個人際關係條目')
  if (patch.appearance !== undefined) rel.appearance = patch.appearance
  if (patch.toPlayer !== undefined) rel.toPlayer = patch.toPlayer
  if (patch.aliases !== undefined) rel.aliases = patch.aliases.filter(Boolean)
  if (patch.toOthers !== undefined) {
    rel.toOthers = Object.fromEntries(Object.entries(patch.toOthers).filter(([k, v]) => k && v.trim()))
  }
}

// ---- 共同記憶 ----

/** 報告的參與人：隊伍成員，以及報告中出現、已有人際關係條目的角色。 */
export function participantsOf(state: GameState, report: Report): string[] {
  const ids = new Set(report.party.map((p) => p.id))
  const rels = relationsOf(state)
  for (const o of report.others ?? []) if (rels[o.id]) ids.add(o.id)
  for (const a of report.changes.affinity ?? []) ids.add(a.npc)
  return [...ids]
}

/** 哪些報告值得記住，以及重要程度；回傳 null 表示不記錄。 */
function memoryImportance(report: Report): Memory['importance'] | null {
  switch (report.kind) {
    case 'combat':
      return report.outcome.result === 'defeat' || report.outcome.tags?.includes('隊員倒下') ? 2 : 1
    case 'quest':
      return report.quest?.status === 'completed' ? 3 : report.quest?.status === 'accepted' ? 2 : null
    case 'social':
      return report.outcome.result === 'neutral' ? 1 : 2
    case 'travel':
      return 1
    case 'action':
      // 主動行動（有檢定）才記；大成功、大失敗比較難忘
      if (!report.check) return null
      return report.check.degree === 'critical' || report.check.degree === 'fumble' ? 2 : 1
    case 'rest':
      return report.changes.companions?.length ? 2 : null
    default:
      return null
  }
}

/** 由報告自動建立記憶（在 commitReport 時呼叫）。 */
export function recordMemory(state: GameState, report: Report): Memory | null {
  const importance = memoryImportance(report)
  if (importance === null || !report.outcome.summary) return null
  const memory: Memory = {
    id: `m-${report.report_id}`,
    time: { ...report.time.start },
    location: report.location.to && report.outcome.result === 'arrived' ? report.location.to : report.location.at,
    ...(report.location.scene ? { scene: report.location.scene } : {}),
    participants: participantsOf(state, report),
    summary: report.outcome.summary,
    importance,
    report: report.report_id,
  }
  ;(state.memories ??= []).push(memory)
  compactMemories(state)
  for (const id of memory.participants) {
    const rel = relationsOf(state)[id]
    if (rel) rel.lastSeen = { time: { ...report.time.end }, location: memory.location }
  }
  return memory
}

export function addMemory(state: GameState, m: Omit<Memory, 'id'>): Memory {
  const memory = { ...m, id: `m-manual-${Date.now().toString(36)}-${(state.memories ?? []).length}` }
  ;(state.memories ??= []).push(memory)
  compactMemories(state)
  return memory
}

export type MemoryPatch = Partial<Pick<Memory, 'summary' | 'importance' | 'pinned' | 'participants'>>

export function editMemory(state: GameState, id: string, patch: MemoryPatch) {
  const m = state.memories?.find((x) => x.id === id)
  if (!m) throw new Error('沒有這段記憶')
  Object.assign(m, patch)
}

export function deleteMemory(state: GameState, id: string) {
  state.memories = (state.memories ?? []).filter((m) => m.id !== id)
}

/**
 * 記憶超過 MEMORY_CAP 筆時，把較舊的日常記憶（重要程度 1、未釘選）合併：
 * 先依「同一天」合併成一筆摘要；還是太多就依「10 天」為一段再合併。最近 KEEP_RECENT 筆不動。
 * 回傳合併掉的筆數。
 */
export function compactMemories(state: GameState, cap = MEMORY_CAP): number {
  const list = state.memories ?? []
  if (list.length <= cap) return 0
  const before = list.length
  for (const span of [1, 10]) {
    if ((state.memories ?? []).length <= cap) break
    mergeMemories(state, span)
  }
  return before - (state.memories ?? []).length
}

function mergeMemories(state: GameState, spanDays: number) {
  const list = state.memories ?? []
  const cutoff = list.length - KEEP_RECENT
  const groups = new Map<number, Memory[]>()
  list.forEach((m, i) => {
    if (i >= cutoff || m.pinned || m.importance !== 1) return
    const key = Math.floor((m.time.day - 1) / spanDays)
    groups.set(key, [...(groups.get(key) ?? []), m])
  })
  const removed = new Set<string>()
  const merged: Memory[] = []
  for (const [key, ms] of groups) {
    if (ms.length < 2) continue
    for (const m of ms) removed.add(m.id)
    const counts = new Map<string, number>()
    for (const m of ms) counts.set(m.location, (counts.get(m.location) ?? 0) + 1)
    const location = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    const days = spanDays === 1 ? `第 ${ms[0]!.time.day} 天` : `第 ${key * spanDays + 1}～${(key + 1) * spanDays} 天`
    let summary = `${days}的日常：${ms.map((m) => m.summary.replace(/。$/, '')).join('；')}。`
    if (summary.length > MERGED_SUMMARY_CHARS) summary = `${summary.slice(0, MERGED_SUMMARY_CHARS - 1)}…`
    merged.push({
      id: `m-merged-${spanDays}-${key}-${ms[0]!.id}`,
      time: { ...ms[0]!.time },
      location,
      participants: [...new Set(ms.flatMap((m) => m.participants))],
      summary,
      importance: 1,
      merged: ms.reduce((n, m) => n + (m.merged ?? 1), 0),
    })
  }
  if (!merged.length) return
  const kept = list.filter((m) => !removed.has(m.id))
  state.memories = [...kept, ...merged].sort((a, b) => a.time.day - b.time.day || (a.time.hour ?? 0) - (b.time.hour ?? 0) || (a.time.minute ?? 0) - (b.time.minute ?? 0))
}

// ---- AI 提議的人際關係文字 ----

/** 接受提議：寫入「與主角的關係」 */
export function acceptSuggestion(state: GameState, id: string, text?: string) {
  const s = state.suggestions?.find((x) => x.id === id)
  if (!s) throw new Error('沒有這個提議')
  const rel = relationsOf(state)[s.npc]
  if (rel) rel.toPlayer = (text ?? s.text).trim() || rel.toPlayer
  state.suggestions = (state.suggestions ?? []).filter((x) => x.id !== id)
}

export function rejectSuggestion(state: GameState, id: string) {
  state.suggestions = (state.suggestions ?? []).filter((x) => x.id !== id)
}

/** 加入提議（只接受已有條目的角色，同一角色只保留最新一筆） */
export function addSuggestions(state: GameState, updates: { id: string; to_player: string }[], report?: string) {
  for (const u of updates) {
    const rel = relationsOf(state)[u.id]
    const text = u.to_player.trim().slice(0, 120)
    if (!rel || !text || text === rel.toPlayer) continue
    state.suggestions = (state.suggestions ?? []).filter((x) => x.npc !== u.id)
    state.suggestions.push({ id: `s-${report ?? 'x'}-${u.id}`, npc: u.id, text, ...(report ? { report } : {}) })
  }
}

// ---- 檢索 ----

function dayDistance(a: GameTime, b: GameTime): number {
  return Math.abs(a.day - b.day)
}

/**
 * 依參與人、地點、時間挑出相關條目：
 * - 人際關係：查詢的參與人（主角除外）。
 * - 記憶：分數 = 3 × 共同參與人數 + 2 × 同一地點 + 重要程度 + 時間接近度，釘選的記憶優先；
 *   取前幾名後依時間排序。
 */
export function selectContext(state: GameState, q: ContextQuery): ContextResult {
  const rels = relationsOf(state)
  const people = q.participants.filter((id) => id !== 'pc')
  const relationships = people.map((id) => rels[id]).filter((r): r is Relationship => !!r)

  const now = q.time ?? state.time
  const scored = (state.memories ?? [])
    .filter((m) => m.report === undefined || m.report !== q.excludeReport)
    .map((m) => {
      const shared = m.participants.filter((p) => p !== 'pc' && people.includes(p)).length
      const sameLocation = q.location !== undefined && m.location === q.location
      const days = dayDistance(m.time, now)
      const recency = days <= 3 ? 1.5 : days <= 10 ? 0.75 : 0
      const score = (m.pinned ? 10 : 0) + 3 * shared + (sameLocation ? 2 : 0) + m.importance + recency
      return { m, score, relevant: m.pinned || shared > 0 || sameLocation }
    })
    .filter((x) => x.relevant)
    .sort((a, b) => b.score - a.score)
    .slice(0, q.maxMemories ?? MAX_MEMORIES)
    .map((x) => x.m)
    .sort((a, b) => a.time.day - b.time.day || (a.time.hour ?? 0) - (b.time.hour ?? 0))

  return { relationships, memories: scored }
}

/** 報告對應的檢索條件 */
export function queryForReport(state: GameState, report: Report): ContextQuery {
  return {
    participants: participantsOf(state, report),
    location: report.location.at,
    time: report.time.start,
    excludeReport: report.report_id,
  }
}

// ---- 給 AI 的文字 ----

function nameOf(state: GameState, id: string): string {
  if (id === 'pc') return state.party.find((m) => m.isPlayer)?.name ?? '主角'
  return relationsOf(state)[id]?.name ?? state.party.find((m) => m.id === id)?.name ?? id
}

function timeText(t: GameTime): string {
  return `第 ${t.day} 天 ${String(t.hour ?? 0).padStart(2, '0')}:${String(t.minute ?? 0).padStart(2, '0')}`
}

export function formatContext(state: GameState, ctx: ContextResult): string {
  const parts: string[] = []
  if (ctx.relationships.length) {
    const lines = ctx.relationships.map((r) => {
      const others = Object.entries(r.toOthers).map(([id, text]) => `${nameOf(state, id)}：${text}`)
      return [
        `- ${r.name}｜親密度 ${r.affinity}（${affinityStage(r.affinity)}）｜id: ${r.id}`,
        r.appearance && `  外貌：${r.appearance}`,
        r.personality && `  性格：${r.personality}`,
        `  與主角：${r.toPlayer}`,
        others.length ? `  與他人：${others.join('；')}` : '',
      ].filter(Boolean).join('\n')
    })
    parts.push(`<relationships>\n${lines.join('\n')}\n</relationships>`)
  }
  if (ctx.memories.length) {
    const lines = ctx.memories.map((m) => {
      const where = m.scene ?? locationById(m.location).name
      const who = m.participants.map((id) => nameOf(state, id)).join('、')
      return `- ${timeText(m.time)}｜${where}｜${who}｜${m.summary}`
    })
    parts.push(`<memories>\n${lines.join('\n')}\n</memories>`)
  }
  return parts.join('\n\n')
}
