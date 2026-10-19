// 地點圖與路徑規劃。

import { geography, type Route, type RouteMode } from './data'

export interface Leg {
  from: string
  to: string
  days: [number, number]
  mode: RouteMode
}

export interface Path {
  legs: Leg[]
  days: [number, number]
}

interface Edge {
  to: string
  route: Route & { days: [number, number] }
}

const adjacency = new Map<string, Edge[]>()
for (const route of geography.routes) {
  if (!route.days) continue
  const r = route as Route & { days: [number, number] }
  for (const [x, y] of [[r.a, r.b], [r.b, r.a]] as const) {
    if (!adjacency.has(x)) adjacency.set(x, [])
    adjacency.get(x)!.push({ to: y, route: r })
  }
}

export function neighbors(id: string): Edge[] {
  return adjacency.get(id) ?? []
}

/** 以最少天數為準的最短路徑（Dijkstra）；到不了回傳 null。 */
export function shortestPath(from: string, to: string): Path | null {
  if (from === to) return { legs: [], days: [0, 0] }
  const best = new Map<string, number>([[from, 0]])
  const prev = new Map<string, Edge & { from: string }>()
  const queue: [number, string][] = [[0, from]]
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0])
    const [dist, node] = queue.shift()!
    if (node === to) break
    if (dist > (best.get(node) ?? Infinity)) continue
    for (const edge of neighbors(node)) {
      const next = dist + edge.route.days[0]
      if (next < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, next)
        prev.set(edge.to, { ...edge, from: node })
        queue.push([next, edge.to])
      }
    }
  }
  if (!prev.has(to)) return null
  const legs: Leg[] = []
  for (let node = to; node !== from; ) {
    const edge = prev.get(node)!
    legs.unshift({ from: edge.from, to: node, days: edge.route.days, mode: edge.route.mode })
    node = edge.from
  }
  const days: [number, number] = [
    legs.reduce((sum, leg) => sum + leg.days[0], 0),
    legs.reduce((sum, leg) => sum + leg.days[1], 0),
  ]
  return { legs, days }
}

/** 從某地出發可以到達的所有地點與預估天數，依天數排序。 */
export function reachable(from: string): { id: string; path: Path }[] {
  return geography.locations
    .filter((l) => l.id !== from)
    .map((l) => ({ id: l.id, path: shortestPath(from, l.id) }))
    .filter((r): r is { id: string; path: Path } => r.path !== null)
    .sort((a, b) => a.path.days[0] - b.path.days[0])
}
