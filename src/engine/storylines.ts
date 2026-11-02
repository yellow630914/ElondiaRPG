// 故事線總覽（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E3c）：任務與任務之間的關係，畫面在 components/content/StorylineOverview.vue。
// - unlock：B 的接取條件需要 A 設定的旗標（A 做完或做到某一步，B 才開放）
// - start：A 的結果「開始特殊任務」直接開啟 B
// - block：B 的接取條件不能有 A 設定的旗標（走了 A 的某條路，B 就不開放）
// - echo：B 的任務點或選項讀到 A 設定的旗標（呼應別條線，不影響 B 開不開放）
// 用 unlock、start、block 連起來的任務算同一條故事線（連通的群組）；echo 只畫在群組裡，跨群組的列在任務卡片上。

import { stories, type StoryDef } from './data'
import { portsOf } from './storyReach'

export type LineEdgeKind = 'unlock' | 'start' | 'block' | 'echo'
export interface LineEdge { from: string; to: string; kind: LineEdgeKind; flags: string[] }
export interface Storyline {
  /** 群組的名稱：簡介最後「（某某・一）」的某某，沒有時用第一個任務的名稱 */
  name: string
  ids: string[]
  edges: LineEdge[]
  /** 呼應到群組外面的任務（任務 id → 那些任務的 id） */
  outside: Record<string, string[]>
}

/** 一個任務寫的旗標（開頭、結果的設定） */
function writes(def: StoryDef): Set<string> {
  const out = new Set(def.start_flags ?? [])
  for (const n of def.nodes) for (const p of portsOf(n)) for (const f of p.outcome.set_flags ?? []) out.add(f)
  return out
}
/** 任務點與選項讀的旗標（不含接取條件） */
function innerReads(def: StoryDef): Set<string> {
  const out = new Set<string>()
  for (const n of def.nodes) {
    for (const f of [...(n.requires?.flags ?? []), ...(n.requires?.flags_any ?? [])]) out.add(f)
    for (const o of n.options ?? []) for (const f of [...(o.requires?.flags ?? []), ...(o.requires?.flags_any ?? [])]) out.add(f)
  }
  return out
}

export function storylines(all: StoryDef[] = stories): Storyline[] {
  const byFlag = new Map<string, string[]>()
  for (const s of all) for (const f of writes(s)) byFlag.set(f, [...(byFlag.get(f) ?? []), s.id])
  const edges = new Map<string, LineEdge>()
  const add = (from: string, to: string, kind: LineEdgeKind, flag?: string) => {
    if (from === to) return
    const k = `${from}>${to}>${kind}`
    const e = edges.get(k) ?? { from, to, kind, flags: [] }
    if (flag && !e.flags.includes(flag)) e.flags.push(flag)
    edges.set(k, e)
  }
  for (const b of all) {
    const r = b.start.requires ?? {}
    for (const f of [...(r.flags ?? []), ...(r.flags_any ?? [])]) for (const a of byFlag.get(f) ?? []) add(a, b.id, 'unlock', f)
    for (const f of r.flags_none ?? []) for (const a of byFlag.get(f) ?? []) add(a, b.id, 'block', f)
    const own = writes(b)
    for (const f of innerReads(b)) if (!own.has(f)) for (const a of byFlag.get(f) ?? []) add(a, b.id, 'echo', f)
    for (const n of b.nodes) for (const p of portsOf(n)) for (const e of p.outcome.effects ?? []) if (e.type === 'start_story') add(b.id, e.story, 'start')
  }
  const list = [...edges.values()].filter((e) => all.some((s) => s.id === e.to))
  // 連通的群組（不算 echo）
  const parent = new Map(all.map((s) => [s.id, s.id]))
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!))
  for (const e of list) if (e.kind !== 'echo') parent.set(find(e.from), find(e.to))
  const groups = new Map<string, string[]>()
  for (const s of all) groups.set(find(s.id), [...(groups.get(find(s.id)) ?? []), s.id])
  const title = (id: string) => all.find((s) => s.id === id)!
  return [...groups.values()].map((ids) => {
    const set = new Set(ids)
    const inner = list.filter((e) => set.has(e.from) && set.has(e.to))
    const outside: Record<string, string[]> = {}
    for (const e of list) if (e.kind === 'echo' && set.has(e.to) && !set.has(e.from)) outside[e.to] = [...new Set([...(outside[e.to] ?? []), e.from])]
    const first = title(ids[0]!)
    const m = /（([^（）]*)）\s*$/.exec(first.summary)
    const name = m ? m[1]!.replace(/・[一二三四五六七八九十終序].*$/, '') : first.title
    return { name, ids, edges: inner, outside }
  })
}
