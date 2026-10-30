// 流程圖的線（StoryGraph、StorylineOverview 共用）：量卡片在畫面上的位置，算出底下 SVG 的路徑。
// 往右的線從起點的右邊連到終點的左邊；往回（或同一欄）的從下面繞過去；同一張卡片連回自己的繞到上方。

export interface EdgeIn { from: string; to: string }
export interface DrawnEdge<E extends EdgeIn> { edge: E; d: string; x: number; y: number }

export function measureEdges<E extends EdgeIn>(root: HTMLElement, els: Map<string, HTMLElement>, edges: E[], selfLoop: (e: E) => boolean = (e) => e.from === e.to): DrawnEdge<E>[] {
  const r = root.getBoundingClientRect()
  const box = (id: string) => {
    const b = els.get(id)?.getBoundingClientRect()
    return b ? { l: b.left - r.left, r: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top, my: (b.top + b.bottom) / 2 - r.top } : undefined
  }
  const out: DrawnEdge<E>[] = []
  for (const e of edges) {
    const a = box(e.from)
    const b = box(e.to)
    if (!a || !b) continue
    let d: string
    if (selfLoop(e)) {
      d = `M ${a.r} ${a.my} C ${a.r + 30} ${a.my}, ${a.r + 30} ${b.t - 14}, ${(b.l + b.r) / 2} ${b.t - 14} L ${(b.l + b.r) / 2} ${b.t}`
    } else if (b.l > a.r) {
      const dx = Math.max(40, (b.l - a.r) / 2)
      d = `M ${a.r} ${a.my} C ${a.r + dx} ${a.my}, ${b.l - dx} ${b.my}, ${b.l} ${b.my}`
    } else {
      const low = Math.max(a.b, b.b) + 24
      d = `M ${a.r} ${a.my} C ${a.r + 40} ${a.my}, ${a.r + 40} ${low}, ${(a.r + b.l) / 2} ${low} S ${b.l - 40} ${b.my}, ${b.l} ${b.my}`
    }
    out.push({ edge: e, d, x: (a.r + b.l) / 2, y: (a.my + b.my) / 2 })
  }
  return out
}
