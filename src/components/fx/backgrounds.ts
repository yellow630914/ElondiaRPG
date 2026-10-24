// 背景圖：依所在的地點、地區、時段或地下城的深度挑一張整頁背景。
// 圖放在 src/assets/backgrounds/，檔名就是 key（見同資料夾的 README.md）；沒有那張圖時往下找，全部沒有就不顯示背景圖。

import { DUNGEON_LAYER_IDS, locationById } from '@/engine/data'
import { currentArea } from '@/engine/grid'
import type { GameState } from '@/engine/types'

const FILES = import.meta.glob<string>('../../assets/backgrounds/*.{webp,png,jpg,jpeg}', { eager: true, query: '?url', import: 'default' })

/** key（檔名去掉副檔名）→ 圖片網址 */
export const BACKGROUNDS: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
)

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'

/** 時段：清晨 5～7 點、白天 7～17、黃昏 17～19、其他是夜晚（和背景氛圍的晝夜色調同一套） */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'dusk'
  return 'night'
}

/**
 * 依序要找的背景 key（前面的優先）：
 * - 聚落、房子、近郊：<地點>-<時段>、<地點>、region-<地區>-<時段>、region-<地區>
 * - 地下城：<地點>-<層>（outskirts、shallow……）、<地點>、地區
 * - 特殊地圖：special-<地圖 id>、所屬地點、地區
 * - 旅途與臨時地圖：地區
 * - 還沒開始遊戲：title、region-central
 */
export function backgroundKeys(state: GameState | null | undefined): string[] {
  if (!state) return ['title', 'region-central']
  let area
  try {
    area = currentArea(state)
  } catch {
    return []
  }
  const loc = locationById(area.location)
  const time = timeOfDay(state.time.hour)
  const region = loc?.region ? [`region-${loc.region}-${time}`, `region-${loc.region}`] : []
  const place = loc ? [`${loc.id}-${time}`, loc.id] : []
  switch (area.kind) {
    case 'dungeon': {
      const layer = DUNGEON_LAYER_IDS[area.layer ?? 0]
      return [...(loc && layer ? [`${loc.id}-${layer}`] : []), ...(loc ? [loc.id] : []), ...region]
    }
    case 'special':
      return [...(area.special ? [`special-${area.special}`] : []), ...place, ...region]
    case 'road':
    case 'side':
      return region
    default:
      return [...place, ...region]
  }
}

/** 現在要顯示的背景圖網址；沒有合適的圖時是 null */
export function backgroundFor(state: GameState | null | undefined, files: Record<string, string> = BACKGROUNDS): string | null {
  for (const key of backgroundKeys(state)) if (files[key]) return files[key]!
  return null
}
