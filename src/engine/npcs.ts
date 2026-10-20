// NPC 登錄與生成。
//
// 遊戲中登場的 NPC 都放在 GameState.npcs：data/world/npcs.json 的具名角色第一次離隊時複製進來，
// 酒館候選人、其他隊伍、奴隸市場的角色則由程式生成（名字、外貌、性格可再交給 AI 潤飾）。
// NPC 不在隊伍時，角色資料（等級、經驗、能力）保存在 NpcRecord.character，再次入隊時沿用。

import { createNpc, lifeTier } from './character'
import {
  attributeRules, classes, className, companionRules, GENDER_IDS, locationById, npcPool, npcs as namedNpcs, slaveryRules, tagDef,
  type Haunt, type NpcKind,
} from './data'
import { Rng } from './rng'
import type { Character, GameState, NpcRecord } from './types'

export interface NpcSpec {
  id?: string
  name?: string
  gender?: string
  race?: string
  class?: string
  level?: number
  personality?: string
  appearance?: string
  faction?: string
  background?: string
  location?: string
  /** 普通人沒有職業（class 為空字串），改用 occupation 描述 */
  kind?: NpcKind
  tags?: string[]
  occupation?: string
  haunts?: Haunt[]
  spot?: string
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function npcRecord(state: GameState, id: string): NpcRecord | undefined {
  return state.npcs?.[id] ?? namedNpcs.find((n) => n.id === id)
}

export function registerNpc(state: GameState, rec: NpcRecord): NpcRecord {
  ;(state.npcs ??= {})[rec.id] = rec
  return rec
}

/** 雇傭要價 = (a + b × 等級 + c × 等級²)，再乘上浮動 */
export function askingPrice(level: number, rng?: Rng): number {
  const { a, b, c } = companionRules.tavern.asking
  const base = a + b * level + c * level * level
  const v = companionRules.tavern.asking_variance
  const factor = rng ? 1 - v + rng.next() * 2 * v : 1
  return Math.max(10, Math.round((base * factor) / 5) * 5)
}

/** 奴隸價格：依世界書的層級與種族區間（見 data/rules/slavery.json）。 */
export function slavePrice(c: { race: string; class: string; level: number }, marketMult = 1, rng?: Rng): number {
  const p = slaveryRules.prices_cc
  const tier = lifeTier(c.level)
  const group = p.race_group[c.race] ?? 'human'
  const table = p[String(Math.min(tier, 3)) as '1' | '2' | '3'][group]
  const range = tierLevels(Math.min(tier, 3))
  const t = range[1] > range[0] ? (Math.min(c.level, range[1]) - range[0]) / (range[1] - range[0]) : 0
  let price = table[0] + (table[1] - table[0]) * t
  if (tier > 3) price *= p.beyond_tier3_mult ** (tier - 3)
  price *= (p.race_mult[c.race] ?? 1) * (p.class_mult[c.class] ?? 1) * marketMult
  if (rng) price *= 1 - p.variance + rng.next() * 2 * p.variance
  return Math.max(100, Math.round(price / 10) * 10)
}

function tierLevels(tier: number): [number, number] {
  const levels: Record<number, [number, number]> = { 1: [1, 4], 2: [5, 8], 3: [9, 12] }
  return levels[tier] ?? [1, 4]
}

function weightedPick(rng: Rng, weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rng.next() * total
  for (const [k, w] of entries) {
    r -= w
    if (r < 0) return k
  }
  return entries[entries.length - 1]![0]
}

export { weightedPick }

/** 各地區生成 NPC 的種族比例 */
function raceWeights(location: string): Record<string, number> {
  const region = locationById(location).region
  const base: Record<string, number> = { human: 6, catfolk: 2, dwarf: 2, demon: 1, elf: 1, yulin: 1 }
  if (region === 'south') Object.assign(base, { demon: 6, human: 3 })
  if (region === 'north') Object.assign(base, { dwarf: 6 })
  if (region === 'forest') Object.assign(base, { elf: 5 })
  if (region === 'east_sea') Object.assign(base, { yulin: 4 })
  if (region === 'west') Object.assign(base, { catfolk: 5 })
  return Object.fromEntries(Object.entries(base).filter(([r]) => attributeRules.races[r]))
}

function uniqueName(state: GameState, rng: Rng, race: string, gender: string): string {
  const names = npcPool.names[race] ?? npcPool.names.human!
  const kind = npcPool.genders[gender]?.names ?? 'any'
  const pool = kind === 'm' ? names.m : kind === 'f' ? names.f : [...names.m, ...names.f]
  const used = new Set([
    ...Object.values(state.npcs ?? {}).map((n) => n.name),
    ...namedNpcs.map((n) => n.name),
    ...state.party.map((m) => m.name),
  ])
  const free = pool.filter((n) => !used.has(n))
  if (free.length) return rng.pick(free)
  const base = rng.pick(pool)
  for (let i = 2; ; i++) if (!used.has(`${base}・${i}`)) return `${base}・${i}`
}

function newNpcId(state: GameState, prefix: string): string {
  const taken = state.npcs ?? {}
  let n = Object.keys(taken).length + 1
  while (taken[`${prefix}_${n}`]) n++
  return `${prefix}_${n}`
}

/** 生成一位 NPC 並登錄。spec 沒指定的欄位隨機決定；普通人沒有職業。 */
export function generateNpc(state: GameState, rng: Rng, spec: NpcSpec = {}, prefix = 'gen'): NpcRecord {
  const location = spec.location ?? state.location
  const kind: NpcKind = spec.kind ?? 'adventurer'
  const race = spec.race && attributeRules.races[spec.race] ? spec.race : weightedPick(rng, raceWeights(location))
  const cls = kind === 'commoner' ? '' : spec.class && classes[spec.class] ? spec.class : rng.pick(Object.keys(classes))
  const level = Math.max(1, Math.min(20, Math.round(spec.level ?? 1)))
  const gender = spec.gender && GENDER_IDS.includes(spec.gender)
    ? spec.gender
    : weightedPick(rng, Object.fromEntries(GENDER_IDS.map((g) => [g, npcPool.genders[g]!.weight])))
  const features = npcPool.features[race] ?? npcPool.features.human!
  const tags = spec.tags ?? []
  const outfits = kind === 'commoner'
    ? tags.map((t) => npcPool.commoner_outfits[t]).find(Boolean) ?? npcPool.commoner_outfits.default!
    : npcPool.outfits
  const rec: NpcRecord = {
    id: spec.id ?? newNpcId(state, prefix),
    name: spec.name?.trim() || uniqueName(state, rng, race, gender),
    gender,
    race,
    class: cls,
    level,
    location,
    hire_cc: kind === 'commoner' ? 0 : askingPrice(level, rng),
    personality: spec.personality?.trim() || rng.pick(kind === 'commoner' ? npcPool.commoner_personalities : npcPool.personalities),
    appearance: spec.appearance?.trim() || `${rng.pick(features)}，${rng.pick(outfits)}。`,
    ...(spec.faction ? { faction: spec.faction } : {}),
    ...(spec.background ? { background: spec.background } : {}),
    kind,
    ...(tags.length ? { tags } : {}),
    ...(spec.occupation ? { occupation: spec.occupation } : {}),
    ...(spec.haunts?.length ? { haunts: spec.haunts } : {}),
    ...(spec.spot ? { spot: spec.spot } : {}),
    generated: true,
  }
  return registerNpc(state, rec)
}

/** 普通人或冒險者（舊資料沒寫時，有職業的算冒險者） */
export function npcKind(rec: Pick<NpcRecord, 'kind' | 'class'>): NpcKind {
  return rec.kind ?? (rec.class ? 'adventurer' : 'commoner')
}

/** 身分的簡稱：冒險者是職業，普通人是職業描述 */
export function npcTitle(rec: Pick<NpcRecord, 'kind' | 'class' | 'occupation' | 'tags'>): string {
  if (npcKind(rec) === 'adventurer') return className(rec.class)
  return rec.occupation ?? tagDef(rec.tags?.[0] ?? '')?.name ?? '平民'
}

/** 給 AI 的身分說明：類型、職業或職業描述、標籤 */
export function npcIdentity(rec: Pick<NpcRecord, 'kind' | 'class' | 'occupation' | 'tags'>): string {
  const kind = npcKind(rec) === 'adventurer' ? '冒險者' : '普通人'
  const tags = (rec.tags ?? []).map((t) => tagDef(t)).filter(Boolean).map((t) => `${t!.name}（${t!.ai_hint}）`)
  return [`${kind}・${npcTitle(rec)}`, ...tags].join('；')
}

/** 取得 NPC 的角色資料：之前同行過就沿用，否則依等級生成。 */
export function characterFor(state: GameState, rec: NpcRecord): Character {
  if (rec.character) return JSON.parse(JSON.stringify(rec.character)) as Character
  return createNpc(rec, new Rng(hashString(rec.id)))
}

/** 找出 NPC 的 id（依名字或別名比對），供 AI 回傳的名字對應 */
export function findNpcByName(state: GameState, name: string): string | undefined {
  const n = name.trim()
  for (const r of Object.values(state.relationships ?? {})) {
    if (r.name === n || r.aliases?.includes(n)) return r.id
  }
  return state.party.find((m) => m.name === n)?.id
}

const SHOP_SPOT: Record<string, string> = { general: 'shop', temple: 'temple', tavern: 'tavern' }

/** NPC 平常待的設施：店主在自己的店、公會職員在公會，冒險者與知情人在酒館。 */
export function npcSpot(rec: NpcRecord): string | undefined {
  if (rec.spot) return rec.spot
  const keeper = /^keeper_.+_(\w+)$/.exec(rec.id)
  if (keeper) return SHOP_SPOT[keeper[1]!] ?? 'shop'
  if (rec.id.startsWith('clerk_')) return 'guild'
  if (/^(tav|pty|gen|inf)_/.test(rec.id) || namedNpcs.some((n) => n.id === rec.id)) return 'tavern'
  return undefined
}
