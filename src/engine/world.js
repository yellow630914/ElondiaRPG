// 地點圖與路徑規劃。
import { geography } from './data';
const adjacency = new Map();
for (const route of geography.routes) {
    if (!route.days)
        continue;
    const r = route;
    for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) {
        if (!adjacency.has(x))
            adjacency.set(x, []);
        adjacency.get(x).push({ to: y, route: r });
    }
}
export function neighbors(id) {
    return adjacency.get(id) ?? [];
}
/** 以最少天數為準的最短路徑（Dijkstra）；到不了回傳 null。 */
export function shortestPath(from, to) {
    if (from === to)
        return { legs: [], days: [0, 0] };
    const best = new Map([[from, 0]]);
    const prev = new Map();
    const queue = [[0, from]];
    while (queue.length > 0) {
        queue.sort((a, b) => a[0] - b[0]);
        const [dist, node] = queue.shift();
        if (node === to)
            break;
        if (dist > (best.get(node) ?? Infinity))
            continue;
        for (const edge of neighbors(node)) {
            const next = dist + edge.route.days[0];
            if (next < (best.get(edge.to) ?? Infinity)) {
                best.set(edge.to, next);
                prev.set(edge.to, { ...edge, from: node });
                queue.push([next, edge.to]);
            }
        }
    }
    if (!prev.has(to))
        return null;
    const legs = [];
    for (let node = to; node !== from;) {
        const edge = prev.get(node);
        legs.unshift({ from: edge.from, to: node, days: edge.route.days, mode: edge.route.mode, ...(edge.route.fare !== undefined ? { fare: edge.route.fare } : {}) });
        node = edge.from;
    }
    const days = [
        legs.reduce((sum, leg) => sum + leg.days[0], 0),
        legs.reduce((sum, leg) => sum + leg.days[1], 0),
    ];
    return { legs, days };
}
/** 從某地出發可以到達的所有地點與預估天數，依天數排序。 */
export function reachable(from) {
    return geography.locations
        .filter((l) => l.id !== from)
        .map((l) => ({ id: l.id, path: shortestPath(from, l.id) }))
        .filter((r) => r.path !== null)
        .sort((a, b) => a.path.days[0] - b.path.days[0]);
}
