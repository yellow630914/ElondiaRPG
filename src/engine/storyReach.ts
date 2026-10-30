// 特殊任務的可達性（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E3）：從開頭出發，把「完成了哪些任務點、成立了哪些旗標」的每一種狀態走一遍，
// 找出三種問題（storyCheck 的提醒，流程圖上也標出來）：
// - 到不了的任務點：任何走法都不會解鎖
// - 走不到完成：沒有任何一條路走到「完成任務」
// - 會卡住的結果：選了之後可能沒有任務點可以進行（任務沒完成也沒失敗，只能放棄）
//
// 寬鬆的估計（只抓一定有問題的）：任務外面可能設定的旗標（其他任務、AI 判定、園區印章、沒有人設定的）一直當成成立；
// 「不能有」的旗標、好感、計數器、主角條件都當成可能成立；檢定、戰鬥照可能成功也可能失敗算。
// 狀態太多（超過 STATE_CAP）時不報「會卡住」，只報前兩種（用旗標的固定點算，不用列舉狀態）。

import type { StoryDef, StoryNode, StoryOutcome } from './data'

export interface ReachPort {
  /** 任務點的 id */
  node: string
  /** 結果的名稱（成功、失敗、「選項」…） */
  label: string
  outcome: StoryOutcome
}

/** 一個任務點的所有結果（和 storyMods.ts 的 outcomesOf 一樣的名稱） */
export function portsOf(n: StoryNode): ReachPort[] {
  const out: ReachPort[] = []
  if (n.success) out.push({ node: n.id, label: n.kind === 'combat' ? '勝利' : '成功', outcome: n.success })
  if (n.fail) out.push({ node: n.id, label: n.kind === 'combat' ? '落敗' : '失敗', outcome: n.fail })
  for (const o of n.options ?? []) {
    if (o.success) out.push({ node: n.id, label: `「${o.label}」${o.check ? '成功' : ''}`, outcome: o.success })
    if (o.fail) out.push({ node: n.id, label: `「${o.label}」失敗`, outcome: o.fail })
  }
  return out
}

export interface StoryReach {
  /** 永遠不會解鎖的任務點（id） */
  unreachable: string[]
  /** 有沒有任何一條路走到完成 */
  canComplete: boolean
  /** 選了之後可能卡住的結果 */
  stuck: { node: string; label: string }[]
  /** 狀態太多沒有列舉完（stuck 不可靠，留空） */
  truncated: boolean
}

const STATE_CAP = 20000

/** 任務裡有寫的旗標（開頭、結果的設定）：其他的旗標都當成任務外面會設定 */
function ownFlags(def: StoryDef): Set<string> {
  const own = new Set(def.start_flags ?? [])
  for (const n of def.nodes) for (const p of portsOf(n)) for (const f of p.outcome.set_flags ?? []) own.add(f)
  return own
}

export function storyReach(def: StoryDef): StoryReach {
  const own = ownFlags(def)
  // 外面的旗標一直成立；任務自己的旗標照走法
  const has = (flags: Set<string>, f: string) => !own.has(f) || flags.has(f)
  const open = (n: StoryNode, flags: Set<string>) => {
    const r = n.requires
    if (r?.flags?.some((f) => !has(flags, f))) return false
    if (r?.flags_any?.length && !r.flags_any.some((f) => has(flags, f))) return false
    return true
  }
  const nodes = def.nodes
  const ports = nodes.map(portsOf)
  // 判定與戰鬥沒寫失敗：失敗了可以再試，狀態不變（不用列）

  // 1. 固定點：只會增加的旗標（忽略清除），算出可能解鎖的任務點
  const reachFlags = new Set(def.start_flags ?? [])
  const everOpen = new Set<number>()
  for (let changed = true; changed;) {
    changed = false
    nodes.forEach((n, i) => {
      if (everOpen.has(i) || !open(n, reachFlags)) return
      everOpen.add(i)
      changed = true
      for (const p of ports[i]!) for (const f of p.outcome.set_flags ?? []) reachFlags.add(f)
    })
  }
  const unreachable = nodes.filter((_, i) => !everOpen.has(i)).map((n) => n.id)
  const canComplete = [...everOpen].some((i) => ports[i]!.some((p) => p.outcome.complete))

  // 2. 列舉狀態：完成了哪些任務點 + 任務自己的旗標
  const stuck = new Map<string, { node: string; label: string }>()
  const seen = new Set<string>()
  const key = (done: Set<number>, flags: Set<string>) => `${[...done].sort((a, b) => a - b).join(',')}|${[...flags].sort().join(',')}`
  type St = { done: Set<number>; flags: Set<string> }
  const start: St = { done: new Set(), flags: new Set(def.start_flags ?? []) }
  const queue: { st: St }[] = [{ st: start }]
  seen.add(key(start.done, start.flags))
  let truncated = false
  const availOf = (st: St) => nodes.map((_, i) => i).filter((i) => !st.done.has(i) && open(nodes[i]!, st.flags))
  while (queue.length) {
    const { st } = queue.shift()!
    const avail = availOf(st)
    for (const i of avail) {
      for (const p of ports[i]!) {
        const o = p.outcome
        if (o.complete || o.fail_quest) continue
        const flags = new Set(st.flags)
        for (const f of o.clear_flags ?? []) flags.delete(f)
        for (const f of o.set_flags ?? []) if (own.has(f)) flags.add(f)
        const done = o.retry ? st.done : new Set([...st.done, i])
        const k = key(done, flags)
        const next = { done, flags }
        // 走到沒有任務點可以進行、任務也沒結束的狀態：這個結果可能讓任務卡住
        if (!availOf(next).length) stuck.set(`${nodes[i]!.id}\u0000${p.label}`, { node: nodes[i]!.id, label: p.label })
        if (seen.has(k)) continue
        if (seen.size >= STATE_CAP) {
          truncated = true
          queue.length = 0
          break
        }
        seen.add(k)
        queue.push({ st: next })
      }
    }
  }
  return { unreachable, canComplete, stuck: truncated ? [] : [...stuck.values()], truncated }
}
