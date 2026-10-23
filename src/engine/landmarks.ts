// 城鎮的特色地標：遊戲中的功能（docs/LANDMARKS.md）。資料在 data/world/landmarks.json，內容編輯器見 landmarkMods.ts。

import { landmarkDef, type LandmarkDef } from './data'
import { currentArea, currentCell } from './grid'
import type { GameState } from './types'

/** 主角現在站的地標（聚落裡） */
export function landmarkHere(state: GameState): LandmarkDef | undefined {
  if (currentArea(state).kind !== 'settlement') return undefined
  return landmarkDef(currentCell(state).kind)
}

/** 站在地標上行動時，場景帶上地標與它的氛圍（交給 AI） */
export function withLandmark(state: GameState, scene: string): string {
  const l = landmarkHere(state)
  if (!l || scene.includes(l.name)) return scene
  const mood = (l.scene || l.desc).slice(0, 80)
  return `${scene}・${l.name}${mood ? `（${mood}）` : ''}`
}
