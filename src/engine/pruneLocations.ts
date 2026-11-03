// 存檔裡指向已經不存在的自建地點（自建地下城，id 是 loc_ 開頭）的資料：讀檔時與自訂內容改變之後清掉
// （docs/CONTENT_DEPENDENCIES.md 第 2 節）。
// 內建的地點不會不見，所以只看 loc_ 開頭的 id；目前的存檔用到的地下城本來就不能刪，這裡處理的是其他存檔與匯入。

import { findLocation, isSettlement } from './data'
import { dropExam } from './guild'
import type { GameState } from './types'

const CUSTOM_LOCATION = /^loc_/

/** 這個 id 是已經不存在的自建地點 */
export function isGoneLocation(id: string | undefined | null): boolean {
  return !!id && CUSTOM_LOCATION.test(id) && !findLocation(id)
}

/** 人在不見的地點時送回哪裡：最近走過、還在的聚落，再來是出生地，最後是索里耶爾 */
function fallbackLocation(state: GameState): string {
  for (const t of [...(state.trail ?? [])].reverse()) {
    const loc = findLocation(t.location)
    if (loc && isSettlement(loc)) return loc.id
  }
  const birthplace = state.party[0]?.birthplace
  const home = findLocation(birthplace)
  if (home && isSettlement(home)) return home.id
  return 'soriel'
}

/**
 * 清掉存檔裡指向不存在的自建地點的資料。回傳 true 表示主角被移到別的地方（格子位置已經清掉，呼叫的人要 enterLocation）。
 * - 人在那裡、正在往返那裡的旅途上：送回 fallbackLocation，探索、旅途、戰鬥、待處理的戰敗作廢。
 * - 待處理的移動、俘虜：作廢。
 * - 委託（委託人或目標）：從清單拿掉（進行中的考核一起放棄）；情報：拿掉。
 * - 生成的 NPC 的出沒、足跡、隨機地圖：拿掉。
 */
export function pruneLocations(state: GameState): boolean {
  let moved = false
  const road = state.road
  const lost = isGoneLocation(state.location) || (!!road && (isGoneLocation(road.from) || isGoneLocation(road.to)))
  if (lost) {
    // 旅途的起點還在時回到起點（例如從聚落出發、要去的地下城不見了）
    const back = road && !isGoneLocation(road.from) && findLocation(road.from) ? road.from : fallbackLocation(state)
    delete state.road
    delete state.roadEvent
    delete state.side
    delete state.combat
    delete state.pendingDefeat
    if (state.expedition && isGoneLocation(state.expedition.location)) delete state.expedition
    if (state.special && isGoneLocation(state.special.location)) delete state.special
    state.location = back
    delete state.position
    moved = true
  }
  if (state.expedition && isGoneLocation(state.expedition.location)) delete state.expedition
  if (state.pendingDefeat && isGoneLocation(state.pendingDefeat.location)) delete state.pendingDefeat
  if (state.pendingMove?.travel_to && isGoneLocation(state.pendingMove.travel_to)) {
    delete state.pendingMove.travel_to
    if (!Object.keys(state.pendingMove).length) delete state.pendingMove
  }
  if (state.captives && isGoneLocation(state.captives.location)) delete state.captives
  if (state.special && isGoneLocation(state.special.location)) state.special.location = state.location
  const gone = state.quests.filter((q) => isGoneLocation(q.giver) || isGoneLocation(q.target))
  for (const q of gone) dropExam(state, q.id)
  if (gone.length) state.quests = state.quests.filter((q) => !gone.includes(q))
  if (state.intel?.some((i) => isGoneLocation(i.location) || isGoneLocation(i.from))) {
    state.intel = state.intel.filter((i) => !isGoneLocation(i.location) && !isGoneLocation(i.from))
  }
  for (const rec of Object.values(state.npcs ?? {})) {
    if (rec.haunts?.some((h) => isGoneLocation(h.location))) rec.haunts = rec.haunts.filter((h) => !isGoneLocation(h.location))
  }
  if (state.trail?.some((t) => isGoneLocation(t.location))) state.trail = state.trail.filter((t) => !isGoneLocation(t.location))
  for (const key of Object.keys(state.areas ?? {})) if (isGoneLocation(key.split('/')[0])) delete state.areas![key]
  return moved
}
