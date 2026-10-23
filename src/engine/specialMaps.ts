// 特殊地圖（docs/SPECIAL_MAPS.md）：人工設計的固定地圖或隨機地圖，屬於某個地點。
// - 進入：特殊任務、旅途事件的結果傳送進來（special_map），或從城鎮區塊、別張特殊地圖的通道走進來。
// - 通道（connections）：兩端都變成 link 格，旗標條件成立時才打開；城鎮那一端要是牆或水。
// - 離開：出口回到從外面進來前的位置；從通道走出去就在那一頭；倒下時被送回所屬地點。
// - 內容：refresh 的地圖離開這片特殊地圖後作廢，下次進來重新生成；其他的一直留在存檔裡。

import { specialKey, specialMapLegend, specialMapOfKey, specialMaps, type SpecialConnection, type SpecialMapDef } from './data'
import { enterLocation, findKind, generateSpecial, placeAt, position, specialVersion, storeArea, type Area, type Cell, type CellKind } from './grid'
import { leaveSide } from './road'
import { withRng } from './state'
import { condMet } from './storyFlags'
import type { GameState } from './types'

/** 存檔裡的特殊地圖（還沒生成、或定義改過時重新生成） */
export function specialArea(state: GameState, id: string): Area {
  const def = specialMaps[id]
  if (!def) throw new Error(`unknown area: ${specialKey(id)}`)
  const key = specialKey(id)
  let area = state.areas?.[key]
  if (!area || area.version !== specialVersion(def)) {
    area = withRng(state, (rng) => generateSpecial(state, def, rng))
    storeArea(state, area)
    // 地圖改過、主角正站在裡面：站的格子不在了或變成牆時，移到入口
    const p = state.position
    if (p?.area === key) {
      const cell = area.cells[p.y * area.width + p.x]
      if (p.x >= area.width || p.y >= area.height || !cell || cell.kind === 'wall' || cell.kind === 'water') {
        const e = entryOf(area, def)
        state.position = { area: key, x: e.x, y: e.y }
      }
    }
  }
  // 名稱、地點、光線改了不用重新生成
  area.name = def.name
  area.location = def.location
  area.lighting = def.lighting ?? 'dark'
  return area
}

/** 通道現在有沒有打開 */
export function connectionOpen(state: GameState, c: SpecialConnection): boolean {
  return condMet(state, c.requires)
}

/** 這個區域上的通道端點：自己的（特殊地圖的 at）與別張特殊地圖接過來的（to） */
export function endpointsIn(areaKey: string): { x: number; y: number; link: { area: string; x: number; y: number }; c: SpecialConnection; own: boolean }[] {
  const out: ReturnType<typeof endpointsIn> = []
  const self = specialMapOfKey(areaKey)
  for (const c of self?.connections ?? []) out.push({ ...c.at, link: c.to, c, own: true })
  for (const def of Object.values(specialMaps)) {
    for (const c of def.connections ?? []) {
      if (c.to.area === areaKey) out.push({ x: c.to.x, y: c.to.y, link: { area: specialKey(def.id), ...c.at }, c, own: false })
    }
  }
  return out
}

/** 固定地圖這一格原本的種類（通道關起來時還原） */
function baseKind(def: SpecialMapDef | undefined, x: number, y: number): CellKind {
  const ch = def?.grid?.[y]?.[x]
  if (ch === undefined) return 'wall'
  return ({ ...specialMapLegend, ...(def?.legend ?? {}) }[ch] ?? 'wall') as CellKind
}

const sameLink = (cell: Cell | undefined, link: { area: string; x: number; y: number }) =>
  cell?.kind === 'link' && cell.link?.area === link.area && cell.link.x === link.x && cell.link.y === link.y

/**
 * 依旗標套上通道：打開的端點變成 link 格；關著的還原成原本的格子。
 * 城鎮區塊每次都重新組出來，只有牆或水的格子會被打開；特殊地圖存在存檔裡，關起來時還原成地圖上畫的格子。
 */
export function overlayConnections(state: GameState, area: Area): Area {
  const special = area.kind === 'special' ? specialMaps[area.special ?? ''] : undefined
  for (const e of endpointsIn(area.key)) {
    if (e.x < 0 || e.y < 0 || e.x >= area.width || e.y >= area.height) continue
    const i = e.y * area.width + e.x
    const cell = area.cells[i]
    if (connectionOpen(state, e.c)) {
      if (sameLink(cell, e.link)) continue
      if (area.kind === 'settlement' && cell?.kind !== 'wall' && cell?.kind !== 'water') continue
      area.cells[i] = { kind: 'link', link: { ...e.link } }
    } else if (sameLink(cell, e.link) && special) {
      area.cells[i] = { kind: baseKind(special, e.x, e.y) }
    }
  }
  return area
}

/** 特殊地圖被事件傳送進來時站的位置：入口、出口、第一格空地 */
export function entryOf(area: Area, def: SpecialMapDef): { x: number; y: number } {
  if (def.entry && def.entry.x < area.width && def.entry.y < area.height) return def.entry
  const exit = findKind(area, 'exit')
  if (exit) return exit
  const i = area.cells.findIndex((c) => c.kind === 'floor')
  return i >= 0 ? { x: i % area.width, y: Math.floor(i / area.width) } : { x: 0, y: 0 }
}

/** 走進一張特殊地圖：地點改成它的所屬地點，需要刷新的記下來 */
function arriveIn(state: GameState, def: SpecialMapDef) {
  state.location = def.location
  const sp = state.special!
  if (def.refresh && !sp.visited.includes(def.id)) sp.visited.push(def.id)
}

/** 離開這片特殊地圖（走出去、被傳送走）：需要刷新的地圖作廢 */
export function closeOut(state: GameState) {
  for (const id of state.special?.visited ?? []) delete state.areas?.[specialKey(id)]
  delete state.special
}

/** 走過通道換了區域（grid.ts 的 link 格）：進出特殊地圖時記下回程與地點 */
export function onAreaChange(state: GameState, from: Area, to: Area, at: { x: number; y: number }) {
  const inFrom = from.kind === 'special'
  const inTo = to.kind === 'special'
  if (!inFrom && inTo) state.special = { back: { area: from.key, x: at.x, y: at.y }, location: state.location, visited: [] }
  if (inTo) {
    state.special ??= { location: state.location, visited: [] }
    arriveIn(state, specialMaps[to.special ?? '']!)
  } else if (inFrom) {
    closeOut(state)
    state.location = to.location
  }
}

/** 被傳送到特殊地圖（事件的結果）：站在那張地圖的入口 */
export function enterSpecial(state: GameState, id: string) {
  const def = specialMaps[id]
  if (!def) throw new Error('沒有這個地方')
  if (state.side) leaveSide(state)
  if (!state.special) {
    const p = position(state)
    state.special = { back: { area: p.area, x: p.x, y: p.y }, location: state.location, visited: [] }
  }
  const area = specialArea(state, id)
  const pos = entryOf(area, def)
  arriveIn(state, def)
  placeAt(state, area, pos.x, pos.y)
}

/** 自訂內容拿掉的特殊地圖：存檔裡的地圖作廢；正站在裡面時送回現在的地點（讀檔時，以及自訂內容改變之後） */
export function pruneSpecialMaps(state: GameState) {
  for (const key of Object.keys(state.areas ?? {})) {
    if (key.startsWith('sm/') && !specialMaps[key.slice(3)]) delete state.areas![key]
  }
  if (state.special) state.special.visited = state.special.visited.filter((id) => !!specialMaps[id])
  const at = state.position?.area
  if (at?.startsWith('sm/') && !specialMaps[at.slice(3)]) {
    const back = state.special?.back
    const backOk = back && (!back.area.startsWith('sm/') || !!specialMaps[back.area.slice(3)])
    const location = state.special?.location
    delete state.special
    if (backOk) {
      state.location = location ?? state.location
      state.position = { ...back }
    } else enterLocation(state)
  }
}

/** 從出口離開：回到從外面進來前的位置；沒有時到所屬地點 */
export function leaveSpecial(state: GameState) {
  const def = specialMapOfKey(state.position?.area)
  const sp = state.special
  closeOut(state)
  if (sp?.back) {
    state.location = sp.location
    state.position = { ...sp.back }
    return
  }
  state.location = def?.location ?? state.location
  enterLocation(state)
}

/** 在特殊地圖裡倒下：被送回所屬地點（旅途就此中斷） */
export function specialDefeat(state: GameState) {
  const def = specialMapOfKey(state.position?.area)
  closeOut(state)
  delete state.road
  delete state.roadEvent
  delete state.side
  if (def) state.location = def.location
  enterLocation(state)
}
