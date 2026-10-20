// 走格子系統。
//
// 每個地點由區塊組成，區塊由格子組成：
// - 城市與城鎮的區塊是固定地圖（data/world/maps.json），可在區塊間通行，城門可出城或啟程旅行。
// - 城鎮近郊（荒野）與冒險區域（周邊 → 淺層 → 中層 → 深層）是隨機生成的格子，存在 GameState.areas，
//   有戰爭迷霧；離開後重新進入會重新生成（近郊每天換一次）。
// 走進格子會觸發內容：遭遇（戰鬥）、陷阱（檢定）、資源（採集）等；設施與樓梯等需要在格子上選擇動作。

import { safeText } from './content'
import mapsJson from '@data/world/maps.json'
import { mod, snapshot } from './character'
import { startCombat, type CombatState } from './combat'
import {
  dungeonEncounters, enemies, itemDef, locationById, regionById, wildEncounters,
  type DungeonLayerId, type EncounterGroup, type Location,
} from './data'
import { forgeItemFor, gearRules, MATERIAL_KINDS, randomGear, registerGear } from './gear'
import { formatMoney } from './money'
import { spawnVisitors } from './population'
import { gateCheck, zoneEntryBlock } from './security'
import { assertMasterAllows } from './slavery'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type { GameState, Report } from './types'

export type CellKind =
  | 'floor' | 'wall' | 'water'
  | 'inn' | 'guild' | 'tavern' | 'shop' | 'temple' | 'gate' | 'link' | 'brothel'
  | 'smithy' | 'tailor' | 'jeweler' | 'magic' | 'informant'
  | 'encounter' | 'elite' | 'boss' | 'trap' | 'resource' | 'safe' | 'chest'
  | 'stairs_down' | 'stairs_up' | 'exit' | 'quest'

export interface Cell {
  kind: CellKind
  /** 已清除的遭遇、已觸發的陷阱、已採集的資源、已使用的安全房 */
  done?: boolean
  group?: EncounterGroup
  item?: string
  questId?: string
  /** 通道：通往的區域與座標 */
  link?: { area: string; x: number; y: number }
  /** 寶箱：這一層怪物的最高等級（決定內容） */
  level?: number
  /** 打倒守在這裡的層主後，格子變成這種設施（淺層、中層的層主守著往下的階梯） */
  then?: CellKind
}

export interface Area {
  key: string
  location: string
  name: string
  kind: 'settlement' | 'wild' | 'dungeon'
  /** 聚落區塊所屬的地區（貴族區、王城）；沒有時為一般區域 */
  zone?: Zone
  /** 冒險區域的層數（0 = 周邊） */
  layer?: number
  width: number
  height: number
  cells: Cell[]
  /** 已探索的格子索引；城鎮固定地圖全部可見，不需要記錄 */
  revealed?: number[]
  /** 生成的日期（近郊每天重新生成） */
  day?: number
}

export interface Position {
  area: string
  x: number
  y: number
  /** 上一格，戰鬥撤退時退回這裡 */
  prev?: { x: number; y: number }
}

interface BlockDef { id: string; name: string; grid: string[]; links?: Record<string, string>; zone?: Zone }

/** 地區：決定 NPC 出現在哪裡（見 docs/NPC_SYSTEM.md 第 5 節） */
export type Zone = 'town' | 'noble' | 'palace' | 'temple' | 'brothel' | 'outskirts' | 'dungeon'
export const ZONES: Zone[] = ['town', 'noble', 'palace', 'temple', 'brothel', 'outskirts', 'dungeon']
interface LayerGen {
  id: DungeonLayerId
  name: string
  encounters: [number, number]
  traps: [number, number]
  resources: [number, number]
  /** 寶箱數量 */
  chests?: [number, number]
  elites?: number
  boss?: boolean
  /** 層主守著往下的階梯（打倒後變成階梯） */
  guard?: boolean
  trap_dc: number
  trap_damage: string
}
const maps = mapsJson as unknown as {
  legend: Record<string, { kind: CellKind; name: string }>
  maps: Record<string, { blocks: BlockDef[] }>
  palace_names: Record<string, string>
  templates: Record<string, { blocks: BlockDef[] }>
  template_by_type: Record<string, string>
  generation: {
    step_minutes: { settlement: number; wild: number; dungeon: number }
    wild: { size: [number, number]; obstacles: number; encounters: [number, number]; resources: [number, number]; resource_items: string[] }
    dungeon: { size: [number, number]; carve_steps: number; layers: LayerGen[]; resource_items: string[] }
  }
}

export const CELL_NAME: Record<CellKind, string> = {
  floor: '道路', wall: '牆', water: '水道',
  inn: '旅店', guild: '冒險者公會', tavern: '酒館', shop: '雜貨店', temple: '神殿', gate: '城門', link: '通道', brothel: '娼館',
  smithy: '鐵匠鋪', tailor: '裁縫店', jeweler: '珠寶店', magic: '魔法物品店', informant: '情報商',
  encounter: '遭遇', elite: '強敵', boss: '層主', trap: '陷阱', resource: '資源', safe: '安全房', chest: '寶箱',
  stairs_down: '往下一層', stairs_up: '往上一層', exit: '出口', quest: '委託地點',
}

/** 地圖與場所標題用的圖示：每一種設施都要有 */
export const CELL_ICON: Partial<Record<CellKind, string>> = {
  inn: '🛏️', guild: '🏛️', tavern: '🍺', shop: '🛒', temple: '⛪', gate: '🚪', link: '➡️', brothel: '🏮',
  smithy: '⚒️', tailor: '🧵', jeweler: '💍', magic: '🔮', informant: '🕵️',
  encounter: '⚔️', elite: '💀', boss: '👑', resource: '🌿', safe: '🔥', chest: '🎁',
  stairs_down: '⬇️', stairs_up: '⬆️', exit: '🚪', quest: '❗', water: '〰️',
}

/** 格子的名稱（關閉成人向時，娼館顯示為按摩店） */
export function cellName(kind: CellKind): string {
  return safeText(CELL_NAME[kind])
}

const WALKABLE_BLOCKERS: CellKind[] = ['wall', 'water']
export const DUNGEON_LAYERS = maps.generation.dungeon.layers

// ---- 區域 ----

function blocksFor(loc: Location): BlockDef[] {
  const custom = maps.maps[loc.id]
  if (custom) return custom.blocks
  const template = maps.templates[maps.template_by_type[loc.type] ?? 'town'] ?? maps.templates.town!
  return template.blocks
}

function settlementKey(locationId: string, blockId: string) {
  return `${locationId}/${blockId}`
}

function palaceName(loc: Location): string {
  return (loc.faction && maps.palace_names[loc.faction]) || '王城'
}

/** 一個地點有哪些地區（依地圖的區塊與設施） */
export function zonesOf(loc: Location): Zone[] {
  const zones = new Set<Zone>(['town', 'outskirts'])
  for (const b of blocksFor(loc)) {
    if (b.zone) zones.add(b.zone)
    if (b.grid.some((row) => row.includes('C'))) zones.add('temple')
    if (b.grid.some((row) => row.includes('B'))) zones.add('brothel')
  }
  return [...zones]
}

/** 聚落的各區塊：區域 key、地區、有哪些設施 */
export function settlementBlocks(loc: Location): { key: string; zone: Zone; kinds: Set<CellKind> }[] {
  if (loc.type === 'dungeon') return []
  return blocksFor(loc).map((b) => ({
    key: settlementKey(loc.id, b.id),
    zone: b.zone ?? 'town',
    kinds: new Set(b.grid.join('').split('').map((ch) => maps.legend[ch]?.kind).filter((k): k is CellKind => !!k)),
  }))
}

/** 主角現在所在的地區：站在神殿格上是神殿，其餘依區域 */
export function currentZone(state: GameState): Zone {
  const area = currentArea(state)
  if (area.kind === 'dungeon') return 'dungeon'
  if (area.kind === 'wild') return 'outskirts'
  if (currentCell(state).kind === 'temple') return 'temple'
  if (currentCell(state).kind === 'brothel') return 'brothel'
  return area.zone ?? 'town'
}

export function outskirtsKey(locationId: string) {
  return `${locationId}/outskirts`
}

export function layerKey(locationId: string, layer: number) {
  return `${locationId}/L${layer}`
}

/** 固定地圖的區塊（每次由資料建立，不存檔） */
function buildBlock(loc: Location, block: BlockDef): Area {
  const width = block.grid[0]!.length
  const height = block.grid.length
  const cells: Cell[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = block.grid[y]![x] ?? '#'
      if (/[1-9]/.test(ch)) {
        const target = block.links?.[ch]
        const targetBlock = blocksFor(loc).find((b) => b.id === target)
        const pos = targetBlock ? findChar(targetBlock, ch) : null
        cells.push(pos && target ? { kind: 'link', link: { area: settlementKey(loc.id, target), ...pos } } : { kind: 'wall' })
      } else {
        cells.push({ kind: maps.legend[ch]?.kind ?? 'wall' })
      }
    }
  }
  return {
    key: settlementKey(loc.id, block.id),
    location: loc.id,
    name: block.name.split('{town}').join(loc.name).split('{palace}').join(palaceName(loc)),
    kind: 'settlement',
    ...(block.zone && block.zone !== 'town' ? { zone: block.zone } : {}),
    width, height, cells,
  }
}

function findChar(block: BlockDef, ch: string): { x: number; y: number } | null {
  for (let y = 0; y < block.grid.length; y++) {
    const x = block.grid[y]!.indexOf(ch)
    if (x >= 0) return { x, y }
  }
  return null
}

/** 取得區域：固定地圖即時建立，隨機區域從存檔讀取。 */
export function getArea(state: GameState, key: string): Area {
  const stored = state.areas?.[key]
  if (stored) return stored
  const [locationId, blockId] = key.split('/') as [string, string]
  const loc = locationById(locationId)
  const block = blocksFor(loc).find((b) => b.id === blockId)
  if (!block) throw new Error(`unknown area: ${key}`)
  return buildBlock(loc, block)
}

export function cellAt(area: Area, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= area.width || y >= area.height) return undefined
  return area.cells[y * area.width + x]
}

export function findKind(area: Area, kind: CellKind): { x: number; y: number } | null {
  const i = area.cells.findIndex((c) => c.kind === kind)
  return i < 0 ? null : { x: i % area.width, y: Math.floor(i / area.width) }
}

export function currentArea(state: GameState): Area {
  return getArea(state, position(state).area)
}

export function position(state: GameState): Position {
  if (!state.position) enterLocation(state)
  return state.position!
}

export function currentCell(state: GameState): Cell {
  const p = position(state)
  return cellAt(currentArea(state), p.x, p.y) ?? { kind: 'floor' }
}

export function isRevealed(area: Area, x: number, y: number): boolean {
  return area.kind === 'settlement' || (area.revealed?.includes(y * area.width + x) ?? false)
}

function reveal(area: Area, x: number, y: number) {
  if (area.kind === 'settlement') return
  const set = new Set(area.revealed ?? [])
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (cellAt(area, x + dx, y + dy)) set.add((y + dy) * area.width + (x + dx))
    }
  }
  area.revealed = [...set]
}

function storeArea(state: GameState, area: Area) {
  state.areas ??= {}
  state.areas[area.key] = area
}

/** 聚落所有區塊的 key */
export function blockKeys(locationId: string): string[] {
  return blocksFor(locationById(locationId)).map((b) => settlementKey(locationId, b.id))
}

/** 站到聚落裡第一個指定種類的設施上（測試與事件用） */
export function standOn(state: GameState, kind: CellKind): boolean {
  const keys = locationById(state.location).type === 'dungeon' ? [currentArea(state).key] : blockKeys(state.location)
  for (const key of keys) {
    const area = getArea(state, key)
    const i = area.cells.findIndex((c) => c.kind === kind)
    if (i >= 0) {
      placeAt(state, area, i % area.width, Math.floor(i / area.width))
      return true
    }
  }
  return false
}

function placeAt(state: GameState, area: Area, x: number, y: number) {
  state.position = { area: area.key, x, y }
  reveal(area, x, y)
}

/** 抵達地點（旅行後或開新遊戲）：城鎮站在城門，冒險區域站在周邊的入口。 */
export function enterLocation(state: GameState) {
  const loc = locationById(state.location)
  // 隨機區域在離開後作廢，下次進入重新生成
  state.areas = {}
  if (loc.type === 'dungeon') {
    const area = withRng(state, (rng) => generateLayer(state, loc, 0, rng))
    storeArea(state, area)
    const entry = findKind(area, 'exit')!
    spawnVisitors(state, area, entry)
    placeAt(state, area, entry.x, entry.y)
    return
  }
  const blocks = blocksFor(loc)
  const gateBlock = blocks.find((b) => b.grid.some((row) => row.includes('E'))) ?? blocks[0]!
  const area = buildBlock(loc, gateBlock)
  const gate = findKind(area, 'gate') ?? { x: 1, y: 1 }
  placeAt(state, area, gate.x, gate.y)
}

// ---- 隨機生成 ----

function randomCells(rng: Rng, area: Area, count: number, exclude: Set<number>): number[] {
  const free = area.cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c.kind === 'floor' && !exclude.has(i))
    .map(({ i }) => i)
  const picked: number[] = []
  while (picked.length < count && free.length > 0) picked.push(free.splice(rng.int(0, free.length - 1), 1)[0]!)
  return picked
}

function between(rng: Rng, [lo, hi]: [number, number]) {
  return rng.int(lo, hi)
}

/** 城鎮近郊：開闊的荒野，散落遭遇與資源，下方中央是回城的城門。 */
export function generateOutskirts(state: GameState, loc: Location, rng: Rng): Area {
  const g = maps.generation.wild
  const [width, height] = g.size
  const cells: Cell[] = Array.from({ length: width * height }, () => ({ kind: rng.chance(g.obstacles) ? 'wall' : 'floor' }) as Cell)
  const area: Area = {
    key: outskirtsKey(loc.id), location: loc.id, name: `${loc.name}近郊`, kind: 'wild',
    width, height, cells, revealed: [], day: state.time.day,
  }
  const gateIndex = (height - 1) * width + Math.floor(width / 2)
  cells[gateIndex] = { kind: 'exit' }
  ensureConnected(area, gateIndex)
  const used = new Set([gateIndex, gateIndex - width])
  const table = wildEncounters(loc.region)
  for (const i of randomCells(rng, area, between(rng, g.encounters), used)) {
    cells[i] = { kind: 'encounter', group: rng.pick(table) }
    used.add(i)
  }
  for (const i of randomCells(rng, area, between(rng, g.resources), used)) {
    cells[i] = { kind: 'resource', item: rng.pick(g.resource_items) }
    used.add(i)
  }
  ensureQuestMarkers(state, area, rng)
  return area
}

/** 在近郊標出已接取的近郊委託地點（接委託時近郊已經生成過也會補上）。 */
function ensureQuestMarkers(state: GameState, area: Area, rng: Rng) {
  const marked = new Set(area.cells.map((c) => c.questId).filter(Boolean))
  for (const q of state.quests) {
    if (q.giver !== area.location || q.area !== 'outskirts' || q.status !== 'accepted' || marked.has(q.id)) continue
    const [i] = randomCells(rng, area, 1, new Set([area.cells.findIndex((c) => c.kind === 'exit')]))
    if (i === undefined) return
    area.cells[i] = { kind: 'quest', questId: q.id }
  }
}

/** 已完成（或不再進行中）的委託，把近郊的委託地點標記拿掉。 */
export function clearQuestMarkers(state: GameState) {
  const active = new Set(state.quests.filter((q) => q.status === 'accepted').map((q) => q.id))
  for (const area of Object.values(state.areas ?? {})) {
    area.cells.forEach((c, i) => {
      if (c.kind === 'quest' && (!c.questId || !active.has(c.questId))) area.cells[i] = { kind: 'floor' }
    })
  }
}

/** 城內委託要站在指定設施上，近郊委託要站在委託地點上。 */
export function questRunnableHere(state: GameState, quest: { id: string; area: string; giver: string; spot?: string }): boolean {
  if (quest.giver !== state.location) return false
  const area = currentArea(state)
  const cell = currentCell(state)
  if (quest.area === 'town') return area.kind === 'settlement' && cell.kind === (quest.spot ?? 'guild')
  if (quest.area === 'outskirts') return area.kind === 'wild' && cell.kind === 'quest' && cell.questId === quest.id
  return false
}

/** 冒險區域的一層：從入口隨機挖出通道，最遠處放下行階梯（深層放層主），入口旁是安全房。 */
export function generateLayer(state: GameState, loc: Location, layer: number, rng: Rng): Area {
  const g = maps.generation.dungeon
  const spec = g.layers[layer]!
  const [width, height] = g.size
  const cells: Cell[] = Array.from({ length: width * height }, () => ({ kind: 'wall' }) as Cell)
  const area: Area = {
    key: layerKey(loc.id, layer), location: loc.id, name: `${loc.name}・${spec.name}`, kind: 'dungeon', layer,
    width, height, cells, revealed: [],
  }
  // 隨機漫步挖出通道
  let x = Math.floor(width / 2)
  let y = height - 1
  const start = y * width + x
  cells[start] = { kind: 'floor' }
  for (let step = 0; step < g.carve_steps; step++) {
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, -1], [0, -1], [0, 1]] as const)
    const nx = Math.max(0, Math.min(width - 1, x + dx))
    const ny = Math.max(0, Math.min(height - 1, y + dy))
    x = nx
    y = ny
    cells[y * width + x] = { kind: 'floor' }
  }
  cells[start] = { kind: layer === 0 ? 'exit' : 'stairs_up' }
  const used = new Set([start])
  // 入口旁的安全房
  const nearStart = [start - width, start - 1, start + 1].find((i) => cells[i]?.kind === 'floor')
  if (nearStart !== undefined) {
    cells[nearStart] = { kind: 'safe' }
    used.add(nearStart)
  }
  // 最遠的格子放階梯或層主
  const far = farthest(area, start)
  // 深層：最終層主；淺層、中層：層主守著往下的階梯（沒有層主資料時直接是階梯）
  const bossGroup = dungeonEncounters[loc.id]?.bosses?.[spec.id as 'shallow' | 'middle' | 'deep'] ?? (spec.boss ? dungeonEncounters[loc.id]?.boss : undefined)
  cells[far] = spec.boss
    ? { kind: 'boss', group: bossGroup ?? [] }
    : spec.guard && bossGroup?.length
      ? { kind: 'boss', group: bossGroup, then: 'stairs_down' }
      : { kind: 'stairs_down' }
  used.add(far)

  const table = dungeonEncounters[loc.id]?.[spec.id] ?? wildEncounters(loc.region)
  for (const i of randomCells(rng, area, between(rng, spec.encounters), used)) {
    cells[i] = { kind: 'encounter', group: rng.pick(table) }
    used.add(i)
  }
  for (const i of randomCells(rng, area, spec.elites ?? 0, used)) {
    // 強敵：本層最強的一組，再多一隻
    const strongest = [...table].sort((a, b) => b.reduce((s, [, n]) => s + n, 0) - a.reduce((s, [, n]) => s + n, 0))[0] ?? []
    const group = strongest.map(([id, n], idx) => [id, idx === 0 ? n + 1 : n] as [string, number])
    cells[i] = { kind: 'elite', group }
    used.add(i)
  }
  for (const i of randomCells(rng, area, between(rng, spec.traps), used)) {
    cells[i] = { kind: 'trap' }
    used.add(i)
  }
  for (const i of randomCells(rng, area, between(rng, spec.resources), used)) {
    cells[i] = { kind: 'resource', item: rng.pick(g.resource_items) }
    used.add(i)
  }
  // 寶箱：內容依這一層怪物的最高等級
  const level = Math.max(1, ...table.flat().map(([id]) => enemies[id]?.level ?? 1))
  for (const i of randomCells(rng, area, spec.chests ? between(rng, spec.chests) : 0, used)) {
    cells[i] = { kind: 'chest', level }
    used.add(i)
  }
  return area
}

function neighborsOf(area: Area, i: number): number[] {
  const x = i % area.width
  const y = Math.floor(i / area.width)
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dy]) => [x + dx!, y + dy!] as const)
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < area.width && ny < area.height)
    .map(([nx, ny]) => ny * area.width + nx)
}

function walkable(c: Cell | undefined) {
  return !!c && !WALKABLE_BLOCKERS.includes(c.kind)
}

/** 從起點出發無法到達的空地改成障礙物，確保整張圖連通。 */
function ensureConnected(area: Area, from: number) {
  const seen = new Set([from])
  const queue = [from]
  while (queue.length) {
    for (const n of neighborsOf(area, queue.shift()!)) {
      if (!seen.has(n) && walkable(area.cells[n])) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  area.cells.forEach((c, i) => {
    if (walkable(c) && !seen.has(i)) area.cells[i] = { kind: 'wall' }
  })
}

function farthest(area: Area, from: number): number {
  const dist = new Map([[from, 0]])
  const queue = [from]
  let best = from
  while (queue.length) {
    const cur = queue.shift()!
    for (const n of neighborsOf(area, cur)) {
      if (!dist.has(n) && walkable(area.cells[n])) {
        dist.set(n, dist.get(cur)! + 1)
        if (dist.get(n)! > dist.get(best)!) best = n
        queue.push(n)
      }
    }
  }
  return best
}

// ---- 移動 ----

export type StepResult = { report?: Report; combat?: CombatState }

function stepMinutes(area: Area): number {
  const s = maps.generation.step_minutes
  return area.kind === 'settlement' ? s.settlement : area.kind === 'wild' ? s.wild : s.dungeon
}

/** 往上下左右移動一格，觸發走進格子的內容。 */
export function move(state: GameState, dx: number, dy: number): StepResult {
  if (state.combat) throw new Error('戰鬥進行中')
  assertNoStandoff(state)
  if (Math.abs(dx) + Math.abs(dy) !== 1) throw new Error('一次只能移動一格')
  const p = position(state)
  const area = currentArea(state)
  const nx = p.x + dx
  const ny = p.y + dy
  const cell = cellAt(area, nx, ny)
  if (!walkable(cell)) throw new Error('那裡過不去')
  // 貴族區與王城有衛兵把守
  if (cell!.kind === 'link') {
    const blocked = zoneEntryBlock(state, getArea(state, cell!.link!.area).zone)
    if (blocked) throw new Error(blocked)
  }
  state.time = addHours(state.time, stepMinutes(area) / 60)
  state.position = { area: area.key, x: nx, y: ny, prev: { x: p.x, y: p.y } }
  reveal(area, nx, ny)
  return enterCell(state, area, nx, ny, cell!)
}

/** 移動到指定格子（只能是相鄰格）。 */
export function moveTo(state: GameState, x: number, y: number): StepResult {
  const p = position(state)
  return move(state, x - p.x, y - p.y)
}

function enterCell(state: GameState, area: Area, x: number, y: number, cell: Cell): StepResult {
  const loc = locationById(area.location)
  switch (cell.kind) {
    case 'link': {
      const target = getArea(state, cell.link!.area)
      placeAt(state, target, cell.link!.x, cell.link!.y)
      return {}
    }
    case 'encounter':
    case 'elite':
    case 'boss': {
      if (cell.done || !cell.group?.length) return {}
      // 玩家刪掉的自建怪物：格子視為已清除
      const group = cell.group.filter(([id]) => !!enemies[id])
      if (!group.length) {
        cell.done = true
        return {}
      }
      const scene = area.name
      return { combat: startCombat(state, group, { scene, cell: { area: area.key, x, y } }) }
    }
    case 'trap': {
      if (cell.done) return {}
      cell.done = true
      return { report: springTrap(state, area, loc) }
    }
    case 'resource': {
      if (cell.done || !cell.item) return {}
      cell.done = true
      return { report: gather(state, area, cell.item) }
    }
    case 'chest': {
      if (cell.done) return {}
      cell.done = true
      return { report: openChest(state, area, cell.level ?? 1) }
    }
    default:
      return {}
  }
}

function eventReport(state: GameState, area: Area, minutes: number): Report {
  const pc = player(state)
  const loc = locationById(area.location)
  const start = { ...state.time }
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, minutes / 60) },
    location: { at: area.location, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'neutral' },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

function springTrap(state: GameState, area: Area, loc: Location): Report {
  const spec = DUNGEON_LAYERS[area.layer ?? 0]!
  const report = eventReport(state, area, 5)
  // 隊伍中靈巧最高的人負責察覺陷阱
  const scout = [...state.party].filter((m) => m.hp > 0).sort((a, b) => b.attrs.dex - a.attrs.dex)[0] ?? player(state)
  const before = state.party.map((m) => ({ ...m }))
  const dice = withBonus('1d20', mod(scout.attrs.dex))
  const r = withRng(state, (rng) => roll(rng, dice))
  const success = r.total >= spec.trap_dc
  const effects: NonNullable<Report['timeline']>[number]['effects'] = []
  if (!success) {
    const dmg = withRng(state, (rng) => roll(rng, spec.trap_damage).total)
    scout.hp = Math.max(1, scout.hp - dmg)
    effects.push({ type: 'damage', target: scout.id, amount: dmg })
  }
  report.kind = 'event'
  report.timeline = [{
    seq: 1, actor: scout.id, action: '靈巧檢定・察覺陷阱',
    roll: { dice, value: r.total, dc: spec.trap_dc }, result: success ? 'success' : 'fail', effects,
  }]
  report.party = state.party.map((m, i) => snapshot(m, before[i], player(state)))
  report.outcome = {
    result: success ? 'success' : 'failure',
    summary: success ? `${scout.name}及時察覺${area.name}的陷阱。` : `${scout.name}觸發了${area.name}的陷阱。`,
    tags: ['陷阱'],
  }
  report.lore_keys!.push(loc.name)
  return commitReport(state, report)
}

function gather(state: GameState, area: Area, item: string): Report {
  const report = eventReport(state, area, 10)
  report.kind = 'action'
  if (item === '古錢') {
    const money = withRng(state, (rng) => rng.int(10, 60))
    report.changes.money_cc = money
    report.outcome = { result: 'success', summary: `在${area.name}找到一些古錢。` }
  } else {
    report.changes.items_gained = [{ name: item, qty: 1, owner: 'pc' }]
    report.outcome = { result: 'success', summary: `在${area.name}採集到${item}。` }
  }
  return commitReport(state, report)
}

/** 打開寶箱：錢、消耗品、裝備與打造材料（gear.json 的 chests） */
function openChest(state: GameState, area: Area, level: number): Report {
  const report = eventReport(state, area, 5)
  report.kind = 'event'
  const layer = DUNGEON_LAYERS[area.layer ?? 0]!.id
  const t = gearRules.chests[layer] ?? gearRules.chests.outskirts!
  const items: { name: string; qty: number; owner: 'pc' }[] = []
  const add = (name: string) => {
    const x = items.find((i) => i.name === name)
    if (x) x.qty++
    else items.push({ name, qty: 1, owner: 'pc' })
  }
  const money = withRng(state, (rng) => {
    for (const [name, p] of t.items) if (itemDef(name) && rng.chance(p)) add(name)
    if (rng.chance(t.gear)) add(registerGear(state, randomGear(rng, level)))
    if (t.gear_extra && rng.chance(t.gear_extra)) add(registerGear(state, randomGear(rng, level)))
    for (const [tier, p] of t.forge) {
      if (!rng.chance(p)) continue
      const name = forgeItemFor(rng.pick(MATERIAL_KINDS), tier)
      if (name) add(name)
    }
    return rng.int(t.money[0], t.money[1]) * level
  })
  report.changes.money_cc = money
  if (items.length) report.changes.items_gained = items
  report.outcome = {
    result: 'success',
    summary: `在${area.name}打開一個寶箱：${[formatMoney(money), ...items.map((i) => (i.qty > 1 ? `${i.name}×${i.qty}` : i.name))].join('、')}。`,
    tags: ['寶箱'],
  }
  return commitReport(state, report)
}

// ---- 格子上的動作 ----

/** 和敵對的人對峙時，不能離開 */
export function assertNoStandoff(state: GameState) {
  if (state.standoff) throw new Error('先處理眼前的對峙')
  if (state.pendingMark) throw new Error('先完成契約印記的刻印')
  if (state.pendingMasterEvent) throw new Error('先回應主人的要求')
  if (state.pendingDefeat) throw new Error('先應付眼前的處境')
}

/** 城門盤查：沒過時回傳盤查的紀錄（沒有擲骰時直接說明原因） */
function passGate(state: GameState): Report | undefined {
  const g = gateCheck(state)
  if (g.ok) return undefined
  if (g.report) return g.report
  throw new Error(g.reason)
}

/** 從城門前往近郊（每天重新生成一次）。被衛兵攔下時回傳盤查的紀錄，不會出城。 */
export function goOutskirts(state: GameState): Report | undefined {
  if (currentCell(state).kind !== 'gate') throw new Error('要在城門才能出城')
  assertNoStandoff(state)
  assertMasterAllows(state)
  const blocked = passGate(state)
  if (blocked) return blocked
  placeOutside(state)
  return undefined
}

/** 直接站到近郊的出口（不經過城門盤查，例如被擋在城外） */
export function placeOutside(state: GameState) {
  const loc = locationById(state.location)
  let area = state.areas?.[outskirtsKey(loc.id)]
  if (!area || area.day !== state.time.day) {
    area = withRng(state, (rng) => generateOutskirts(state, loc, rng))
    storeArea(state, area)
    spawnVisitors(state, area, findKind(area, 'exit'))
  } else {
    const existing = area
    withRng(state, (rng) => ensureQuestMarkers(state, existing, rng))
  }
  const exit = findKind(area, 'exit')!
  placeAt(state, area, exit.x, exit.y)
}

/** 從近郊的出口回到城門。被衛兵攔下時回傳盤查的紀錄，不會進城。 */
export function returnToTown(state: GameState): Report | undefined {
  if (currentArea(state).kind !== 'wild' || currentCell(state).kind !== 'exit') throw new Error('要在近郊的出口才能回城')
  assertNoStandoff(state)
  const blocked = passGate(state)
  if (blocked) return blocked
  enterTownGate(state)
  return undefined
}

function enterTownGate(state: GameState) {
  const loc = locationById(state.location)
  const blocks = blocksFor(loc)
  const gateBlock = blocks.find((b) => b.grid.some((row) => row.includes('E'))) ?? blocks[0]!
  const area = buildBlock(loc, gateBlock)
  const gate = findKind(area, 'gate')!
  placeAt(state, area, gate.x, gate.y)
}

/** 走下行階梯：生成下一層並站在它的上行階梯。 */
export function descend(state: GameState) {
  assertNoStandoff(state)
  const area = currentArea(state)
  if (currentCell(state).kind !== 'stairs_down' || area.layer === undefined) throw new Error('這裡沒有往下的階梯')
  const loc = locationById(area.location)
  const next = area.layer + 1
  let target = state.areas?.[layerKey(loc.id, next)]
  if (!target) {
    target = withRng(state, (rng) => generateLayer(state, loc, next, rng))
    storeArea(state, target)
    spawnVisitors(state, target, findKind(target, 'stairs_up'))
  }
  const up = findKind(target, 'stairs_up')!
  placeAt(state, target, up.x, up.y)
}

/** 走上行階梯回到上一層的下行階梯。 */
export function ascend(state: GameState) {
  assertNoStandoff(state)
  const area = currentArea(state)
  if (currentCell(state).kind !== 'stairs_up' || !area.layer) throw new Error('這裡沒有往上的階梯')
  const prev = getArea(state, layerKey(area.location, area.layer - 1))
  const down = findKind(prev, 'stairs_down')!
  placeAt(state, prev, down.x, down.y)
}

/** 戰鬥結束後：獲勝清除格子；撤退退回上一格；戰敗被送回城鎮或地下城入口外。 */
export function afterCombat(state: GameState, report: Report) {
  clearQuestMarkers(state)
  const result = report.outcome.result
  const p = state.position
  if (!p) return
  const area = state.areas?.[p.area]
  if (result === 'victory' && area) {
    const key = Object.keys(report.changes.flags ?? {}).find((k) => k.startsWith('cleared:'))
    if (key) {
      const [, areaKey, coords] = key.split(':')
      const [cx, cy] = coords!.split(',').map(Number)
      const target = state.areas?.[areaKey!]
      const cell = target && cellAt(target, cx!, cy!)
      if (cell) cell.done = true
      // 守著階梯的層主倒下：格子變成往下的階梯
      if (cell?.then) {
        cell.kind = cell.then
        delete cell.then
        delete cell.done
      }
      delete state.flags[key]
    }
  } else if (result === 'fled' && p.prev) {
    state.position = { area: p.area, x: p.prev.x, y: p.prev.y }
  } else if (result === 'defeat' && !state.pendingDefeat) {
    // 成人向的戰敗事件等玩家回應之後才離開（defeat.ts）
    afterDefeat(state)
  }
}

/** 戰敗之後：地下城回到入口（重新生成），近郊回到城門，城裡留在原地 */
export function afterDefeat(state: GameState) {
  const p = state.position
  if (!p) return
  const area = state.areas?.[p.area]
  const loc = locationById(state.location)
  if (loc.type === 'dungeon') {
    enterLocation(state)
  } else if (area?.kind === 'wild') {
    enterTownGate(state)
  }
}

/** 可以啟程旅行的位置：城門或冒險區域周邊的出口。 */
export function canTravelHere(state: GameState): boolean {
  const area = currentArea(state)
  const cell = currentCell(state)
  return (area.kind === 'settlement' && cell.kind === 'gate') || (area.kind === 'dungeon' && cell.kind === 'exit')
}
