// 寄生物的自訂內容（內容頁籤「🐛 寄生物」；docs/ADULT_EVENTS.md 第 6 節、docs/CONTENT_EDITOR.md）：
// 內建的三種可以改名字、描述、數值、馴服的效果（不能改種類）；也可以新增自建的（id 用 mod_par_ 開頭）。
// 分類：可馴服（任務線的結局把它馴服，之後可以主動觸發）、短期寄生（長得快，長到最後由發作事件把它拿掉，沒有馴服）。
// 雙面效應（lewd.json 的 parasite_two_face.parasites）跟著每一種寄生物一起編輯（two_face）。
// 寄生物會引用物品、技能、非戰鬥狀態與特殊任務：整理時給已知的清單（同一個包裡新增的也算），不存在的拿掉。

import { ATTR_IDS, SKILL_IDS, abilities, itemDef, lewdRules, perkDef, perkRules, stories, type AttrId, type CheckContext, type CheckFilter } from './data'
import { SLOTS } from './gear'
import { parasiteRules, type BroodDef, type BroodKind, type ParasiteDef } from './parasites'
import { isTattooPlace } from './tattoos'
import type { GearSlot, TattooPlace } from './types'

export type ParasiteCategory = 'tameable' | 'short' | 'brood'
export const PARASITE_CATEGORY_NAME: Record<ParasiteCategory, string> = { tameable: '可馴服', short: '短期寄生', brood: '苗床' }
export const PARASITE_KIND_NAME: Record<ParasiteDef['kind'], string> = { gear: '寄生裝備', mark: '淫紋', seed: '種子' }

/** 雙面效應的一個階段：戰鬥修正與造成的慾望（lust_bonus） */
export type TwoFaceRow = { hit?: number; evade?: number; save?: number; damage?: number; dr?: number; lust_bonus?: number }
export const TWO_FACE_KEYS = ['hit', 'evade', 'save', 'damage', 'dr', 'lust_bonus'] as const
export const TWO_FACE_NAME: Record<(typeof TWO_FACE_KEYS)[number], string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', lust_bonus: '造成的慾望' }

export interface ParasiteMod extends ParasiteDef {
  category: ParasiteCategory
  /** 雙面效應：各階段的戰鬥修正（沒有時沒有） */
  two_face?: TwoFaceRow[]
  custom?: true
}

export const PARASITE_LIMITS = {
  name_chars: 16, desc_chars: 200, scene_chars: 400, text_chars: 200, mark_name_chars: 16,
  grow: [0, 50], effects: 4, bonus: [-5, 5], abilities: 3, lust: [0, 1], dc: [8, 30], price: [0, 100000],
  mark_attr: [-3, 3], mark_bonus: [0, 5], stories: 12, two_face: [-5, 5],
} as const

/** 已知的物品、技能、非戰鬥狀態、特殊任務（同一個包裡新增、還沒登錄的也算） */
export interface ParasiteRefs {
  item?: (name: string) => boolean
  ability?: (id: string) => boolean
  condition?: (id: string) => boolean
  story?: (id: string) => boolean
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const int = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n))) : d
}
const dec = (v: unknown, [lo, hi]: readonly [number, number]) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100 : 0
}
const CONTEXTS = Object.keys(perkRules.contexts) as CheckContext[]
const STAGES = () => parasiteRules.stages.length

/** 內建的寄生物與雙面效應（模組載入時的快照） */
const snapshot = { parasites: clone(parasiteRules.parasites), twoFace: clone(lewdRules.parasite_two_face?.parasites ?? {}) }

export function builtinParasite(id: string): ParasiteMod | undefined {
  const d = snapshot.parasites[id]
  if (!d) return undefined
  const tf = snapshot.twoFace[id] as TwoFaceRow[] | undefined
  return { ...clone(d), category: parasiteCategory(d), ...(tf ? { two_face: clone(tf) } : {}) }
}

/** 寄生物的分類：資料寫了就照寫的；沒寫時有馴服的效果是可馴服，否則是短期寄生 */
export function parasiteCategory(d: Pick<ParasiteDef, 'tamed'> & { category?: ParasiteCategory }): ParasiteCategory {
  return d.category === 'tameable' || d.category === 'short' || d.category === 'brood' ? d.category : d.tamed ? 'tameable' : 'short'
}

export function isCustomParasiteId(id: string): boolean {
  return /^mod_par_[a-z0-9_]{1,24}$/.test(id)
}

/** 一組檢定篩選：屬性、情境、行動種類、對象的標籤 */
function checkFilter(v: unknown): CheckFilter {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : {}
  const list = <T extends string>(x: unknown, allowed?: readonly T[]) => [...new Set((Array.isArray(x) ? x : []).filter((s): s is T => typeof s === 'string' && s.length <= 40 && (!allowed || allowed.includes(s as T))))].slice(0, 8)
  const skills = list(o.skills, SKILL_IDS)
  const attrs = list(o.attrs, ATTR_IDS)
  const contexts = list(o.contexts, CONTEXTS)
  const kinds = list(o.kinds)
  const tags = list(o.vs_tags)
  return { ...(skills.length ? { skills } : {}), ...(attrs.length ? { attrs } : {}), ...(contexts.length ? { contexts } : {}), ...(kinds.length ? { kinds: kinds as CheckFilter['kinds'] } : {}), ...(tags.length ? { vs_tags: tags } : {}) }
}

/** 各階段一個陣列，補齊到階段數、多的拿掉 */
function perStage<T>(v: unknown, each: (x: unknown) => T): T[] {
  const arr = Array.isArray(v) ? v : []
  return Array.from({ length: STAGES() }, (_, i) => each(arr[i]))
}

/**
 * 整理一種寄生物。內建的照內建的種類（不能改），自建的 id 要 mod_par_ 開頭。
 * 寄生裝備要有穿得上的物品與欄位、淫紋要有部位與印記；不合規則時丟出錯誤（整筆不收）。
 */
export function sanitizeParasiteMod(id: string, raw: Partial<ParasiteMod>, refs: ParasiteRefs = {}): ParasiteMod {
  const L = PARASITE_LIMITS
  const base = snapshot.parasites[id]
  if (!base && !isCustomParasiteId(id)) throw new Error('自建的寄生物 id 要用 mod_par_ 開頭（英文小寫、數字、底線）')
  const known = {
    item: refs.item ?? ((n: string) => !!itemDef(n)),
    ability: refs.ability ?? ((x: string) => !!abilities[x]),
    condition: refs.condition ?? (() => true),
    story: refs.story ?? ((x: string) => stories.some((s) => s.id === x)),
  }
  const kind: ParasiteDef['kind'] = base?.kind ?? (raw.kind === 'gear' || raw.kind === 'mark' ? raw.kind : 'seed')
  const category: ParasiteCategory = raw.category === 'tameable' || raw.category === 'short' || raw.category === 'brood' ? raw.category : parasiteCategory(raw)
  const out: ParasiteMod = {
    name: str(raw.name, L.name_chars) || base?.name || '新的寄生物',
    kind,
    category,
    desc: str(raw.desc, L.desc_chars) || base?.desc || '',
  }
  if (kind === 'gear') {
    const item = str(raw.item, 40)
    const slot = raw.slot as GearSlot | undefined
    if (!item || !known.item(item)) throw new Error('寄生裝備要選一件存在的裝備（物品）')
    if (!slot || !SLOTS.includes(slot)) throw new Error('寄生裝備要選鎖住的欄位')
    out.item = item
    out.slot = slot
  } else if (kind === 'mark') {
    out.place = (isTattooPlace(raw.place) ? raw.place : 'belly') as TattooPlace
    const name = str(raw.mark?.name, L.mark_name_chars) || out.name
    out.mark = { name, desc: str(raw.mark?.desc, L.desc_chars) || out.desc }
  }
  const grow = int(raw.grow_per_day, L.grow, 0)
  if (grow) out.grow_per_day = grow
  // 各階段的被動效果：檢定加減（不能是 0）
  const effects = perStage(raw.stage_effects, (x) => (Array.isArray(x) ? x : [])
    .map((e: { check?: unknown; bonus?: unknown }) => ({ check: checkFilter(e?.check), bonus: int(e?.bonus, L.bonus, 0) }))
    .filter((e) => e.bonus).slice(0, L.effects))
  if (effects.some((e) => e.length)) out.stage_effects = effects
  const abil = perStage(raw.stage_abilities, (x) => [...new Set((Array.isArray(x) ? x : []).filter((a): a is string => typeof a === 'string' && known.ability(a)))].slice(0, L.abilities))
  if (abil.some((a) => a.length)) out.stage_abilities = abil
  const lust = perStage(raw.stage_lust, (x) => dec(x, L.lust))
  if (lust.some((n) => n)) out.stage_lust = lust
  // 受孕倍率（docs/FAMILY.md 第 3 節）：侵蝕度從多少開始、倍率（1 = 沒有效果，不存）
  if (raw.fertility && typeof raw.fertility === 'object') {
    const mult = Math.round(Math.max(0, Math.min(5, Number(raw.fertility.mult) || 1)) * 100) / 100
    if (mult !== 1) out.fertility = { min: int(raw.fertility.min, [0, 100], 0), mult }
  }
  if (raw.remove && typeof raw.remove === 'object') out.remove = { dc: int(raw.remove.dc, L.dc, 14), price: int(raw.remove.price, L.price, 1000) }
  // 刻印師把淫紋紋回來的價錢（沒寫是 500；寫了照寫，0 是免費）
  if (raw.reink_price !== undefined && raw.reink_price !== null && Number.isFinite(Number(raw.reink_price))) out.reink_price = int(raw.reink_price, L.price, 500)
  // 苗床（docs/FAMILY.md 第 13 節）：種類、產下的物品、胎生的幼體、寄生共生的特質
  if (category === 'brood') {
    const b = raw.brood && typeof raw.brood === 'object' ? raw.brood : undefined
    const bk: BroodKind = b?.kind === 'live' || b?.kind === 'parasite' ? b.kind : 'egg'
    const range = (r: unknown, lo: number, hi: number): [number, number] => {
      const a = Array.isArray(r) ? r : []
      const x = int(a[0], [lo, hi], lo)
      return [x, Math.max(x, int(a[1], [lo, hi], x))]
    }
    const yields = (Array.isArray(b?.yields) ? b!.yields : []).filter((y) => y && typeof y.item === 'string' && known.item(y.item.trim()))
      .map((y) => ({ item: y.item.trim(), qty: range(y.qty, 1, 20) })).slice(0, 3)
    const brood: BroodDef = { kind: bk, ...(bk !== 'live' && yields.length ? { yields } : {}) }
    if (bk === 'live') {
      const o = b?.offspring
      brood.offspring = { name: str(o?.name, 20) || '魔物的幼體', count: range(o?.count, 1, 6), value_cc: int(o?.value_cc, [0, 5000], 50) }
    }
    if (bk === 'parasite' && typeof b?.symbiosis === 'string' && perkDef(b.symbiosis)) brood.symbiosis = b.symbiosis
    out.brood = brood
  }
  const st = [...new Set((Array.isArray(raw.stories) ? raw.stories : []).filter((s): s is string => typeof s === 'string' && known.story(s)))].slice(0, L.stories)
  if (st.length) out.stories = st
  const prefix = str(raw.flag_prefix, 25)
  if (/^[a-z0-9_]{1,24}_$/.test(prefix)) out.flag_prefix = prefix
  // 馴服之後：只有可馴服的才有
  if (category === 'tameable' && raw.tamed && typeof raw.tamed === 'object') {
    const t = raw.tamed
    const scene = str(t.scene, L.scene_chars)
    const text = str(t.text, L.text_chars)
    if (scene && text) {
      const tamed: NonNullable<ParasiteDef['tamed']> = { scene, text }
      if (kind === 'gear' && t.item && known.item(str(t.item, 40))) tamed.item = str(t.item, 40)
      if (kind === 'mark' && t.mark && typeof t.mark === 'object') {
        const m = t.mark
        const mark: NonNullable<NonNullable<ParasiteDef['tamed']>['mark']> = { name: str(m.name, L.mark_name_chars) || out.mark?.name || out.name, desc: str(m.desc, L.desc_chars) }
        const attrs = Object.fromEntries(ATTR_IDS.map((a) => [a, int(m.attrs?.[a], L.mark_attr, 0)]).filter(([, v]) => v)) as Partial<Record<AttrId, number>>
        if (Object.keys(attrs).length) mark.attrs = attrs
        const bonus = int(m.bonus, L.mark_bonus, 0)
        if (bonus) {
          mark.check = checkFilter(m.check)
          mark.bonus = bonus
        }
        tamed.mark = mark
      }
      if (t.buff && known.condition(str(t.buff, 40))) tamed.buff = str(t.buff, 40)
      if (t.ability && known.ability(str(t.ability, 40))) tamed.ability = str(t.ability, 40)
      out.tamed = tamed
    }
  }
  // 雙面效應：各階段的戰鬥修正（整數）
  const tf = perStage(raw.two_face, (x) => {
    const o = x && typeof x === 'object' ? x as Record<string, unknown> : {}
    return Object.fromEntries(TWO_FACE_KEYS.map((k) => [k, int(o[k], L.two_face, 0)]).filter(([, v]) => v)) as TwoFaceRow
  })
  if (tf.some((r) => Object.keys(r).length)) out.two_face = tf
  if (!base) out.custom = true
  return out
}

/** 套用一種寄生物（定義與雙面效應） */
export function applyParasiteMod(id: string, m: ParasiteMod) {
  const { custom: _c, two_face, ...def } = clone(m)
  parasiteRules.parasites[id] = def as ParasiteDef
  const tf = lewdRules.parasite_two_face
  if (tf) {
    if (two_face) tf.parasites[id] = two_face
    else delete tf.parasites[id]
  }
}

/** 還原成內建的寄生物與雙面效應（自建的拿掉） */
export function restoreParasites() {
  for (const k of Object.keys(parasiteRules.parasites)) delete parasiteRules.parasites[k]
  Object.assign(parasiteRules.parasites, clone(snapshot.parasites))
  const tf = lewdRules.parasite_two_face
  if (tf) {
    for (const k of Object.keys(tf.parasites)) delete tf.parasites[k]
    Object.assign(tf.parasites, clone(snapshot.twoFace))
  }
}

/** 編輯器用：目前的樣子（內建的含改過的內容） */
export function currentParasite(id: string): ParasiteMod | undefined {
  const d = parasiteRules.parasites[id]
  if (!d) return undefined
  const tf = lewdRules.parasite_two_face?.parasites[id] as TwoFaceRow[] | undefined
  return { ...clone(d), category: parasiteCategory(d as ParasiteDef & { category?: ParasiteCategory }), ...(tf ? { two_face: clone(tf) } : {}), ...(snapshot.parasites[id] ? {} : { custom: true as const }) }
}

export function newParasite(): ParasiteMod {
  return {
    name: '新的寄生物', kind: 'seed', category: 'short', desc: '', grow_per_day: 30,
    stage_effects: perStage([], () => []), remove: { dc: 12, price: 400 }, custom: true,
  }
}
