// 玩家自訂內容：新增或修改怪物、物品、裝備底材與材料（「🛠️ 內容」頁籤）。
//
// - 修改存成一份覆寫（ContentMods）：內建項目存整份修改後的資料，自建項目存整份資料並標上 custom。
// - applyContent 先把遊戲資料還原成內建的樣子（模組載入時的快照），再套上覆寫，所以隨時可以重新套用或恢復預設。
// - 怪物的出現地點（spawns / exclude）寫進城郊與地下城的遭遇表；物品的寶箱、採集設定寫進對應的表；
//   掉落物以怪物的 loot 為準（在物品這邊設定掉落時，改的是那隻怪物）。
// - 自建的底材或材料會自動產生「底材 × 同類材料」的制式裝備。
// 說明見 docs/CONTENT_EDITOR.md。

import mapsJson from '@data/world/maps.json'
import {
  abilities, attributeRules, ATTR_IDS, classes, damageTypes, dungeonEncounters, enemies, equipment, GENDER_IDS, geography, itemRules, monsterTraits,
  npcs as namedNpcs, npcTags, reindexItems, statuses, wildEncounterTables, type ArmorDef, type AttrId, type DungeonEncounters, type EncounterGroup,
  type EnemyDef, type ItemCategory, type ItemDef, type ItemUse, type Mods, type NpcDef, type WeaponDef,
} from './data'
import { gearName, gearPrice, gearRules, RARITY_ORDER, type BaseDef, type MaterialDef } from './gear'
import { settlementArea, ZONES } from './grid'
import { cleanFlag } from './storyFlags'
import { applyStoryMod, builtinStory, restoreStories, sanitizeStory, type StoryMod } from './storyMods'
import type { GearSlot, GearSpec } from './types'

export type ChestLayer = 'outskirts' | 'shallow' | 'middle' | 'deep'
export const CHEST_LAYERS: ChestLayer[] = ['outskirts', 'shallow', 'middle', 'deep']
export type GatherPlace = 'wild' | 'dungeon'

/** 怪物出現的地方：table 為遭遇表（wild:地區、dungeon:地點:層、boss:地點:層），count 為一組幾隻，weight 為放幾組（越多越常遇到） */
export interface Placement { table: string; count: number; weight?: number }

export interface EnemyMod extends EnemyDef {
  custom?: boolean
  /** 另外加入的出現地點 */
  spawns?: Placement[]
  /** 從內建遭遇表移除（table key） */
  exclude?: string[]
}

export interface ItemMod extends ItemDef {
  custom?: boolean
  /** 寶箱：各層出現的機率（有這個欄位時取代內建的設定） */
  chests?: Partial<Record<ChestLayer, number>>
  /** 採集：近郊、地下城的資源格（有這個欄位時取代內建的設定） */
  gather?: GatherPlace[]
}

export interface BaseMod extends BaseDef {
  custom?: boolean
  /** 武器的傷害（主手武器）：內建底材改它原本的武器類型，自建底材登錄成 w_<id> */
  weaponDef?: WeaponDef
  /** 防具的迴避與減傷（上身）：內建底材改它原本的防具類型，自建底材登錄成 a_<id> */
  armorDef?: ArmorDef
}

export interface MaterialMod extends MaterialDef {
  custom?: boolean
}

/** 固定 NPC：內建的具名角色（data/world/npcs.json）可以修改，自建的可以刪除 */
export interface NpcMod extends NpcDef {
  custom?: boolean
}

export interface ContentMods {
  version: 1
  enemies: Record<string, EnemyMod>
  items: Record<string, ItemMod>
  bases: Record<string, BaseMod>
  materials: Record<string, MaterialMod>
  npcs: Record<string, NpcMod>
  stories: Record<string, StoryMod>
}

export function emptyMods(): ContentMods {
  return { version: 1, enemies: {}, items: {}, bases: {}, materials: {}, npcs: {}, stories: {} }
}

// ---- 內建資料的快照（模組載入時） ----

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const maps = mapsJson as unknown as { generation: { wild: { resource_items: string[] }; dungeon: { resource_items: string[] } } }

const snapshot = {
  enemies: clone(enemies),
  dungeon: clone(dungeonEncounters),
  wild: clone(wildEncounterTables),
  items: clone(itemRules.items),
  bases: clone(gearRules.bases),
  materials: clone(gearRules.materials),
  chests: clone(gearRules.chests),
  weapons: clone(equipment.weapons),
  armors: clone(equipment.armors),
  gather: { wild: [...maps.generation.wild.resource_items], dungeon: [...maps.generation.dungeon.resource_items] },
  npcs: clone(namedNpcs),
}

export function builtinNpc(id: string): NpcDef | undefined {
  const n = snapshot.npcs.find((x) => x.id === id)
  return n ? clone(n) : undefined
}

export function builtinEnemy(id: string): EnemyDef | undefined {
  return snapshot.enemies[id] ? clone(snapshot.enemies[id]!) : undefined
}
export function builtinItem(name: string): ItemDef | undefined {
  const i = snapshot.items.find((x) => x.name === name)
  return i ? clone(i) : undefined
}
export function builtinBase(id: string): BaseDef | undefined {
  return snapshot.bases[id] ? clone(snapshot.bases[id]!) : undefined
}
export function builtinMaterial(id: string): MaterialDef | undefined {
  return snapshot.materials[id] ? clone(snapshot.materials[id]!) : undefined
}

function replaceRecord<T>(target: Record<string, T>, source: Record<string, T>) {
  for (const k of Object.keys(target)) delete target[k]
  for (const [k, v] of Object.entries(source)) target[k] = clone(v)
}

/** 把遊戲資料還原成內建的樣子 */
function restore() {
  replaceRecord(enemies, snapshot.enemies)
  replaceRecord(dungeonEncounters as Record<string, DungeonEncounters>, snapshot.dungeon)
  replaceRecord(wildEncounterTables as Record<string, unknown>, snapshot.wild as Record<string, unknown>)
  itemRules.items.splice(0, itemRules.items.length, ...clone(snapshot.items))
  replaceRecord(gearRules.bases, snapshot.bases)
  replaceRecord(gearRules.materials, snapshot.materials)
  replaceRecord(gearRules.chests as Record<string, unknown>, snapshot.chests as Record<string, unknown>)
  replaceRecord(equipment.weapons, snapshot.weapons)
  replaceRecord(equipment.armors, snapshot.armors)
  maps.generation.wild.resource_items.splice(0, Infinity, ...snapshot.gather.wild)
  maps.generation.dungeon.resource_items.splice(0, Infinity, ...snapshot.gather.dungeon)
  namedNpcs.splice(0, namedNpcs.length, ...clone(snapshot.npcs))
  restoreStories()
}

// ---- 遭遇表 ----

const LAYER_NAME: Record<ChestLayer, string> = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層' }
const BOSS_LAYERS = ['shallow', 'middle', 'deep'] as const

/** 可以放怪物的遭遇表 */
export function tableOptions(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (const r of geography.regions) out.push({ key: `wild:${r.id}`, label: `城郊・${r.name}` })
  for (const loc of geography.locations.filter((l) => l.type === 'dungeon' && dungeonEncounters[l.id])) {
    for (const layer of CHEST_LAYERS) out.push({ key: `dungeon:${loc.id}:${layer}`, label: `${loc.name}・${LAYER_NAME[layer]}` })
    for (const layer of BOSS_LAYERS) out.push({ key: `boss:${loc.id}:${layer}`, label: `${loc.name}・${LAYER_NAME[layer]}層主（取代原本的層主）` })
  }
  return out
}

export function tableLabel(key: string): string {
  return tableOptions().find((t) => t.key === key)?.label ?? key
}

/** 遭遇表本身（boss 以外） */
function tableGroups(key: string): EncounterGroup[] | undefined {
  const [kind, a, b] = key.split(':')
  if (kind === 'wild') {
    const t = wildEncounterTables[a!]
    return Array.isArray(t) ? t : undefined
  }
  if (kind === 'dungeon') return dungeonEncounters[a!]?.[b as ChestLayer]
  return undefined
}

/** 這隻怪物目前出現在哪些遭遇表（套用覆寫後） */
export function placementsOf(id: string): { key: string; label: string; groups: number }[] {
  const out: { key: string; label: string; groups: number }[] = []
  for (const t of tableOptions()) {
    if (t.key.startsWith('boss:')) {
      const [, loc, layer] = t.key.split(':')
      const g = dungeonEncounters[loc!]?.bosses?.[layer as 'shallow']
      if (g?.[0]?.[0] === id) out.push({ key: t.key, label: t.label.replace('（取代原本的層主）', ''), groups: 1 })
      continue
    }
    const n = (tableGroups(t.key) ?? []).filter((g) => g.some(([e]) => e === id)).length
    if (n) out.push({ key: t.key, label: t.label, groups: n })
  }
  return out
}

/** 內建遭遇表裡有這隻怪物的地方（不含層主），給「從遭遇表移除」用 */
export function builtinPlacementsOf(id: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (const t of tableOptions()) {
    const [kind, a, b] = t.key.split(':')
    const groups = kind === 'wild' ? snapshot.wild[a!] : kind === 'dungeon' ? snapshot.dungeon[a!]?.[b as ChestLayer] : undefined
    if (Array.isArray(groups) && groups.some((g) => g.some(([e]) => e === id))) out.push(t)
  }
  return out
}

function applyPlacements(id: string, m: EnemyMod) {
  for (const key of m.exclude ?? []) {
    const groups = tableGroups(key)
    if (!groups) continue
    const kept = groups.filter((g) => !g.some(([e]) => e === id))
    // 遭遇表不能變成空的
    if (kept.length) groups.splice(0, groups.length, ...kept)
  }
  for (const p of m.spawns ?? []) {
    const count = Math.max(1, Math.min(6, Math.round(p.count) || 1))
    if (p.table.startsWith('boss:')) {
      const [, loc, layer] = p.table.split(':')
      const d = dungeonEncounters[loc!]
      if (!d) continue
      ;(d.bosses ??= {})[layer as 'shallow'] = [[id, count]]
      if (layer === 'deep') d.boss = [[id, count]]
      continue
    }
    const groups = tableGroups(p.table)
    if (!groups) continue
    for (let i = 0; i < Math.max(1, Math.min(5, Math.round(p.weight ?? 1))); i++) groups.push([[id, count]])
  }
}

// ---- 物品的來源 ----

/** 這個物品目前從哪裡來（套用覆寫後） */
export function itemSources(name: string) {
  const drops = Object.values(enemies)
    .flatMap((e) => (e.loot ?? []).filter((l) => l.item === name).map((l) => ({ enemy: e.id, chance: l.chance, qty: l.qty ?? 1 })))
  const chests: Partial<Record<ChestLayer, number>> = {}
  for (const layer of CHEST_LAYERS) {
    const hit = gearRules.chests[layer]?.items.find(([n]) => n === name)
    if (hit) chests[layer] = hit[1]
  }
  const gather: GatherPlace[] = (['wild', 'dungeon'] as const).filter((g) => maps.generation[g].resource_items.includes(name))
  return { drops, chests, gather }
}

// ---- 套用 ----

const strip = <T extends object>(v: T, keys: string[]): T => {
  const c = clone(v) as Record<string, unknown>
  for (const k of keys) delete c[k]
  return c as T
}

const LOC_BY_TIER: Record<number, string> = { 3: 'city', 4: 'capital' }
/** 裝備在哪種店賣：金屬與木材是鐵匠鋪，皮革與布料是裁縫店，寶石是珠寶店 */
export const GEAR_SHOP: Record<string, string> = { metal: 'smith', wood: 'smith', leather: 'tailor', cloth: 'tailor', jewel: 'jeweler' }

/** 自建的底材或材料：產生「底材 × 同類材料」的制式裝備（已有同名物品時略過） */
function generateCatalog(mods: ContentMods) {
  const names = new Set(itemRules.items.map((i) => i.name))
  for (const [bid, b] of Object.entries(gearRules.bases)) {
    for (const [mid, m] of Object.entries(gearRules.materials)) {
      if (m.kind !== b.kind || (!mods.bases[bid]?.custom && !mods.materials[mid]?.custom)) continue
      const spec: GearSpec = { base: bid, material: mid }
      const name = gearName(spec)
      if (names.has(name)) continue
      names.add(name)
      itemRules.items.push({
        name, category: 'equipment', price_cc: gearPrice(spec), tags: m.tier <= 4 ? [GEAR_SHOP[m.kind]!] : [], gear: spec,
        ...(LOC_BY_TIER[m.tier] ? { min_location: LOC_BY_TIER[m.tier] } : {}),
        ...(b.desc || m.desc ? { desc: `${b.desc ?? ''}${m.desc ?? ''}` } : {}),
      })
    }
  }
}

/** 內建制式裝備的價格跟著修改過的底材或材料重新計算 */
function repriceCatalog(mods: ContentMods) {
  for (const i of itemRules.items) {
    if (!i.gear || mods.items[i.name]) continue
    if (mods.bases[i.gear.base] || mods.materials[i.gear.material]) i.price_cc = gearPrice(i.gear)
  }
}

/** 把覆寫套用到遊戲資料（先還原成內建的樣子）。壞掉的項目略過，回傳略過的原因 */
export function applyContent(mods: ContentMods): string[] {
  restore()
  const problems: string[] = []
  const tryEach = <T>(label: string, list: Record<string, T>, fn: (key: string, v: T) => void) => {
    for (const [k, v] of Object.entries(list)) {
      try {
        fn(k, v)
      } catch (e) {
        problems.push(`${label}「${k}」：${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  tryEach('材料', mods.materials, (id, m) => {
    gearRules.materials[id] = strip(m, ['custom'])
  })
  tryEach('底材', mods.bases, (id, b) => {
    const base = strip(b, ['custom', 'weaponDef', 'armorDef'])
    // 內建底材直接改它的武器或防具類型（職業、NPC 用到同一種類型的也一起改）；自建底材另外登錄一種
    if (b.weaponDef) {
      const wid = snapshot.bases[id]?.weapon ?? `w_${id}`
      equipment.weapons[wid] = { ...(snapshot.weapons[wid] ?? {}), ...clone(b.weaponDef) }
      base.weapon = wid
    }
    if (b.armorDef) {
      const aid = snapshot.bases[id]?.armor ?? `a_${id}`
      equipment.armors[aid] = { ...(snapshot.armors[aid] ?? {}), ...clone(b.armorDef) }
      base.armor = aid
    }
    gearRules.bases[id] = base
  })
  generateCatalog(mods)
  repriceCatalog(mods)
  tryEach('物品', mods.items, (name, m) => {
    const def = strip(m, ['custom', 'chests', 'gather'])
    def.name = name
    // 底材或材料被刪掉的裝備：拿掉組成（變成一般物品）
    if (def.gear && (gearRules.bases[def.gear.base]?.kind === undefined || gearRules.bases[def.gear.base]!.kind !== gearRules.materials[def.gear.material]?.kind)) delete def.gear
    const i = itemRules.items.findIndex((x) => x.name === name)
    if (i >= 0) itemRules.items[i] = def
    else itemRules.items.push(def)
    if (m.chests) {
      for (const layer of CHEST_LAYERS) {
        const t = gearRules.chests[layer]
        if (!t) continue
        t.items = t.items.filter(([n]) => n !== name)
        const p = m.chests[layer]
        if (p) t.items.push([name, p])
      }
    }
    if (m.gather) {
      for (const g of ['wild', 'dungeon'] as const) {
        const list = maps.generation[g].resource_items
        const has = list.includes(name)
        if (m.gather.includes(g) && !has) list.push(name)
        if (!m.gather.includes(g) && has) list.splice(list.indexOf(name), 1)
      }
    }
  })
  reindexItems()
  tryEach('怪物', mods.enemies, (id, m) => {
    enemies[id] = { ...strip(m, ['custom', 'spawns', 'exclude']), id }
  })
  tryEach('怪物的出現地點', mods.enemies, (id, m) => applyPlacements(id, m))
  tryEach('固定 NPC', mods.npcs, (id, m) => {
    const def = { ...strip(m, ['custom']), id }
    const i = namedNpcs.findIndex((n) => n.id === id)
    if (i >= 0) namedNpcs[i] = def
    else namedNpcs.push(def)
  })
  tryEach('特殊任務', mods.stories, (id, m) => applyStoryMod(id, m))
  return problems
}

// ---- 整理（儲存與匯入時） ----

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d
}
const int = (v: unknown, lo: number, hi: number, d: number) => Math.round(num(v, lo, hi, d))
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const DICE = /^\d{0,2}d\d{1,3}([+-]\d{1,3})?$/
const dice = (v: unknown, d: string) => {
  const s = str(v, 12).replace(/\s+/g, '')
  return DICE.test(s) ? s : d
}
/** 怪物的攻擊骰：{x}d{y}+{z}（z 可以省略） */
export interface DiceParts { count: number; sides: number; bonus: number }
export function parseDice(v: string): DiceParts {
  const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(v.replace(/\s+/g, ''))
  return m ? { count: Number(m[1]), sides: Number(m[2]), bonus: Number(m[3] ?? 0) } : { count: 1, sides: 6, bonus: 0 }
}
export function formatDice(d: DiceParts): string {
  const count = Math.max(1, Math.min(20, Math.round(d.count) || 1))
  const sides = Math.max(2, Math.min(100, Math.round(d.sides) || 6))
  const bonus = Math.max(0, Math.min(99, Math.round(d.bonus) || 0))
  return `${count}d${sides}${bonus ? `+${bonus}` : ''}`
}
const DAMAGE_IDS = () => damageTypes.types.map((t) => t.id)
const AFFINITY_KEYS = () => [...DAMAGE_IDS(), ...Object.keys(damageTypes.groups), 'all']
const MOD_KEYS: (keyof Mods)[] = ['hit', 'evade', 'save', 'damage', 'dr', 'ap_regen', 'crit', 'threat']

function affinity(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, x] of Object.entries(v)) {
    if (!AFFINITY_KEYS().includes(k)) continue
    const n = Math.round(num(x, -1, 2, 0) * 100) / 100
    if (n) out[k] = n
  }
  return Object.keys(out).length ? out : undefined
}

function mods(v: unknown, lo = -10, hi = 10): Mods | undefined {
  if (!v || typeof v !== 'object') return undefined
  const out: Mods = {}
  for (const k of MOD_KEYS) {
    const x = (v as Record<string, unknown>)[k]
    if (x === undefined || x === '') continue
    const n = k === 'threat' ? Math.round(num(x, -1, 2, 0) * 100) / 100 : int(x, lo, hi, 0)
    if (n) out[k] = n
  }
  return Object.keys(out).length ? out : undefined
}

export const ENEMY_KINDS: Record<string, string> = {
  beast: '野獸', humanoid: '人形', undead: '不死', spirit: '靈體', construct: '構裝', plant: '植物', demon: '魔族', elemental: '元素', fey: '妖精',
}

export function sanitizeEnemy(id: string, raw: Partial<EnemyMod>, custom: boolean): EnemyMod {
  const attrs = Object.fromEntries(ATTR_IDS.map((a) => [a, int(raw.attrs?.[a], 1, 30, 10)])) as EnemyDef['attrs']
  const w = raw.weapon ?? { dice: '1d6', type: 'slashing', attr: 'str' as AttrId }
  const loot = (raw.loot ?? [])
    .map((l) => ({ item: str(l.item, 30), chance: Math.round(num(l.chance, 0, 1, 0.5) * 100) / 100, qty: int(l.qty, 1, 20, 1) }))
    .filter((l) => l.item && l.chance > 0)
    .map(({ qty, ...l }) => (qty > 1 ? { ...l, qty } : l))
  const money = raw.money_cc && raw.money_cc.length === 2 ? [int(raw.money_cc[0], 0, 1e6, 0), int(raw.money_cc[1], 0, 1e6, 0)] as [number, number] : undefined
  const spawns = (raw.spawns ?? [])
    .filter((p) => p && typeof p.table === 'string' && tableOptions().some((t) => t.key === p.table))
    .map((p) => ({ table: p.table, count: int(p.count, 1, 6, 1), ...(int(p.weight, 1, 5, 1) > 1 ? { weight: int(p.weight, 1, 5, 1) } : {}) }))
  const out: EnemyMod = {
    id,
    name: str(raw.name, 20) || '未命名的怪物',
    level: int(raw.level, 1, 30, 1),
    attrs,
    hp: int(raw.hp, 1, 9999, 10),
    ap: int(raw.ap, 1, 12, 3),
    weapon: { dice: formatDice(parseDice(String(w.dice ?? ''))), type: DAMAGE_IDS().includes(w.type) ? w.type : 'slashing', attr: ATTR_IDS.includes(w.attr) ? w.attr : 'str' },
    evade: int(raw.evade, -10, 20, 0),
    dr: int(raw.dr, 0, 30, 0),
    xp: int(raw.xp, 0, 99999, 25),
  }
  const res = affinity(raw.resist)
  if (res) out.resist = res
  const off = affinity(raw.offense)
  if (off) out.offense = off
  // 怪物沒有法術環：只能用技能與戲法
  const abil = (raw.abilities ?? []).filter((a) => !!abilities[a] && abilities[a]!.type !== 'spell')
  if (abil.length) out.abilities = [...new Set(abil)]
  if (money && (money[0] || money[1])) out.money_cc = [Math.min(...money), Math.max(...money)]
  if (loot.length) out.loot = loot
  if (raw.kind && ENEMY_KINDS[raw.kind]) out.kind = raw.kind
  if (raw.armed) out.armed = true
  if (raw.rut) out.rut = true
  const traits = (raw.traits ?? []).filter((t) => !!monsterTraits.traits[t])
  if (traits.length) out.traits = traits
  if (str(raw.desc, 200)) out.desc = str(raw.desc, 200)
  if (raw.habitats?.length) out.habitats = raw.habitats
  if (custom) out.custom = true
  if (spawns.length) out.spawns = spawns
  const exclude = (raw.exclude ?? []).filter((k) => typeof k === 'string')
  if (exclude.length) out.exclude = [...new Set(exclude)]
  return out
}

const CATEGORIES: ItemCategory[] = ['food', 'consumable', 'gear', 'material', 'scroll', 'equipment', 'info']
export const SHOP_TAGS = ['general', 'temple', 'tavern', 'smith', 'tailor', 'jeweler', 'magic', 'info']
const LOCATIONS = ['village', 'town', 'city', 'capital']

function sanitizeUse(u: ItemUse | undefined): ItemUse | undefined {
  if (!u || typeof u !== 'object') return undefined
  const out: ItemUse = {}
  if (u.heal && DICE.test(String(u.heal).replace(/\s+/g, ''))) out.heal = String(u.heal).replace(/\s+/g, '')
  if (u.slot) out.slot = int(u.slot, 1, 9, 1)
  const cleanse = (u.cleanse ?? []).filter((s) => !!statuses[s])
  if (cleanse.length) out.cleanse = cleanse
  if (u.status?.id && statuses[u.status.id]) out.status = { id: u.status.id, turns: int(u.status.turns, 1, 20, 3) }
  if (u.temp_hp) out.temp_hp = int(u.temp_hp, 1, 999, 10)
  if (u.ap) out.ap = int(u.ap, 1, 10, 1)
  if (u.revive) out.revive = Math.round(num(u.revive, 0.01, 1, 0.3) * 100) / 100
  if (u.damage?.dice && DICE.test(String(u.damage.dice).replace(/\s+/g, ''))) {
    out.damage = { dice: String(u.damage.dice).replace(/\s+/g, ''), type: DAMAGE_IDS().includes(u.damage.type) ? u.damage.type : 'fire' }
  }
  if (u.apply?.status && statuses[u.apply.status]) {
    out.apply = {
      status: u.apply.status, turns: int(u.apply.turns, 1, 20, 2),
      ...(u.apply.save && ATTR_IDS.includes(u.apply.save) ? { save: u.apply.save, dc: int(u.apply.dc, 5, 30, 12) } : {}),
    }
  }
  if (u.save?.attr && ATTR_IDS.includes(u.save.attr) && (out.damage || out.apply)) out.save = { attr: u.save.attr, dc: int(u.save.dc, 5, 30, 13) }
  if (u.escape) out.escape = true
  if ((out.damage || out.apply) && u.area === 'all') out.area = 'all'
  else if (out.damage || out.apply) out.area = 'one'
  if (u.combat_only || out.damage || out.apply || out.status || out.temp_hp || out.ap || out.revive || out.cleanse || out.escape) {
    if (!(out.heal || out.slot) || u.combat_only) out.combat_only = true
  }
  return Object.keys(out).length ? out : undefined
}

export function sanitizeGearSpecLoose(g: GearSpec | undefined): GearSpec | undefined {
  if (!g || !gearRules.bases[g.base] || !gearRules.materials[g.material]) return undefined
  if (gearRules.bases[g.base]!.kind !== gearRules.materials[g.material]!.kind) return undefined
  const out: GearSpec = { base: g.base, material: g.material }
  if (g.rarity && RARITY_ORDER.includes(g.rarity) && g.rarity !== gearRules.materials[g.material]!.rarity) out.rarity = g.rarity
  if (g.enchants) {
    const e = { ...(mods(g.enchants.mods, -5, 5) ? { mods: mods(g.enchants.mods, -5, 5) } : {}), ...(affinity(g.enchants.resist) ? { resist: affinity(g.enchants.resist) } : {}), ...(affinity(g.enchants.offense) ? { offense: affinity(g.enchants.offense) } : {}) }
    if (Object.keys(e).length) out.enchants = e
  }
  return out
}

export function sanitizeItem(name: string, raw: Partial<ItemMod>, custom: boolean): ItemMod {
  const category = CATEGORIES.includes(raw.category as ItemCategory) ? raw.category as ItemCategory : 'material'
  const out: ItemMod = {
    name: str(name, 20) || '未命名的物品',
    category,
    price_cc: int(raw.price_cc, 0, 1e8, 10),
    tags: (raw.tags ?? []).filter((t) => SHOP_TAGS.includes(t)),
  }
  if (str(raw.desc, 200)) out.desc = str(raw.desc, 200)
  if (raw.min_location && LOCATIONS.includes(raw.min_location) && raw.min_location !== 'village') out.min_location = raw.min_location
  const use = sanitizeUse(raw.use)
  if (use) out.use = use
  const gear = category === 'equipment' ? sanitizeGearSpecLoose(raw.gear) : undefined
  if (gear) out.gear = gear
  const forge = (raw.forge?.materials ?? []).filter((m) => !!gearRules.materials[m])
  if (forge.length) out.forge = { materials: [...new Set(forge)] }
  if (raw.event) out.event = true
  if (custom) out.custom = true
  if (raw.chests) {
    const c: Partial<Record<ChestLayer, number>> = {}
    for (const l of CHEST_LAYERS) {
      const p = Math.round(num(raw.chests[l], 0, 1, 0) * 100) / 100
      if (p) c[l] = p
    }
    out.chests = c
  }
  if (raw.gather) out.gather = raw.gather.filter((g): g is GatherPlace => g === 'wild' || g === 'dungeon')
  return out
}

const SCALES = ['full', 'half', 'up', 'third', 'third_up', 'res']

export function sanitizeBase(raw: Partial<BaseMod>, custom: boolean): BaseMod {
  const kind = (['metal', 'leather', 'cloth', 'wood', 'jewel'] as const).includes(raw.kind as 'metal') ? raw.kind! : 'metal'
  const slots = [...Object.keys(gearRules.slots).filter((s) => !s.startsWith('ring')), 'ring']
  const slot = slots.includes(raw.slot as string) ? raw.slot! : 'main_hand'
  const out: BaseMod = { slot, name: str(raw.name, 12) || '未命名的底材', kind, price: int(raw.price, 1, 1e7, 100) }
  if (raw.two_handed && slot === 'main_hand') out.two_handed = true
  const stats = mods(raw.stats)
  if (stats) out.stats = stats
  if (raw.threat) out.threat = Math.round(num(raw.threat, -1, 1, 0) * 100) / 100
  const scale: Partial<Record<keyof Mods, BaseDef['scale'] extends Partial<Record<string, infer S>> | undefined ? S : never>> = {}
  for (const [k, v] of Object.entries(raw.scale ?? {})) if (MOD_KEYS.includes(k as keyof Mods) && SCALES.includes(v as string)) (scale as Record<string, unknown>)[k] = v
  if (Object.keys(scale).length) out.scale = scale
  const rs: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw.resist_scale ?? {})) if (AFFINITY_KEYS().includes(k) && SCALES.includes(v)) rs[k] = v
  if (Object.keys(rs).length) out.resist_scale = rs as BaseDef['resist_scale']
  if (str(raw.desc, 120)) out.desc = str(raw.desc, 120)
  if (slot === 'main_hand') {
    const w = raw.weaponDef ?? (raw.weapon ? equipment.weapons[raw.weapon] : undefined)
    if (w) {
      out.weaponDef = {
        name: str(w.name, 12) || out.name, dice: dice(w.dice, '1d6'), type: DAMAGE_IDS().includes(w.type) ? w.type : 'slashing',
        attr: ATTR_IDS.includes(w.attr) ? w.attr : 'str', ...(w.scale ? { scale: w.scale } : {}), ...(w.threat ? { threat: w.threat } : {}),
      }
    } else if (raw.weapon && snapshot.weapons[raw.weapon]) {
      out.weapon = raw.weapon
    }
  }
  if (slot === 'body') {
    const a = raw.armorDef ?? (raw.armor ? equipment.armors[raw.armor] : undefined)
    if (a) {
      out.armorDef = {
        name: str(a.name, 12) || out.name, evade: int(a.evade, -10, 10, 0), dr: int(a.dr, 0, 20, 0),
        ...(affinity(a.resist) ? { resist: affinity(a.resist) } : {}), ...(affinity(a.offense) ? { offense: affinity(a.offense) } : {}),
        ...(a.threat ? { threat: Math.round(num(a.threat, -1, 1, 0) * 100) / 100 } : {}),
      }
    }
  }
  if (custom) out.custom = true
  return out
}

export function sanitizeMaterial(raw: Partial<MaterialMod>, custom: boolean): MaterialMod {
  const kind = (['metal', 'leather', 'cloth', 'wood', 'jewel'] as const).includes(raw.kind as 'metal') ? raw.kind! : 'metal'
  const out: MaterialMod = {
    kind, name: str(raw.name, 8) || '未命名', tier: int(raw.tier, 1, 5, 1), bonus: int(raw.bonus, 0, 10, 0),
    rarity: RARITY_ORDER.includes(raw.rarity as string) ? raw.rarity! : 'common', level: int(raw.level, 1, 30, 1), price: Math.max(0.1, num(raw.price, 0.1, 1e5, 1)),
  }
  const armor = mods(raw.armor, -5, 5)
  if (armor) out.armor = armor
  const res = affinity(raw.resist)
  if (res) out.resist = res
  if (str(raw.desc, 120)) out.desc = str(raw.desc, 120)
  if (custom) out.custom = true
  return out
}

/** 讀取保存的設定或匯入的檔案：整理每一項，壞掉的略過 */
export function normalizeMods(raw: unknown): ContentMods {
  const out = emptyMods()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<ContentMods>
  for (const [id, v] of Object.entries(r.materials ?? {})) out.materials[id] = sanitizeMaterial(v, !!v.custom || !snapshot.materials[id])
  for (const [id, v] of Object.entries(r.bases ?? {})) out.bases[id] = sanitizeBase(v, !!v.custom || !snapshot.bases[id])
  for (const [name, v] of Object.entries(r.items ?? {})) out.items[name] = sanitizeItem(name, v, !!v.custom || !snapshot.items.some((i) => i.name === name))
  for (const [id, v] of Object.entries(r.enemies ?? {})) out.enemies[id] = sanitizeEnemy(id, v, !!v.custom || !snapshot.enemies[id])
  for (const [id, v] of Object.entries(r.npcs ?? {})) out.npcs[id] = sanitizeNpc(id, v, !!v.custom || !builtinNpc(id))
  for (const [id, v] of Object.entries(r.stories ?? {})) out.stories[id] = sanitizeStory(id, v, !!v.custom || !builtinStory(id))
  return out
}

// ---- 固定 NPC ----

const GEAR_SLOTS = Object.keys(gearRules.slots) as GearSlot[]

function settlementIds(): string[] {
  return geography.locations.filter((l) => l.type !== 'dungeon').map((l) => l.id)
}

/** 劇情旗標的條件：名稱整理過、去掉重複 */
function cond(v: unknown): NpcDef['requires'] {
  if (!v || typeof v !== 'object') return undefined
  const r = v as { flags?: unknown; flags_none?: unknown }
  const list = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(cleanFlag).filter(Boolean))]
  const flags = list(r.flags)
  const none = list(r.flags_none)
  return flags.length || none.length ? { ...(flags.length ? { flags } : {}), ...(none.length ? { flags_none: none } : {}) } : undefined
}
export { cond as sanitizeCond }

export function sanitizeNpc(id: string, raw: Partial<NpcMod>, custom: boolean): NpcMod {
  const kind = raw.kind === 'commoner' ? 'commoner' : 'adventurer'
  const cls = kind === 'commoner' ? '' : raw.class && classes[raw.class] && !classes[raw.class]!.noncombat ? raw.class : 'fighter'
  const location = settlementIds().includes(raw.location ?? '') ? raw.location! : 'soriel'
  const out: NpcMod = {
    id,
    name: str(raw.name, 12) || '未命名',
    race: raw.race && attributeRules.races[raw.race] ? raw.race : 'human',
    class: cls,
    level: int(raw.level, 1, 20, 1),
    location,
    hire_cc: int(raw.hire_cc, 0, 1e7, kind === 'commoner' ? 0 : 100),
    personality: str(raw.personality, 160) || '沉默寡言。',
    kind,
  }
  if (raw.gender && GENDER_IDS.includes(raw.gender)) out.gender = raw.gender
  if (str(raw.appearance, 240)) out.appearance = str(raw.appearance, 240)
  if (str(raw.background, 400)) out.background = str(raw.background, 400)
  if (str(raw.faction, 30)) out.faction = str(raw.faction, 30)
  if (str(raw.occupation, 12)) out.occupation = str(raw.occupation, 12)
  if (str(raw.lineage, 30)) out.lineage = str(raw.lineage, 30)
  const tags = (raw.tags ?? []).filter((t) => !!npcTags.tags[t])
  if (tags.length) out.tags = [...new Set(tags)]
  const haunts = (raw.haunts ?? [])
    .filter((h) => h && geography.locations.some((l) => l.id === h.location) && ZONES.includes(h.zone as never))
    .map((h) => ({ location: h.location, zone: h.zone, weight: Math.round(num(h.weight, 0.01, 10, 1) * 100) / 100 }))
  if (haunts.length) out.haunts = haunts
  if (raw.relations && typeof raw.relations === 'object') {
    const rel = Object.fromEntries(Object.entries(raw.relations).map(([k, v]) => [k, str(v, 160)]).filter(([, v]) => v))
    if (Object.keys(rel).length) out.relations = rel
  }
  if (raw.attrs) {
    const a = Object.fromEntries(ATTR_IDS.map((k) => [k, raw.attrs?.[k] ? int(raw.attrs[k], 1, 30, 10) : 0]).filter(([, v]) => v))
    if (Object.keys(a).length) out.attrs = a
  }
  const abil = (raw.abilities ?? []).filter((a) => !!abilities[a])
  if (abil.length) out.abilities = [...new Set(abil)]
  if (raw.gear) {
    const g: NonNullable<NpcDef['gear']> = {}
    for (const slot of GEAR_SLOTS) {
      const spec = sanitizeGearSpecLoose(raw.gear[slot])
      const base = spec && gearRules.bases[spec.base]
      if (!spec || !base) continue
      // 底材要放得進這個欄位（戒指放兩個戒指欄）
      if (base.slot === slot || (base.slot === 'ring' && slot.startsWith('ring'))) g[slot] = spec
    }
    if (Object.keys(g).length) out.gear = g
  }
  if (raw.fixed && typeof raw.fixed.area === 'string') {
    const area = settlementArea(raw.fixed.area)
    if (area) {
      const x = int(raw.fixed.x, 0, area.width - 1, 0)
      const y = int(raw.fixed.y, 0, area.height - 1, 0)
      const kind = area.cells[y * area.width + x]?.kind
      if (kind && kind !== 'wall' && kind !== 'water') out.fixed = { area: area.key, x, y }
    }
  }
  const req = cond(raw.requires)
  if (req) out.requires = req
  if (custom) out.custom = true
  return out
}

export function newNpc(id: string): NpcMod {
  return {
    id, name: '新的角色', race: 'human', class: 'fighter', level: 3, location: 'soriel', hire_cc: 200, kind: 'adventurer',
    gender: 'male', personality: '沉默寡言，但很可靠。', appearance: '', haunts: [{ location: 'soriel', zone: 'town', weight: 1 }], custom: true,
  }
}

/** 新的 id（自建項目） */
export function newModId(prefix: string): string {
  return `mod_${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** 新怪物的預設值 */
export function newEnemy(id: string): EnemyMod {
  return {
    id, name: '新的怪物', level: 1, attrs: { str: 12, dex: 12, int: 6, fai: 10, cha: 6 }, hp: 12, ap: 3,
    weapon: { dice: '1d6', type: 'slashing', attr: 'str' }, evade: 0, dr: 0, xp: 35, kind: 'beast', custom: true,
  }
}

export function newItem(name: string): ItemMod {
  return { name, category: 'material', price_cc: 10, tags: [], custom: true }
}

export function newBase(): BaseMod {
  return { slot: 'main_hand', name: '新的武器', kind: 'metal', price: 200, weaponDef: { name: '新的武器', dice: '1d8', type: 'slashing', attr: 'str' }, scale: { damage: 'full', hit: 'half' }, custom: true }
}

export function newMaterial(): MaterialMod {
  return { kind: 'metal', name: '新材料', tier: 2, bonus: 1, rarity: 'uncommon', level: 3, price: 3, custom: true }
}

export type { GearSlot }
