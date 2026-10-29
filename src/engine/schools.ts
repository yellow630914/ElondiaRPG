// 慾望流派與雙面效應（成人向；docs/LEWD_STATS.md 第 6、7 節）：
// - 流派：入門與進階特質（perks.json 的 school、lust）。流派只是特質，不限制能學的色情技能。
//   流派特質的慾望效果（PerkDef.lust）在開戰時換算（combat.ts 的 initLust）；隸從派沒有主人時一半效果。
// - 雙面效應：拘束具（底材的 bind、bind_kind）平常是檢定減值；修了流派、鎖上時，戰鬥中反轉成增益。
// - 鎖：拘束具要鎖上（自己用鎖、或主人強制戴上的），戰鬥增益才生效；鎖越好倍率越高。
// 規則與數值在 data/rules/lewd.json 的 schools、servitude、two_face、locks。

import { BIND_KINDS, lewdRules, type BindKind, type LewdSchool, type LockGrade, type LustPerk, type Mods } from './data'
import { gearRules } from './gear'
import { lewdOf } from './lewd'
import { PARASITE_LOCK } from './parasites'
import { matches, perksOf, type CheckCtx } from './perks'
import { contractOf } from './tattoos'
import type { Character, GearSlot } from './types'

/** 所有流派（lewd.json 的順序） */
export function schoolIds(): string[] {
  return Object.keys(lewdRules.schools).filter((k) => !k.startsWith('$'))
}

export function schoolDef(id: string): LewdSchool | undefined {
  return id.startsWith('$') ? undefined : lewdRules.schools[id]
}

export function schoolName(id: string): string {
  return schoolDef(id)?.name ?? id
}

/** 角色修了哪些流派（有入門特質） */
export function schoolsOf(c: Pick<Character, 'perks' | 'customPerks' | 'race'>): string[] {
  const own = new Set(perksOf(c).map((p) => p.id))
  return schoolIds().filter((id) => own.has(schoolDef(id)!.entry))
}

export function hasSchool(c: Pick<Character, 'perks' | 'customPerks' | 'race'>, id: string): boolean {
  return schoolsOf(c).includes(id)
}

/** 有主人（奴隸契約上有主人；認主） */
export function hasMaster(c: Character): boolean {
  return !!contractOf(c)?.master
}

// ---- 流派特質的慾望效果 ----

export interface LustTotals {
  max: number; taken: number; self: number; convert: number; burst: number; relief: number; crit_convert: number; regen: number
  climax_heal: number; exposure: number; exposure_level: number; endurance_max: number; sensitivity_bonus: number
  growth: Partial<Record<'lewdness' | 'sensitivity' | 'endurance' | 'submission', number>>
  wounded: Mods; master: Mods; bound: Mods; bound_max: number
}

const NUM_KEYS = ['max', 'taken', 'self', 'convert', 'burst', 'relief', 'crit_convert', 'regen', 'climax_heal', 'exposure', 'exposure_level', 'endurance_max', 'sensitivity_bonus', 'bound_max'] as const
const MOD_KEYS = ['wounded', 'master', 'bound'] as const

function addMods(into: Mods, m: Mods | undefined, scale: number) {
  for (const [k, v] of Object.entries(m ?? {})) {
    const n = Math.floor((v ?? 0) * scale)
    if (n) into[k as keyof Mods] = (into[k as keyof Mods] ?? 0) + n
  }
}

/** 流派特質的慾望效果合計；隸從派的特質在沒有主人時乘上 servitude.no_master（戰鬥修正向下取整） */
export function lustTotals(c: Character): LustTotals {
  const t: LustTotals = {
    max: 0, taken: 0, self: 0, convert: 0, burst: 0, relief: 0, crit_convert: 0, regen: 0, climax_heal: 0, exposure: 0, exposure_level: 0,
    endurance_max: 0, sensitivity_bonus: 0, growth: {}, wounded: {}, master: {}, bound: {}, bound_max: 0,
  }
  const master = hasMaster(c)
  for (const p of perksOf(c)) {
    const l: LustPerk | undefined = p.lust
    if (!l) continue
    const scale = p.school === 'servitude' && !master ? lewdRules.servitude.no_master : 1
    for (const k of NUM_KEYS) t[k] += (l[k] ?? 0) * scale
    for (const k of MOD_KEYS) addMods(t[k], l[k], scale)
    for (const [k, v] of Object.entries(l.growth ?? {})) t.growth[k as keyof LustTotals['growth']] = (t.growth[k as keyof LustTotals['growth']] ?? 0) + (v ?? 0) * scale
  }
  return t
}

// ---- 雙面效應與鎖 ----

export interface BindInfo {
  slot: GearSlot
  name: string
  kind: BindKind
  bind: number
  /** 鎖：自己裝的鎖，或主人強制戴上的（依主人的身分） */
  lock?: LockGrade
}

export function lockName(g: LockGrade): string {
  return lewdRules.locks.grades[g]?.name ?? g
}

/** 主人強制戴上時用的鎖：依主人的身分 */
export function masterLockGrade(tags: string[] = []): LockGrade {
  const t = lewdRules.locks.master_tags
  return [...tags].reverse().map((x) => t[x]).find((x): x is LockGrade => !!x) ?? lewdRules.locks.master_default
}

/** 身上的拘束具（底材有 bind 與 bind_kind） */
export function bindsOf(c: Pick<Character, 'gear'>): BindInfo[] {
  const out: BindInfo[] = []
  for (const [slot, g] of Object.entries(c.gear ?? {})) {
    const base = g ? gearRules.bases[g.spec.base] : undefined
    if (!g || !base?.bind || !base.bind_kind || !BIND_KINDS.includes(base.bind_kind)) continue
    const masterLock = g.locked && !g.locked.startsWith(PARASITE_LOCK) ? lewdRules.locks.master_default : undefined
    const lock = g.lock ?? masterLock
    out.push({ slot: slot as GearSlot, name: g.name, kind: base.bind_kind, bind: Math.max(1, Math.min(3, Math.round(base.bind))), ...(lock ? { lock } : {}) })
  }
  return out
}

/** 拘束具平常的檢定減值（每件一行）：符合 checks 才算，每 endurance_per 點忍耐減輕 1 */
export function bindModifiers(c: Character, ctx: CheckCtx): { label: string; value: number }[] {
  const binds = bindsOf(c)
  if (!binds.length) return []
  const r = lewdRules.two_face
  const ease = Math.floor(lewdOf(c).endurance / r.endurance_per)
  const out: { label: string; value: number }[] = []
  for (const b of binds) {
    const k = r.kinds[b.kind]
    if (!k.checks.some((f) => matches(f, ctx))) continue
    // 淫器：日常的減值加重（lewd.json 的 fusion.penalty_mult）
    const fused = !!c.gear?.[b.slot]?.spec.fused
    const value = Math.round(Math.max(0, (k.penalty[b.bind - 1] ?? 0) - ease) * (fused ? lewdRules.fusion.penalty_mult : 1))
    if (value) out.push({ label: `拘束【${b.name}】`, value: -value })
  }
  return out
}

/** 這件拘束具的戰鬥倍率：鎖 × 流派契合（隸從派有主人時用 servitude_master） */
function bindMult(c: Character, b: BindInfo, schools: string[]): number {
  const r = lewdRules.two_face
  const lock = b.lock ? lewdRules.locks.grades[b.lock]?.mult ?? 1 : 0
  const fit = schools.includes('servitude') && hasMaster(c) ? r.servitude_master
    : schools.some((s) => schoolDef(s)?.fit.includes(b.kind)) ? r.fit : 1
  return lock * fit
}

export interface TwoFace {
  mods: Mods
  initiative: number
  immune: string[]
  /** 有效的拘束具（修了流派、鎖上的）：名稱與倍率 */
  active: { name: string; kind: BindKind; mult: number }[]
}

/** 雙面效應的戰鬥增益：修了任何流派、而且鎖上的拘束具才算 */
export function twoFaceCombat(c: Character): TwoFace {
  const out: TwoFace = { mods: {}, initiative: 0, immune: [], active: [] }
  const schools = schoolsOf(c)
  if (!schools.length) return out
  for (const b of bindsOf(c)) {
    const mult = bindMult(c, b, schools)
    if (!mult) continue
    const k = lewdRules.two_face.kinds[b.kind]
    const row = k.combat[b.bind - 1] ?? {}
    for (const [key, v] of Object.entries(row)) {
      const n = Math.round((v ?? 0) * mult)
      if (!n) continue
      if (key === 'initiative') out.initiative += n
      else out.mods[key as keyof Mods] = (out.mods[key as keyof Mods] ?? 0) + n
    }
    for (const s of k.immune ?? []) if (!out.immune.includes(s)) out.immune.push(s)
    out.active.push({ name: b.name, kind: b.kind, mult: Math.round(mult * 100) / 100 })
  }
  return out
}

// ---- 淫服的雙面效應（docs/LEWD_STATS.md 第 24 節；lewd.json 的 outfit_two_face） ----

/** 身上的成人向服裝件數（最多 max_pieces） */
export function adultOutfitPieces(c: Pick<Character, 'gear'>): number {
  const n = Object.values(c.gear ?? {}).filter((g) => g && gearRules.bases[g.spec.base]?.outfit === 'adult').length
  return Math.min(lewdRules.outfit_two_face.max_pieces, n)
}

/** 平常：穿著淫服和貴族、皇族、神職的人打交道比較難（每 endurance_per 點忍耐減輕 1） */
export function outfitModifiers(c: Character, ctx: CheckCtx): { label: string; value: number }[] {
  const r = lewdRules.outfit_two_face
  const n = adultOutfitPieces(c)
  if (!n || !ctx.kind || !r.penalty_kinds.includes(ctx.kind) || !ctx.vsTags?.some((t) => r.penalty_tags.includes(t))) return []
  const value = Math.max(0, Math.min(r.penalty_max, n * r.penalty_per) - Math.floor(lewdOf(c).endurance / r.endurance_per))
  return value ? [{ label: `淫服（${n} 件）`, value: -value }] : []
}

/** 戰鬥中：修了縱欲、露出派的人每件淫服有加成，禁慾派反過來 */
export function outfitCombat(c: Character): { mods: Mods; lustBonus: number } {
  const n = adultOutfitPieces(c)
  const out = { mods: {} as Mods, lustBonus: 0 }
  if (!n) return out
  for (const s of schoolsOf(c)) {
    const row = lewdRules.outfit_two_face.schools[s]
    if (!row) continue
    out.lustBonus += (row.lust_bonus ?? 0) * n
    if (row.evade) out.mods.evade = (out.mods.evade ?? 0) + row.evade * n
    if (row.save) out.mods.save = (out.mods.save ?? 0) + row.save * n
  }
  return out
}

/** 身上有上鎖的拘束具（繩縛之力） */
export function lockedBound(c: Pick<Character, 'gear'>): boolean {
  return bindsOf(c).some((b) => !!b.lock)
}

/** 拘束具的說明（物品說明、角色詳情用）：「束縛雙手 2」 */
export function bindLabel(kind: BindKind, bind: number): string {
  return `${lewdRules.two_face.kinds[kind]?.name ?? kind} ${bind}`
}

// ---- 內容編輯器、匯入：整理流派特質的慾望效果 ----

const LUST_RANGES: Record<(typeof NUM_KEYS)[number], [number, number]> = {
  max: [-30, 30], taken: [-0.5, 0.5], self: [-0.5, 1], convert: [0, 0.5], burst: [0, 0.5], relief: [-0.5, 1], crit_convert: [0, 1], regen: [0, 10],
  climax_heal: [0, 0.5], exposure: [0, 2], exposure_level: [0, 3], endurance_max: [0, 5], sensitivity_bonus: [0, 3], bound_max: [0, 30],
}
const MOD_IDS: (keyof Mods)[] = ['hit', 'evade', 'save', 'damage', 'dr', 'ap_regen', 'crit']

function cleanMods(raw: unknown): Mods | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Mods = {}
  for (const k of MOD_IDS) {
    const n = Math.round(Number((raw as Record<string, unknown>)[k]))
    if (Number.isFinite(n) && n) out[k] = Math.max(-3, Math.min(3, n))
  }
  return Object.keys(out).length ? out : undefined
}

/** 整理 PerkDef.lust：未知的欄位拿掉，數值夾在範圍內；沒有東西時回傳 undefined */
export function sanitizeLustPerk(raw: unknown): LustPerk | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: LustPerk = {}
  for (const k of NUM_KEYS) {
    const n = Number(r[k])
    if (!Number.isFinite(n) || !n) continue
    const [lo, hi] = LUST_RANGES[k]
    out[k] = Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100
  }
  for (const k of MOD_KEYS) {
    const m = cleanMods(r[k])
    if (m) out[k] = m
  }
  if (r.growth && typeof r.growth === 'object') {
    const g: NonNullable<LustPerk['growth']> = {}
    for (const k of ['lewdness', 'sensitivity', 'endurance', 'submission'] as const) {
      const n = Number((r.growth as Record<string, unknown>)[k])
      if (Number.isFinite(n) && n) g[k] = Math.round(Math.max(-1, Math.min(1, n)) * 100) / 100
    }
    if (Object.keys(g).length) out.growth = g
  }
  return Object.keys(out).length ? out : undefined
}
