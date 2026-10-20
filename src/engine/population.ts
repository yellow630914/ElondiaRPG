// NPC 名單與每日位置（見 docs/NPC_SYSTEM.md）。
//
// - 每個聚落第一次進入時建立一份名單：冒險者與普通人約各半（data/rules/npc_population.json）。
//   名單用「存檔種子＋地點」的固定亂數生成，不影響遊戲的亂數。
// - NPC 有標籤與活躍地點（地點＋地區＋權重）。每天在哪裡由「NPC id＋日期」的固定亂數決定，
//   不需要另外存檔，重新整理也不會變。
// - 店主、公會職員等職員沒有活躍地點，固定待在自己的設施；舊資料（沒有活躍地點）沿用同樣的規則。

import { geography, locationById, npcs as namedNpcs, npcTags, population, type Haunt, type Location, type NpcKind } from './data'
import { currentArea, currentCell, zonesOf, type Zone } from './grid'
import { generateNpc, hashString, npcKind, npcRecord, npcSpot, registerNpc, weightedPick } from './npcs'
import { Rng } from './rng'
import type { GameState, NpcRecord, Roster } from './types'

// ---- 生成 ----

/** 抽標籤：普通人抽一個主要標籤；冒險者每個標籤各自擲機率；最後可能再疊加「旅人」等額外標籤 */
export function pickTags(rng: Rng, kind: NpcKind, loc: Location): string[] {
  const usable = Object.entries(npcTags.tags)
    .filter(([, t]) => t.kinds.includes(kind) && (!t.location_types || t.location_types.includes(loc.type)))
  const tags: string[] = []
  if (kind === 'commoner') {
    const weights = Object.fromEntries(usable.map(([id, t]) => [id, t.commoner_weight ?? 0]))
    tags.push(weightedPick(rng, weights))
  } else {
    for (const [id, t] of usable) if (t.adventurer_chance && rng.next() < t.adventurer_chance) tags.push(id)
  }
  for (const [id, t] of usable) {
    if (tags.length && !tags.includes(id) && t.extra_chance && rng.next() < t.extra_chance) tags.push(id)
  }
  return tags
}

/** 沿道路相連的地點（一步） */
function neighbors(locId: string): string[] {
  return geography.routes.flatMap((r) => (r.a === locId ? [r.b] : r.b === locId ? [r.a] : []))
}

function isSettlement(locId: string): boolean {
  return locationById(locId).type !== 'dungeon'
}

/** 活躍地點：所屬地點的各地區，加上相鄰的聚落；冒險者再加上附近的地下城 */
export function buildHaunts(rng: Rng, kind: NpcKind, tags: string[], loc: Location): Haunt[] {
  const kindDef = npcTags.kinds[kind]
  const weights: Record<string, number> = { ...kindDef.zone_weights }
  for (const t of tags) Object.assign(weights, npcTags.tags[t]?.zone_weights ?? {})

  const available = zonesOf(loc)
  const home: Record<string, number> = {}
  for (const [zone, w] of Object.entries(weights)) {
    if (zone === 'dungeon' || w <= 0) continue
    const z = available.includes(zone as Zone) ? zone : 'town'
    home[z] = (home[z] ?? 0) + w
  }
  const haunts: Haunt[] = Object.entries(home).map(([zone, weight]) => ({ location: loc.id, zone, weight: round(weight) }))

  // 相鄰的聚落：旅人等標籤會多去幾個地方（兩步以內），其他人只有低機率出現在一個鄰近的聚落
  const near = neighbors(loc.id).filter(isSettlement)
  const twoSteps = [...new Set([...near, ...near.flatMap(neighbors)])].filter((id) => id !== loc.id && isSettlement(id))
  const extra = tags.reduce((n, t) => {
    const r = npcTags.tags[t]?.haunt_extra
    return Math.max(n, r ? rng.int(r[0], r[1]) : 0)
  }, 0)
  if (extra > 0 && twoSteps.length) {
    const range = tags.map((t) => npcTags.tags[t]?.haunt_extra_weight).find(Boolean) ?? [0.3, 0.6]
    const pool = [...twoSteps]
    for (let i = 0; i < extra && pool.length; i++) {
      const id = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
      haunts.push({ location: id, zone: 'town', weight: round(range[0] + rng.next() * (range[1] - range[0])) })
    }
  } else if (near.length) {
    haunts.push({ location: rng.pick(near), zone: 'town', weight: npcTags.neighbor_weight })
  }

  const dungeonWeight = weights.dungeon ?? 0
  const dungeons = neighbors(loc.id).filter((id) => !isSettlement(id))
  if (kind === 'adventurer' && dungeonWeight > 0 && dungeons.length) {
    const [lo, hi] = kindDef.dungeon_haunts ?? [1, 1]
    const pool = [...dungeons]
    for (let i = rng.int(lo, hi); i > 0 && pool.length; i--) {
      const id = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
      haunts.push({ location: id, zone: 'dungeon', weight: dungeonWeight })
    }
  }
  return haunts
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** 生成一位名單上的居民 */
export function generateResident(state: GameState, rng: Rng, loc: Location, kind: NpcKind): NpcRecord {
  const tags = pickTags(rng, kind, loc)
  const occupations = tags.flatMap((t) => npcTags.tags[t]?.occupations ?? [])
  let level: number
  if (kind === 'adventurer') {
    const [lo, hi] = population.adventurer_level[loc.type] ?? [1, 5]
    level = Math.min(rng.int(lo, hi), rng.int(lo, hi))
  } else {
    const [lo, hi] = npcTags.kinds.commoner.level ?? [1, 3]
    level = rng.int(lo, hi)
  }
  return generateNpc(state, rng, {
    kind,
    tags,
    level,
    location: loc.id,
    haunts: buildHaunts(rng, kind, tags, loc),
    ...(kind === 'commoner' && occupations.length ? { occupation: rng.pick(occupations) } : {}),
    ...(loc.faction && kind === 'commoner' ? { faction: loc.faction } : {}),
  }, kind === 'adventurer' ? 'adv' : 'cmn')
}

/** 建立地點的名單（已經有就直接回傳）；地下城沒有名單 */
export function ensureRoster(state: GameState, locId: string): Roster | undefined {
  const loc = locationById(locId)
  const size = population.roster[loc.type]
  if (!size) return undefined
  const rosters = (state.rosters ??= {})
  if (rosters[locId]) return rosters[locId]
  // 具名 NPC：所屬地點是這裡的算進冒險者名額
  const named = namedNpcs.filter((n) => n.location === locId).map((n) => n.id)
  const rng = new Rng(hashString(`${state.seed}:roster:${locId}`))
  const members = [...named]
  for (let i = named.length; i < size.adventurer; i++) members.push(generateResident(state, rng, loc, 'adventurer').id)
  for (let i = 0; i < size.commoner; i++) members.push(generateResident(state, rng, loc, 'commoner').id)
  rosters[locId] = { members, day: state.time.day }
  return rosters[locId]
}

// ---- 每天在哪裡 ----

/** NPC 今天在哪裡（依活躍地點的權重，用 NPC id＋日期的固定亂數）；沒有活躍地點時為 undefined */
export function whereToday(rec: Pick<NpcRecord, 'id' | 'haunts'>, day: number): Haunt | undefined {
  const haunts = rec.haunts ?? []
  if (!haunts.length) return undefined
  const rng = new Rng(hashString(`${rec.id}@${day}`))
  const i = Number(weightedPick(rng, Object.fromEntries(haunts.map((h, idx) => [String(idx), h.weight]))))
  return haunts[i]
}

/** 所有登錄過的 NPC（遊戲中的紀錄優先，加上還沒登場的具名 NPC） */
function allNpcs(state: GameState): NpcRecord[] {
  const seen = new Set<string>()
  const out: NpcRecord[] = []
  for (const rec of [...Object.values(state.npcs ?? {}), ...namedNpcs.map((n) => npcRecord(state, n.id)!)]) {
    if (seen.has(rec.id)) continue
    seen.add(rec.id)
    out.push(rec)
  }
  return out
}

/** 主角目前看得到的地區：聚落是所在區塊的地區（站在神殿格上再加上神殿），近郊是 outskirts */
export function visibleZones(state: GameState): Zone[] {
  const area = currentArea(state)
  if (area.kind === 'dungeon') return []
  if (area.kind === 'wild') return ['outskirts']
  return [area.zone ?? 'town', ...(currentCell(state).kind === 'temple' ? ['temple' as Zone] : [])]
}

export interface PresentNpc {
  rec: NpcRecord
  kind: NpcKind
  /** 職員：店主、公會職員等，固定待在自己的設施 */
  staff: boolean
}

/** 這裡的人：今天在這個地點、這個地區的 NPC（不含隊友） */
export function peopleHere(state: GameState): PresentNpc[] {
  const inParty = new Set(state.party.map((m) => m.id))
  const area = currentArea(state)
  const zones = visibleZones(state)
  const cell = currentCell(state)
  const out: PresentNpc[] = []
  for (const rec of allNpcs(state)) {
    if (inParty.has(rec.id)) continue
    const today = whereToday(rec, state.time.day)
    if (today) {
      if (today.location === state.location && zones.includes(today.zone as Zone)) out.push({ rec, kind: npcKind(rec), staff: false })
      continue
    }
    // 沒有活躍地點：職員待在自己的設施；其他人（舊資料、入住旅館時認識的人……）要認識才會列出
    if (rec.location !== state.location || area.kind !== 'settlement') continue
    const spot = npcSpot(rec)
    if (spot ? cell.kind === spot : !!state.relationships?.[rec.id]) out.push({ rec, kind: npcKind(rec), staff: !!spot })
  }
  // 職員排前面，再依冒險者、普通人、名字排序
  return out.sort((a, b) => Number(b.staff) - Number(a.staff) || (a.kind === b.kind ? 0 : a.kind === 'adventurer' ? -1 : 1) || a.rec.name.localeCompare(b.rec.name))
}

/**
 * 角色現在是否在主角身邊：隊友永遠在；有活躍地點的人要今天在這裡、這個地區；
 * 其他人要在同一個聚落，而且主角站在他平常待的設施上（沒有固定設施的人在整個聚落都找得到）。
 */
export function presentHere(state: GameState, id: string): boolean {
  if (state.party.some((m) => m.id === id)) return true
  const rec = npcRecord(state, id)
  if (!rec) return false
  const today = whereToday(rec, state.time.day)
  if (today) return today.location === state.location && visibleZones(state).includes(today.zone as Zone)
  if (rec.location !== state.location) return false
  if (currentArea(state).kind !== 'settlement') return false
  const spot = npcSpot(rec)
  return !spot || currentCell(state).kind === spot
}

/** 今天在這座城裡（任何區塊）、可以雇用的冒險者 */
export function adventurersInTown(state: GameState): NpcRecord[] {
  const inParty = new Set(state.party.map((m) => m.id))
  ensureRoster(state, state.location)
  return allNpcs(state).filter((rec) => {
    if (inParty.has(rec.id) || npcKind(rec) !== 'adventurer' || rec.hostile) return false
    const today = whereToday(rec, state.time.day)
    if (today) return today.location === state.location && today.zone !== 'outskirts' && today.zone !== 'dungeon'
    // 舊資料：離隊後回到酒館的人
    return rec.location === state.location && npcSpot(rec) === 'tavern' && !/^(slv|pty|mst)_/.test(rec.id)
  })
}

/** 和主角沒有任何關聯、也不在名單上的生成 NPC：移除，避免存檔越來越大 */
export function pruneNpcs(state: GameState) {
  const keep = new Set<string>([
    ...state.party.map((m) => m.id),
    ...Object.keys(state.relationships ?? {}),
    ...Object.values(state.rosters ?? {}).flatMap((r) => r.members),
    ...(state.memories ?? []).flatMap((m) => m.participants),
    ...Object.values(state.markets ?? {}).flatMap((m) => m.stock.map((x) => x.npc)),
    ...(state.partyOffers ?? []).flatMap((o) => [o.leader, ...o.members]),
    ...state.party.flatMap((m) => (m.contract ? [m.contract.master] : [])),
  ])
  for (const [id, rec] of Object.entries(state.npcs ?? {})) {
    if (rec.generated && /^(tav|slv|pty)_/.test(id) && !keep.has(id)) delete state.npcs![id]
  }
}

// ---- AI 潤飾 ----

/** AI 潤飾的文字（名字、外貌、性格、背景，普通人還有職業描述）；數值不變 */
export interface NpcFlavor { id: string; name?: string; appearance?: string; personality?: string; background?: string; occupation?: string }

/** 名單上還沒潤飾過的人：生成的、還不認識的 */
export function unflavored(state: GameState, locId: string): NpcRecord[] {
  const roster = state.rosters?.[locId]
  if (!roster || roster.flavored) return []
  return roster.members
    .map((id) => state.npcs?.[id])
    .filter((r): r is NpcRecord => !!r?.generated && !state.relationships?.[r.id])
}

export function applyRosterFlavor(state: GameState, locId: string, flavors: NpcFlavor[]) {
  const roster = state.rosters?.[locId]
  if (!roster) return
  const ids = new Set(unflavored(state, locId).map((r) => r.id))
  const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')
  const usedNames = new Set([...Object.values(state.npcs ?? {}).map((n) => n.name), ...namedNpcs.map((n) => n.name), ...state.party.map((m) => m.name)])
  for (const f of flavors) {
    const rec = state.npcs?.[f.id]
    if (!rec || !ids.has(f.id)) continue
    const name = clip(f.name, 12)
    if (name && !usedNames.has(name)) {
      usedNames.add(name)
      rec.name = name
    }
    rec.appearance = clip(f.appearance, 160) || rec.appearance
    rec.personality = clip(f.personality, 120) || rec.personality
    const bg = clip(f.background, 160)
    if (bg) rec.background = bg
    const occupation = clip(f.occupation, 12)
    if (occupation && npcKind(rec) === 'commoner') rec.occupation = occupation
  }
  roster.flavored = true
}
