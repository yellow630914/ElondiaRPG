// 裝備：11 個欄位、底材 × 材料、稀有度與附魔（data/rules/gear.json）。
//
// - 一件裝備的數值由組成（GearSpec）推算：底材決定欄位、武器或防具類型與固定數值，材料的 bonus 依 scale 成長，
//   附魔在稀有度的點數內加減。制式裝備（items.json）、打造與事件生成的裝備（customItems）都用同一套公式。
// - 穿在身上的裝備自帶組成（EquippedGear），計算數值不需要存檔。
// - 角色的 weapon / armor 由主手與上身的裝備決定（syncGear），戰鬥沿用原本的武器與防具計算；
//   其餘欄位與材料、附魔的加成合計成 mods / resist / offense（gearBonuses）。

import gearJson from '@data/rules/gear.json'
import { armorDef, damageTypeName, damageTypes, equipment, itemDef, itemRules, weaponDef, type AffinityMap, type AttrId, type Mods } from './data'
import type { Rng } from './rng'
import type { Character, EquippedGear, GameState, GearSlot, GearSpec } from './types'

type Scale = 'full' | 'half' | 'up' | 'third' | 'third_up' | 'res'
export type MaterialKind = 'metal' | 'leather' | 'cloth' | 'wood' | 'jewel'

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
  slot: GearSlot | 'ring'
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
  drops: {
    adventurer: { chance: number; max: number }
    armed: { chance: number; per_level: number; max_chance: number }
    bump: number
  }
  chests: Record<string, {
    money: [number, number]; gear: number; gear_extra?: number
    items: [string, number][]; forge: [number, number][]
  }>
  craft: {
    hours: number; attr: AttrId; fee: number[]; dc: number[]
    units: Record<string, number>; lost_on_fail: number
    aux: { max_kinds: number; max_qty: number; chance_per_value: number; max_chance: number; elements: Record<string, string[]> }
  }
  loadout: {
    top: number; below: number; lower: number; legendary: number
    pieces_base: number; pieces_per_level: number
    jewelry_base: number; jewelry_per_level: number; jewelry_max: number
  }
}

export const SLOTS = Object.keys(gearRules.slots) as GearSlot[]
const PIECE_SLOTS: GearSlot[] = ['head', 'legs', 'wrists', 'feet', 'belt']
const JEWELRY: { slot: GearSlot; group: 'accessory' | 'ring' }[] = [
  { slot: 'accessory', group: 'accessory' }, { slot: 'ring_1', group: 'ring' }, { slot: 'ring_2', group: 'ring' },
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
  slot: GearSlot | 'ring'
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

/** 底材與材料都還在（自訂內容可能刪掉了自建的底材或材料） */
export function gearKnown(spec: Pick<GearSpec, 'base' | 'material'> | undefined): spec is GearSpec {
  return !!spec && !!gearRules.bases[spec.base] && !!gearRules.materials[spec.material]
}

/** 一件裝備的數值（底材或材料不存在時丟錯；可能遇到失效裝備的地方先用 gearKnown 檢查） */
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
  const base = gearRules.bases[spec.base]
  const material = gearRules.materials[spec.material]
  if (!base || !material) return 0
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
  if (!gearKnown(spec)) return []
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
  // 失效的裝備（底材或材料被刪掉）：當成沒有裝備
  c.weapon = main && gearKnown(main.spec) ? gearStats(main.spec).weapon ?? natural : natural
  c.armor = body && gearKnown(body.spec) ? gearStats(body.spec).armor ?? 'none' : 'none'
}

/** 身上所有裝備的加成合計（主手武器的骰子與上身防具的迴避、減傷另外由武器與防具類型計算） */
export function gearBonuses(c: Pick<Character, 'gear'>): { mods: Mods; resist: AffinityMap; offense: AffinityMap; threat: number } {
  const mods: Mods = {}
  const resist: AffinityMap = {}
  const offense: AffinityMap = {}
  let threat = 0
  for (const g of Object.values(c.gear ?? {})) {
    if (!g || !gearKnown(g.spec)) continue
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
  const list = Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind)
  // 沒有剛好這一級的材料時，用最接近的（同樣接近時取低的）
  const best = list.sort(([, a], [, b]) => Math.abs(a.tier - tier) - Math.abs(b.tier - tier) || a.tier - b.tier)[0]
  if (!best) throw new Error(`沒有${kind}類的材料`)
  return best[0]
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
  accessory: ['amulet_ward', 'amulet_iron', 'pendant_fire', 'pendant_cold', 'pendant_lightning', 'pendant_poison', 'pendant_shadow', 'pendant_mind'],
  ring: ['ring_precision', 'ring_guard', 'ring_fortune', 'ring_swift'],
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
  if (!gearKnown(spec)) return '（已失效：底材或材料不存在，沒有效果）'
  const s = gearStats(spec)
  const parts = [rarityName(s.rarity), s.slot === 'ring' ? '戒指' : slotName(s.slot)]
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

// ---- AI 打造與事件生成的裝備 ----

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function shiftRarity(r: string, n: number): string {
  const i = Math.max(0, RARITY_ORDER.indexOf(r))
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, i + n))]!
}

/** 稀有度可以用的附魔點數 */
export function rarityPoints(r: string): number {
  return gearRules.rarities[r]?.enchant_points ?? 0
}

const ENCHANT_MODS: Record<string, number> = { hit: 2, damage: 3, evade: 2, dr: 2, save: 2, crit: 1, ap_regen: 1 }
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)
const isAffinityKey = (k: string) => k in damageTypes.groups || damageTypes.types.some((t) => t.id === k)

/**
 * 整理附魔：mods 為整數（每項有上限），resist 以 0.25 為單位、只能減傷（負數，最多 -0.5），
 * offense 以 0.25 為單位、只能增加（最多 +0.5），threat 以 0.1 為單位（±0.3）。
 * 總點數超過 points 時從最後一項開始刪減。
 */
export function sanitizeEnchants(raw: unknown, points: number): GearSpec['enchants'] | undefined {
  if (!raw || typeof raw !== 'object' || points <= 0) return undefined
  const r = raw as Record<string, unknown>
  const entries: { group: 'mods' | 'resist' | 'offense'; key: string; value: number }[] = []
  for (const [k, v] of Object.entries((r.mods ?? {}) as Record<string, unknown>)) {
    const n = num(v)
    if (Number.isNaN(n)) continue
    if (k === 'threat') {
      const t = Math.round(Math.max(-0.3, Math.min(0.3, n)) * 10) / 10
      if (t) entries.push({ group: 'mods', key: k, value: t })
    } else if (ENCHANT_MODS[k]) {
      const m = Math.round(Math.max(0, Math.min(ENCHANT_MODS[k]!, n)))
      if (m) entries.push({ group: 'mods', key: k, value: m })
    }
  }
  for (const [k, v] of Object.entries((r.resist ?? {}) as Record<string, unknown>)) {
    const n = Math.round(Math.max(-0.5, Math.min(0, num(v) || 0)) * 4) / 4
    if (n && isAffinityKey(k)) entries.push({ group: 'resist', key: k, value: n })
  }
  for (const [k, v] of Object.entries((r.offense ?? {}) as Record<string, unknown>)) {
    const n = Math.round(Math.max(0, Math.min(0.5, num(v) || 0)) * 4) / 4
    if (n && isAffinityKey(k)) entries.push({ group: 'offense', key: k, value: n })
  }
  const build = (list: typeof entries) => {
    const e: NonNullable<GearSpec['enchants']> = {}
    for (const x of list) ((e[x.group] ??= {}) as Record<string, number>)[x.key] = x.value
    return e
  }
  // 超過點數：刪掉最後一項（一項一項刪，直到夠用）
  while (entries.length && enchantPoints(build(entries)) > points) entries.pop()
  return entries.length ? build(entries) : undefined
}

/** 依名稱或 id 找底材、材料（AI 可能寫中文名稱） */
export function findBase(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return undefined
  if (gearRules.bases[s]) return s
  return Object.entries(gearRules.bases).find(([, b]) => b.name === s)?.[0]
}

export function findMaterial(v: unknown, kind?: MaterialKind): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return undefined
  const ok = (m: MaterialDef) => !kind || m.kind === kind
  if (gearRules.materials[s] && ok(gearRules.materials[s]!)) return s
  return Object.entries(gearRules.materials).find(([, m]) => m.name === s && ok(m))?.[0]
}

export interface GearLimits {
  /** 材料的建議等級上限 */
  maxLevel: number
  /** 稀有度上限（沒有時為材料原本的稀有度） */
  maxRarity?: string
  /** 固定底材或材料（打造時由玩家選定） */
  base?: string
  material?: string
}

/**
 * 把 AI 提出的裝備（{ base, material, rarity, enchants }）整理成合法的組成：底材與材料要同類型、
 * 材料不超過等級上限（超過時降到上限內最高的一級）、稀有度不超過上限、附魔在稀有度的點數內。
 */
export function sanitizeGearSpec(raw: unknown, limits: GearLimits): GearSpec | undefined {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = limits.base ?? findBase(r.base ?? r.slot)
  if (!base) return undefined
  const kind = gearRules.bases[base]!.kind
  let material = limits.material ?? findMaterial(r.material, kind) ?? materialOf(kind, 1)
  if (gearRules.materials[material]!.level > limits.maxLevel) {
    const fit = Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind && m.level <= limits.maxLevel)
    material = fit.sort((a, b) => b[1].tier - a[1].tier)[0]?.[0] ?? materialOf(kind, 1)
  }
  const natural = gearRules.materials[material]!.rarity
  const cap = limits.maxRarity ?? natural
  const want = typeof r.rarity === 'string' && RARITY_ORDER.includes(r.rarity) ? r.rarity : natural
  const rarity = RARITY_ORDER[Math.min(RARITY_ORDER.indexOf(want), Math.max(RARITY_ORDER.indexOf(cap), RARITY_ORDER.indexOf(natural)))]!
  const enchants = sanitizeEnchants(r.enchants, rarityPoints(rarity))
  return { base, material, ...(rarity !== natural ? { rarity } : {}), ...(enchants ? { enchants } : {}) }
}

/** 和目錄裡的制式品完全相同（沒有附魔、稀有度也沒變） */
function isStandard(spec: GearSpec): boolean {
  return !spec.enchants && !spec.rarity
}

function sameSpec(a?: GearSpec, b?: GearSpec): boolean {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 登錄一件打造或事件生成的裝備，回傳物品名稱。制式品直接用目錄的名稱；
 * 其他的用 AI 取的名字（沒有時是「稀有度＋制式名稱」或「精製＋制式名稱」），和現有的物品撞名時加上編號。
 */
export function registerGear(state: Pick<GameState, 'customItems'>, spec: GearSpec, name?: string, desc?: string): string {
  if (!gearKnown(spec)) throw new Error('這件裝備的底材或材料不存在')
  const standard = gearName(spec)
  // 制式品：目錄裡真的有同名、同組成的物品才直接用（底材或材料改過名、目錄物品被改掉時另外登錄）
  if (isStandard(spec) && !name && sameSpec(itemDef(standard)?.gear, spec)) return standard
  // 預設名稱：稀有度比材料高時加上稀有度（優良鐵長劍），只是有附魔時是「精製」（精製秘銀長劍）
  const want = name?.trim().slice(0, 20) || (isStandard(spec) ? standard : `${spec.rarity ? rarityName(spec.rarity) : '精製'}${standard}`)
  const taken = (n: string) => {
    if (itemDef(n)) return !sameSpec(itemDef(n)!.gear, spec) || !isStandard(spec)
    const c = state.customItems?.[n]
    return !!c && !sameSpec(c.gear, spec)
  }
  let final = want
  for (let i = 2; taken(final); i++) final = `${want}（${i}）`
  if (itemDef(final)) return final
  ;(state.customItems ??= {})[final] = {
    category: 'equipment', price_cc: gearPrice(spec), gear: spec,
    ...(desc?.trim() ? { desc: desc.trim().slice(0, 80) } : {}),
  }
  return final
}

const ENCHANT_POOL: Record<string, { mods?: (keyof Mods)[]; resist?: boolean; offense?: boolean }> = {
  weapon: { mods: ['hit', 'damage', 'crit'], offense: true },
  armor: { mods: ['dr', 'evade', 'save'], resist: true },
  jewel: { mods: ['save', 'crit', 'hit', 'evade', 'ap_regen'], resist: true },
  focus: { mods: ['hit', 'save', 'ap_regen'], offense: true },
}
const ELEMENTS = ['fire', 'cold', 'lightning', 'acid', 'poison', 'radiant', 'necrotic', 'force', 'psychic']

/** 規則生成的附魔（沒有 AI 時）：依欄位挑合適的加成，用掉 points 點；elements 是偏好的屬性（輔料決定） */
export function rollEnchants(base: string, points: number, rng: Rng, elements: string[] = []): GearSpec['enchants'] | undefined {
  const b = gearRules.bases[base]!
  const pool = ENCHANT_POOL[b.weapon ? 'weapon' : base === 'focus' ? 'focus' : b.kind === 'jewel' ? 'jewel' : 'armor']!
  const e: NonNullable<GearSpec['enchants']> = {}
  let left = points
  for (let guard = 0; left > 0 && guard < 20; guard++) {
    const options: (() => boolean)[] = []
    for (const k of pool.mods ?? []) {
      options.push(() => {
        const cost = gearRules.enchant_costs[k] ?? 1
        const next = ((e.mods ??= {})[k] ?? 0) + 1
        if (cost > left || next > (ENCHANT_MODS[k] ?? 1)) return false
        e.mods![k] = next
        left -= cost
        return true
      })
    }
    const element = () => (elements.length && rng.chance(0.8) ? rng.pick(elements) : rng.pick(ELEMENTS))
    const resist = () => {
      const k = element()
      const next = ((e.resist ??= {})[k] ?? 0) - 0.25
      if (next < -0.5) return false
      e.resist![k] = next
      left -= gearRules.enchant_costs.resist ?? 1
      return true
    }
    const offense = () => {
      const k = element()
      const next = ((e.offense ??= {})[k] ?? 0) + 0.25
      if (next > 0.5) return false
      e.offense![k] = next
      left -= gearRules.enchant_costs.offense ?? 1
      return true
    }
    // 有偏好的屬性（輔料）時，抗性與屬性攻擊的機會加倍
    for (let n = elements.length ? 2 : 1; n > 0; n--) {
      if (pool.resist) options.push(resist)
      if (pool.offense) options.push(offense)
    }
    rng.pick(options)()
  }
  for (const k of ['mods', 'resist', 'offense'] as const) if (e[k] && !Object.keys(e[k]!).length) delete e[k]
  return Object.keys(e).length ? e : undefined
}

// ---- 寶箱與掉落 ----

/** 依等級隨機生成一件裝備（寶箱、人形怪物的掉落）：底材平均挑，材料依等級，有機會高一級稀有度並附魔 */
export function randomGear(rng: Rng, level: number, bases = Object.keys(gearRules.bases)): GearSpec {
  const base = rng.pick(bases)
  const kind = gearRules.bases[base]!.kind
  const material = materialOf(kind, rollTier(rng, kind, level))
  const spec: GearSpec = { base, material }
  if (rng.chance(gearRules.drops.bump)) {
    const rarity = shiftRarity(gearRules.materials[material]!.rarity, 1)
    spec.rarity = rarity
    const enchants = rollEnchants(base, rarityPoints(rarity), rng)
    if (enchants) spec.enchants = enchants
  }
  return spec
}

/** 某一類型、某一級的打造材料（items.json 有 forge 的物品，挑最便宜的） */
export function forgeItemFor(kind: MaterialKind, tier: number): string | undefined {
  const material = materialOf(kind, tier)
  return itemRules.items
    .filter((i) => i.forge?.materials.includes(material))
    .sort((a, b) => a.price_cc - b.price_cc)[0]?.name
}

export const MATERIAL_KINDS: MaterialKind[] = ['metal', 'leather', 'cloth', 'wood', 'jewel']
