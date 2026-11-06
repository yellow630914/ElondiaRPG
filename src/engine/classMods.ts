// 職業的自訂內容（docs/CONTENT_EDITOR.md 3.45 節）：內建職業可以改、可以恢復預設，也可以新增自建的職業（mod_cls_…）。
// 一個職業存三份資料：classes.json 的定義、gear.json 的裝備模板、身分標籤的職業倍率（npc_tags.json 的 class_mult），
// 編輯器把它們合成一份 ClassMod，套用時再拆回去。「無法戰鬥」不開放編輯。

import {
  abilities, ATTR_IDS, classes, damageTypes, equipment, geography, NONCOMBAT_CLASS, npcs, npcTags, perkRules, refreshClassLists,
  type AffinityMap, type AttrId, type CasterType, type ClassDef,
} from './data'
import { createPlayer, learnable, recalc } from './character'
import { gearRules, type ClassGearTemplate, type MaterialKind } from './gear'
import type { GameState, GearSlot } from './types'

/** 編輯器存的職業：定義、裝備模板與 NPC 生成的倍率合成一份 */
export interface ClassMod {
  name: string
  emoji: string
  role: string
  hit_die: number
  threat: { start: number; mult: number }
  /** 建角時屬性陣列的分配順序（五個屬性各一次） */
  priority: AttrId[]
  caster: CasterType
  /** 施法屬性（只有施法職業） */
  casting?: AttrId
  /** 沒有裝備時的武器、防具類型（武僧的拳腳這種天生武器才有作用） */
  weapon: string
  armor: string
  /** 初始能力 */
  start: string[]
  resist?: AffinityMap
  gear: ClassGearTemplate
  /** 隨機生成的 NPC 抽到這個職業的權重（1 是一般；0 = NPC 不會隨機抽到） */
  npc_weight: number
  /** 地區職業倍率（classes.json 的 region_mult：地區 id 或 other → 倍率；沒寫的是 1） */
  region_mult?: Record<string, number>
  /** 冒險者帶某個身分標籤的機率倍率（npc_tags.json 的 class_mult；沒寫的是 1） */
  tag_mult?: Record<string, number>
  custom?: boolean
}

export const CLASS_ID = /^mod_cls_[a-z0-9]{1,24}$/
export const CLASS_LIMITS = {
  name_chars: 8, emoji_chars: 4, role_chars: 80, hit_die: [4, 12] as const, threat_start: [0, 20] as const, threat_mult: [0.3, 2] as const,
  start: 6, npc_weight: [0, 5] as const, region_mult: [0, 10] as const, tag_mult: [0, 10] as const, resist: [-0.5, 0.5] as const, bases: 8,
}
export const CASTER_NAME: Record<CasterType, string> = { none: '不施法', half: '半施法者（1～5 環）', full: '全施法者（1～9 環）' }
export const PIECE_NAME: Record<string, string> = { metal: '金屬（重甲）', leather: '皮革（輕甲）', cloth: '布' }
/** 起始裝備能填的欄位 */
export const START_SLOTS: GearSlot[] = ['main_hand', 'off_hand', 'body']
const PIECES: MaterialKind[] = ['metal', 'leather', 'cloth']
const HIT_DICE = [4, 6, 8, 10, 12]

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown, [lo, hi]: readonly [number, number], d: number): number => {
  const n = Number(v)
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? d : Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100
}

// ---- 內建的樣子（模組載入時） ----

const builtin = {
  classes: clone(classes),
  gear: clone(gearRules.classes),
  tagMult: Object.fromEntries(Object.entries(npcTags.tags).map(([t, d]) => [t, clone(d.class_mult ?? {})])) as Record<string, Record<string, number>>,
}

export function isBuiltinClass(id: string): boolean {
  return !!builtin.classes[id]
}

/** 職業編輯器列出的職業：所有戰鬥職業（「無法戰鬥」不算） */
export function editableClassIds(): string[] {
  return Object.keys(classes).filter((k) => k !== NONCOMBAT_CLASS && !classes[k]!.noncombat)
}

/** 主手武器的類型（底材的 type：刀劍、鎚斧……），「職業武器限制」用 */
export function weaponTypes(): string[] {
  return [...new Set(Object.values(gearRules.bases).filter((b) => b.slot === 'main_hand' && !!b.weapon && !b.restraint && !!b.type).map((b) => b.type!))]
}

/** 從定義、裝備模板與標籤倍率組出一份 ClassMod */
function compose(id: string, def: ClassDef, gear: ClassGearTemplate | undefined, tagMult: (tag: string) => number | undefined): ClassMod {
  const tm = Object.fromEntries(Object.keys(npcTags.tags).map((t) => [t, tagMult(t)] as const).filter(([, v]) => v !== undefined && v !== 1)) as Record<string, number>
  const out: ClassMod = {
    name: def.name, emoji: def.emoji, role: def.role, hit_die: def.hit_die, threat: clone(def.threat ?? { start: 0, mult: 1 }),
    priority: [...def.priority], caster: def.caster, weapon: def.weapon, armor: def.armor, start: [...def.start],
    gear: clone(gear ?? { start: {}, main: [], off: [], body: [], pieces: 'cloth' }),
    npc_weight: def.npc_weight ?? 1,
  }
  if (def.casting) out.casting = def.casting
  if (def.resist && Object.keys(def.resist).length) out.resist = clone(def.resist)
  if (Object.keys(tm).length) out.tag_mult = tm
  if (def.region_mult && Object.keys(def.region_mult).length) out.region_mult = clone(def.region_mult)
  return out
}

/** 目前世界裡這個職業的樣子（編輯器打開時） */
export function classModOf(id: string): ClassMod {
  const def = classes[id]
  if (!def) throw new Error(`沒有這個職業：${id}`)
  return compose(id, def, gearRules.classes[id], (t) => npcTags.tags[t]?.class_mult?.[id])
}

/** 內建職業原本的樣子（恢復預設、比較有沒有改過）；自建的 undefined */
export function builtinClassMod(id: string): ClassMod | undefined {
  const def = builtin.classes[id]
  if (!def || def.noncombat) return undefined
  return compose(id, def, builtin.gear[id], (t) => builtin.tagMult[t]?.[id])
}

/** 整理時認得的東西：能力、底材（自建的也算）、身分標籤 */
export interface ClassKnown {
  abilities: Set<string>
  bases: Set<string>
  tags: Set<string>
}

export function classKnown(): ClassKnown {
  return { abilities: new Set(Object.keys(abilities)), bases: new Set(Object.keys(gearRules.bases)), tags: new Set(Object.keys(npcTags.tags)) }
}

/** 整理一個職業（內容編輯器、匯入）：數值夾在範圍內、不認得的能力與底材拿掉、不認得的欄位拿掉 */
export function sanitizeClassMod(raw: Partial<ClassMod> | undefined, custom: boolean, known: ClassKnown = classKnown()): ClassMod {
  const r = raw ?? {}
  const prio = (Array.isArray(r.priority) ? r.priority : []).filter((a, i, l): a is AttrId => ATTR_IDS.includes(a as AttrId) && l.indexOf(a) === i)
  const priority = [...prio, ...ATTR_IDS.filter((a) => !prio.includes(a))]
  const caster: CasterType = r.caster === 'full' || r.caster === 'half' ? r.caster : 'none'
  const hd = Number(r.hit_die)
  const out: ClassMod = {
    name: str(r.name, CLASS_LIMITS.name_chars) || '新的職業',
    emoji: str(r.emoji, CLASS_LIMITS.emoji_chars) || '🎓',
    role: str(r.role, CLASS_LIMITS.role_chars),
    hit_die: HIT_DICE.includes(hd) ? hd : 8,
    threat: { start: num(r.threat?.start, CLASS_LIMITS.threat_start, 2), mult: num(r.threat?.mult, CLASS_LIMITS.threat_mult, 1) },
    priority,
    caster,
    weapon: typeof r.weapon === 'string' && equipment.weapons[r.weapon] ? r.weapon : 'unarmed',
    armor: typeof r.armor === 'string' && equipment.armors[r.armor] ? r.armor : 'cloth',
    start: [...new Set((Array.isArray(r.start) ? r.start : []).filter((x): x is string => typeof x === 'string' && known.abilities.has(x)))].slice(0, CLASS_LIMITS.start),
    gear: sanitizeGear(r.gear, known.bases),
    npc_weight: num(r.npc_weight, CLASS_LIMITS.npc_weight, 1),
  }
  if (caster !== 'none') out.casting = ATTR_IDS.includes(r.casting as AttrId) ? r.casting! : priority[0]!
  const keys = [...damageTypes.types.map((t) => t.id), ...Object.keys(damageTypes.groups), 'all']
  const res = Object.fromEntries(Object.entries(r.resist ?? {}).filter(([k]) => keys.includes(k)).map(([k, v]) => [k, num(v, CLASS_LIMITS.resist, 0)] as const).filter(([, v]) => v !== 0))
  if (Object.keys(res).length) out.resist = res
  const tm = Object.fromEntries(Object.entries(r.tag_mult ?? {}).filter(([t]) => known.tags.has(t)).map(([t, v]) => [t, num(v, CLASS_LIMITS.tag_mult, 1)] as const).filter(([, v]) => v !== 1))
  if (Object.keys(tm).length) out.tag_mult = tm
  // 地區倍率：認得的地區或 other，1 不記
  const regionKeys = new Set([...geography.regions.map((g) => g.id), 'other'])
  const rm = Object.fromEntries(Object.entries(r.region_mult ?? {}).filter(([k]) => regionKeys.has(k)).map(([k, v]) => [k, num(v, CLASS_LIMITS.region_mult, 1)] as const).filter(([, v]) => v !== 1))
  if (Object.keys(rm).length) out.region_mult = rm
  if (custom) out.custom = true
  return out
}

function sanitizeGear(raw: Partial<ClassGearTemplate> | undefined, bases: Set<string>): ClassGearTemplate {
  const g = raw ?? {}
  const fits = (b: unknown, slot: GearSlot) => typeof b === 'string' && bases.has(b) && (gearRules.bases[b] ? gearRules.bases[b]!.slot === slot : true)
  const list = (v: unknown, slot: GearSlot) => [...new Set((Array.isArray(v) ? v : []).filter((b) => fits(b, slot)) as string[])].slice(0, CLASS_LIMITS.bases)
  const start: ClassGearTemplate['start'] = {}
  for (const slot of START_SLOTS) {
    const b = g.start?.[slot]
    if (fits(b, slot)) start[slot] = b
  }
  const out: ClassGearTemplate = {
    start,
    main: list(g.main, 'main_hand'),
    off: list(g.off, 'off_hand'),
    body: list(g.body, 'body'),
    pieces: PIECES.includes(g.pieces as MaterialKind) ? g.pieces! : 'cloth',
  }
  if (Array.isArray(g.weapons)) out.weapons = [...new Set(g.weapons.filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim().slice(0, 8)))].slice(0, 8)
  return out
}

/** 把整理過的職業寫進遊戲資料：定義、裝備模板、身分標籤的職業倍率 */
export function applyClassMod(id: string, m: ClassMod) {
  const base = builtin.classes[id]
  const def: ClassDef = {
    ...(base ? clone(base) : {}),
    name: m.name, emoji: m.emoji, role: m.role, hit_die: m.hit_die, threat: clone(m.threat), priority: [...m.priority], caster: m.caster,
    weapon: m.weapon, armor: m.armor, start: [...m.start],
  }
  if (m.casting) def.casting = m.casting
  else delete def.casting
  if (m.resist) def.resist = clone(m.resist)
  else delete def.resist
  if (m.npc_weight !== 1) def.npc_weight = m.npc_weight
  else delete def.npc_weight
  if (m.region_mult && Object.keys(m.region_mult).length) def.region_mult = clone(m.region_mult)
  else delete def.region_mult
  classes[id] = def
  gearRules.classes[id] = clone(m.gear)
  for (const [t, tag] of Object.entries(npcTags.tags)) {
    const v = m.tag_mult?.[t]
    if (v === undefined) {
      if (tag.class_mult) delete tag.class_mult[id]
    } else {
      (tag.class_mult ??= {})[id] = v
    }
  }
  refreshClassLists()
}

/** 還原成內建的職業與裝備模板（身分標籤的倍率由身分標籤的還原一起處理） */
export function restoreClasses() {
  for (const k of Object.keys(classes)) delete classes[k]
  for (const [k, v] of Object.entries(builtin.classes)) classes[k] = clone(v)
  for (const k of Object.keys(gearRules.classes)) delete gearRules.classes[k]
  for (const [k, v] of Object.entries(builtin.gear)) gearRules.classes[k] = clone(v)
  refreshClassLists()
}

export function newClassMod(): ClassMod {
  return sanitizeClassMod({
    name: '新的職業', emoji: '🎓', role: '', hit_die: 8, threat: { start: 2, mult: 1 }, priority: ['str', 'dex', 'fai', 'cha', 'int'], caster: 'none',
    weapon: 'unarmed', armor: 'leather', start: [],
    gear: { start: { main_hand: 'shortsword', body: 'leather_armor' }, main: ['shortsword'], off: [], body: ['leather_armor'], pieces: 'leather' },
    // 還沒有能力：NPC 先不抽到（第一次存好初始能力時編輯器改回 1）
    npc_weight: 0,
  }, true)
}

/** 能學這個職業能力的數量（編輯器顯示，提醒能力不夠升級三選一） */
export function classAbilityCount(id: string): number {
  return Object.values(abilities).filter((a) => a.classes.includes(id)).length
}

/**
 * 從 1 級升到 20 級、每級學一個能力時，2～20 級各有幾個能力可以學（編輯器提醒：少於 3 個湊不滿三選一，
 * 少於 6 個不能重抽；內建職業每一級都至少 6 個）。照目前套用的資料算，所以要先存檔。
 */
export function levelPoolSizes(id: string): number[] {
  if (!classes[id]) return []
  const c = createPlayer('_', 'human', id)
  const out: number[] = []
  for (let lv = 2; lv <= 20; lv++) {
    c.level = lv
    recalc(c)
    const pool = learnable(c)
    out.push(pool.length)
    if (pool[0]) c.abilities.push(pool[0].id)
  }
  return out
}

/**
 * 哪些地方用到這個職業（刪除自建職業時擋下）：固定 NPC、特質的「限定職業」、目前存檔的角色與 NPC。
 * 能力的「誰可以學」、特質與血統的「NPC 比較容易抽到」不擋：職業刪掉時整理會一起拿掉。
 */
export function classUsage(id: string, state?: GameState | null): string[] {
  const out: string[] = []
  for (const n of npcs) if (n.class === id) out.push(`固定 NPC「${n.name}」`)
  for (const p of perkRules.perks) if (p.requires?.classes?.includes(id)) out.push(`特質「${p.name}」的限定職業`)
  if (state) {
    const members = state.party.filter((m) => m.class === id)
    if (members.length) out.push(`目前存檔的隊伍（${members.map((m) => m.name).join('、')}）`)
    const n = Object.values(state.npcs ?? {}).filter((r) => r.class === id || r.character?.class === id).length
    if (n) out.push(`目前存檔裡的 ${n} 位 NPC`)
  }
  return [...new Set(out)]
}
