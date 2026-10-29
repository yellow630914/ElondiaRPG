// 特質（被動，data/rules/perks.json，見 docs/PERKS.md）：
// - 角色身上一直生效的能力：檢定加值（依屬性、情境、行動種類、對象的標籤）、戰鬥修正、抗性與增傷。
// - 所有檢定都透過 checkModifiers 取得加減（非戰鬥狀態 + 特質），日誌與判定資料會逐條列出。
// - 取得：建立角色時任選（也能自訂）；之後由升級、事件、特殊任務、訓練、物品提供「機會」（PerkOffer），
//   從提供的特質選一個，或寫一段說法擲骰交給 AI 判斷（見 actions.ts 的 perk_pitch）。也可能失去。
// - 缺陷（flaw）：負的效果。建立角色時最多選兩個、每個換一個一般特質的名額；事件直接給（不是機會），
//   受訓或事件的 lose_perk 克服。AI 設計的特質不能是缺陷。

import { activeParasites, parasiteDef, parasiteEffects, stageName } from './parasites'
import {
  actionRules, ATTR_IDS, attrName, choosablePerks, damageTypeName, isChoosablePerk, npcTags, perkDef, perkRules, type ActionKind, type AffinityMap, type AttrId, type CheckContext, type CheckFilter, type Degree, type Mods,
  type PerkDef, type PerkEffect,
  mulResist,
} from './data'
import { gearRules } from './gear'
import { conditionModifiers } from './party'
import { Rng as RngImpl, type Rng } from './rng'
import type { Character, PerkOffer, Report } from './types'

/** 有特質的角色（隊員、NPC 的角色資料）；有種族時一併算種族特質 */
export type PerkHolder = Pick<Character, 'perks' | 'customPerks'> & { race?: string }

/** 這次檢定是什麼：情境、主動行動的種類、屬性、對象的標籤 */
export interface CheckCtx {
  context: CheckContext
  kind?: ActionKind
  attr?: AttrId
  vsTags?: string[]
}

/** 種族特質（原本的種族天賦）：依種族自動擁有，不寫進存檔 */
export function racePerks(race: string | undefined): PerkDef[] {
  return race ? perkRules.perks.filter((p) => p.race === race) : []
}

/** 角色身上所有的特質（種族的、清單裡的、自訂的） */
export function perksOf(c: PerkHolder): PerkDef[] {
  const own = (c.perks ?? []).map(perkDef).filter((p): p is PerkDef => !!p && !p.race)
  return [...racePerks(c.race), ...own, ...(c.customPerks ?? [])]
}

export function hasPerk(c: PerkHolder, id: string): boolean {
  return !!c.perks?.includes(id) || !!c.customPerks?.some((p) => p.id === id)
}

export function matches(f: CheckFilter, ctx: CheckCtx): boolean {
  if (f.attrs?.length && (!ctx.attr || !f.attrs.includes(ctx.attr))) return false
  if (f.contexts?.length && !f.contexts.includes(ctx.context)) return false
  if (f.kinds?.length && (!ctx.kind || !f.kinds.includes(ctx.kind))) return false
  if (f.vs_tags?.length && !f.vs_tags.some((t) => ctx.vsTags?.includes(t))) return false
  return true
}

/** 特質對這次檢定的加減（每個特質一行） */
export function perkModifiers(c: PerkHolder, ctx: CheckCtx): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = []
  for (const p of perksOf(c)) {
    let value = 0
    for (const e of p.effects) if ('check' in e && matches(e.check, ctx)) value += e.bonus
    if (value) out.push({ label: `${p.flaw ? '缺陷' : '特質'}【${p.name}】`, value })
  }
  return out
}

/** 身上獨特裝備的檢定加值（每件一行；同樣的加值可以疊加） */
export function gearCheckModifiers(c: Pick<Character, 'gear'>, ctx: CheckCtx): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = []
  for (const g of Object.values(c.gear ?? {})) {
    const u = g?.spec.unique
    if (u && matches(u.check, ctx)) out.push({ label: `獨特裝備【${g!.name}】`, value: u.bonus })
  }
  return out
}

/** 寄生物的被動效果（目前階段）與已馴服的印記的檢定加值 */
export function parasiteCheckModifiers(c: Pick<Character, 'parasites' | 'tattoos'>, ctx: CheckCtx): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = []
  for (const p of activeParasites(c)) {
    for (const e of parasiteEffects(p)) if (matches(e.check, ctx)) out.push({ label: `寄生【${parasiteDef(p.id)!.name}・${stageName(p.corruption)}】`, value: e.bonus })
  }
  for (const t of c.tattoos ?? []) if (t.kind === 'curse' && t.tamed && t.unique && matches(t.unique.check, ctx)) out.push({ label: `印記【${t.name ?? ''}】`, value: t.unique.bonus })
  return out
}

/** 檢定的情境修正：非戰鬥狀態 + 特質 + 獨特裝備 + 寄生物與印記（正數是加值） */
export function checkModifiers(c: Character, ctx: CheckCtx): { label: string; value: number }[] {
  return [...conditionModifiers(c, ctx.attr), ...perkModifiers(c, ctx), ...gearCheckModifiers(c, ctx), ...parasiteCheckModifiers(c, ctx)].filter((x) => x.value !== 0)
}

/** 檢定的情境修正總和 */
export function checkBonus(c: Character, ctx: CheckCtx): number {
  return checkModifiers(c, ctx).reduce((sum, x) => sum + x.value, 0)
}

/** 情境修正寫成一段說明（例：「（受罰 -2、特質【識途老馬】+2）」），沒有時是空字串 */
export function modifierNote(mods: { label: string; value: number }[]): string {
  return mods.length ? `（${mods.map((m) => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join('、')}）` : ''
}

/** 特質帶進戰鬥的修正、抗性與增傷 */
export function perkCombat(c: PerkHolder): { mods: Mods; resist: AffinityMap; offense: AffinityMap } {
  const mods: Mods = {}
  const resist: AffinityMap = {}
  const offense: AffinityMap = {}
  for (const p of perksOf(c)) {
    for (const e of p.effects) {
      if ('combat' in e) for (const [k, v] of Object.entries(e.combat)) mods[k as keyof Mods] = (mods[k as keyof Mods] ?? 0) + (v ?? 0)
      if ('resist' in e) mulResist(resist, e.resist)
      if ('offense' in e) for (const [k, v] of Object.entries(e.offense)) offense[k] = (offense[k] ?? 0) + (v ?? 0)
    }
  }
  return { mods, resist, offense }
}

// ---- 強度：AI 設計的特質不能比提供的強太多 ----

/** 檢定加值適用的範圍有多廣（全部檢定 4；一個屬性 1.5；一種情境 0.75；一種行動或標籤 0.5；不同欄位取最窄的） */
function breadth(f: CheckFilter): number {
  const parts = [
    f.attrs?.length ? f.attrs.length * 1.5 : undefined,
    f.contexts?.length ? f.contexts.length * 0.75 : undefined,
    f.kinds?.length ? f.kinds.length * 0.5 : undefined,
    f.vs_tags?.length ? f.vs_tags.length * 0.5 : undefined,
  ].filter((x): x is number => x !== undefined)
  return parts.length ? Math.min(4, ...parts) : 4
}

/** 效果的強度：好處是正的，壞處（負的加值、弱點）是負的 */
function effectPower(e: PerkEffect): number {
  if ('check' in e) return e.bonus * breadth(e.check)
  if ('combat' in e) {
    // 戰鬥修正比照附魔的點數，再加倍（一直生效）；仇恨不算
    return Object.entries(e.combat).reduce((s, [k, v]) => s + (k === 'threat' ? 0 : (v ?? 0) * (gearRules.enchant_costs[k] ?? 1) * 2), 0)
  }
  if ('resist' in e) return Object.values(e.resist).reduce((s: number, v) => s - (v ?? 0) * 4, 0)
  return Object.values(e.offense).reduce((s: number, v) => s + (v ?? 0) * 4, 0)
}

/** 特質的強度（約略）：比較用；缺陷是負的（大約抵銷一個一般特質） */
/** 能在野外紮營長休（camp）算的強度：省下旅店的錢、不用回城就能補滿 */
const CAMP_POWER = 3

export function perkPower(p: Pick<PerkDef, 'effects'> & Pick<Partial<PerkDef>, 'camp'>): number {
  return Math.round((p.effects.reduce((s, e) => s + effectPower(e), 0) + (p.camp ? CAMP_POWER : 0)) * 2) / 2
}

// ---- 自訂特質 ----

const CONTEXTS = Object.keys(perkRules.contexts) as CheckContext[]
const MOD_KEYS: (keyof Mods)[] = ['hit', 'evade', 'save', 'damage', 'dr', 'ap_regen', 'crit']

function clampInt(v: unknown, [lo, hi]: [number, number]): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo
}

function strList<T extends string>(v: unknown, allowed?: readonly T[]): T[] {
  return (Array.isArray(v) ? v : []).filter((x): x is T => typeof x === 'string' && x.length <= 40 && (!allowed || allowed.includes(x as T))).slice(0, 8)
}

/** 特質效果的數值範圍（自訂特質用 perks.json 的 custom；內容編輯器另有較寬的範圍） */
export interface PerkLimits {
  effects: number
  check_bonus: [number, number]
  combat: [number, number]
  resist: [number, number]
  /** 造成的傷害倍率加成；沒有時不收 offense 效果 */
  offense?: [number, number]
  /** 仇恨倍率；沒有時不收 threat */
  threat?: [number, number]
}

/** 整理特質的效果：未知的欄位拿掉，數值夾在範圍內；檢定加值與戰鬥修正的正負號不在範圍內的拿掉（不翻成另一邊），0 也拿掉 */
export function cleanPerkEffects(raw: unknown, c: PerkLimits): PerkEffect[] {
  const effects: PerkEffect[] = []
  const quarter = (v: unknown, [lo, hi]: [number, number]) => Math.round(Math.max(lo, Math.min(hi, Number(v) || 0)) * 4) / 4
  for (const e of (Array.isArray(raw) ? raw : []) as Record<string, unknown>[]) {
    if (effects.length >= c.effects || !e || typeof e !== 'object') continue
    if (e.check && typeof e.check === 'object') {
      const f = e.check as Record<string, unknown>
      const check: CheckFilter = {}
      const attrs = strList(f.attrs, ATTR_IDS)
      const contexts = strList(f.contexts, CONTEXTS)
      const kinds = strList<ActionKind>(f.kinds)
      const tags = strList(f.vs_tags)
      if (attrs.length) check.attrs = attrs
      if (contexts.length) check.contexts = contexts
      if (kinds.length) check.kinds = kinds
      if (tags.length) check.vs_tags = tags
      const n = Number(e.bonus)
      if (n && (n > 0 ? c.check_bonus[1] > 0 : c.check_bonus[0] < 0)) {
        const bonus = clampInt(n, c.check_bonus)
        if (bonus) effects.push({ check, bonus })
      }
    } else if (e.combat && typeof e.combat === 'object') {
      const mods: Mods = {}
      for (const k of MOD_KEYS) {
        const v = (e.combat as Record<string, unknown>)[k]
        // 正負號不在範圍內的（例如一般特質的負值）拿掉，不翻成另一邊
        const n = Number(v)
        if (v !== undefined && n && (n > 0 ? c.combat[1] > 0 : c.combat[0] < 0)) {
          const m = clampInt(n, c.combat)
          if (m) mods[k] = m
        }
      }
      const t = (e.combat as Record<string, unknown>).threat
      if (c.threat && t !== undefined && Number(t)) mods.threat = Math.round(Math.max(c.threat[0], Math.min(c.threat[1], Number(t))) * 100) / 100
      if (Object.keys(mods).length) effects.push({ combat: mods })
    } else if (e.resist && typeof e.resist === 'object') {
      const resist: AffinityMap = {}
      for (const [k, v] of Object.entries(e.resist as Record<string, unknown>).slice(0, 4)) {
        const n = quarter(v, c.resist)
        if (n && damageTypeName(k) !== k) resist[k] = n
      }
      if (Object.keys(resist).length) effects.push({ resist })
    } else if (c.offense && e.offense && typeof e.offense === 'object') {
      const offense: AffinityMap = {}
      for (const [k, v] of Object.entries(e.offense as Record<string, unknown>).slice(0, 4)) {
        const n = quarter(v, c.offense)
        if (n && damageTypeName(k) !== k) offense[k] = n
      }
      if (Object.keys(offense).length) effects.push({ offense })
    }
  }
  return effects
}

/**
 * 整理自訂（玩家輸入、AI 設計）的特質：名稱、描述、效果都夾在 perks.json 的 custom 範圍內。
 * maxPower：強度上限（AI 設計的特質）；超過時從最後一個效果開始減弱、拿掉。
 * allowFlaw：可以是缺陷（建立角色時自訂）；缺陷只收負的效果（custom.flaw 的範圍）。AI 設計的特質不能是缺陷。
 */
export function sanitizePerk(raw: unknown, id: string, maxPower?: number, allowFlaw = false): PerkDef | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<PerkDef> & { effects?: unknown }
  const c = perkRules.custom
  const name = String(r.name ?? '').trim().slice(0, c.name_chars)
  if (!name) return undefined
  const flaw = allowFlaw && r.flaw === true
  const effects = cleanPerkEffects(r.effects, flaw ? { effects: c.effects, ...c.flaw } : c)
  if (!effects.length) return undefined
  // 強度上限：從最後一個效果開始減弱
  while (maxPower !== undefined && perkPower({ effects }) > maxPower && effects.length) {
    // 先把最強的效果減弱一級（檢定加值 -1、戰鬥修正 -1），都減不動了才拿掉最後一個
    const weakenable = effects
      .map((e, i) => ({ e, i, p: effectPower(e) }))
      .filter(({ e }) => ('check' in e && e.bonus > 1) || ('combat' in e && Object.values(e.combat).some((v) => (v ?? 0) > 1)))
      .sort((a, b) => b.p - a.p)[0]
    if (weakenable) {
      const e = weakenable.e
      if ('check' in e) e.bonus -= 1
      else if ('combat' in e) {
        const k = (Object.keys(e.combat) as (keyof Mods)[]).find((x) => (e.combat[x] ?? 0) > 1)!
        e.combat[k] = (e.combat[k] ?? 0) - 1
      }
    } else effects.pop()
  }
  if (!effects.length) return undefined
  return { id, name, desc: String(r.desc ?? '').trim().slice(0, c.desc_chars) || describeEffects(effects), effects, ...(flaw ? { flaw: true } : {}), custom: true }
}

/** 效果寫成一段說明（自訂的特質沒寫描述時用） */
const COMBAT_NAME: Record<string, string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊', threat: '仇恨' }
export function describeEffects(effects: PerkEffect[]): string {
  const scope = (f: CheckFilter) => {
    const parts = [
      f.attrs?.length ? `${f.attrs.map(attrName).join('、')}檢定` : '',
      f.contexts?.length ? f.contexts.map((x) => perkRules.contexts[x] ?? x).join('、') : '',
      f.kinds?.length ? f.kinds.map((k) => actionRules.kinds[k]?.name ?? k).join('、') : '',
      f.vs_tags?.length ? `對${f.vs_tags.map((t) => npcTags.tags[t]?.name ?? t).join('、')}的檢定` : '',
    ].filter(Boolean)
    return parts.length ? parts.join('・') : '所有檢定'
  }
  return effects.map((e) => {
    if ('check' in e) return `${scope(e.check)} ${e.bonus >= 0 ? '+' : ''}${e.bonus}`
    if ('combat' in e) return `戰鬥${Object.entries(e.combat).map(([k, v]) => `${COMBAT_NAME[k] ?? k} ${(v ?? 0) >= 0 ? '+' : ''}${v}`).join('、')}`
    if ('resist' in e) return Object.entries(e.resist).map(([k, v]) => `${damageTypeName(k)}傷害 ×${1 + (v ?? 0)}`).join('、')
    return Object.entries(e.offense).map(([k, v]) => `造成的${damageTypeName(k)}傷害 ×${1 + (v ?? 0)}`).join('、')
  }).join('；') + '。'
}

// ---- 取得與失去 ----

function record(report: Report | undefined, c: Character, p: PerkDef, added: boolean) {
  if (report) (report.changes.perks ??= []).push({ actor: c.id, perk: p.id, name: p.name, added })
}

/** 學會特質（清單裡的 id，或自訂的特質）；已經有了就略過。回傳學會的特質 */
export function grantPerk(c: Character, perk: string | PerkDef, report?: Report): PerkDef | undefined {
  const def = typeof perk === 'string' ? perkDef(perk) : perk
  // 種族特質是依種族自動擁有的，不能另外給
  if (!def || def.race || hasPerk(c, def.id)) return undefined
  if (def.custom || typeof perk !== 'string') (c.customPerks ??= []).push({ ...def, custom: true })
  else (c.perks ??= []).push(def.id)
  record(report, c, def, true)
  return def
}

/** 失去特質 */
export function losePerk(c: Character, id: string, report?: Report): PerkDef | undefined {
  const def = perksOf(c).find((p) => p.id === id)
  // 種族特質不會失去
  if (!def || def.race) return undefined
  c.perks = (c.perks ?? []).filter((x) => x !== id)
  c.customPerks = (c.customPerks ?? []).filter((x) => x.id !== id)
  record(report, c, def, false)
  return def
}

/** 還能學的清單特質：沒有的、條件符合、不互斥 */
export function learnablePerks(c: Character): PerkDef[] {
  const own = perksOf(c)
  return choosablePerks().filter((p) => {
    if (hasPerk(c, p.id) || p.flaw) return false
    if (p.requires?.races?.length && !p.requires.races.includes(c.race)) return false
    if (p.requires?.classes?.length && !p.requires.classes.includes(c.class)) return false
    if (own.some((o) => o.exclusive?.includes(p.id) || p.exclusive?.includes(o.id))) return false
    return true
  })
}

/** 新的取得特質的機會（options 會去掉已經有的；缺陷不是機會，見 effects 的 perk） */
export function offerPerks(c: Character, source: string, options: string[], pitch = true): PerkOffer | undefined {
  const usable = [...new Set(options)].filter((id) => isChoosablePerk(id) && !perkDef(id)?.flaw && !hasPerk(c, id))
  if (!usable.length && !pitch) return undefined
  const n = (c.perkOffers ?? []).reduce((m, o) => Math.max(m, Number(o.id.split('-')[1]) || 0), 0) + 1
  const offer: PerkOffer = { id: `po-${n}`, source, options: usable, ...(pitch ? { pitch: true } : {}) }
  ;(c.perkOffers ??= []).push(offer)
  return offer
}

/** 升級時：到了 perks.json 的 levelup.levels 就給一次三選一（可以寫說法交給 AI） */
export function levelUpPerkOffer(c: Character, level: number, rng: Rng): PerkOffer | undefined {
  if (!perkRules.levelup.levels.includes(level)) return undefined
  const pool = [...learnablePerks(c)]
  const picks: string[] = []
  while (picks.length < perkRules.levelup.choices && pool.length) picks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!.id)
  return offerPerks(c, `升到 ${level} 級`, picks)
}

/** 從機會裡選一個特質 */
export function takeOffer(c: Character, offerId: string, perkId: string, report?: Report): PerkDef {
  const offer = c.perkOffers?.find((o) => o.id === offerId)
  if (!offer) throw new Error('沒有這個機會')
  if (!offer.options.includes(perkId)) throw new Error('不能選這個特質')
  const def = grantPerk(c, perkId, report)
  if (!def) throw new Error('已經有這個特質了')
  c.perkOffers = (c.perkOffers ?? []).filter((o) => o.id !== offerId)
  return def
}

/** 放棄這次機會 */
export function dropOffer(c: Character, offerId: string) {
  c.perkOffers = (c.perkOffers ?? []).filter((o) => o.id !== offerId)
}

/** 這次機會的說法可以強到多少：提供的特質最強的強度 + 成功程度的加減（至少 1） */
export function pitchCap(offer: PerkOffer, delta: number): number {
  const base = Math.max(1, ...offer.options.map((id) => perkPower(perkDef(id) ?? { effects: [] })))
  return Math.max(1, base + delta)
}

// ---- NPC ----

/**
 * NPC 生成時抽特質：依 perks.json 的 npc.chances 決定有幾個（第一個、第二個的機率），
 * 每個特質的權重是 npc.weight，NPC 有對應的標籤或職業時權重加乘。
 */
export function rollNpcPerks(rng: Rng, who: { tags?: string[]; class?: string; race?: string }): string[] {
  const r = perkRules.npc
  const out: string[] = []
  const pick = (flaw: boolean): string | undefined => {
    const pool = choosablePerks()
      .filter((p) => !out.includes(p.id) && !!p.flaw === flaw && (p.npc?.weight ?? 0) > 0)
      .filter((p) => (!p.requires?.races?.length || p.requires.races.includes(who.race ?? '')) && (!p.requires?.classes?.length || p.requires.classes.includes(who.class ?? '')))
      .filter((p) => !out.some((o) => perkDef(o)?.exclusive?.includes(p.id) || p.exclusive?.includes(o)))
      .map((p) => {
        let w = p.npc!.weight!
        if (p.npc?.tags?.some((t) => who.tags?.includes(t))) w *= r.tag_mult
        if (who.class && p.npc?.classes?.includes(who.class)) w *= r.class_mult
        return { id: p.id, w }
      })
    const total = pool.reduce((s, x) => s + x.w, 0)
    if (!total) return undefined
    let roll = rng.next() * total
    return (pool.find((x) => (roll -= x.w) < 0) ?? pool[pool.length - 1]!).id
  }
  for (const chance of r.chances) {
    if (!rng.chance(chance)) break
    const id = pick(false)
    if (!id) break
    out.push(id)
  }
  // 缺陷另外抽（在一般特質之後擲，不影響原本抽到的特質）
  if (rng.chance(r.flaw_chance ?? 0)) {
    const id = pick(true)
    if (id) out.push(id)
  }
  return out
}

/** NPC 的特質：資料裡指定的，沒有時依 id 固定地抽（同一個人一直是同樣的特質，不動到遊戲的亂數） */
export function npcPerksOf(rec: { id: string; perks?: string[]; tags?: string[]; class?: string; race?: string }): string[] {
  if (rec.perks) return rec.perks.filter(isChoosablePerk)
  let h = 2166136261
  for (const ch of `${rec.id}:perks`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return rollNpcPerks(new RngImpl(h), rec)
}

/** 特質的名字清單（給 AI 與畫面）；缺陷標明 */
export function perkNames(c: PerkHolder): string {
  return perksOf(c).map((p) => `${p.name}（${p.flaw ? '缺陷：' : ''}${p.desc}）`).join('；')
}

// ---- 建立角色：缺陷換名額 ----

export interface CreationPerks {
  /** 選了幾個缺陷、幾個一般特質（種族特質不算） */
  flaws: number
  normal: number
  /** 一般特質的名額（null = 不限） */
  slots: number | null
  error?: string
}

/** 建立角色時選的特質：缺陷最多 creation.max_flaws 個，每個多 slots_per_flaw 個一般特質的名額 */
export function creationPerks(picked: Pick<PerkDef, 'flaw' | 'race'>[]): CreationPerks {
  const r = perkRules.creation
  const own = picked.filter((p) => !p.race)
  const flaws = own.filter((p) => p.flaw).length
  const normal = own.length - flaws
  const slots = r.slots > 0 ? r.slots + Math.min(flaws, r.max_flaws) * r.slots_per_flaw : null
  const error = flaws > r.max_flaws ? `缺陷最多選 ${r.max_flaws} 個`
    : slots !== null && normal > slots ? `一般特質最多 ${slots} 個（每選一個缺陷多 ${r.slots_per_flaw} 個名額）` : undefined
  return { flaws, normal, slots, ...(error ? { error } : {}) }
}

/** 照建立角色的規則整理：多的缺陷、超過名額的一般特質從後面拿掉 */
export function fitCreationPerks<T extends Pick<PerkDef, 'flaw' | 'race'>>(picked: T[]): T[] {
  const flaws = picked.filter((x) => x.flaw && !x.race).slice(0, perkRules.creation.max_flaws)
  const slots = creationPerks(flaws).slots
  const normal = picked.filter((x) => !x.flaw && !x.race)
  const keep = new Set([...flaws, ...(slots === null ? normal : normal.slice(0, slots))])
  return picked.filter((p) => keep.has(p))
}

// ---- 訓練：在設施花錢、花時間學（主動行動 train） ----

/** 這一格可以學的特質（perks.json 的 train.cells） */
export function trainablePerks(c: Character, cell: string): PerkDef[] {
  return learnablePerks(c).filter((p) => p.train?.cells.includes(cell))
}

/** 這一格可以克服的缺陷（身上有、而且 train.cells 有這一格） */
export function overcomablePerks(c: Character, cell: string): PerkDef[] {
  return perksOf(c).filter((p) => p.flaw && !p.race && p.train?.cells.includes(cell))
}

/** 受訓的費用：大成功打對折，失敗收一半，大失敗照收 */
export function trainingFee(price: number, degree: Degree): number {
  return degree === 'critical' ? Math.round(price / 2) : degree === 'fail' ? Math.round(price / 2) : price
}

// ---- 說法：在取得特質的機會上，寫一段說法交給 AI（主動行動 perk_pitch） ----

/** target：「隊員 id:機會 id」 */
export function parsePitchTarget(target?: string): { member: string; offer: string } {
  const [member, offer] = (target ?? '').split(':')
  if (!member || !offer) throw new Error('要選一個取得特質的機會')
  return { member, offer }
}

export function pitchTarget(member: string, offer: string): string {
  return `${member}:${offer}`
}

// ---- 分類（建角時依分類折疊） ----

export const PERK_CATEGORIES: Record<string, string> = {
  social: '社交與交易', explore: '探索與潛行', combat: '戰鬥', body: '體質', craft: '學識與技藝', bond: '主從與束縛', other: '其他',
}

const SOCIAL_KINDS = ['chat', 'gift', 'flatter', 'haggle', 'bargain', 'intimidate', 'bluff', 'hire', 'invite', 'rest_talk', 'black_market', 'patron']
const EXPLORE_CONTEXTS = ['trap', 'lock', 'travel', 'road', 'stealth', 'retreat']
const BOND_KINDS = ['escape', 'negotiate', 'marking', 'master_permit', 'master_leave', 'master_event', 'unmark']
const CRAFT_KINDS = ['craft', 'make', 'produce', 'invent', 'work']

/** 特質的分類：寫了就用，否則依第一個效果推斷（戰鬥修正→戰鬥、抗性與增傷→體質、檢定看屬性、情境與行動） */
export function perkCategory(p: Pick<PerkDef, 'category' | 'effects'>): string {
  if (p.category && PERK_CATEGORIES[p.category]) return p.category
  for (const e of p.effects) {
    if ('combat' in e) return 'combat'
    if ('resist' in e || 'offense' in e) return 'body'
    const c = e.check
    if (c.kinds?.some((k) => BOND_KINDS.includes(k)) || c.contexts?.includes('master_event')) return 'bond'
    if (c.kinds?.some((k) => SOCIAL_KINDS.includes(k)) || c.contexts?.some((x) => x === 'negotiation' || x === 'gate') || c.vs_tags?.length || c.attrs?.includes('cha')) return 'social'
    if (c.contexts?.some((x) => EXPLORE_CONTEXTS.includes(x)) || c.kinds?.includes('steal')) return 'explore'
    if (c.contexts?.includes('initiative') || c.contexts?.includes('save')) return 'combat'
    if (c.kinds?.some((k) => CRAFT_KINDS.includes(k)) || c.contexts?.includes('quest') || c.attrs?.length) return 'craft'
  }
  return 'other'
}
