// 特殊任務的流程圖模型（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E3）：只讀任務資料，畫面在 components/content/StoryGraph.vue。
// 任務點之間沒有直接連線，順序與分支都是劇情旗標：這裡把「結果設定的旗標 → 需要這個旗標的任務點」畫成邊。
//
// 節點：▶ 開頭、任務點（每個結果是一個出口）、✅ 完成、❌ 失敗、☁ 任務外面的旗標（其他任務、AI 判定、園區印章、沒有人設定）
// 邊：start（一開始就解鎖）、unlock（需要的旗標）、any（至少一個成立）、block（不能有）、clear（清除了需要的旗標）、end（完成或失敗）

import { geography, npcs, specialMaps, stories, storyCounters, PARK_STAMP_PREFIX, type StoryDef, type StoryNodeKind, type StoryOutcome } from './data'
import { STORY_EFFECTS } from './storyMods'
import { portsOf, storyReach, type StoryReach } from './storyReach'

export interface GraphPort {
  /** `節點 id#第幾個出口` */
  id: string
  node: string
  label: string
  /** 失敗的結果（判定、戰鬥、選項的檢定失敗） */
  fail: boolean
  sets: string[]
  clears: string[]
  end?: 'complete' | 'fail' | 'retry'
  /** 結果的其他效果，寫成短的標籤（加入、死亡、移動、計數器、親密場景……） */
  notes: string[]
  /** 選項的內容標籤 */
  tags: string[]
  /** 選了之後可能卡住（storyReach） */
  stuck: boolean
}

export interface GraphNode {
  id: string
  index: number
  title: string
  kind: StoryNodeKind
  urgent: boolean
  /** 判定或戰鬥沒寫失敗：失敗了可以再試 */
  retryOnFail: boolean
  /** 其他條件（好感、計數器、主角條件）的簡短說明 */
  conds: string[]
  ports: GraphPort[]
  /** 不會解鎖（storyReach） */
  unreachable: boolean
}

export type EdgeKind = 'start' | 'unlock' | 'any' | 'block' | 'clear' | 'end'

export interface GraphEdge {
  /** 'start'、出口 id 或 'ext:<旗標>' */
  from: string
  /** 任務點 id、'complete' 或 'fail' */
  to: string
  kind: EdgeKind
  flag?: string
}

export interface GraphExternal {
  id: string
  flag: string
  /** story：其他任務設定；ai：AI 判定；park：園區印章；none：沒有人設定 */
  source: 'story' | 'ai' | 'park' | 'none'
  stories: { id: string; title: string }[]
}

export interface StoryGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  externals: GraphExternal[]
  reach: StoryReach
}

const npcName = (id: string) => npcs.find((n) => n.id === id)?.name ?? id

function notesOf(o: StoryOutcome): string[] {
  const out: string[] = []
  if (o.scene) out.push('💗 親密場景')
  if (o.join) out.push(`＋同行 ${npcName(o.join)}`)
  if (o.leave) out.push(`－同行 ${npcName(o.leave)}`)
  for (const d of o.deaths ?? []) out.push(`💀 ${npcName(d)}`)
  if (o.travel_to) out.push(`➜ ${geography.locations.find((l) => l.id === o.travel_to)?.name ?? o.travel_to}`)
  if (o.side_map) out.push('➜ 臨時地圖')
  if (o.special_map) out.push(`➜ ${specialMaps[o.special_map]?.name ?? o.special_map}`)
  for (const [k, v] of Object.entries(o.counters ?? {})) out.push(`${storyCounters[k]?.name ?? k} ${v > 0 ? '+' : ''}${v}`)
  for (const e of o.effects ?? []) {
    if (e.type === 'start_story') out.push(`▶ ${stories.find((s) => s.id === e.story)?.title ?? e.story}`)
    else if (e.type === 'money') out.push(`${e.amount > 0 ? '+' : ''}${e.amount} 白鸛`)
    else out.push(STORY_EFFECTS[e.type] ?? e.type)
  }
  return out
}

export function storyGraph(def: StoryDef, others: StoryDef[] = stories): StoryGraph {
  const reach = storyReach(def)
  const stuck = new Set(reach.stuck.map((x) => `${x.node}\u0000${x.label}`))
  const nodes: GraphNode[] = def.nodes.map((n, index) => {
    const r = n.requires ?? {}
    const conds: string[] = []
    for (const [id, v] of Object.entries(r.affinity ?? {})) conds.push(`${npcName(id)}好感 ≥ ${v}`)
    for (const [id, v] of Object.entries(r.counters ?? {})) conds.push(`${storyCounters[id]?.name ?? id}${v.min !== undefined ? ` ≥ ${v.min}` : ''}${v.max !== undefined ? ` ≤ ${v.max}` : ''}`)
    if (r.parasites) conds.push('寄生物')
    if (r.pc_tags?.length) conds.push('主角的身分')
    if (r.stats || r.charm || r.wearing) conds.push('成人向條件')
    if (n.wear?.length) conds.push(`限定穿著 ${n.wear.join('、')}`)
    const ports: GraphPort[] = portsOf(n).map((p, i) => {
      const o = p.outcome
      const option = n.options?.find((x) => p.label.startsWith(`「${x.label}」`))
      return {
        id: `${n.id}#${i}`, node: n.id, label: p.label, fail: p.label === '失敗' || p.label === '落敗' || p.label.endsWith('」失敗'),
        sets: o.set_flags ?? [], clears: o.clear_flags ?? [],
        ...(o.complete ? { end: 'complete' as const } : o.fail_quest ? { end: 'fail' as const } : o.retry ? { end: 'retry' as const } : {}),
        notes: notesOf(o), tags: option?.tags ?? [], stuck: stuck.has(`${n.id}\u0000${p.label}`),
      }
    })
    return {
      id: n.id, index, title: n.title, kind: n.kind, urgent: !!n.urgent,
      retryOnFail: (n.kind === 'check' || n.kind === 'combat') && !n.fail, conds, ports, unreachable: reach.unreachable.includes(n.id),
    }
  })

  // 旗標 → 設定它的出口（開頭旗標算 start）
  const writers = new Map<string, string[]>()
  const addWriter = (f: string, from: string) => writers.set(f, [...(writers.get(f) ?? []), from])
  for (const f of def.start_flags ?? []) addWriter(f, 'start')
  for (const n of nodes) for (const p of n.ports) for (const f of p.sets) addWriter(f, p.id)
  const clearers = new Map<string, string[]>()
  for (const n of nodes) for (const p of n.ports) for (const f of p.clears) clearers.set(f, [...(clearers.get(f) ?? []), p.id])

  const edges: GraphEdge[] = []
  const externals = new Map<string, GraphExternal>()
  const external = (flag: string): string => {
    const id = `ext:${flag}`
    if (!externals.has(id)) {
      const by = others.filter((s) => s.id !== def.id && (s.start_flags?.includes(flag) || s.nodes.some((n) => portsOf(n).some((p) => p.outcome.set_flags?.includes(flag)))))
      const source = by.length ? 'story' : flag.startsWith('ai:') ? 'ai' : flag.startsWith(PARK_STAMP_PREFIX) ? 'park' : 'none'
      externals.set(id, { id, flag, source, stories: by.map((s) => ({ id: s.id, title: s.title })) })
    }
    return id
  }
  def.nodes.forEach((n) => {
    const r = n.requires ?? {}
    const need = [...(r.flags ?? []), ...(r.flags_any ?? [])]
    // 沒有旗標條件（或只要開頭旗標）：任務一開始就解鎖
    if (!need.length) edges.push({ from: 'start', to: n.id, kind: 'start' })
    for (const [list, kind] of [[r.flags ?? [], 'unlock'], [r.flags_any ?? [], 'any']] as const) {
      for (const f of list) {
        const from = writers.get(f) ?? [external(f)]
        for (const w of from) edges.push({ from: w, to: n.id, kind, flag: f })
        for (const c of clearers.get(f) ?? []) edges.push({ from: c, to: n.id, kind: 'clear', flag: f })
      }
    }
    for (const f of r.flags_none ?? []) for (const w of writers.get(f) ?? []) if (w !== 'start') edges.push({ from: w, to: n.id, kind: 'block', flag: f })
  })
  for (const n of nodes) for (const p of n.ports) if (p.end === 'complete' || p.end === 'fail') edges.push({ from: p.id, to: p.end, kind: 'end' })
  return { nodes, edges, externals: [...externals.values()], reach }
}

/**
 * 分層排版（左到右）：每一欄是一層。第 0 欄是開頭與外面的旗標，最後一欄是完成與失敗；
 * 任務點放在「最長的前置路徑」那一層（回頭的邊不算），同一欄依前一欄的位置排（重心法兩輪）。
 */
export function layoutGraph(g: StoryGraph): string[][] {
  const portNode = new Map(g.nodes.flatMap((n) => n.ports.map((p) => [p.id, n.id] as const)))
  const src = (from: string) => portNode.get(from) ?? from
  // 任務點之間的前後（只看解鎖的邊）
  const preds = new Map<string, Set<string>>(g.nodes.map((n) => [n.id, new Set()]))
  for (const e of g.edges) {
    if (e.kind !== 'unlock' && e.kind !== 'any' && e.kind !== 'start') continue
    const from = src(e.from)
    if (preds.has(e.to) && from !== e.to) preds.get(e.to)!.add(from)
  }
  // 拿掉回頭的邊：照任務點的順序做 DFS
  const state = new Map<string, 0 | 1 | 2>()
  const back = new Set<string>()
  const succ = new Map<string, string[]>()
  for (const [to, ps] of preds) for (const p of ps) succ.set(p, [...(succ.get(p) ?? []), to])
  const visit = (id: string) => {
    state.set(id, 1)
    for (const t of succ.get(id) ?? []) {
      if (state.get(t) === 1) back.add(`${id}>${t}`)
      else if (!state.get(t)) visit(t)
    }
    state.set(id, 2)
  }
  for (const r of ['start', ...g.externals.map((x) => x.id), ...g.nodes.map((n) => n.id)]) if (!state.get(r)) visit(r)
  const rank = new Map<string, number>([['start', 0], ...g.externals.map((x) => [x.id, 0] as [string, number])])
  const rankOf = (id: string, seen = new Set<string>()): number => {
    if (rank.has(id)) return rank.get(id)!
    if (seen.has(id)) return 1
    seen.add(id)
    const ps = [...(preds.get(id) ?? [])].filter((p) => !back.has(`${p}>${id}`))
    const r = ps.length ? Math.max(...ps.map((p) => rankOf(p, seen))) + 1 : 1
    rank.set(id, r)
    return r
  }
  for (const n of g.nodes) rankOf(n.id)
  const last = Math.max(1, ...g.nodes.map((n) => rank.get(n.id)!)) + 1
  const ends = ['complete', 'fail'].filter((t) => g.edges.some((e) => e.to === t))
  const cols: string[][] = Array.from({ length: last + 1 }, () => [])
  cols[0]!.push('start', ...g.externals.map((x) => x.id))
  for (const n of g.nodes) cols[rank.get(n.id)!]!.push(n.id)
  cols[last]!.push(...ends)
  // 重心法：依前一欄連過來的位置排
  const into = new Map<string, string[]>()
  for (const e of g.edges) into.set(e.to, [...(into.get(e.to) ?? []), src(e.from)])
  for (let pass = 0; pass < 2; pass++) {
    const pos = new Map<string, number>()
    for (const col of cols) col.forEach((id, i) => pos.set(id, i))
    for (let c = 1; c < cols.length; c++) {
      const bary = (id: string) => {
        const xs = (into.get(id) ?? []).map((p) => pos.get(p)).filter((x): x is number => x !== undefined)
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : pos.get(id)!
      }
      cols[c]!.sort((a, b) => bary(a) - bary(b))
      cols[c]!.forEach((id, i) => pos.set(id, i))
    }
  }
  return cols.filter((c) => c.length)
}
