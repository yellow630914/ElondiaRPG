// 特殊地圖的自訂內容（docs/SPECIAL_MAPS.md、docs/CONTENT_EDITOR.md）。
// 內建的地圖每一項都可以改、不能刪；自建的地圖沒有被用到時可以刪。

import {
  DUNGEON_LAYER_IDS, enemies, geography, isSpecialMapId, itemDef, npcs as namedNpcs, shopRules, specialKey, specialMapLegend, specialMaps, stories,
  type DungeonLayerId, type EncounterGroup, type ShopType, type SpecialConnection, type SpecialMapDef,
} from './data'
import { settlementArea, type CellKind } from './grid'
import { isLotCell } from './homes'
import type { Lighting } from './light'
import { cleanFlag } from './storyFlags'

export interface SpecialMapMod extends SpecialMapDef {
  custom?: boolean
}

export const SPECIAL_MAP_LIMITS = {
  name_chars: 16, desc_chars: 300, size: [3, 20], carve: [5, 400], count: [0, 20], elites: [0, 5],
  connections: 8, table: 8, group_types: 4, group_count: [1, 6], items: 6, flags: 4, shops: 8, bosses: 8, boss_name_chars: 12,
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
 * 整理特殊地圖。known 是同一批一起整理的地圖（匯入時互相接的通道），沒有時只認得目前的地圖；
 * refs 判斷遭遇表的怪物與資源的物品存不存在（匯入時同一包裡的也算）。
 * 通道只有固定地圖可以設定；接到城鎮時那一格要是牆或水。
 */
export function sanitizeSpecialMapMod(
  id: string, raw: Partial<SpecialMapMod>, known: Record<string, Pick<SpecialMapDef, 'grid' | 'size'>> = {}, shopIds: Set<string> = new Set(Object.keys(shopRules.types)),
  refs: { enemy: (id: string) => boolean; item: (name: string) => boolean } = { enemy: (x) => !!enemies[x], item: (n) => !!itemDef(n) },
): SpecialMapMod {
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
  const cleanGroup = (g: unknown): EncounterGroup => (Array.isArray(g) ? g : [])
    .filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && refs.enemy(x[0]))
    .slice(0, L.group_types)
    .map(([m, n]) => [m, int(n, L.group_count, 1)] as [string, number])
  const table = (Array.isArray(raw.table) ? raw.table : [])
    .map(cleanGroup)
    .filter((g): g is EncounterGroup => g.length > 0)
    .slice(0, L.table)
  if (table.length) out.table = table
  const items = [...new Set((Array.isArray(raw.resource_items) ? raw.resource_items : []).filter((n): n is string => typeof n === 'string' && refs.item(n)))].slice(0, L.items)
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
      // 城鎮那一頭要是牆或水，而且不能是待售的空地（遊戲裡會變成空地，通道只剩單向）
      if (!area.startsWith('sm/')) {
        const kind = settlementArea(area, false)?.cells[y * size[0] + x]?.kind
        if ((kind !== 'wall' && kind !== 'water') || isLotCell(area, x, y)) continue
      }
      const conn: SpecialConnection = { at: { x: c.at.x, y: c.at.y }, to: { area, x, y } }
      const flags = [...new Set((c.requires?.flags ?? []).map(cleanFlag).filter(Boolean))].slice(0, L.flags)
      const none = [...new Set((c.requires?.flags_none ?? []).map(cleanFlag).filter(Boolean))].slice(0, L.flags)
      if (flags.length || none.length) conn.requires = { ...(flags.length ? { flags } : {}), ...(none.length ? { flags_none: none } : {}) }
      connections.push(conn)
    }
    if (connections.length) out.connections = connections
    // 商店：存在的店種，一格一家
    const shops: NonNullable<SpecialMapDef['shops']> = []
    for (const s of (Array.isArray(raw.shops) ? raw.shops : []).slice(0, L.shops)) {
      if (!s || typeof s.shop !== 'string' || !shopIds.has(s.shop) || s.shop === 'wanderer' || !inside(s)) continue
      if (shops.some((x) => x.x === s.x && x.y === s.y)) continue
      shops.push({ shop: s.shop, x: s.x, y: s.y })
    }
    if (shops.length) out.shops = shops
    // BOSS 格：只留畫在地圖上的 B 格，一格一組
    const legend = { ...specialMapLegend, ...(raw.legend ?? {}) }
    const bosses: NonNullable<SpecialMapDef['bosses']> = []
    for (const b of (Array.isArray(raw.bosses) ? raw.bosses : []).slice(0, L.bosses)) {
      if (!b || !inside(b) || legend[out.grid[b.y]![b.x]!] !== 'boss' || bosses.some((x) => x.x === b.x && x.y === b.y)) continue
      const group = cleanGroup(b.group)
      const name = str(b.name, L.boss_name_chars)
      if (group.length || name) bosses.push({ x: b.x, y: b.y, group, ...(name ? { name } : {}) })
    }
    if (bosses.length) out.bosses = bosses
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
  const key = specialKey(id)
  for (const n of namedNpcs) {
    if (n.fixed?.area === key || n.stages?.some((st) => st.fixed?.area === key)) out.push(`固定 NPC「${n.name}」待在這裡`)
  }
  return [...new Set(out)]
}

/** 任務點（⭐）可以指定的格子種類：空地與固定的遭遇、強敵、資源、寶箱、陷阱 */
const STORY_SPOT_KINDS = new Set<string>(['floor', 'encounter', 'elite', 'resource', 'chest', 'trap'])

/**
 * 任務點能不能放在固定地圖的這一格：不行時回傳原因（隨機地圖、超出範圍、不是空地或固定內容、入口、通道的端點）。
 * 不行的格子在遊戲裡改成隨機放在一格空地。
 */
export function storySpotProblem(id: string, x: number, y: number): string | undefined {
  const def = specialMaps[id]
  const map = specialPreview(id)
  if (!def || !map) return '隨機地圖不能指定格子'
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return '格子超出地圖'
  if (!STORY_SPOT_KINDS.has(map.cells[y * map.width + x]!.kind)) return '那一格不是空地（或遭遇、資源、寶箱、陷阱）'
  if (def.entry && def.entry.x === x && def.entry.y === y) return '那一格是入口'
  const key = specialKey(id)
  const ends = [
    ...(def.connections ?? []).map((c) => c.at),
    ...Object.values(specialMaps).flatMap((d) => (d.connections ?? []).filter((c) => c.to.area === key).map((c) => c.to)),
  ]
  if (ends.some((e) => e.x === x && e.y === y)) return '那一格是通道的端點'
  return undefined
}

/** 固定地圖的樣子（不含隨機的內容；商店照擺的位置）：固定 NPC 選格子、檢查位置用。隨機地圖沒有固定的樣子 */
export function specialPreview(id: string): { key: string; name: string; width: number; height: number; cells: { kind: CellKind }[] } | undefined {
  const def = specialMaps[id]
  if (!def?.grid?.length) return undefined
  const legend = { ...specialMapLegend, ...(def.legend ?? {}) }
  const [width, height] = mapSize(def)
  const cells = def.grid.flatMap((row) => Array.from({ length: width }, (_, x) => ({ kind: (legend[row[x] ?? '#'] ?? 'wall') as CellKind })))
  for (const s of def.shops ?? []) {
    const t = shopRules.types[s.shop as ShopType]
    if (t && s.x < width && s.y < height) cells[s.y * width + s.x] = { kind: (t.custom ? s.shop : t.cell) as CellKind }
  }
  return { key: specialKey(id), name: def.name, width, height, cells }
}
