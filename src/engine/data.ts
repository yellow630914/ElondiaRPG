// 讀入 data/ 底下的 JSON，並提供型別。

import geographyJson from '@data/world/geography.json'
import npcsJson from '@data/world/npcs.json'
import progressionJson from '@data/rules/progression.json'
import economyJson from '@data/rules/economy.json'
import combatJson from '@data/rules/combat.json'
import skillsJson from '@data/rules/skills.json'
import enemiesJson from '@data/rules/enemies.json'
import townQuestsJson from '@data/rules/town_quests.json'
import type { GuildRank, QuestKind, SkillQuality } from './types'

export type RouteMode = 'road' | 'trail' | 'wild' | 'sea' | 'dive' | 'underground'
export type LocationType =
  | 'capital' | 'city' | 'town' | 'village' | 'port' | 'outpost' | 'fortress' | 'dungeon'

export interface Region { id: string; name: string; climate: string; dominant: string; danger: number }
export interface Location {
  id: string
  name: string
  region: string
  type: LocationType
  faction?: string | null
  rank?: string
  note?: string
}
export interface Route {
  a: string
  b: string
  days: [number, number] | null
  mode: RouteMode
  estimated?: boolean
  note?: string
}

export interface NpcDef {
  id: string
  name: string
  race: string
  class: string
  level: number
  location: string
  hire_cc: number
  personality: string
  faction: string
}

export interface ClassCombat {
  hit_die: number
  mp_per_level: number
  ac: number
  damage: string
  attack_attr: number
  start_skills: string[]
}

export interface SkillEffect {
  kind: 'attack' | 'damage' | 'heal' | 'buff'
  damage_mult?: number
  hit_mod?: number
  hits?: number
  bonus_dice?: string
  dice?: string
  add_level?: boolean
  element?: string
  status?: string
  turns?: number
  self_status?: string
}
export interface SkillDef {
  id: string
  name: string
  quality: SkillQuality
  mp: number
  enemy_only?: boolean
  target: 'enemy' | 'ally' | 'self' | 'all_enemies' | 'all_allies'
  effect: SkillEffect
}
export interface StatusDef {
  dot?: string
  skip_turn?: boolean
  attack_bonus?: number
  ac_bonus?: number
  ac_penalty?: number
  turns?: number
  desc: string
}

export interface EnemyDef {
  id: string
  name: string
  level: number
  hp: number
  ac: number
  attack: number
  damage: string
  xp: number
  skills?: string[]
  habitats: string[]
  money_cc?: [number, number]
  loot?: { item: string; chance: number }[]
}
export type EncounterGroup = [string, number][]

export const geography = geographyJson as unknown as {
  regions: Region[]
  locations: Location[]
  routes: Route[]
}
export const npcs = (npcsJson as unknown as { npcs: NpcDef[] }).npcs
export const progression = progressionJson as unknown as {
  life_tiers: { tier: number; levels: [number, number]; max_skill_quality: SkillQuality }[]
  guild_ranks: { rank: GuildRank; levels: [number, number]; desc: string }[]
  classes: { id: string; name: string; power: string[] }[]
  races: { id: string; name: string; home: string }[]
  affinity: { min: number; max: number; initial: number; stages: { range: [number, number]; name: string }[] }
  power_gap_attitude: { by_diff: Record<string, string>; clamp: [number, number] }
}
export const economy = economyJson as unknown as {
  quest_rewards_cc: Record<string, { range: [number, number]; party: string; duration_days: [number, number] }>
  lodging_cc_per_night: Record<string, [number, number]>
  meals_cc: Record<string, number | [number, number]>
}
export const combatRules = combatJson as unknown as {
  proficiency: { base: number; every_levels: number }
  xp_to_next_level_per_level: number
  party_max: number
  flee_dc: number
  defend_ac_bonus: number
  classes: Record<string, ClassCombat>
}
const skillsData = skillsJson as unknown as { skills: SkillDef[]; statuses: Record<string, StatusDef> }
export const skills: Record<string, SkillDef> = Object.fromEntries(skillsData.skills.map((s) => [s.id, s]))
export const statuses = skillsData.statuses
const enemiesData = enemiesJson as unknown as {
  enemies: EnemyDef[]
  encounters: Record<string, EncounterGroup[] | string>
}
export const enemies: Record<string, EnemyDef> = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]))
export const encounterTables: Record<string, EncounterGroup[]> = Object.fromEntries(
  Object.entries(enemiesData.encounters).filter((e): e is [string, EncounterGroup[]] => Array.isArray(e[1])),
)

export interface TownQuestTemplate {
  id: string
  kind: Exclude<QuestKind, 'clear_dungeon'>
  area: 'town' | 'outskirts'
  title: string
  scene: string
  hours: number
  dc?: number
  item?: string
  qty?: number
  encounter?: EncounterGroup
  encounter_chance?: number
  reward_cc: [number, number]
}
const townQuestsData = townQuestsJson as unknown as { per_town: number; templates: TownQuestTemplate[] }
export const townQuestsPerTown = townQuestsData.per_town
export const townQuestTemplates: Record<string, TownQuestTemplate> = Object.fromEntries(
  townQuestsData.templates.map((t) => [t.id, t]),
)

const locationIndex = new Map(geography.locations.map((l) => [l.id, l]))
const regionIndex = new Map(geography.regions.map((r) => [r.id, r]))

export function locationById(id: string): Location {
  const loc = locationIndex.get(id)
  if (!loc) throw new Error(`unknown location: ${id}`)
  return loc
}

export function regionById(id: string): Region {
  const region = regionIndex.get(id)
  if (!region) throw new Error(`unknown region: ${id}`)
  return region
}

export function className(id: string): string {
  return progression.classes.find((c) => c.id === id)?.name ?? id
}

export function raceName(id: string): string {
  return progression.races.find((r) => r.id === id)?.name ?? id
}

/** 有公會、旅店、酒館的聚落 */
export function isSettlement(loc: Location): boolean {
  return loc.type !== 'dungeon'
}
