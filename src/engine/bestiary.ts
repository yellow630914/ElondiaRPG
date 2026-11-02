// 怪物圖鑑：打過、打倒，或聽 NPC 說過的怪物會「點亮」。
// 三種程度：聽說（NPC 告訴你：名字、外觀、出沒的地方、弱點與抗性）＜ 遭遇（打過：再加上等級、生命、技能、特徵）＜ 擊敗（再加上打倒的次數與掉落物）。
// 見 docs/MONSTERS.md 的「怪物圖鑑」一節。

import {
  contentRevision, DUNGEON_LAYER_IDS, DUNGEON_LAYER_NAME, damageTypeName, dungeonEncounters, enemies, geography, wildEncounters,
  type EncounterGroup, type EnemyDef,
} from './data'
import type { GameState } from './types'

export interface BestiaryEntry {
  /** NPC 告訴你的（第一次）：哪一天、誰說的 */
  heard?: { day: number; from?: string }
  /** 第一次在戰鬥裡遇到的日子 */
  seen?: number
  /** 打倒的次數 */
  defeated?: number
}

export type BestiaryLevel = 'heard' | 'seen' | 'defeated'

export const BESTIARY_LEVEL_NAME: Record<BestiaryLevel, string> = { heard: '聽說', seen: '遭遇', defeated: '擊敗' }

export function bestiaryLevel(e: BestiaryEntry | undefined): BestiaryLevel | undefined {
  if (!e) return undefined
  if (e.defeated) return 'defeated'
  if (e.seen !== undefined) return 'seen'
  return e.heard ? 'heard' : undefined
}

function entry(state: GameState, id: string): BestiaryEntry | undefined {
  if (!enemies[id]) return undefined
  return ((state.bestiary ??= {})[id] ??= {})
}

/** 聽 NPC 說了這種怪物：點亮成「聽說」（已經更亮的不變）；回傳是不是第一次點亮 */
export function hearOf(state: GameState, id: string, from?: string): boolean {
  const e = entry(state, id)
  if (!e) return false
  const first = !bestiaryLevel(e)
  e.heard ??= { day: state.time.day, ...(from ? { from } : {}) }
  return first
}

/** 戰鬥結束：在場的怪物記成遭遇，倒下的記一次擊敗；回傳第一次記進圖鑑的怪物名稱 */
export function noteFight(state: GameState, foes: { defId?: string; hp: number }[]): string[] {
  const fresh: string[] = []
  for (const f of foes) {
    const e = f.defId ? entry(state, f.defId) : undefined
    if (!e) continue
    if (e.seen === undefined && !e.defeated) fresh.push(enemies[f.defId!]!.name)
    e.seen ??= state.time.day
    if (f.hp === 0) e.defeated = (e.defeated ?? 0) + 1
  }
  return [...new Set(fresh)]
}

/** 弱點與抗性（resist 正數是吃更多傷害，負數是抗性） */
export function weaknesses(def: Pick<EnemyDef, 'resist'>): { weak: string[]; resist: string[] } {
  const entries = Object.entries(def.resist ?? {}).filter(([k]) => k !== 'all')
  return {
    weak: entries.filter(([, v]) => (v ?? 0) > 0).map(([k]) => damageTypeName(k)),
    resist: entries.filter(([, v]) => (v ?? 0) < 0).map(([k]) => damageTypeName(k)),
  }
}

// ---- 出沒的地方（依遭遇表，內容改了就重算） ----

let habitatCache: { rev: number; map: Map<string, string[]> } | undefined

/** 這種怪物在哪裡出沒：地下城的哪一層、哪個地區的近郊 */
export function habitats(id: string): string[] {
  const rev = contentRevision()
  if (habitatCache?.rev !== rev) {
    const map = new Map<string, string[]>()
    const add = (groups: EncounterGroup[] | undefined, where: string) => {
      for (const [m] of (groups ?? []).flat()) {
        const list = map.get(m) ?? []
        if (!list.includes(where)) list.push(where)
        map.set(m, list)
      }
    }
    for (const r of geography.regions) add(wildEncounters(r.id), `${r.name}的近郊`)
    for (const loc of geography.locations) {
      const table = dungeonEncounters[loc.id]
      if (!table) continue
      for (const layer of DUNGEON_LAYER_IDS) add(table[layer], `${loc.name}・${DUNGEON_LAYER_NAME[layer]}`)
    }
    habitatCache = { rev, map }
  }
  return habitatCache.map.get(id) ?? []
}

/** 一則圖鑑的文字（交給 AI 或顯示用的一行）：名字、種類、弱點與抗性 */
export function monsterLine(def: EnemyDef, kindName: (k: string) => string): string {
  const { weak, resist } = weaknesses(def)
  return [
    `${def.name} Lv.${def.level}${def.kind ? ` ${kindName(def.kind)}` : ''}`,
    weak.length ? `怕 ${weak.join('、')}` : '',
    resist.length ? `抗 ${resist.join('、')}` : '',
  ].filter(Boolean).join('｜')
}

/** 圖鑑的統計：點亮了幾種、全部幾種 */
export function bestiaryCount(state: GameState): { lit: number; total: number } {
  const total = Object.keys(enemies).length
  const lit = Object.entries(state.bestiary ?? {}).filter(([id, e]) => enemies[id] && bestiaryLevel(e)).length
  return { lit, total }
}

