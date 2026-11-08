// 地下街（docs/SPECIAL_MAPS.md 第 9 節）：每座有灰色產業的聚落一張隱藏的特殊地圖（special_maps.json 的 underworld），
// 黑市、淫鬥場、地下俱樂部這些地標擺在裡面。在酒館打聽到之後（主動行動 black_market，旗標 underworld:<地點>），
// 從酒館走進去，從出口回到酒館。舊存檔打聽到黑市的旗標（black_market:<地點>）也算知道。
// 被主人帶著時不能打聽，改成向主人提議去地下街（主人答應的那一天由主人帶著進去，旗標 underworld_escort:<地點>）。

import { landmarkDef, landmarks, specialKey, specialMaps, type LandmarkDef, type SpecialMapDef } from './data'
import { currentArea, currentCell } from './grid'
import { isBound } from './party'
import { enterSpecial } from './specialMaps'
import { condMet } from './storyFlags'
import type { GameState } from './types'

/** 這座聚落的地下街（沒有時是 undefined） */
export function underworldOf(location: string): SpecialMapDef | undefined {
  return Object.values(specialMaps).find((m) => m.underworld && m.location === location && !!m.grid?.length)
}

/** 擺在這張地下街裡的地標 */
export function underworldLandmarks(map: SpecialMapDef): LandmarkDef[] {
  const key = specialKey(map.id)
  return Object.values(landmarks).filter((l) => l.at.area === key)
}

/** 打聽到之後設的旗標 */
export const underworldFlag = (location: string) => `underworld:${location}`
/** 被主人帶著時，主人答應今天帶你去這座城的地下街（向主人提議，companions.ts 的 applyUnderworldProposal）：值是那一天 */
export const underworldEscortFlag = (location: string) => `underworld_escort:${location}`

/** 主人今天答應帶你去這座城的地下街 */
export function underworldEscorted(state: GameState, location = state.location): boolean {
  return state.flags[underworldEscortFlag(location)] === state.time.day
}

/**
 * 主角知道這座聚落的地下街在哪：在酒館打聽到了（舊存檔是打聽到黑市），
 * 或者裡面有某個靠劇情開放的地標已經開放（劇情帶你去過，例如阿雅帶你去黑檀之夜）
 */
export function underworldKnown(state: GameState, location = state.location): boolean {
  const map = underworldOf(location)
  if (!map) return false
  if (state.flags[underworldFlag(location)] || state.flags[`black_market:${location}`]) return true
  return underworldLandmarks(map).some((l) => !!l.open?.flags?.length && condMet(state, { flags: l.open.flags, ...(l.open.flags_none ? { flags_none: l.open.flags_none } : {}) }))
}

/** 為什麼現在不能在這裡打聽地下街（可以時是 undefined） */
export function underworldAskBlocked(state: GameState): string | undefined {
  if (currentArea(state).kind !== 'settlement' || currentCell(state).kind !== 'tavern') return '要在酒館才能打聽'
  if (!underworldOf(state.location)) return '這座城沒有地下街'
  if (underworldKnown(state)) return '已經知道地下街的入口了'
  return undefined
}

/** 為什麼現在不能從這裡走進地下街（可以時是 undefined） */
export function underworldEntryBlocked(state: GameState): string | undefined {
  const map = underworldOf(state.location)
  if (!map) return '這座城沒有地下街'
  if (currentArea(state).kind !== 'settlement' || currentCell(state).kind !== 'tavern') return '要從酒館進去'
  // 被主人帶著：要主人今天答應帶你去（知不知道入口都一樣，是主人帶路）
  if (isBound(state)) {
    if (!underworldEscorted(state)) return '被主人帶著：先向主人提議去地下街'
  } else if (!underworldKnown(state)) return '還不知道地下街的入口'
  if (state.combat || state.pendingAction || state.pendingDefeat || state.townEvent) return '現在不能這麼做'
  return undefined
}

/** 從酒館走進地下街（站在入口；從出口離開時回到酒館） */
export function enterUnderworld(state: GameState) {
  const why = underworldEntryBlocked(state)
  if (why) throw new Error(why)
  enterSpecial(state, underworldOf(state.location)!.id)
}

/** 主角站在黑市的地標上（不公開的奴隸買賣、今天的珍品、黑市的解除印記） */
export function blackMarketHere(state: GameState): boolean {
  const l = landmarkDef(currentCell(state).kind)
  return !!l?.black_market && l.location === state.location
}

/** 主角在這張地圖是不是地下街 */
export function inUnderworld(state: GameState): boolean {
  const area = currentArea(state)
  return area.kind === 'special' && !!specialMaps[area.special ?? '']?.underworld
}
