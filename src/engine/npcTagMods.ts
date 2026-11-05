// 身分標籤的自訂內容（docs/CONTENT_EDITOR.md 3.7 節；R20 的 C6）：NPC 與主角共用的身分（旅人、商人、貴族……）。
// 編輯器開放通用欄位：名稱、emoji、給 AI 的描述、NPC 生成（普通人或冒險者、權重、出沒、職業、財富、聚落類型）、
// 主角能不能選、互斥，以及主角帶著時的效果。內建標籤寫死的特殊行為（略過聲望、互動 DC 修正、不會在野外動手、
// 犯罪的額外聲望、職業倍率、只在某區域、出沒的地點數）保留內建的值、不開放編輯；自建標籤沒有這些。

import { cleanPerkEffects } from './perks'
import { itemRules, npcTags, npcs, perkRules, shopRules, stories, type CheckFilter, type NpcKind, type NpcTagDef, type PcTagEffects } from './data'
import { travelEvents } from './road'
import { allMasterEvents } from './masterEventMods'
import type { GameState } from './types'

/** 編輯器存的身分標籤：通用欄位（自建的是整份，內建的照內建合併） */
export interface NpcTagMod {
  name: string
  emoji: string
  kinds: NpcKind[]
  ai_hint: string
  wealth: number
  commoner_weight?: number
  adventurer_chance?: number
  extra_chance?: number
  location_types?: string[]
  zone_weights?: Record<string, number>
  occupations?: string[]
  exclusive?: string[]
  /** false：主角不能選 */
  player?: boolean
  pc_effects?: Omit<PcTagEffects, 'bypass_reputation'>
  custom?: boolean
}

/** 編輯器開放的欄位（其他欄位只有內建標籤有，套用時沿用內建的值） */
export const EDITABLE_KEYS = ['name', 'emoji', 'kinds', 'ai_hint', 'wealth', 'commoner_weight', 'adventurer_chance', 'extra_chance', 'location_types', 'zone_weights', 'occupations', 'exclusive', 'player', 'pc_effects'] as const

export const TAG_KINDS: NpcKind[] = ['commoner', 'adventurer']
export const TAG_LOCATION_TYPES = ['capital', 'city', 'town', 'port', 'village', 'outpost', 'fortress'] as const
/** NPC 出沒的區域（npc_tags.json 的 zone_weights） */
export const TAG_ZONES: Record<string, string> = { town: '城區', outskirts: '近郊', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', dungeon: '地下城' }

export const TAG_LIMITS = {
  name_chars: 8, emoji_chars: 4, hint_chars: 120, pc_hint_chars: 80, occupation_chars: 12, occupations: 16, checks: 6,
  wealth: [0, 5], commoner_weight: [0, 100], chance: [0, 1], zone_weight: [0, 5],
  price_mult: [0.5, 1.5], exposure_mult: [0, 3], slave_price_mult: [0.5, 3], lust_resist: [-0.5, 0.5], check_bonus: [-3, 3],
} as const

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown, [lo, hi]: readonly [number, number]): number | undefined => {
  const n = Number(v)
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? undefined : Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100
}

/** 整理一個身分標籤（內容編輯器、匯入）：數值夾在範圍內、不認得的欄位拿掉；known 是認得的標籤 id（互斥用） */
export function sanitizeNpcTagMod(raw: Partial<NpcTagMod> | undefined, custom: boolean, known: Set<string> = new Set(Object.keys(npcTags.tags))): NpcTagMod {
  const r = raw ?? {}
  const kinds = TAG_KINDS.filter((k) => (r.kinds ?? []).includes(k))
  const out: NpcTagMod = {
    name: str(r.name, TAG_LIMITS.name_chars) || '新的身分',
    emoji: str(r.emoji, TAG_LIMITS.emoji_chars) || '🏷️',
    kinds: kinds.length ? kinds : ['commoner'],
    ai_hint: str(r.ai_hint, TAG_LIMITS.hint_chars),
    wealth: num(r.wealth, TAG_LIMITS.wealth) ?? 1,
  }
  const cw = num(r.commoner_weight, TAG_LIMITS.commoner_weight)
  if (cw !== undefined) out.commoner_weight = cw
  const ac = num(r.adventurer_chance, TAG_LIMITS.chance)
  if (ac !== undefined) out.adventurer_chance = ac
  const ex = num(r.extra_chance, TAG_LIMITS.chance)
  if (ex) out.extra_chance = ex
  const lt = TAG_LOCATION_TYPES.filter((t) => (r.location_types ?? []).includes(t))
  if (lt.length) out.location_types = [...lt]
  const zw = Object.fromEntries(Object.keys(TAG_ZONES).map((z) => [z, num(r.zone_weights?.[z], TAG_LIMITS.zone_weight) ?? 0] as const).filter(([, v]) => v > 0)) as Record<string, number>
  if (Object.keys(zw).length) out.zone_weights = zw
  const occ = [...new Set((Array.isArray(r.occupations) ? r.occupations : []).map((x) => str(x, TAG_LIMITS.occupation_chars)).filter(Boolean))].slice(0, TAG_LIMITS.occupations)
  if (occ.length) out.occupations = occ
  const excl = [...new Set((Array.isArray(r.exclusive) ? r.exclusive : []).filter((x): x is string => typeof x === 'string' && known.has(x)))]
  if (excl.length) out.exclusive = excl
  if (r.player === false) out.player = false
  const pe = r.pc_effects
  if (pe && typeof pe === 'object') {
    const e: NonNullable<NpcTagMod['pc_effects']> = {}
    const checks = cleanPerkEffects((Array.isArray(pe.checks) ? pe.checks : []).map((c) => ({ check: c?.check ?? {}, bonus: c?.bonus })), { effects: TAG_LIMITS.checks, check_bonus: [...TAG_LIMITS.check_bonus], combat: [0, 0], resist: [0, 0], offense: [0, 0] } as never)
      .filter((x): x is { check: CheckFilter; bonus: number } => 'check' in x)
    if (checks.length) e.checks = checks
    const mult = (k: 'buy_mult' | 'sell_mult' | 'service_mult', lim: readonly [number, number]) => {
      const v = num(pe[k], lim)
      if (v !== undefined && v !== 1) e[k] = v
    }
    mult('buy_mult', TAG_LIMITS.price_mult)
    mult('sell_mult', TAG_LIMITS.price_mult)
    mult('service_mult', TAG_LIMITS.price_mult)
    const exp = num(pe.exposure_mult, TAG_LIMITS.exposure_mult)
    if (exp !== undefined && exp !== 1) e.exposure_mult = exp
    const sp = num(pe.slave_price_mult, TAG_LIMITS.slave_price_mult)
    if (sp !== undefined && sp !== 1) e.slave_price_mult = sp
    const lr = num(pe.lust_resist, TAG_LIMITS.lust_resist)
    if (lr) e.lust_resist = lr
    const hint = str(pe.hint, TAG_LIMITS.pc_hint_chars)
    if (hint) e.hint = hint
    if (Object.keys(e).length) out.pc_effects = e
  }
  if (custom) out.custom = true
  return out
}

/** 一個標籤的可編輯部分（編輯器打開時、比較有沒有改過） */
export function editableOf(def: NpcTagDef): NpcTagMod {
  const out = Object.fromEntries(EDITABLE_KEYS.filter((k) => def[k] !== undefined).map((k) => [k, JSON.parse(JSON.stringify(def[k]))])) as unknown as NpcTagMod
  if (out.pc_effects && 'bypass_reputation' in out.pc_effects) delete (out.pc_effects as PcTagEffects).bypass_reputation
  return out
}

/** 套用：內建的標籤照內建的值，只換掉可編輯的欄位（略過聲望這種寫死的效果保留）；自建的整份 */
export function mergeNpcTag(builtin: NpcTagDef | undefined, mod: NpcTagMod): NpcTagDef {
  const own = Object.fromEntries(Object.entries(mod).filter(([k]) => k !== 'custom')) as unknown as NpcTagDef
  if (!builtin) return own
  const base = JSON.parse(JSON.stringify(builtin)) as NpcTagDef
  for (const k of EDITABLE_KEYS) delete (base as unknown as Record<string, unknown>)[k]
  const merged = { ...base, ...own }
  if (builtin.pc_effects?.bypass_reputation) merged.pc_effects = { ...(merged.pc_effects ?? {}), bypass_reputation: true }
  return merged
}

export function newNpcTag(): NpcTagMod {
  return { name: '新的身分', emoji: '🏷️', kinds: ['commoner'], ai_hint: '', wealth: 1, commoner_weight: 5, pc_effects: { checks: [{ check: { skills: ['persuade'] }, bonus: 1 }] }, custom: true }
}

const hasTag = (f: CheckFilter | undefined, id: string) => !!f?.vs_tags?.includes(id)

/** 條件裡「主角的身分標籤」（pc_tags）有沒有這個標籤：任務、事件的條件散在不同結構裡，遞迴找 */
function mentionsPcTag(v: unknown, id: string): boolean {
  if (!v || typeof v !== 'object') return false
  if (Array.isArray(v)) return v.some((x) => mentionsPcTag(x, id))
  for (const [k, x] of Object.entries(v)) {
    if (k === 'pc_tags' && Array.isArray(x) && x.includes(id)) return true
    if (mentionsPcTag(x, id)) return true
  }
  return false
}

/** 哪些地方用到這個標籤：固定 NPC、特質與物品的「對象的標籤」、商店的店主、任務與事件的條件、其他標籤的互斥、目前的存檔 */
export function npcTagUsage(id: string, state?: GameState | null): string[] {
  const out: string[] = []
  for (const n of npcs) if (n.tags?.includes(id)) out.push(`固定 NPC「${n.name}」`)
  for (const p of perkRules.perks) {
    if (p.effects.some((e) => 'check' in e && hasTag(e.check, id)) || p.npc?.tags?.includes(id)) out.push(`特質「${p.name}」`)
  }
  for (const i of itemRules.items) if (hasTag(i.gear?.unique?.check, id)) out.push(`物品「${i.name}」的檢定加值`)
  for (const [t, def] of Object.entries(shopRules.types)) if (def.keeper?.tags?.includes(id)) out.push(`商店「${def.name ?? t}」的店主`)
  for (const s of stories) if (mentionsPcTag(s, id)) out.push(`特殊任務「${s.title}」的條件`)
  for (const e of travelEvents.templates) if (mentionsPcTag(e, id)) out.push(`事件「${e.title}」的條件`)
  for (const { def } of allMasterEvents()) if (mentionsPcTag(def, id)) out.push(`主奴與娼館的事件「${def.id}」的條件`)
  for (const [t, def] of Object.entries(npcTags.tags)) if (t !== id && def.exclusive?.includes(id)) out.push(`身分標籤「${def.name}」的互斥`)
  if (state) {
    if (state.party.some((m) => m.isPlayer && (m as { tags?: string[] }).tags?.includes(id))) out.push('目前存檔的主角')
    const n = Object.values(state.npcs ?? {}).filter((r: { tags?: string[] }) => r.tags?.includes(id)).length
    if (n) out.push(`目前存檔裡的 ${n} 位 NPC`)
  }
  return [...new Set(out)]
}
