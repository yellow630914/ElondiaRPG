// 城鎮特色地標的自訂內容（docs/LANDMARKS.md、docs/CONTENT_EDITOR.md 3.9 節）。
// 內建的地標每一項都可以改（位置只能在同一個聚落裡移動），不能刪除；自建的地標可以擺在任何聚落，沒有被用到時可以刪除。

import { geography, isLandmarkId, landmarks, landmarkTypes, npcs as namedNpcs, stories, type LandmarkDef } from './data'
import { blockKeys, CELL_ICON, invalidateBlocks, settlementArea, type CellKind } from './grid'

export interface LandmarkMod extends LandmarkDef {
  custom?: boolean
}

export const LANDMARK_LIMITS = { name_chars: 12, desc_chars: 200, scene_chars: 200, types: 4 } as const

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** 內建地標的快照（模組載入時） */
const snapshot = clone(landmarks)

export function builtinLandmark(id: string): LandmarkDef | undefined {
  return snapshot[id] ? clone(snapshot[id]!) : undefined
}

export function newLandmarkId(): string {
  return `lm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** 新地標：擺在這個聚落第一格空地（道路）上（之後在表單上改） */
export function newLandmark(id: string, location = geography.locations.find((l) => l.type !== 'dungeon')!.id): LandmarkMod {
  for (const key of blockKeys(location)) {
    const area = settlementArea(key)
    const i = area?.cells.findIndex((c) => c.kind === 'floor') ?? -1
    if (area && i >= 0) {
      return { id, name: '新的地標', emoji: '📍', location, at: { area: key, x: i % area.width, y: Math.floor(i / area.width) }, desc: '', types: [], custom: true }
    }
  }
  throw new Error('這個聚落沒有空地可以擺地標')
}

/** 整理地標：內建的不能換聚落；位置要是那個聚落的一個區塊（是不是空地在存的時候檢查） */
export function sanitizeLandmarkMod(id: string, raw: Partial<LandmarkMod>): LandmarkMod {
  if (!isLandmarkId(id)) throw new Error('地標的 id 要是 lm_ 開頭')
  const base = builtinLandmark(id)
  const L = LANDMARK_LIMITS
  const area = typeof raw.at?.area === 'string' ? settlementArea(raw.at.area, false) : undefined
  const location = base?.location ?? area?.location ?? ''
  if (!geography.locations.some((l) => l.id === location && l.type !== 'dungeon')) throw new Error('地標要擺在聚落裡')
  const at = area && area.location === location
    && Number.isInteger(raw.at!.x) && Number.isInteger(raw.at!.y) && raw.at!.x >= 0 && raw.at!.y >= 0 && raw.at!.x < area.width && raw.at!.y < area.height
    ? { area: area.key, x: raw.at!.x, y: raw.at!.y }
    : base?.at
  if (!at) throw new Error('請在小地圖上選一格')
  const out: LandmarkMod = {
    id,
    name: str(raw.name, L.name_chars) || base?.name || '新的地標',
    emoji: str(raw.emoji, 8) || base?.emoji || '📍',
    location,
    at,
    desc: str(raw.desc, L.desc_chars),
    types: [...new Set((Array.isArray(raw.types) ? raw.types : []).filter((t) => !!landmarkTypes[t]))].slice(0, L.types),
  }
  const scene = str(raw.scene, L.scene_chars)
  if (scene) out.scene = scene
  if (!base) out.custom = true
  return out
}

/** 把地標還原成內建的樣子（自建的拿掉） */
export function restoreLandmarks() {
  for (const id of Object.keys(landmarks)) {
    if (snapshot[id]) continue
    delete landmarks[id]
    delete CELL_ICON[id as CellKind]
  }
  for (const [id, l] of Object.entries(snapshot)) {
    landmarks[id] = clone(l)
    CELL_ICON[id as CellKind] = l.emoji
  }
  invalidateBlocks()
}

export function applyLandmarkMod(id: string, m: LandmarkMod) {
  const { custom: _custom, ...def } = clone(m)
  landmarks[id] = { ...def, id }
  CELL_ICON[id as CellKind] = def.emoji
  invalidateBlocks()
}

/** 哪些地方用到這個地標：特殊任務的任務點、待在這裡的固定 NPC */
export function landmarkUsage(id: string): string[] {
  const out: string[] = []
  for (const s of stories) {
    for (const n of s.nodes) if (n.at.where === 'cell' && n.at.cell === id) out.push(`特殊任務「${s.title}」的任務點「${n.title}」`)
  }
  for (const n of namedNpcs) if (n.landmark === id) out.push(`固定 NPC「${n.name}」待在這裡`)
  return out
}
