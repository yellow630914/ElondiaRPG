// 地下城編輯器的即時資訊與快速開始（docs/plan/roadmap/LOCATION_EDITOR_PLAN.md 第 3 節）：
// 各層的等級範圍、建議階級、寶箱等級與提醒；會發委託的公會、會有冒險者出沒的聚落；照內建地下城複製、依等級自動填。
// 只讀遊戲資料、不改任何東西（用還沒儲存的草稿算）。

import {
  BOSS_LAYER_IDS, DUNGEON_LAYER_NAME, dungeonEncounters, enemies, geography, regionById, wildEncounters,
  type BossLayerId, type DungeonLayerId, type EncounterGroup,
} from './data'
import { dungeonLayersOf, routeTargets, type DungeonMod } from './dungeonMods'
import { CLEAR_MIN_RANK, rankForLevel } from './materialQuests'
import { QUEST_RANGE_DAYS } from './town'
import type { GuildRank } from './types'
import { shortestPath } from './world'

export interface LayerPreview {
  layer: DungeonLayerId
  /** 一般怪物（不含層主）的等級範圍；沒有怪物時 undefined */
  levels?: [number, number]
  /** 建議階級（周邊沒有） */
  rank?: GuildRank
  /** 寶箱的等級：這一層遭遇表最高的怪物等級 */
  chest?: number
  /** 層主（第一種怪物）的名字與等級 */
  boss?: { name: string; level: number }
  /** 同一地區的內建地下城這一層的等級範圍（比較用） */
  reference?: [number, number]
  warnings: string[]
}

const monsterIds = (groups: EncounterGroup[] | undefined) => [...new Set((groups ?? []).flatMap((g) => g.map(([e]) => e)))].filter((e) => !!enemies[e])
const levelRange = (ids: string[]): [number, number] | undefined => {
  const lv = ids.map((e) => enemies[e]!.level)
  return lv.length ? [Math.min(...lv), Math.max(...lv)] : undefined
}

/** 拿來比較的內建地下城：不是園區、沒有出現條件（高等地下城、緋夢樂園底下的遺跡不算） */
function referenceDungeons(region: string): string[] {
  const plain = geography.locations.filter((l) => l.type === 'dungeon' && !l.park && !l.requires && dungeonEncounters[l.id] && !l.id.startsWith('loc_'))
  const same = plain.filter((l) => l.region === region)
  return (same.length ? same : plain).map((l) => l.id)
}

/** 同一地區內建地下城每一層的等級範圍（周邊、淺層、中層、深層、底層） */
export function regionLayerLevels(region: string): Partial<Record<DungeonLayerId, [number, number]>> {
  const out: Partial<Record<DungeonLayerId, [number, number]>> = {}
  for (const layer of ['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as DungeonLayerId[]) {
    const range = levelRange(referenceDungeons(region).flatMap((id) => monsterIds(dungeonEncounters[id]?.[layer])))
    if (range) out[layer] = range
  }
  return out
}

/** 各層的資訊與提醒（不擋儲存） */
export function layerPreview(m: Pick<DungeonMod, 'region' | 'layers' | 'bosses' | 'abyss'>): LayerPreview[] {
  const refs = regionLayerLevels(m.region)
  const regionName = geography.regions.some((r) => r.id === m.region) ? regionById(m.region).name : m.region
  let prevMax = 0
  return dungeonLayersOf(m).map((layer) => {
    const ids = monsterIds(m.layers[layer])
    const levels = levelRange(ids)
    const out: LayerPreview = { layer, warnings: [] }
    if (levels) {
      out.levels = levels
      out.chest = levels[1]
      if (layer !== 'outskirts') out.rank = rankForLevel(levels[1], [CLEAR_MIN_RANK, 'S'])
    }
    const bossId = layer !== 'outskirts' ? m.bosses?.[layer as BossLayerId]?.[0]?.[0] : undefined
    if (bossId && enemies[bossId]) out.boss = { name: enemies[bossId]!.name, level: enemies[bossId]!.level }
    const ref = refs[layer]
    if (ref) out.reference = ref
    if (!levels) {
      out.warnings.push(layer === 'abyss' ? '勾了底層但還沒有怪物：沒有怪物時只有四層' : `這一層還沒有怪物：會用${regionName}的城郊遭遇表`)
    } else {
      if (levels[1] < prevMax) out.warnings.push('比上一層弱')
      if (ref && levels[1] > ref[1] + 2) out.warnings.push(`比${regionName}內建地下城的${DUNGEON_LAYER_NAME[layer]}（${ref[0]}～${ref[1]} 級）強很多`)
      if (ref && levels[1] < ref[0] - 1) out.warnings.push(`比${regionName}內建地下城的${DUNGEON_LAYER_NAME[layer]}（${ref[0]}～${ref[1]} 級）弱很多`)
      prevMax = Math.max(prevMax, levels[1])
    }
    if (out.boss && levels && out.boss.level < levels[0]) out.warnings.push('層主比這一層的怪物弱')
    return out
  })
}

/** 會發清剿委託、賣情報的聚落（照路線算 QUEST_RANGE_DAYS 天內，看最多的天數），以及會有冒險者出沒的相鄰聚落 */
export function routePreview(m: Pick<DungeonMod, 'routes' | 'requires'>): { guilds: { id: string; name: string; days: number }[]; neighbors: string[] } {
  const guilds: { id: string; name: string; days: number }[] = []
  for (const s of routeTargets()) {
    let best = Infinity
    for (const r of m.routes) {
      const leg = r.to === s.id ? 0 : shortestPath(s.id, r.to)?.days[1]
      if (leg !== undefined) best = Math.min(best, leg + r.days[1])
    }
    if (best <= QUEST_RANGE_DAYS) guilds.push({ id: s.id, name: s.name, days: best })
  }
  guilds.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name))
  // 有出現條件的地下城不會有冒險者出沒（population.ts）
  const neighbors = m.requires ? [] : m.routes.map((r) => geography.locations.find((l) => l.id === r.to)?.name ?? r.to)
  return { guilds, neighbors }
}

// ---- 快速開始 ----

/** 可以照抄的內建地下城（不是園區） */
export function copyableDungeons(): { id: string; name: string; region: string }[] {
  return geography.locations
    .filter((l) => l.type === 'dungeon' && !l.park && dungeonEncounters[l.id] && !l.id.startsWith('loc_'))
    .map((l) => ({ id: l.id, name: l.name, region: l.region }))
}

/** 照內建地下城複製各層的遭遇與層主（含底層） */
export function copyLayers(source: string): Pick<DungeonMod, 'layers' | 'bosses' | 'abyss'> {
  const t = dungeonEncounters[source]
  if (!t) throw new Error('找不到這座地下城')
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const out: Pick<DungeonMod, 'layers' | 'bosses' | 'abyss'> = {
    layers: { outskirts: clone(t.outskirts), shallow: clone(t.shallow), middle: clone(t.middle), deep: clone(t.deep) },
  }
  if (t.abyss?.length) {
    out.abyss = true
    out.layers.abyss = clone(t.abyss)
  }
  const bosses: Partial<Record<BossLayerId, EncounterGroup>> = {}
  for (const layer of BOSS_LAYER_IDS) {
    const g = t.bosses?.[layer] ?? (layer === 'deep' && t.boss?.length ? t.boss : undefined)
    if (g?.length && (layer !== 'abyss' || out.abyss)) bosses[layer] = clone(g)
  }
  if (Object.keys(bosses).length) out.bosses = bosses
  return out
}

/** 這個地區的怪物：城郊遭遇表與內建地下城（不含園區）出現過的；太少時用所有內建地下城的 */
export function regionMonsters(region: string): string[] {
  const fromTables = (ids: string[]) => ids.flatMap((id) => {
    const t = dungeonEncounters[id]
    return t ? [...(['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as const).flatMap((l) => monsterIds(t[l])), ...BOSS_LAYER_IDS.flatMap((l) => monsterIds(t.bosses?.[l] ? [t.bosses[l]!] : []))] : []
  })
  const own = new Set([...monsterIds(wildEncounters(region)), ...fromTables(referenceDungeons(region))])
  if (own.size >= 8) return [...own]
  return [...new Set([...own, ...fromTables(referenceDungeons(''))])]
}

/**
 * 依等級自動填：每一層從這個地區的怪物裡挑等級在範圍內的（沒有時放寬到所有內建地下城的怪物），
 * 排成 3～4 組（單種一組、兩種混一組），層主挑範圍上限附近最強的一隻、帶兩隻這一層的怪當護衛。
 * ranges 沒給的層照同一地區內建地下城那一層的等級。
 */
export function autoFillLayers(
  region: string, abyss: boolean, ranges: Partial<Record<DungeonLayerId, [number, number]>> = {}, random: () => number = Math.random,
): Pick<DungeonMod, 'layers' | 'bosses'> {
  const refs = regionLayerLevels(region)
  const pool = regionMonsters(region)
  const all = Object.keys(enemies).filter((e) => !enemies[e]!.id.startsWith('mod_'))
  const shuffle = <T>(list: T[]) => list.map((v) => ({ v, k: random() })).sort((a, b) => a.k - b.k).map((x) => x.v)
  const layers: DungeonMod['layers'] = {}
  const bosses: Partial<Record<BossLayerId, EncounterGroup>> = {}
  for (const layer of dungeonLayersOf({ abyss })) {
    const [lo, hi] = ranges[layer] ?? refs[layer] ?? [1, 2]
    const inRange = (ids: string[]) => ids.filter((e) => enemies[e] && enemies[e]!.level >= lo && enemies[e]!.level <= hi)
    let picks = shuffle(inRange(pool))
    if (picks.length < 2) picks = shuffle([...new Set([...picks, ...inRange(all)])])
    picks = picks.slice(0, 3)
    const groups: EncounterGroup[] = picks.map((e) => [[e, enemies[e]!.level >= hi ? 1 : 2]] as EncounterGroup)
    if (picks.length >= 2) groups.push([[picks[0]!, 1], [picks[1]!, 1]])
    layers[layer] = groups
    if (layer === 'outskirts' || !picks.length) continue
    const strong = [...pool, ...all].filter((e) => enemies[e] && enemies[e]!.level >= hi && enemies[e]!.level <= hi + 2)
    const head = strong.sort((a, b) => enemies[a]!.level - enemies[b]!.level)[0] ?? [...picks].sort((a, b) => enemies[b]!.level - enemies[a]!.level)[0]!
    const guard = picks.find((e) => e !== head)
    bosses[layer as BossLayerId] = guard ? [[head, 1], [guard, 2]] : [[head, 1]]
  }
  return { layers, bosses }
}
