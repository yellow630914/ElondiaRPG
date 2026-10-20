// 裝備：11 個欄位、底材 × 材料、稀有度與附魔（data/rules/gear.json）。
//
// - 一件裝備的數值由組成（GearSpec）推算：底材決定欄位、武器或防具類型與固定數值，材料的 bonus 依 scale 成長，
//   附魔在稀有度的點數內加減。制式裝備（items.json）、打造與事件生成的裝備（customItems）都用同一套公式。
// - 穿在身上的裝備自帶組成（EquippedGear），計算數值不需要存檔。
// - 角色的 weapon / armor 由主手與上身的裝備決定（syncGear），戰鬥沿用原本的武器與防具計算；
//   其餘欄位與材料、附魔的加成合計成 mods / resist / offense（gearBonuses）。

import gearJson from '@data/rules/gear.json'
import { armorDef, damageTypeName, equipment, itemDef, weaponDef, type AffinityMap, type Mods } from './data'
import type { Rng } from './rng'
import type { Character, EquippedGear, GameState, GearSlot, GearSpec } from './types'

type Scale = 'full' | 'half' | 'up' | 'third' | 'third_up' | 'res'
type MaterialKind = 'metal' | 'leather' | 'cloth' | 'wood' | 'jewel'

export interface MaterialDef {
  kind: MaterialKind
  name: string
  tier: number
  bonus: number
  rarity: string
  level: number
  price: number
  armor?: Mods
  resist?: AffinityMap
  desc?: string
}

export interface BaseDef {
  slot: GearSlot | 'neck'
  name: string
  kind: MaterialKind
  weapon?: string
  armor?: string
  two_handed?: boolean
  price: number
  stats?: Mods
  threat?: number
  scale?: Partial<Record<keyof Mods, Scale>>
  resist_scale?: Record<string, Scale>
  desc?: string
}

export interface ClassGearTemplate {
  start: Partial<Record<GearSlot, string>>
  main: string[]
  off: string[]
  body: string[]
  pieces: MaterialKind
}

export const gearRules = gearJson as unknown as {
  slots: Record<GearSlot, string>
  slot_groups: Record<string, GearSlot[]>
  rarities: Record<string, { name: string; enchant_points: number }>
  enchant_costs: Record<string, number>
  materials: Record<string, MaterialDef>
  bases: Record<string, BaseDef>
  classes: Record<string, ClassGearTemplate>
  races: Record<string, { blocked: GearSlot[] }>
  loadout: {
    top: number; below: number; lower: number; legendary: number
    pieces_base: number; pieces_per_level: number
    jewelry_base: number; jewelry_per_level: number; jewelry_max: number
  }
}

export const SLOTS = Object.keys(gearRules.slots) as GearSlot[]
const PIECE_SLOTS: GearSlot[] = ['head', 'legs', 'wrists', 'feet', 'belt']
const JEWELRY: { slot: GearSlot; group: 'accessory' | 'neck' }[] = [
  { slot: 'accessory', group: 'accessory' }, { slot: 'neck_1', group: 'neck' }, { slot: 'neck_2', group: 'neck' },
]

export function slotName(slot: GearSlot): string {
  return gearRules.slots[slot]
}

export function rarityName(r: string): string {
  return gearRules.rarities[r]?.name ?? r
}

function scaled(s: Scale, bonus: number): number {
  switch (s) {
    case 'full': return bonus
    case 'half': return Math.floor(bonus / 2)
    case 'up': return Math.ceil(bonus / 2)
    case 'third': return Math.floor(bonus / 3)
    case 'third_up': return Math.ceil(bonus / 3)
    case 'res': return -Math.round(0.15 * bonus * 100) / 100
  }
}

export interface GearStats {
  slot: GearSlot | 'neck'
  base: BaseDef
  material: MaterialDef
  rarity: string
  weapon?: string
  armor?: string
  two_handed: boolean
  mods: Mods
  resist: AffinityMap
  offense: AffinityMap
  threat: number
}

function addMods(into: Mods, from?: Mods) {
  for (const [k, v] of Object.entries(from ?? {})) {
    if (!v) continue
    into[k as keyof Mods] = Math.round(((into[k as keyof Mods] ?? 0) + v) * 100) / 100
  }
}

function addMap(into: AffinityMap, from?: AffinityMap) {
  for (const [k, v] of Object.entries(from ?? {})) {
    if (!v) continue
    into[k] = Math.round(((into[k] ?? 0) + v) * 100) / 100
  }
}

/** 一件裝備的數值 */
export function gearStats(spec: GearSpec): GearStats {
  const base = gearRules.bases[spec.base]
  const material = gearRules.materials[spec.material]
  if (!base) throw new Error(`unknown gear base: ${spec.base}`)
  if (!material) throw new Error(`unknown gear material: ${spec.material}`)
  const mods: Mods = {}
  const resist: AffinityMap = {}
  const offense: AffinityMap = {}
  addMods(mods, base.stats)
  for (const [k, s] of Object.entries(base.scale ?? {})) addMods(mods, { [k]: scaled(s as Scale, material.bonus) })
  for (const [k, s] of Object.entries(base.resist_scale ?? {})) addMap(resist, { [k]: scaled(s, material.bonus) })
  // 材料本身的特性：防具才有（秘銀較輕、精金更硬）；材料的抗性（龍皮抗火）防具與飾品都有
  if (!base.weapon) {
    addMods(mods, material.armor)
    addMap(resist, material.resist)
  }
  addMods(mods, spec.enchants?.mods)
  addMap(resist, spec.enchants?.resist)
  addMap(offense, spec.enchants?.offense)
  const threat = (base.threat ?? 0) + (spec.enchants?.mods?.threat ?? 0)
  delete mods.threat
  return {
    slot: base.slot, base, material, rarity: spec.rarity ?? material.rarity,
    ...(base.weapon ? { weapon: base.weapon } : {}), ...(base.armor ? { armor: base.armor } : {}),
    two_handed: !!base.two_handed, mods, resist, offense, threat,
  }
}

/**
 * 制式名稱：材料＋底材（例如「秘銀長劍」）。皮製品避免重複：第一級的皮革只用底材名（皮甲、皮靴），
 * 其他皮料省掉底材開頭的「皮」（硬皮甲、龍皮靴）。
 */
export function gearName(spec: Pick<GearSpec, 'base' | 'material'>): string {
  const m = gearRules.materials[spec.material]
  const b = gearRules.bases[spec.base]?.name ?? spec.base
  if (!m) return b
  if (m.kind === 'leather' && b.startsWith('皮')) return m.tier === 1 ? b : `${m.name}${m.name.endsWith('皮') ? b.slice(1) : b}`
  return `${m.name}${b}`
}

/** 依組成估價：底材價格 × 材料倍率 × 附魔（每點 +50%） */
export function gearPrice(spec: GearSpec): number {
  const base = gearRules.bases[spec.base]!
  const material = gearRules.materials[spec.material]!
  const points = enchantPoints(spec.enchants)
  return Math.round(base.price * material.price * (1 + 0.5 * points))
}

/** 附魔用掉的點數（gear.json 的 enchant_costs） */
export function enchantPoints(e?: GearSpec['enchants']): number {
  if (!e) return 0
  const c = gearRules.enchant_costs
  let n = 0
  for (const [k, v] of Object.entries(e.mods ?? {})) n += k === 'threat' ? Math.abs(v ?? 0) / 0.1 * c.threat! : Math.abs(v ?? 0) * (c[k] ?? 1)
  for (const v of Object.values(e.resist ?? {})) n += Math.abs(v ?? 0) / 0.25 * c.resist!
  for (const v of Object.values(e.offense ?? {})) n += Math.abs(v ?? 0) / 0.25 * c.offense!
  return Math.round(n * 100) / 100
}

/** 物品名稱 → 裝備組成（目錄或打造、事件生成的物品） */
export function gearSpecOf(state: Pick<GameState, 'customItems'> | undefined, name: string): GearSpec | undefined {
  return itemDef(name)?.gear ?? state?.customItems?.[name]?.gear
}

/** 這件裝備可以放的欄位 */
export function slotsFor(spec: GearSpec): GearSlot[] {
  const slot = gearStats(spec).slot
  return gearRules.slot_groups[slot] ?? [slot as GearSlot]
}

// ---- 角色身上的裝備 ----

/** 主手與上身決定角色的武器與防具類型；主手空著時用職業的徒手（武僧拳腳）或徒手 */
export function syncGear(c: Character, classWeapon?: string) {
  const main = c.gear?.main_hand
  const body = c.gear?.body
  const natural = classWeapon && equipment.weapons[classWeapon]?.natural ? classWeapon
    : equipment.weapons[c.weapon]?.natural ? c.weapon : 'unarmed'
  c.weapon = main ? gearStats(main.spec).weapon ?? natural : natural
  c.armor = body ? gearStats(body.spec).armor ?? 'none' : 'none'
}

/** 身上所有裝備的加成合計（主手武器的骰子與上身防具的迴避、減傷另外由武器與防具類型計算） */
export function gearBonuses(c: Pick<Character, 'gear'>): { mods: Mods; resist: AffinityMap; offense: AffinityMap; threat: number } {
  const mods: Mods = {}
  const resist: AffinityMap = {}
  const offense: AffinityMap = {}
  let threat = 0
  for (const g of Object.values(c.gear ?? {})) {
    if (!g) continue
    const s = gearStats(g.spec)
    addMods(mods, s.mods)
    addMap(resist, s.resist)
    addMap(offense, s.offense)
    threat += s.threat
  }
  return { mods, resist, offense, threat: Math.round(threat * 100) / 100 }
}

export function equipped(name: string, spec: GearSpec): EquippedGear {
  return { name, spec }
}

/** 材料類型裡指定等級的材料（tier 1～5） */
function materialOf(kind: MaterialKind, tier: number): string {
  return Object.entries(gearRules.materials).find(([, m]) => m.kind === kind && m.tier === tier)![0]
}

function piece(base: string, tier: number): EquippedGear {
  const spec: GearSpec = { base, material: materialOf(gearRules.bases[base]!.kind, tier) }
  return { name: gearName(spec), spec }
}

/** 開局的基本配備（第一級材料） */
export function startingGear(classId: string): Partial<Record<GearSlot, EquippedGear>> {
  const t = gearRules.classes[classId]
  const out: Partial<Record<GearSlot, EquippedGear>> = {}
  for (const [slot, base] of Object.entries(t?.start ?? {})) out[slot as GearSlot] = piece(base, 1)
  return out
}

/** 依等級挑材料：建議等級不超過角色等級的最高一級最常見，傳說材料特別少 */
function rollTier(rng: Rng, kind: MaterialKind, level: number): number {
  const l = gearRules.loadout
  const top = Math.max(1, ...Object.values(gearRules.materials).filter((m) => m.kind === kind && m.level <= level).map((m) => m.tier))
  const r = rng.next()
  let tier = r < l.top ? top : r < l.top + l.below ? top - 1 : top - 2
  tier = Math.max(1, tier)
  if (tier === 5 && !rng.chance(l.legendary)) tier = 4
  return tier
}

const PIECE_BASES: Record<MaterialKind, Partial<Record<GearSlot, string>>> = {
  metal: { head: 'helm', legs: 'greaves', wrists: 'vambraces', feet: 'sabatons', belt: 'girdle' },
  leather: { head: 'leather_cap', legs: 'leather_leggings', wrists: 'bracers', feet: 'boots', belt: 'belt' },
  cloth: { head: 'hood', legs: 'trousers', wrists: 'wraps', feet: 'shoes', belt: 'sash' },
  wood: {},
  jewel: {},
}
const JEWELRY_BASES = {
  accessory: ['ring_precision', 'ring_guard', 'ring_fortune', 'ring_swift'],
  neck: ['amulet_ward', 'amulet_iron', 'pendant_fire', 'pendant_cold', 'pendant_lightning', 'pendant_poison', 'pendant_shadow', 'pendant_mind'],
}

/** 夥伴與敵對冒險者：依職業模板與等級生成一套裝備 */
export function generateLoadout(classId: string, level: number, rng: Rng, race?: string): Partial<Record<GearSlot, EquippedGear>> {
  const t = gearRules.classes[classId] ?? gearRules.classes.fighter!
  const l = gearRules.loadout
  const blocked = new Set(race ? gearRules.races[race]?.blocked ?? [] : [])
  const out: Partial<Record<GearSlot, EquippedGear>> = {}
  const put = (slot: GearSlot, base: string | undefined) => {
    if (!base || blocked.has(slot)) return
    out[slot] = piece(base, rollTier(rng, gearRules.bases[base]!.kind, level))
  }
  put('main_hand', t.main.length ? rng.pick(t.main) : undefined)
  const twoHanded = !!(out.main_hand && gearRules.bases[out.main_hand.spec.base]?.two_handed)
  if (!twoHanded && t.off.length) put('off_hand', t.start.off_hand ?? rng.pick(t.off))
  put('body', level >= 9 && t.body.includes('plate') ? 'plate' : t.start.body ?? rng.pick(t.body))
  const pieceChance = Math.min(0.95, l.pieces_base + l.pieces_per_level * level)
  for (const slot of PIECE_SLOTS) if (rng.chance(pieceChance)) put(slot, PIECE_BASES[t.pieces][slot])
  const jewelChance = Math.min(l.jewelry_max, l.jewelry_base + l.jewelry_per_level * level)
  for (const j of JEWELRY) if (rng.chance(jewelChance)) put(j.slot, rng.pick(JEWELRY_BASES[j.group]))
  return out
}

const MOD_NAME: Record<string, string> = {
  hit: '命中', damage: '傷害', evade: '迴避', dr: '減傷', save: '豁免', crit: '幸運一擊', ap_regen: '行動點回復',
}
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** 一行說明：稀有度・欄位・武器或防具類型・加成 */
export function gearSummary(spec: GearSpec): string {
  const s = gearStats(spec)
  const parts = [rarityName(s.rarity), s.slot === 'neck' ? '項鍊' : slotName(s.slot)]
  if (s.weapon) {
    const w = weaponDef(s.weapon)
    parts.push(`${w.dice} ${damageTypeName(w.type)}${s.two_handed ? '（雙手）' : ''}`)
  }
  if (s.armor) {
    const a = armorDef(s.armor)
    parts.push(`迴避 ${signed(a.evade)}、減傷 ${a.dr}`)
  }
  const bonus = Object.entries(s.mods).filter(([, v]) => v).map(([k, v]) => `${MOD_NAME[k] ?? k} ${signed(v!)}`)
  const res = Object.entries(s.resist).filter(([, v]) => v).map(([k, v]) => `${damageTypeName(k)} ×${Math.round((1 + v!) * 100) / 100}`)
  const off = Object.entries(s.offense).filter(([, v]) => v).map(([k, v]) => `${damageTypeName(k)}攻擊 ×${Math.round((1 + v!) * 100) / 100}`)
  const all = [...bonus, ...res, ...off, ...(s.threat ? [`仇恨 ${signed(Math.round(s.threat * 100))}%`] : [])]
  if (all.length) parts.push(all.join('、'))
  return parts.join('・')
}
