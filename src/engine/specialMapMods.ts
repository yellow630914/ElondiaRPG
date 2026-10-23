// 特殊地圖的自訂內容（docs/SPECIAL_MAPS.md、docs/CONTENT_EDITOR.md）。
// 內建的地圖每一項都可以改、不能刪；自建的地圖沒有被用到時可以刪。

import {
  DUNGEON_LAYER_IDS, enemies, geography, isSpecialMapId, itemDef, npcs as namedNpcs, specialKey, specialMapLegend, specialMaps, stories,
  type DungeonLayerId, type EncounterGroup, type SpecialConnection, type SpecialMapDef,
} from './data'
import { settlementArea } from './grid'
import type { Lighting } from './light'
import { cleanFlag } from './storyFlags'

export interface SpecialMapMod extends SpecialMapDef {
  custom?: boolean
}

export const SPECIAL_MAP_LIMITS = {
  name_chars: 16, desc_chars: 300, size: [3, 20], carve: [5, 400], count: [0, 20], elites: [0, 5],
  connections: 8, table: 8, group_types: 4, group_count: [1, 6], items: 6, flags: 4,
} as const
export const LIGHTINGS: Record<Lighting, string> = { lit: '一直有光', daylight: '白天有光', dark: '黑暗' }
/** 固定地圖可以畫的格子（共用的圖例） */
export const MAP_CHARS = Object.keys(specialMapLegend)

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const int = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d
}
const range = (v: unknown, lim: readonly [number, number]): [number, number] | undefined => {
  if (!Array.isArray(v)) return undefined
  const lo = int(v[0], lim, 0)
  const hi = int(v[1], lim, lo)
  return lo || hi ? [Math.min(lo, hi), Math.max(lo, hi)] : undefined
}

/** 內建地圖的快照（模組載入時） */
const snapshot = clone(specialMaps)

export function builtinSpecialMap(id: string): SpecialMapDef | undefined {
  return snapshot[id] ? clone(snapshot[id]!) : undefined
}

export function newSpecialMapId(): string {
  return `sm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** 新地圖：一間小石室，下方是出口 */
export function newSpecialMap(id: string, location = geography.locations[0]!.id): SpecialMapMod {
  return {
    id, name: '新的特殊地圖', location, desc: '', lighting: 'dark', layer: 'shallow', custom: true,
    grid: ['#######', '#.....#', '#.....#', '#.....#', '###E###'],
  }
}

/** 地圖的寬高（固定地圖照格子，隨機地圖照 size） */
export function mapSize(def: Pick<SpecialMapDef, 'grid' | 'size'>): [number, number] {
  return def.grid?.length ? [Math.max(...def.grid.map((r) => r.length)), def.grid.length] : (def.size ?? [9, 7])
}

/** 通道另一頭的區域與它的大小（特殊地圖看定義，城鎮看區塊）；不存在時為 undefined */
function targetSize(area: string, known: Record<string, Pick<SpecialMapDef, 'grid' | 'size'>>): [number, number] | undefined {
  if (area.startsWith('sm/')) {
    const def = known[area.slice(3)] ?? specialMaps[area.slice(3)]
    return def ? mapSize(def) : undefined
  }
  const block = settlementArea(area, false)
  return block ? [block.width, block.height] : undefined
}

/**
 * 整理特殊地圖。known 是同一批一起整理的地圖（匯入時互相接的通道），沒有時只認得目前的地圖。
 * 通道只有固定地圖可以設定；接到城鎮時那一格要是牆或水。
 */
export function sanitizeSpecialMapMod(id: string, raw: Partial<SpecialMapMod>, known: Record<string, Pick<SpecialMapDef, 'grid' | 'size'>> = {}): SpecialMapMod {
  if (!isSpecialMapId(id)) throw new Error('特殊地圖的 id 要是 sm_ 開頭（小寫英數與底線）')
  const L = SPECIAL_MAP_LIMITS
  const base = builtinSpecialMap(id)
  const location = geography.locations.some((l) => l.id === raw.location) ? raw.location! : base?.location ?? geography.locations[0]!.id
  const out: SpecialMapMod = {
    id,
    name: str(raw.name, L.name_chars) || base?.name || '新的特殊地圖',
    location,
    desc: str(raw.desc, L.desc_chars),
    lighting: raw.lighting && LIGHTINGS[raw.lighting] ? raw.lighting : 'dark',
    layer: DUNGEON_LAYER_IDS.includes(raw.layer as DungeonLayerId) ? raw.layer : 'shallow',
  }
  if (raw.refresh) out.refresh = true
  // 版面：固定地圖（格子）或隨機地圖（大小）
  const rows = (Array.isArray(raw.grid) ? raw.grid : []).filter((r): r is string => typeof r === 'string').slice(0, L.size[1])
  if (rows.length) {
    const width = int(Math.max(...rows.map((r) => [...r].length)), L.size, 3)
    const grid = rows.map((r) => Array.from({ length: width }, (_, x) => ([...r][x] && MAP_CHARS.includes([...r][x]!) ? [...r][x]! : '#')).join(''))
    while (grid.length < L.size[0]) grid.push('#'.repeat(width))
    out.grid = grid
  } else {
    const size = Array.isArray(raw.size) ? raw.size : [9, 7]
    out.size = [int(size[0], L.size, 9), int(size[1], L.size, 7)]
    if (raw.carve_steps !== undefined) out.carve_steps = int(raw.carve_steps, L.carve, out.size[0] * out.size[1])
  }
  const [width, height] = mapSize(out)
  const inside = (p: unknown): p is { x: number; y: number } => {
    const q = p as { x?: unknown; y?: unknown } | undefined
    return !!q && Number.isInteger(q.x) && Number.isInteger(q.y) && (q.x as number) >= 0 && (q.y as number) >= 0 && (q.x as number) < width && (q.y as number) < height
  }
  // 額外隨機撒的內容
  for (const k of ['encounters', 'traps', 'resources', 'chests'] as const) {
    const r = range(raw[k], L.count)
    if (r) out[k] = r
  }
  const elites = int(raw.elites, L.elites, 0)
  if (elites) out.elites = elites
  // 遭遇表：存在的怪物
  const table = (Array.isArray(raw.table) ? raw.table : [])
    .map((g) => (Array.isArray(g) ? g : [])
      .filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && !!enemies[x[0]])
      .slice(0, L.group_types)
      .map(([m, n]) => [m, int(n, L.group_count, 1)] as [string, number]))
    .filter((g): g is EncounterGroup => g.length > 0)
    .slice(0, L.table)
  if (table.length) out.table = table
  const items = [...new Set((Array.isArray(raw.resource_items) ? raw.resource_items : []).filter((n): n is string => typeof n === 'string' && !!itemDef(n)))].slice(0, L.items)
  if (items.length) out.resource_items = items
  if (inside(raw.entry)) out.entry = { x: raw.entry.x, y: raw.entry.y }
  // 通道（只有固定地圖）
  if (out.grid) {
    const connections: SpecialConnection[] = []
    for (const c of (Array.isArray(raw.connections) ? raw.connections : []).slice(0, L.connections)) {
      if (!c || !inside(c.at) || typeof c.to?.area !== 'string') continue
      const area = c.to.area
      if (area === specialKey(id)) continue
      const size = targetSize(area, known)
      if (!size) continue
      const { x, y } = c.to
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size[0] || y >= size[1]) continue
      // 城鎮那一頭要是牆或水
      if (!area.startsWith('sm/')) {
        const kind = settlementArea(area, false)?.cells[y * size[0] + x]?.kind
        if (kind !== 'wall' && kind !== 'water') continue
      }
      const conn: SpecialConnection = { at: { x: c.at.x, y: c.at.y }, to: { area, x, y } }
      const flags = [...new Set((c.requires?.flags ?? []).map(cleanFlag).filter(Boolean))].slice(0, L.flags)
      const none = [...new Set((c.requires?.flags_none ?? []).map(cleanFlag).filter(Boolean))].slice(0, L.flags)
      if (flags.length || none.length) conn.requires = { ...(flags.length ? { flags } : {}), ...(none.length ? { flags_none: none } : {}) }
      connections.push(conn)
    }
    if (connections.length) out.connections = connections
  }
  if (!base) out.custom = true
  return out
}

/** 把特殊地圖還原成內建的樣子（自建的拿掉） */
export function restoreSpecialMaps() {
  for (const id of Object.keys(specialMaps)) if (!snapshot[id]) delete specialMaps[id]
  for (const [id, m] of Object.entries(snapshot)) specialMaps[id] = clone(m)
}

export function applySpecialMapMod(id: string, m: SpecialMapMod) {
  const { custom: _custom, ...def } = clone(m)
  specialMaps[id] = { ...def, id }
}

/** 哪些地方用到這張地圖：特殊任務（任務點、傳送）、其他地圖的通道、待在這裡的固定 NPC */
export function specialMapUsage(id: string): string[] {
  const out: string[] = []
  for (const s of stories) {
    for (const n of s.nodes) {
      if (n.at.where === 'special' && n.at.special_map === id) out.push(`特殊任務「${s.title}」的任務點「${n.title}」`)
      const outcomes = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]
      if (outcomes.some((o) => o?.special_map === id)) out.push(`特殊任務「${s.title}」的任務點「${n.title}」傳送到這裡`)
    }
  }
  for (const def of Object.values(specialMaps)) {
    if (def.id !== id && def.connections?.some((c) => c.to.area === specialKey(id))) out.push(`特殊地圖「${def.name}」的通道`)
  }
  for (const n of namedNpcs) if ((n as { special_map?: string }).special_map === id) out.push(`固定 NPC「${n.name}」待在這裡`)
  return [...new Set(out)]
}
