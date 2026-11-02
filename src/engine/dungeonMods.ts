// 自建地下城的自訂內容（docs/plan/roadmap/LOCATION_EDITOR_PLAN.md、docs/CONTENT_DEPENDENCIES.md）。
// 自建的地下城是世界上的一個地點：經由路線旅行到達，只能接內建的聚落；各層的遭遇與層主記在地下城上（地下城 → 怪物），
// 刪掉地下城時遭遇表一起拿掉；有自建地下城用到的自建怪物不能刪。內建的地點、路線、地區都不能改。

import mapsJson from '@data/world/maps.json'
import {
  BOSS_LAYER_IDS, DUNGEON_LAYER_IDS, DUNGEON_LAYER_NAME, dungeonEncounters, enemies, geography, itemRules, reindexLocations, specialMaps, stories,
  type BossLayerId, type DungeonEncounters, type DungeonLayerId, type EncounterGroup, type Location, type Route, type RouteMode, type StoryCond,
} from './data'
import { gearRules } from './gear'
import { sanitizeCond } from './mods'
import { travelEvents } from './road'
import type { GameState } from './types'
import { rebuildRoutes } from './world'

type Lighting = 'lit' | 'daylight' | 'dark'

export interface DungeonRoute {
  /** 接到哪個聚落（只能是內建的聚落） */
  to: string
  days: [number, number]
  mode: RouteMode
  /** 這段路每人收的船資；沒寫時照路的種類（海路每段 50） */
  fare?: number
}

export interface DungeonMod {
  /** loc_ 開頭 */
  id: string
  name: string
  /** 只能選現有的地區 */
  region: string
  /** 給 AI 的描述 */
  desc?: string
  /** 劇情條件成立才找得到、才能前往 */
  requires?: StoryCond
  /** 寶箱與人形怪掉的隨機裝備優先用這一套材料 */
  material_series?: string
  routes: DungeonRoute[]
  /** 各層的遭遇（周邊、淺層、中層、深層；有底層時多一層） */
  layers: Partial<Record<DungeonLayerId, EncounterGroup[]>>
  /** 有沒有底層（五層） */
  abyss?: boolean
  /** 各層的層主：第一種是層主，其他是護衛 */
  bosses?: Partial<Record<BossLayerId, EncounterGroup>>
  /** 各層的光線（周邊起算）；沒寫的層照共用的預設 */
  lighting?: Lighting[]
  custom: true
}

export const DUNGEON_LIMITS = {
  name_chars: 16, desc_chars: 300, routes: 6, days: [0.5, 30], fare: [0, 9999], groups: 12, group_types: 4, group_count: [1, 6], boss_types: 3,
} as const

export const ROUTE_MODES: RouteMode[] = ['road', 'trail', 'wild', 'sea', 'dive', 'underground']
const LIGHTINGS: Lighting[] = ['lit', 'daylight', 'dark']
export const DUNGEON_ID = /^loc_[a-z0-9_]{1,40}$/

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d
}
const int = (v: unknown, lim: readonly [number, number], d: number) => Math.round(num(v, lim, d))
/** 天數以半天為單位 */
const halfDay = (v: unknown, d: number) => Math.round(num(v, DUNGEON_LIMITS.days, d) * 2) / 2

const lighting = (mapsJson as unknown as { lighting: { locations: Record<string, Lighting[]> } }).lighting

// ---- 內建資料的快照（模組載入時；內建的地點、路線不能改） ----

const builtinIds = new Set(geography.locations.map((l) => l.id))
const builtinSettlements = new Set(geography.locations.filter((l) => l.type !== 'dungeon').map((l) => l.id))
const builtinLighting = new Set(Object.keys(lighting.locations))

/** 這個地點是自建的地下城 */
export function isCustomDungeon(id: string): boolean {
  return !builtinIds.has(id) && geography.locations.some((l) => l.id === id)
}

/** 自建地下城的路線可以接的聚落：內建的聚落 */
export function routeTargets(): Location[] {
  return geography.locations.filter((l) => builtinSettlements.has(l.id))
}

export function newDungeonId(): string {
  return `loc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`
}

/** 新的地下城：中央平原，接索里耶爾一天的山道，各層還沒有怪物 */
export function newDungeon(id: string): DungeonMod {
  return {
    id, name: '新的地下城', region: geography.regions[0]!.id, custom: true,
    routes: [{ to: 'soriel', days: [1, 1], mode: 'trail' }],
    layers: { outskirts: [], shallow: [], middle: [], deep: [] },
  }
}

/** 這座地下城有哪幾層 */
export function dungeonLayersOf(m: Pick<DungeonMod, 'abyss'>): DungeonLayerId[] {
  return DUNGEON_LAYER_IDS.filter((l) => l !== 'abyss' || !!m.abyss)
}

// ---- 整理 ----

function group(raw: unknown, known: (id: string) => boolean, types: number): EncounterGroup | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: EncounterGroup = []
  for (const g of raw) {
    if (!Array.isArray(g) || typeof g[0] !== 'string' || !known(g[0]) || seen.has(g[0])) continue
    seen.add(g[0])
    out.push([g[0], int(g[1], DUNGEON_LIMITS.group_count, 1)])
    if (out.length >= types) break
  }
  return out.length ? out : undefined
}

/**
 * 整理自建地下城。knownEnemy 判斷怪物存不存在（匯入時同一包裡的新怪物也算）。
 * id 不對時丟錯（呼叫的人略過這一項）；其他欄位不對的拿掉或改成預設。
 */
export function sanitizeDungeonMod(id: string, raw: Partial<DungeonMod>, knownEnemy: (id: string) => boolean = (x) => !!enemies[x]): DungeonMod {
  if (!DUNGEON_ID.test(id)) throw new Error('自建地下城的 id 要是 loc_ 開頭')
  if (builtinIds.has(id)) throw new Error('不能蓋過內建的地點')
  const L = DUNGEON_LIMITS
  const region = geography.regions.some((r) => r.id === raw.region) ? raw.region! : geography.regions[0]!.id
  const routes: DungeonRoute[] = []
  for (const r of Array.isArray(raw.routes) ? raw.routes : []) {
    if (!r || !builtinSettlements.has(r.to) || routes.some((x) => x.to === r.to)) continue
    const lo = halfDay(r.days?.[0], 1)
    const hi = halfDay(r.days?.[1], lo)
    const route: DungeonRoute = { to: r.to, days: [Math.min(lo, hi), Math.max(lo, hi)], mode: ROUTE_MODES.includes(r.mode) ? r.mode : 'trail' }
    if (r.fare !== undefined && r.fare !== null && String(r.fare) !== '') route.fare = int(r.fare, L.fare, 0)
    routes.push(route)
    if (routes.length >= L.routes) break
  }
  const out: DungeonMod = { id, name: str(raw.name, L.name_chars) || '未命名的地下城', region, routes, layers: {}, custom: true }
  const desc = str(raw.desc, L.desc_chars)
  if (desc) out.desc = desc
  const requires = sanitizeCond(raw.requires)
  if (requires) out.requires = requires
  const series = str(raw.material_series, 30)
  if (series && Object.values(gearRules.materials).some((m) => m.series === series)) out.material_series = series
  if (raw.abyss) out.abyss = true
  for (const layer of dungeonLayersOf(out)) {
    const groups = (Array.isArray(raw.layers?.[layer]) ? raw.layers![layer]! : [])
      .map((g) => group(g, knownEnemy, L.group_types))
      .filter((g): g is EncounterGroup => !!g)
      .slice(0, L.groups)
    out.layers[layer] = groups
  }
  const bosses: Partial<Record<BossLayerId, EncounterGroup>> = {}
  for (const layer of BOSS_LAYER_IDS.filter((l) => l !== 'abyss' || out.abyss)) {
    const g = group(raw.bosses?.[layer], knownEnemy, L.boss_types)
    if (g) bosses[layer] = g
  }
  if (Object.keys(bosses).length) out.bosses = bosses
  const lights = (Array.isArray(raw.lighting) ? raw.lighting : []).slice(0, dungeonLayersOf(out).length)
  if (lights.length && lights.every((x) => LIGHTINGS.includes(x))) out.lighting = [...lights]
  return out
}

// ---- 套用與還原 ----

/** 把地點、路線、光線還原成內建的樣子（自建的拿掉）；遭遇表由 mods.ts 的 restore 一起還原 */
export function restoreDungeons() {
  for (let i = geography.locations.length - 1; i >= 0; i--) if (!builtinIds.has(geography.locations[i]!.id)) geography.locations.splice(i, 1)
  for (let i = geography.routes.length - 1; i >= 0; i--) {
    const r = geography.routes[i]!
    if (!builtinIds.has(r.a) || !builtinIds.has(r.b)) geography.routes.splice(i, 1)
  }
  for (const id of Object.keys(lighting.locations)) if (!builtinLighting.has(id)) delete lighting.locations[id]
  for (const id of Object.keys(dungeonEncounters)) if (!builtinIds.has(id)) delete dungeonEncounters[id]
  reindexLocations()
  rebuildRoutes()
}

/** 套用一座自建地下城：加進地點、路線、遭遇表與光線（同一個 id 已經有了先拿掉） */
export function applyDungeonMod(m: DungeonMod) {
  removeDungeon(m.id)
  const loc: Location = { id: m.id, name: m.name, region: m.region, type: 'dungeon' }
  if (m.requires) loc.requires = clone(m.requires)
  if (m.material_series) loc.material_series = m.material_series
  if (m.desc) loc.desc = m.desc
  geography.locations.push(loc)
  for (const r of m.routes) {
    const route: Route = { a: m.id, b: r.to, days: [...r.days], mode: r.mode }
    if (r.fare !== undefined) route.fare = r.fare
    geography.routes.push(route)
  }
  const enc: DungeonEncounters = {
    outskirts: clone(m.layers.outskirts ?? []),
    shallow: clone(m.layers.shallow ?? []),
    middle: clone(m.layers.middle ?? []),
    deep: clone(m.layers.deep ?? []),
    // 深層的層主寫在 bosses.deep（舊資料的 boss 欄位留空：沒設的層主照強敵的規則）
    boss: [],
  }
  // 底層要有怪物才算五層（dungeonDepth）
  if (m.abyss && m.layers.abyss?.length) enc.abyss = clone(m.layers.abyss)
  if (m.bosses && Object.keys(m.bosses).length) enc.bosses = clone(m.bosses)
  dungeonEncounters[m.id] = enc
  if (m.lighting?.length) lighting.locations[m.id] = [...m.lighting]
  reindexLocations()
  rebuildRoutes()
}

function removeDungeon(id: string) {
  if (builtinIds.has(id)) return
  const i = geography.locations.findIndex((l) => l.id === id)
  if (i >= 0) geography.locations.splice(i, 1)
  for (let j = geography.routes.length - 1; j >= 0; j--) {
    const r = geography.routes[j]!
    if (r.a === id || r.b === id) geography.routes.splice(j, 1)
  }
  delete dungeonEncounters[id]
  delete lighting.locations[id]
}

// ---- 引用 ----

/** 這座地下城各層與層主用到的怪物 */
export function dungeonEnemies(m: Pick<DungeonMod, 'layers' | 'bosses'>): Set<string> {
  const out = new Set<string>()
  for (const groups of Object.values(m.layers ?? {})) for (const g of groups ?? []) for (const [e] of g) out.add(e)
  for (const g of Object.values(m.bosses ?? {})) for (const [e] of g ?? []) out.add(e)
  return out
}

/** 有哪些自建地下城的哪幾層用到這隻怪物（mods 給了時看這一份，否則看已套用的遭遇表） */
export function enemyInDungeons(enemyId: string, mods: Record<string, DungeonMod>): string[] {
  const out: string[] = []
  for (const m of Object.values(mods)) {
    const where = [
      ...dungeonLayersOf(m).filter((l) => m.layers[l]?.some((g) => g.some(([e]) => e === enemyId))).map((l) => DUNGEON_LAYER_NAME[l]),
      ...BOSS_LAYER_IDS.filter((l) => m.bosses?.[l]?.some(([e]) => e === enemyId)).map((l) => `${DUNGEON_LAYER_NAME[l]}層主`),
    ]
    if (where.length) out.push(`自建地下城「${m.name}」的${where.join('、')}`)
  }
  return out
}

/** 從自建地下城拿掉這隻怪物（「從這些地下城拿掉」）：組裡只剩它的整組拿掉；回傳改過的地下城 */
export function withoutEnemy(m: DungeonMod, enemyId: string): DungeonMod | undefined {
  if (!dungeonEnemies(m).has(enemyId)) return undefined
  const out = clone(m)
  for (const layer of Object.keys(out.layers) as DungeonLayerId[]) {
    out.layers[layer] = (out.layers[layer] ?? []).map((g) => g.filter(([e]) => e !== enemyId)).filter((g) => g.length)
  }
  for (const layer of Object.keys(out.bosses ?? {}) as BossLayerId[]) {
    const g = out.bosses![layer]!.filter(([e]) => e !== enemyId)
    if (g.length) out.bosses![layer] = g
    else delete out.bosses![layer]
  }
  if (out.bosses && !Object.keys(out.bosses).length) delete out.bosses
  return out
}

/**
 * 哪些地方用到這座地下城：特殊任務（任務點、帶去那裡）、事件（地下城事件、改道）、特殊地圖（所屬地點、園區的通道）、
 * 情報物品，以及目前的存檔（人在裡面、旅途、待處理的移動、戰敗、進行中的委託、有效的情報）。
 * 生成的冒險者在這裡出沒不擋（套用與讀檔時拿掉）。
 */
export function dungeonUsage(id: string, state?: GameState | null): string[] {
  const out: string[] = []
  for (const s of stories) {
    if (s.start.location === id) out.push(`特殊任務「${s.title}」的開頭`)
    for (const n of s.nodes) {
      if (n.at.location === id) out.push(`特殊任務「${s.title}」的任務點「${n.title}」`)
      const outcomes = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]
      if (outcomes.some((o) => o?.travel_to === id)) out.push(`特殊任務「${s.title}」的任務點「${n.title}」帶去這裡`)
    }
  }
  for (const t of travelEvents.templates) {
    if (t.dungeons?.includes(id)) out.push(`地下城事件「${t.title}」`)
    const outcomes = [t.success, t.fail, ...(t.options ?? []).flatMap((o) => [o.success, o.fail])]
    if (outcomes.some((o) => o?.travel_to === id)) out.push(`事件「${t.title}」改道到這裡`)
  }
  for (const m of Object.values(specialMaps)) {
    if (m.location === id) out.push(`特殊地圖「${m.name}」屬於這裡`)
    if (m.connections?.some((c) => c.to.area === `dungeon/${id}`)) out.push(`特殊地圖「${m.name}」的通道`)
  }
  for (const it of itemRules.items) if (it.intel?.location === id) out.push(`情報物品「${it.name}」`)
  if (state) {
    if (state.location === id) out.push('目前的存檔正在這裡')
    if (state.road && (state.road.from === id || state.road.to === id)) out.push('目前的存檔正在往返這裡的旅途上')
    if (state.pendingMove?.travel_to === id) out.push('目前的存檔待處理的移動')
    if (state.pendingDefeat?.location === id) out.push('目前的存檔待處理的戰敗')
    for (const q of state.quests) if ((q.status === 'accepted' || q.status === 'ready') && q.target === id) out.push(`進行中的委託「${q.title}」`)
    for (const it of state.intel ?? []) if (it.status === 'active' && it.location === id) out.push(`情報「${it.title}」`)
  }
  return [...new Set(out)]
}
