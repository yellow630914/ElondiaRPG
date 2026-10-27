// 寄生物（docs/ADULT_EVENTS.md 第 6 節）：寄生裝備、淫紋（詛咒印記）、寄生種子。只有主角會有，存在角色身上（Character.parasites）。
// - 侵蝕度 0～100 決定階段（潛伏、發作、共生、支配）；各階段有很輕的被動效果（檢定加減，算在 perks.ts 的 checkModifiers）。
// - 寄生裝備鎖住它的欄位（EquippedGear.locked = parasite:<id>，不綁契約）；淫紋是刺青的一種（kind: curse），未馴服時洗不掉，
//   只有奴隸印記能把它頂掉（頂掉時沉睡，刻印師可以紋回來）；馴服之後可以自由洗掉、換掉，之後也能紋回來。
// - 馴服（任務的結局）：寄生裝備換成馴服後的物品、淫紋變成已馴服的印記；不再自動發作，可以主動觸發（parasiteEvents.ts）。
// - 成人向關閉時：不發作、沒有被動效果（寄生物還在身上）。
// 規則與定義在 data/rules/parasites.json；發作事件在 travel_events.json（scope: parasite）。

import parasitesJson from '@data/rules/parasites.json'
import { adultContent } from './content'
import { itemDef, type AttrId, type CheckFilter } from './data'
import { placeName, tattooAt, tattoosOf } from './tattoos'
import type { Character, GameTime, GearSlot, ParasiteState, Tattoo, TattooPlace } from './types'

export interface ParasiteStage {
  min: number
  name: string
  /** 這個階段發作的機率倍率 */
  chance_mult?: number
}

export interface ParasiteDef {
  name: string
  kind: 'gear' | 'mark' | 'seed'
  desc: string
  /** 寄生裝備：寄生的物品（items.json）與鎖住的欄位 */
  item?: string
  slot?: GearSlot
  /** 淫紋：刻在哪個部位、印記的名稱與外觀 */
  place?: TattooPlace
  mark?: { name: string; desc: string }
  /** 每天自己增長的侵蝕度（例如種子會長大） */
  grow_per_day?: number
  /** 各階段的被動效果（依階段的順序；每一項是一種檢定的加減） */
  stage_effects?: { check: CheckFilter; bonus: number }[][]
  /** 解咒：DC 與價錢的基準（侵蝕度越高越難、越貴）；沒有時不能解咒 */
  remove?: { dc: number; price: number }
  /** 刻印師把淫紋紋回來的價錢 */
  reink_price?: number
  /** 解咒時中止的任務線（stories.json 的 id）；連同這個前綴的劇情旗標一起清掉，之後再被寄生可以重來 */
  stories?: string[]
  flag_prefix?: string
  /** 馴服之後：物品（寄生裝備）或印記（淫紋）、主動觸發的親密場景與結果 */
  tamed?: {
    item?: string
    mark?: { name: string; desc: string; attrs?: Partial<Record<AttrId, number>>; check?: CheckFilter; bonus?: number }
    scene: string
    text: string
    /** 主動觸發之後得到的非戰鬥狀態（companions.json 的 conditions） */
    buff?: string
  }
}

export interface ParasiteRules {
  step_chance: number
  travel_chance: number
  rest_chance: number
  cooldown_hours: number
  stages: ParasiteStage[]
  /** 解咒的地方：神殿用信仰、刻印師用智力 */
  remove: Record<'temple' | 'carver', { name: string; attr: AttrId }>
  parasites: Record<string, ParasiteDef>
}

export const parasiteRules = parasitesJson as unknown as ParasiteRules

/** 寄生裝備的鎖：EquippedGear.locked 的前綴 */
export const PARASITE_LOCK = 'parasite:'

export function parasiteDef(id: string): ParasiteDef | undefined {
  return parasiteRules.parasites[id]
}

export function parasitesOf(c: Pick<Character, 'parasites'> | undefined): ParasiteState[] {
  return c?.parasites ?? []
}

export function parasiteOf(c: Pick<Character, 'parasites'> | undefined, id: string): ParasiteState | undefined {
  return parasitesOf(c).find((p) => p.id === id)
}

/** 侵蝕度對應的階段（0 潛伏 … 3 支配） */
export function stageOf(corruption: number): number {
  let s = 0
  parasiteRules.stages.forEach((st, i) => { if (corruption >= st.min) s = i })
  return s
}

export function stageName(corruption: number): string {
  return parasiteRules.stages[stageOf(corruption)]?.name ?? ''
}

/** 會發作、有被動效果的寄生物：成人向開著、沒有沉睡、還沒馴服 */
export function activeParasites(c: Pick<Character, 'parasites'> | undefined): ParasiteState[] {
  if (!adultContent()) return []
  return parasitesOf(c).filter((p) => !p.dormant && !p.tamed && parasiteDef(p.id))
}

/** 目前階段的被動效果 */
export function parasiteEffects(p: ParasiteState): { check: CheckFilter; bonus: number }[] {
  return parasiteDef(p.id)?.stage_effects?.[stageOf(p.corruption)] ?? []
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const dayOf = (t: GameTime) => t.day

/**
 * 依時間增長侵蝕度（例如種子）：上次增長之後過了幾天就加幾次。
 * 暫停時（成人向關閉、沉睡、已馴服，或 paused 說發作關掉了）只把日子往前推、不增長，恢復時不會一次補上。
 */
export function growParasites(c: Character, now: GameTime, paused?: (p: ParasiteState) => boolean) {
  const active = new Set(activeParasites(c))
  for (const p of parasitesOf(c)) {
    const last = p.grown ?? dayOf(p.since)
    const days = dayOf(now) - last
    if (days <= 0) continue
    p.grown = dayOf(now)
    if (!active.has(p) || paused?.(p)) continue
    const grow = parasiteDef(p.id)?.grow_per_day ?? 0
    if (grow) p.corruption = clamp(p.corruption + grow * days)
  }
}

/** 侵蝕度加減（沉睡、已馴服的不動）；回傳說明 */
export function changeCorruption(c: Character, id: string, delta: number): string {
  const p = parasiteOf(c, id)
  const def = parasiteDef(id)
  if (!p || !def || p.dormant || p.tamed || !delta) return ''
  const before = stageOf(p.corruption)
  p.corruption = clamp(p.corruption + delta)
  const after = stageOf(p.corruption)
  const stage = after !== before ? `，進入「${parasiteRules.stages[after]!.name}」` : ''
  return `${def.name}的侵蝕度${delta > 0 ? '上升' : '下降'}到 ${p.corruption}${stage}`
}

/**
 * 寄生：寄生裝備穿上並鎖住（原本那個欄位的東西放回行囊，由呼叫的人處理），淫紋刻在小腹（蓋掉原本的刺青，記下來）。
 * 已經有同一種寄生物、或小腹是奴隸印記時不寄生；回傳說明與換下來的裝備名稱。
 */
export function attachParasite(c: Character, id: string, time: GameTime, by?: string): { note: string; removed?: string } {
  const def = parasiteDef(id)
  if (!def) return { note: '' }
  if (parasiteOf(c, id)) return { note: `已經有${def.name}了` }
  const state: ParasiteState = { id, corruption: 0, since: { ...time }, grown: time.day }
  let removed: string | undefined
  if (def.kind === 'gear') {
    const spec = def.item ? itemDef(def.item)?.gear : undefined
    if (!spec || !def.slot) return { note: '' }
    const gear = (c.gear ??= {})
    const old = gear[def.slot]
    if (old?.locked) return { note: `${def.name}沒有地方附著（那個欄位被鎖住了）` }
    removed = old?.name
    gear[def.slot] = { name: def.item!, spec, locked: `${PARASITE_LOCK}${id}` }
  } else if (def.kind === 'mark') {
    const place = def.place ?? 'belly'
    const there = tattooAt(c, place)
    if (there?.kind === 'slave') return { note: `${def.name}刻不上去：${placeName(place)}已經有奴隸印記` }
    if (there?.kind === 'curse') return { note: `${placeName(place)}已經有另一個詛咒印記` }
    if (there) {
      c.tattoos = tattoosOf(c).filter((t) => t !== there)
      state.covered = there
    }
    ;(c.tattoos ??= []).push({ kind: 'curse', place, name: def.mark?.name ?? def.name, desc: def.mark?.desc ?? def.desc, since: { ...time }, parasite: id, ...(by ? { by } : {}) })
  }
  ;(c.parasites ??= []).push(state)
  const cover = state.covered ? `（蓋掉了原本的「${state.covered.name ?? ''}」）` : ''
  return { note: `身上多了${def.name}${cover}`, ...(removed ? { removed } : {}) }
}

/** 馴服：寄生裝備換成馴服後的物品、淫紋變成已馴服的印記；回傳說明 */
export function tameParasite(c: Character, id: string): string {
  const p = parasiteOf(c, id)
  const def = parasiteDef(id)
  if (!p || !def || p.tamed) return ''
  p.tamed = true
  p.corruption = 0
  if (def.kind === 'gear' && def.slot) {
    const g = c.gear?.[def.slot]
    const item = def.tamed?.item
    const spec = item ? itemDef(item)?.gear : undefined
    if (g?.locked === `${PARASITE_LOCK}${id}`) {
      if (spec) c.gear![def.slot] = { name: item!, spec }
      else delete g.locked
    }
  } else if (def.kind === 'mark') {
    const m = def.tamed?.mark
    const t = tattoosOf(c).find((x) => x.kind === 'curse' && x.parasite === id) ?? p.stored
    if (t && m) applyTamedMark(t, m)
  }
  return `${def.name}被馴服了`
}

function applyTamedMark(t: Tattoo, m: NonNullable<NonNullable<ParasiteDef['tamed']>['mark']>) {
  t.tamed = true
  t.name = m.name
  t.desc = m.desc
  if (m.attrs) t.attrs = { ...m.attrs }
  if (m.check && m.bonus) t.unique = { check: m.check, bonus: m.bonus }
}

/** 拿掉寄生物（解咒成功、種子產下）：寄生裝備消失、淫紋洗掉；回傳說明 */
export function detachParasite(c: Character, id: string): string {
  const p = parasiteOf(c, id)
  const def = parasiteDef(id)
  if (!p) return ''
  if (def?.kind === 'gear' && def.slot && c.gear?.[def.slot]?.locked === `${PARASITE_LOCK}${id}`) delete c.gear[def.slot]
  if (def?.kind === 'mark') c.tattoos = tattoosOf(c).filter((t) => !(t.kind === 'curse' && t.parasite === id))
  // 被淫紋蓋掉的刺青留下來，之後還能到刻印師紋回來
  if (p.covered) (c.coveredTattoos ??= []).push({ parasite: id, tattoo: p.covered })
  c.parasites = parasitesOf(c).filter((x) => x !== p)
  return `${def?.name ?? '寄生物'}離開了你的身體`
}

/**
 * 奴隸印記頂掉淫紋（tattoos.ts 的 setContract 呼叫）：未馴服的淫紋沉睡；已馴服的只是不在身上。
 * 兩種都記下來，之後可以到刻印師紋回來。
 */
export function displaceCurse(c: Character, t: Tattoo) {
  const p = t.parasite ? parasiteOf(c, t.parasite) : undefined
  if (!p) return
  p.stored = t
  if (!p.tamed) p.dormant = true
}

/** 洗掉已馴服的淫紋：記下來，之後可以紋回來 */
export function storeTamedCurse(c: Character, t: Tattoo) {
  const p = t.parasite ? parasiteOf(c, t.parasite) : undefined
  if (p) p.stored = t
}

/** 可以紋回來的印記：記下來的淫紋（部位空著、而且不是被奴隸印記佔著）與被淫紋蓋掉的刺青 */
export function reinkable(c: Character): { parasite: string; tattoo: Tattoo; kind: 'curse' | 'covered'; price: number }[] {
  const out: { parasite: string; tattoo: Tattoo; kind: 'curse' | 'covered'; price: number }[] = []
  for (const p of parasitesOf(c)) {
    const def = parasiteDef(p.id)
    if (p.stored && !tattooAt(c, p.stored.place)) out.push({ parasite: p.id, tattoo: p.stored, kind: 'curse', price: def?.reink_price ?? 500 })
    if (p.covered && !tattooAt(c, p.covered.place)) out.push({ parasite: p.id, tattoo: p.covered, kind: 'covered', price: def?.reink_price ?? 500 })
  }
  // 淫紋已經拿掉、留下來的被蓋掉的刺青（同一種寄生物還在身上、也蓋著刺青時先列它的）
  for (const k of c.coveredTattoos ?? []) {
    if (out.some((o) => o.parasite === k.parasite && o.kind === 'covered') || tattooAt(c, k.tattoo.place)) continue
    out.push({ parasite: k.parasite, tattoo: k.tattoo, kind: 'covered', price: parasiteDef(k.parasite)?.reink_price ?? 500 })
  }
  return out
}

/** 紋回來（刻印師）：回傳說明 */
export function reinkTattoo(c: Character, parasite: string, kind: 'curse' | 'covered', time: GameTime): string {
  const p = parasiteOf(c, parasite)
  const kept = kind === 'covered' && !p?.covered ? c.coveredTattoos?.find((k) => k.parasite === parasite) : undefined
  const t = kind === 'curse' ? p?.stored : (p?.covered ?? kept?.tattoo)
  if (!t || (!p && !kept)) throw new Error('沒有可以紋回來的印記')
  if (tattooAt(c, t.place)) throw new Error(`${placeName(t.place)}已經有刺青了`)
  ;(c.tattoos ??= []).push({ ...t, since: { ...time } })
  if (kept) c.coveredTattoos = c.coveredTattoos!.filter((k) => k !== kept)
  else if (kind === 'curse') {
    delete p!.stored
    delete p!.dormant
    // 沉睡的日子不算：從今天起才繼續增長
    p!.grown = time.day
  } else delete p!.covered
  return `${placeName(t.place)}重新紋上了「${t.name ?? ''}」`
}

/** 解咒的 DC 與價錢（侵蝕度越高越難、越貴） */
export function removalTerms(p: ParasiteState): { dc: number; price: number } | undefined {
  const r = parasiteDef(p.id)?.remove
  if (!r) return undefined
  return { dc: r.dc + Math.floor(p.corruption / 10), price: Math.round(r.price * (1 + p.corruption / 100)) }
}

/** 給 AI 的寄生物清單（沒有時為空字串） */
export function parasiteSummary(c: Pick<Character, 'parasites'>): string {
  return parasitesOf(c).map((p) => {
    const def = parasiteDef(p.id)
    if (!def) return ''
    // 馴服之後不再寫未馴服時的樣子（會餓、會自己動），免得 AI 照舊描寫它作亂
    if (p.tamed) return `- ${def.name}：已馴服。蠢蠢欲動，但乖乖地在等待你的指令。`
    const state = p.dormant ? '沉睡中（被奴隸印記頂掉）' : `${stageName(p.corruption)}（侵蝕度 ${p.corruption}）`
    return `- ${def.name}：${state}。${def.desc}`
  }).filter(Boolean).join('\n')
}
