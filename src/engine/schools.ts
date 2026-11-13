// 慾望流派與雙面效應（成人向；docs/LEWD_STATS.md 第 6、7 節）：
// - 流派：入門與進階特質（perks.json 的 school、lust）。流派只是特質，不限制能學的色情技能。
//   流派特質的慾望效果（PerkDef.lust）在開戰時換算（combat.ts 的 initLust）；隸從派沒有主人時一半效果。
// - 雙面效應：拘束具（底材的 bind、bind_kind）平常是檢定減值；修了流派、鎖上時，戰鬥中反轉成增益。
// - 鎖：拘束具要鎖上（自己用鎖、或主人強制戴上的），戰鬥增益才生效；鎖越好倍率越高。
// 規則與數值在 data/rules/lewd.json 的 schools、servitude、two_face、locks。

import { BIND_KINDS, lewdRules, type BindKind, type KeyCustodyCaps, type LewdSchool, type LockGrade, type LustPerk, type Mods } from './data'
import { gearRules } from './gear'
import { lewdPowerOf } from './lewd'
import { PARASITE_LOCK } from './parasites'
import { matches, perksOf, type CheckCtx } from './perks'
import { contractOf } from './tattoos'
import type { Character, EquippedGear, GameState, GearSlot } from './types'
import { gameRule } from './gameRules'

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

/** 流派給的戰鬥技能（lewd.json 的 schools.*.abilities；不佔攜帶上限）：進階的要有進階特質，有等級的要到那個等級 */
export function schoolAbilities(c: Character): string[] {
  const own = new Set(perksOf(c).map((p) => p.id))
  const out: string[] = []
  // 獸蟲派：苗床的卵孵化認主學會的技能
  if (schoolsOf(c).includes('beast')) out.push(...(c.hatched ?? []))
  for (const id of schoolsOf(c)) {
    const d = schoolDef(id)!
    for (const a of d.abilities ?? []) {
      if (a.advanced && !own.has(d.advanced)) continue
      if (a.level && c.level < a.level) continue
      out.push(a.id)
    }
  }
  return [...new Set(out)].filter((x) => !c.abilities.includes(x))
}

/** 獸蟲派的宿主加成：身上每有一隻活著、沒有沉睡的寄生物或苗床，host.mods 再一份，每項最多 max（有進階特質時 advanced_max） */
export function hostMods(c: Character): Mods {
  const out: Mods = {}
  for (const id of schoolsOf(c)) {
    const d = schoolDef(id)!
    if (!d.host) continue
    const n = (c.parasites ?? []).filter((p) => !p.dormant).length
    if (!n) continue
    const advanced = perksOf(c).some((p) => p.id === d.advanced)
    const max = advanced ? d.host.advanced_max ?? d.host.max : d.host.max
    for (const [k, v] of Object.entries(d.host.mods)) {
      const total = Math.min(max, (v ?? 0) * n)
      if (total) out[k as keyof Mods] = Math.max(out[k as keyof Mods] ?? 0, total)
    }
  }
  return out
}

/** 有主人（奴隸契約上有主人；認主） */
export function hasMaster(c: Character): boolean {
  return !!contractOf(c)?.master
}

// ---- 流派特質的慾望效果 ----

export interface LustTotals {
  max: number; taken: number; self: number; convert: number; burst: number; relief: number; crit_convert: number; regen: number; calm: number; floor: number
  climax_heal: number; exposure: number; exposure_level: number; endurance_max: number; sensitivity_bonus: number
  growth: Partial<Record<'lewdness' | 'sensitivity' | 'endurance' | 'submission', number>>
  wounded: Mods; master: Mods; bound: Mods; bound_max: number
}

const NUM_KEYS = ['max', 'taken', 'self', 'convert', 'burst', 'relief', 'crit_convert', 'regen', 'calm', 'floor', 'climax_heal', 'exposure', 'exposure_level', 'endurance_max', 'sensitivity_bonus', 'bound_max'] as const
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
    max: 0, taken: 0, self: 0, convert: 0, burst: 0, relief: 0, crit_convert: 0, regen: 0, calm: 0, floor: 0, climax_heal: 0, exposure: 0, exposure_level: 0,
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
    // 裝上的鎖 → 物品自帶的鎖 → 主人的預設鎖
    const lock = g.lock ?? g.spec.lock ?? masterLock
    // 物品自己的程度蓋過底材的（GearSpec.bind）
    out.push({ slot: slot as GearSlot, name: g.name, kind: base.bind_kind, bind: Math.max(1, Math.min(3, Math.round(g.spec.bind ?? base.bind))), ...(lock ? { lock } : {}) })
  }
  return out
}

/** 拘束具平常的檢定減值（每件一行）：符合 checks 才算，每 endurance_per 點忍耐減輕 1 */
export function bindModifiers(c: Character, ctx: CheckCtx): { label: string; value: number }[] {
  const binds = bindsOf(c)
  if (!binds.length) return []
  const r = lewdRules.two_face
  const ease = Math.floor(lewdPowerOf(c).endurance / r.endurance_per)
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

// ---- 鑰匙保管（docs/LEWD_STATS.md 第 7 節；lewd.json 的 locks.key_custody） ----

/** 自己鎖上的拘束具的鑰匙在哪：自己留著、交給同伴、交給主人、丟掉了 */
export type KeyCustody = 'self' | 'companion' | 'master' | 'discarded'

export const KEY_CUSTODY_NAME: Record<KeyCustody, string> = { self: '自己留著', companion: '交給同伴保管', master: '交給主人保管', discarded: '丟掉了' }

/** 自己鎖上的拘束具的鑰匙在哪（wearer 是戴著的人：鑰匙在他的主人手上算「主人」）；不是自己鎖上的是 undefined */
export function keyCustody(g: EquippedGear | undefined, wearer?: Pick<Character, 'tattoos'>): KeyCustody | undefined {
  if (!g?.lock || g.locked || !g.keyHolder) return undefined
  if (g.keyHolder === 'self' || g.keyHolder === 'discarded') return g.keyHolder
  return wearer && contractOf(wearer)?.master === g.keyHolder ? 'master' : 'companion'
}

/** 這個拘束類型的戰鬥增益會加的項目（三個程度的戰鬥表合起來；先攻寫 initiative） */
export function bindKindKeys(kind: BindKind): string[] {
  const keys: string[] = []
  for (const row of lewdRules.two_face.kinds[kind]?.combat ?? []) for (const k of Object.keys(row ?? {})) if (!keys.includes(k)) keys.push(k)
  return keys
}

/** 鑰匙保管提高的點數裡，這一項用哪個數字：先攻 init、行動點回復 ap、其他 stat */
const custodyAmount = (key: string, x: KeyCustodyCaps) => (key === 'initiative' ? x.init : key === 'ap_regen' ? x.ap : x.stat) ?? 0

export interface CustodyCaps {
  /** 每一項上限提高的點數（Mods 的 key；先攻寫 initiative） */
  raise: Record<string, number>
  /** 提高上限的拘束具：名稱、鑰匙在哪、提高了哪幾項（每一項只記最好的那件） */
  from: { name: string; custody: KeyCustody; servitude?: boolean; keys: string[] }[]
}

/**
 * 鑰匙保管讓這個人雙面效應上限提高的點數：每件自己鎖上、鑰匙交給別人或丟掉的拘束具，
 * 只提高自己拘束類型相關的那幾項（例：眼罩只提高迴避），同一項只算最好的一件（不會疊加）。
 * 修了隸從派、鑰匙在自己的主人手上時再加 servitude_master
 */
export function custodyCaps(c: Character): CustodyCaps {
  const r = lewdRules.locks.key_custody
  const raise: Record<string, number> = {}
  const winner: Record<string, number> = {}
  const items: { name: string; custody: KeyCustody; servitude?: boolean }[] = []
  const servitude = schoolsOf(c).includes('servitude')
  for (const g of Object.values(c.gear ?? {})) {
    const kind = keyCustody(g, c)
    const base = kind && kind !== 'self' ? r?.[kind] : undefined
    const bindKind = g ? gearRules.bases[g.spec.base]?.bind_kind : undefined
    if (!g || !kind || !base || !gearRules.bases[g.spec.base]?.bind || !bindKind || !BIND_KINDS.includes(bindKind)) continue
    const extra = kind === 'master' && servitude ? r.servitude_master : undefined
    const idx = items.push({ name: g.name, custody: kind, ...(extra ? { servitude: true } : {}) }) - 1
    for (const key of bindKindKeys(bindKind)) {
      const n = custodyAmount(key, base) + (extra ? custodyAmount(key, extra) : 0)
      if (n > (raise[key] ?? 0)) {
        raise[key] = n
        winner[key] = idx
      }
    }
  }
  const from = items
    .map((x, i) => ({ ...x, keys: Object.keys(winner).filter((k) => winner[k] === i) }))
    .filter((x) => x.keys.length)
  return { raise, from }
}

export interface TwoFace {
  mods: Mods
  initiative: number
  immune: string[]
  /** 有效的拘束具（修了流派、鎖上的）：名稱與倍率 */
  active: { name: string; kind: BindKind; mult: number }[]
  /** 還沒套上全身上限的加總（畫面上寫在括號裡） */
  raw: Mods
  rawInitiative: number
  /** 這個人的全身上限（存檔規則） */
  caps: { stat: number; ap: number; init: number }
  /** 鑰匙保管提高之後的那幾項上限（沒提高的項目照 caps） */
  keyCaps: Record<string, number>
  /** 鑰匙保管提高的上限（沒有時沒有） */
  custody?: CustodyCaps
}

/** 雙面效應的戰鬥增益：修了任何流派、而且鎖上的拘束具才算；全身加總照存檔規則封頂（沒給 state 時用預設的上限），鑰匙交給別人或丟掉時那件拘束具相關的項目上限提高 */
export function twoFaceCombat(c: Character, state?: Pick<GameState, 'options'> | null): TwoFace {
  // 全身上限：存檔規則（0 表示那幾項沒有增益，鑰匙保管也不會打開）＋鑰匙保管提高的
  const custody = custodyCaps(c)
  const caps = { stat: gameRule(state, 'bindCapStat'), ap: gameRule(state, 'bindCapAp'), init: gameRule(state, 'bindCapInit') }
  const baseCap = (key: string) => (key === 'initiative' ? caps.init : key === 'ap_regen' ? caps.ap : caps.stat)
  const keyCaps: Record<string, number> = {}
  for (const [key, n] of Object.entries(custody.raise)) if (baseCap(key) > 0) keyCaps[key] = baseCap(key) + n
  const capOf = (key: string) => keyCaps[key] ?? baseCap(key)
  const out: TwoFace = { mods: {}, initiative: 0, immune: [], active: [], raw: {}, rawInitiative: 0, caps, keyCaps, ...(custody.from.length ? { custody } : {}) }
  const schools = schoolsOf(c)
  if (!schools.length) return out
  for (const b of bindsOf(c)) {
    const mult = bindMult(c, b, schools)
    if (!mult) continue
    const k = lewdRules.two_face.kinds[b.kind]
    const row = k.combat[b.bind - 1] ?? {}
    for (const [key, v] of Object.entries(row)) {
      // 每件無條件捨去（1 × 1.56 不會變成 2）
      const n = Math.trunc((v ?? 0) * mult)
      if (!n) continue
      if (key === 'initiative') out.initiative += n
      else out.mods[key as keyof Mods] = (out.mods[key as keyof Mods] ?? 0) + n
    }
    // 免疫只在程度 3（docs/LEWD_STATS.md 第 22 節的表）
    if (b.bind >= 3) for (const s of k.immune ?? []) if (!out.immune.includes(s)) out.immune.push(s)
    out.active.push({ name: b.name, kind: b.kind, mult: Math.round(mult * 100) / 100 })
  }
  // 全身合計的上限（存檔規則 bindCapStat、bindCapAp、bindCapInit，鑰匙保管再提高）：穿再多件也不會一直疊
  out.raw = { ...out.mods }
  out.rawInitiative = out.initiative
  for (const [k, v] of Object.entries(out.mods)) {
    const c = capOf(k)
    if ((v ?? 0) > c) out.mods[k as keyof Mods] = c
  }
  out.initiative = Math.min(capOf('initiative'), out.initiative)
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
  const value = Math.max(0, Math.min(r.penalty_max, n * r.penalty_per) - Math.floor(lewdPowerOf(c).endurance / r.endurance_per))
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
  max: [-30, 30], taken: [-0.5, 0.5], self: [-0.5, 1], convert: [0, 0.5], burst: [0, 0.5], relief: [-0.5, 1], crit_convert: [0, 1], regen: [0, 10], calm: [0, 0.2], floor: [-0.5, 0.5],
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
