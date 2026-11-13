// NPC 自己的日子（docs/NPC_SYSTEM.md「NPC 自己的日子」）：玩家在乎的冒險者，不在隊上時也會成長。
//
// - 誰：玩家「關注」的人、留在家裡或寄放在酒館的夥伴、離隊的夥伴（角色資料存在 NpcRecord.character），
//   以及好感達到 AFFINITY_MIN 的冒險者。要有戰鬥職業；死了、敵對、被制伏、在隊上的不算。
// - 什麼時候：每 X 天（設定，預設 3）擲一次；跨過幾次就擲幾次（最多 MAX_CATCH_UP 次，再久的直接跳過）。
//   用「角色 id＋那一次的日子」的固定亂數：回退、重讀都一樣。
// - 擲什麼：這段時間去了哪裡做什麼（一定有）；升級（上限是主角的等級，落後越多越容易升：levelUpChance；固定 NPC 不升級）、換一件武器或護甲、
//   受了點傷去休養（只是近況，不影響什麼，隨時可以找他）。
// - 近況記在 state.npcLife.news（每人最多 NEWS_KEEP 則）：規則寫的短句，AI 開啟時另外潤飾成一段（story）。
//   交給 AI 的人際關係裡附上最近的近況（social.ts 的 formatContext），重逢時 AI 會知道。
// 引擎不讀設定：畫面套用設定時呼叫 setNpcLife。

import { gainXp, recalc, xpToNext } from './character'
import { classDef, dungeonEncounters, enemies, geography, itemDef, locationById, npcs as namedNpcs, parkPlaza } from './data'
import { gearName, gearPrice, generateLoadout, syncGear } from './gear'
import { characterFor, hashString, inLeadEvent, npcRecord, registerNpc } from './npcs'
import { isNoncombatant } from './party'
import { Rng } from './rng'
import { attributeRules, lewdRules, namedNpcById } from './data'
import { addItem } from './state'
import { tagsAllowed } from './content'
import { addLewdStat, lewdOf, npcLewd } from './lewd'
import { addEncounter, sexRecordOf, sexRecordsOn, storyVirginIds } from './sexRecord'
import { locationOpen } from './storyFlags'
import type { Character, EquippedGear, GameState, GearSlot, NpcLifeState, NpcNews, NpcRecord } from './types'

export type { NpcLifeState, NpcNews }

/** 好感到這裡的冒險者也算在乎的人（不用手動關注） */
export const AFFINITY_MIN = 30
/** 每人保留幾則近況 */
export const NEWS_KEEP = 6
/** 一次最多補擲幾次（離開很久再回來：太久之前的直接跳過） */
export const MAX_CATCH_UP = 10

// ---- 設定（畫面呼叫） ----

let enabled = true
let everyDays = 3
/** NPC 的私生活可以和別人發生關係（設定的總開關；人際關係裡還要個別打開） */
let pairsAllowed = true
/** 和主角的親密度到這個值以上的人只會自慰，不和別人發生關係（設定，-100～101；101 = 親密度滿了也會出軌） */
let loyalAffinity: number | undefined

/** 「專情」門檻的範圍：-100～101（101 比親密度上限 100 還高，等於沒有限制） */
export const LOYAL_MIN = -100
export const LOYAL_MAX = 101

export function setNpcLife(opts: { on?: boolean; days?: number; pairs?: boolean; loyal?: number }) {
  if (opts.on !== undefined) enabled = opts.on
  if (opts.days !== undefined && Number.isFinite(opts.days)) everyDays = Math.max(1, Math.min(30, Math.round(opts.days)))
  if (opts.pairs !== undefined) pairsAllowed = opts.pairs
  if (opts.loyal !== undefined && Number.isFinite(opts.loyal)) loyalAffinity = Math.max(LOYAL_MIN, Math.min(LOYAL_MAX, Math.round(opts.loyal)))
}

export function npcPairsOn(): boolean {
  return pairsAllowed
}

export function npcLifeOn(): boolean {
  return enabled
}

export function npcLifeDays(): number {
  return everyDays
}

// ---- 誰 ----

function lifeOf(state: GameState): NpcLifeState {
  return (state.npcLife ??= { last: state.time.day, news: {} })
}

export function isFollowed(state: GameState, id: string): boolean {
  return !!state.npcLife?.followed?.includes(id)
}

/** 關注／取消關注（冒險者才能關注） */
export function setFollowed(state: GameState, id: string, on: boolean) {
  const rec = npcRecord(state, id)
  if (on && (!rec || !canLive(rec))) throw new Error('只有冒險者會自己成長')
  const life = lifeOf(state)
  const list = new Set(life.followed ?? [])
  if (on) list.add(id)
  else list.delete(id)
  life.followed = [...list]
  if (!life.followed.length) delete life.followed
}

/** 有戰鬥職業的冒險者（普通人、無法戰鬥的不算） */
export function canLive(rec: NpcRecord): boolean {
  const cls = rec.character?.class ?? rec.class
  return !!cls && !isNoncombatant({ class: cls })
}

/** 現在會自己成長的人 */
export function livingNpcs(state: GameState): NpcRecord[] {
  const ids = new Set([
    ...Object.keys(state.relationships ?? {}),
    ...(state.npcLife?.followed ?? []),
    ...Object.values(state.npcs ?? {}).filter((r) => r.character).map((r) => r.id),
  ])
  const inParty = new Set(state.party.map((m) => m.id))
  const out: NpcRecord[] = []
  for (const id of ids) {
    // 在線索事件裡登場、等主角去的人：事件發生或過期之前不擲
    if (inParty.has(id) || state.captives?.npcs.includes(id) || inLeadEvent(state, id)) continue
    const rec = npcRecord(state, id)
    if (!rec || rec.dead || rec.hostile || !canLive(rec)) continue
    const cared = isFollowed(state, id) || !!rec.character || (state.relationships?.[id]?.affinity ?? 0) >= AFFINITY_MIN
    if (cared) out.push(rec)
  }
  return out
}

// ---- 擲骰 ----

/**
 * 時間過了：每 X 天替會自己成長的人擲一次。回傳這次新增近況的人（id）。
 * 第一次呼叫只記下今天（不補擲遊戲開始以前的日子）
 */
export function tickNpcLife(state: GameState): string[] {
  // 這一輪的成人向事件：同一天已經和別人在一起過的 NPC 不再被挑成對象；被挑成對象的人也算有新的近況
  const ctx: LustCtx = { paired: new Set(), touched: new Set() }
  // 關掉的期間不算：打開時從那天開始數，不補擲關掉的那段日子
  if (!enabled) {
    if (state.npcLife) state.npcLife.last = state.time.day
    return []
  }
  const first = !state.npcLife
  const life = lifeOf(state)
  if (first) return []
  const changed = new Set<string>()
  let rolls = 0
  while (state.time.day - life.last >= everyDays) {
    if (rolls >= MAX_CATCH_UP) {
      life.last = state.time.day
      break
    }
    life.last += everyDays
    rolls++
    ctx.paired.clear()
    const living = livingNpcs(state)
    for (const rec of living) {
      if (rollOnce(state, rec, life.last, ctx)) changed.add(rec.id)
    }
    // 其他認識的人（普通人、親密度不夠的冒險者）：只擲成人向的私生活，有事才記近況
    const livingIds = new Set(living.map((r) => r.id))
    for (const rec of knownNpcs(state)) {
      if (livingIds.has(rec.id)) continue
      const part = rollLust(state, rec, life.last, ctx)
      if (!part) continue
      pushNews(state, rec.id, { day: life.last, text: `${part.text}。`, adult: part.adult })
      changed.add(rec.id)
    }
  }
  for (const id of ctx.touched) changed.add(id)
  return [...changed]
}

const ACTIVITIES = ['討伐魔物', '接了護衛委託', '探索', '找委託做', '和人組隊打獵']
const RESTS = ['受了點傷', '扭傷了腳', '連日奔波累倒了']

function isFixed(id: string): boolean {
  return namedNpcs.some((n) => n.id === id)
}

/** 存檔裡的紀錄（固定 NPC 還沒登場時先複製進存檔，不改到內容資料） */
function storedRecord(state: GameState, rec: NpcRecord): NpcRecord {
  return state.npcs?.[rec.id] ?? registerNpc(state, JSON.parse(JSON.stringify(rec)) as NpcRecord)
}

/** 曾經是隊員的人（雇用過、留守或寄放）：身上的裝備是玩家給的，升級的選擇留給玩家 */
export function wasCompanion(state: GameState, rec: NpcRecord): boolean {
  return !!rec.staying || state.recruited.includes(rec.id)
}

/** 地下城最上面一層的怪物等級（周邊，沒有周邊時淺層）：比 NPC 高太多的不去 */
export function dungeonEntryLevel(id: string): number | undefined {
  const e = dungeonEncounters[id]
  const groups = e?.outskirts?.length ? e.outskirts : e?.shallow
  const levels = (groups ?? []).flat().map(([enemy]) => enemies[enemy]?.level).filter((l): l is number => typeof l === 'number')
  return levels.length ? Math.min(...levels) : undefined
}

/** 入口的怪物最多比 NPC 高幾級 */
export const DUNGEON_LEVEL_SLACK = 1

/** 會去的地下城：劇情條件成立（還沒出現的歷史裂縫不去）、不是主題園區（緋夢樂園）、入口的怪物不比他高太多 */
function dungeonFits(state: GameState, id: string, level: number): boolean {
  if (!locationOpen(state, id) || parkPlaza(id)) return false
  const entry = dungeonEntryLevel(id)
  return entry !== undefined && entry <= level + DUNGEON_LEVEL_SLACK
}

/** 去了哪裡：同一個地區的地下城（合他的等級的）或城鎮 */
function placeFor(state: GameState, rng: Rng, rec: NpcRecord): { name: string; dungeon: boolean } {
  const home = rec.location ? geography.locations.find((l) => l.id === rec.location) : undefined
  const region = home?.region
  const level = rec.character?.level ?? rec.level
  const near = geography.locations.filter((l) => l.region === region && !l.requires)
  const dungeons = geography.locations.filter((l) => l.region === region && l.type === 'dungeon' && dungeonFits(state, l.id, level))
  if (dungeons.length && rng.chance(0.5)) return { name: rng.pick(dungeons).name, dungeon: true }
  const towns = near.filter((l) => l.type !== 'dungeon')
  const t = towns.length ? rng.pick(towns) : home
  return { name: t ? `${t.name}近郊` : '附近', dungeon: false }
}

/** 替一個人擲一次：寫進近況，有升級、換裝時改他的角色資料。回傳有沒有新的近況 */
export function rollOnce(state: GameState, rec0: NpcRecord, day: number, ctx: LustCtx = { paired: new Set(), touched: new Set() }): boolean {
  const rng = new Rng(hashString(`${rec0.id}:life:${day}`))
  const fixed = isFixed(rec0.id)
  const pcLevel = state.party.find((m) => m.isPlayer)?.level ?? 1
  const scale = Math.min(3, everyDays / 3)
  const place = placeFor(state, rng, rec0)
  const news: NpcNews = { day, text: '', place: place.name }
  const parts: string[] = [`${place.dungeon ? `去了${place.name}` : `在${place.name}`}${rng.pick(ACTIVITIES)}`]
  let c: Character | undefined
  const character = () => {
    if (c) return c
    const rec = storedRecord(state, rec0)
    rec.character ??= characterFor(state, rec)
    c = rec.character
    return c
  }
  // 升級：上限是主角的等級；固定 NPC 不升級（等級寫在資料裡，任務的戰鬥照那個設計）
  const level = rec0.character?.level ?? rec0.level
  const companion = wasCompanion(state, rec0)
  if (!fixed && level < pcLevel && rng.chance(levelUpChance(pcLevel - level, everyDays))) {
    const ch = character()
    gainXp(ch, Math.max(1, xpToNext(ch.level) - ch.xp), rng)
    // 曾經是隊員的人：能力選項與屬性點留著，歸隊時玩家自己選
    if (!companion) settleLevelUp(ch)
    storedRecord(state, rec0).level = ch.level
    news.level = ch.level
    parts.push(`升到 Lv.${ch.level}`)
  }
  // 換一件武器或護甲（照現在的等級）：固定 NPC 不換（穿著照內容的設計）；只換比現在好、沒上鎖、不是獨特的那件
  if (!fixed && rng.chance(Math.min(0.6, 0.2 * scale))) {
    const ch = character()
    const loadout = generateLoadout(ch.class, ch.level, rng, ch.race)
    const slots = (['main_hand', 'body'] as GearSlot[]).filter((s) => loadout[s] && replaceable(state, ch.gear?.[s], loadout[s]!))
    if (slots.length) {
      const slot = rng.pick(slots)
      const old = ch.gear?.[slot]
      ;(ch.gear ??= {})[slot] = loadout[slot]
      syncGear(ch, classDef(ch.class).weapon)
      recalc(ch)
      news.gear = gearName(loadout[slot]!.spec)
      parts.push(`換上了${news.gear}`)
      // 夥伴換下的（玩家給的）寄回行囊
      if (old && companion) {
        addItem(state.inventory, old.name, 1)
        news.returned = old.name
        parts.push(`把換下的${old.name}寄回給你`)
      }
    }
  }
  // 受了點傷，休養幾天（只是近況：隨時可以找他）
  if (rng.chance(Math.min(0.4, 0.12 * scale))) {
    const town = rec0.location ? locationById(rec0.location).name : '城裡'
    news.rest = town
    parts.push(`${rng.pick(RESTS)}，在${town}休養了幾天`)
  }
  // 成人向的私生活（另外的亂數：不影響上面擲出來的事）
  const lust = rollLust(state, rec0, day, ctx)
  if (lust) {
    parts.push(lust.text)
    news.adult = lust.adult
  }
  news.text = `${parts.join('，')}。`
  pushNews(state, rec0.id, news)
  return true
}

/** 寫進近況：同一天已經有一則（例如被別人挑成對象）就接在後面 */
/** 別的系統寫一則近況（懷孕、生下孩子……；docs/FAMILY.md）：同一天的接在同一則後面 */
export function addNpcNews(state: GameState, id: string, text: string) {
  pushNews(state, id, { day: state.time.day, text })
}

function pushNews(state: GameState, id: string, news: NpcNews) {
  const life = lifeOf(state)
  const list = (life.news[id] ??= [])
  const same = list.find((n) => n.day === news.day && !n.story)
  if (same) {
    const { text, ...rest } = news
    Object.assign(same, { ...rest, ...(same.adult && !news.adult ? { adult: same.adult } : {}) })
    same.text = `${same.text.replace(/。$/, '')}；${text}`
    return
  }
  list.push(news)
  if (list.length > NEWS_KEEP) list.splice(0, list.length - NEWS_KEEP)
}

// ---- 成人向的私生活（docs/NPC_SYSTEM.md 第 14 節、docs/LEWD_STATS.md 第 29 節） ----

/** 一輪擲骰共用：這天已經和別人在一起過的人、被挑成對象的人 */
export interface LustCtx {
  paired: Set<string>
  touched: Set<string>
}

const lustRules = () => lewdRules.experience.life
const STRANGERS = ['旅人', '冒險者', '傭兵', '吟遊詩人', '行商', '水手', '酒館的熟客']

/** 認識的人（人際關係裡的 NPC）：不在隊上、沒死、不敵對、沒被制伏、不在等主角的線索事件裡 */
export function knownNpcs(state: GameState): NpcRecord[] {
  const inParty = new Set(state.party.map((m) => m.id))
  const out: NpcRecord[] = []
  for (const id of Object.keys(state.relationships ?? {})) {
    if (inParty.has(id) || state.captives?.npcs.includes(id) || inLeadEvent(state, id)) continue
    const rec = npcRecord(state, id)
    if (rec && !rec.dead && !rec.hostile) out.push(rec)
  }
  return out
}

/** 這個人的淫亂與順從（有角色資料的看有效值，沒有的照擲） */
function lustOf(rec: NpcRecord): { lewdness: number; submission: number } {
  return rec.character ? lewdOf(rec.character) : npcLewd(rec)
}

/** 和主角夠親密的人（設定的門檻，預設 60）不和別人發生關係，只會自慰 */
export function devoted(state: GameState, id: string): boolean {
  return (state.relationships?.[id]?.affinity ?? 0) >= (loyalAffinity ?? defaultLoyalAffinity())
}

/** 「專情」門檻的預設（lewd.json 的 experience.life.lover_affinity） */
export function defaultLoyalAffinity(): number {
  return lustRules().lover_affinity
}

/**
 * 這個人的私生活可以和別人發生關係嗎（一夜情、性侍奉、接客、和其他 NPC）：設定的總開關開著，而且人際關係裡打開了（預設關閉）。
 * 關著時只會自慰
 */
export function canPair(state: GameState, id: string): boolean {
  return pairsAllowed && !!state.npcLife?.pairs?.includes(id)
}

/** 人際關係裡的開關（預設關閉）：這個人的私生活可不可以和別人發生關係 */
export function setPairs(state: GameState, id: string, on: boolean) {
  const life = lifeOf(state)
  const list = new Set(life.pairs ?? [])
  if (on) list.add(id)
  else list.delete(id)
  life.pairs = [...list]
  if (!life.pairs.length) delete life.pairs
}

/**
 * 現在還是處子、第一次要留給劇情或主角的人：私生活只自慰，也不會被挑成對象。
 * 固定 NPC 寫了還沒有經驗（NpcDef.sex.virgin；伊莎朵拉、艾琳……的戀愛線有和主角的第一次）、
 * 成人向任務的開頭 NPC（storyVirginIds：任務沒標非處女），或內容篩選關掉了非處女（誰都不在幕後失去第一次）
 */
export function keepsFirst(state: GameState, id: string): boolean {
  if (!sexRecordOf(state, id).virgin) return false
  return namedNpcById(id)?.sex?.virgin === true || storyVirginIds().has(id) || !tagsAllowed(['non_virgin'])
}

/** 內容篩選關掉男性對象時，NPC 之間不挑男性 */
const maleBlocked = (rec: NpcRecord) => !tagsAllowed(['male_partner']) && (rec.character?.gender ?? rec.gender) === 'male'

/** 挑一個認識的 NPC 當對象：只挑住在同一座城的，互相寫了關係的比較容易 */
function pickPartner(state: GameState, rng: Rng, rec: NpcRecord, ctx: LustCtx): NpcRecord | undefined {
  if (!canPair(state, rec.id) || maleBlocked(rec) || !rec.location) return undefined
  const pick = lustRules().pair_pick
  const related = new Set(Object.keys(rec.relations ?? {}))
  const pool: [NpcRecord, number][] = []
  const seen = new Set<string>()
  for (const o of [...knownNpcs(state), ...[...related].map((id) => npcRecord(state, id)).filter((r): r is NpcRecord => !!r)]) {
    if (o.id === rec.id || seen.has(o.id) || o.dead || o.hostile || ctx.paired.has(o.id)) continue
    seen.add(o.id)
    if (state.party.some((m) => m.id === o.id) || state.captives?.npcs.includes(o.id) || inLeadEvent(state, o.id)) continue
    if (!canPair(state, o.id) || devoted(state, o.id) || maleBlocked(o) || keepsFirst(state, o.id)) continue
    // 只挑住在同一座城的人（不會和遠方的人「在這座城共度一夜」）
    if (o.location !== rec.location) continue
    const w = related.has(o.id) || o.relations?.[rec.id] ? pick.related : 1
    pool.push([o, w])
  }
  if (!pool.length) return undefined
  let roll = rng.next() * pool.reduce((s, [, w]) => s + w, 0)
  for (const [o, w] of pool) if ((roll -= w) < 0) return o
  return pool[pool.length - 1]![0]
}

/** 有角色資料的人：發生關係時淫亂成長、記下日子（和主角的親密場景一樣） */
function grow(state: GameState, id: string, day: number) {
  const c = state.npcs?.[id]?.character
  if (!c) return
  addLewdStat(c, 'lewdness', lewdRules.growth.adult_scene?.lewdness ?? 1)
  ;(c.lewd ??= { ...lewdRules.defaults }).lastScene = day
}

/**
 * 擲一次成人向的私生活：淫亂越高越常發生。娼妓先擲接客；其他人擲和別人發生關係（一夜情、性侍奉、和其他認識的 NPC），
 * 沒有的話擲自慰。記進性經歷，回傳近況的一句（沒有事時 null）。用「id＋lust＋日子」的固定亂數
 */
export function rollLust(state: GameState, rec: NpcRecord, day: number, ctx: LustCtx): { text: string; adult: NonNullable<NpcNews['adult']> } | null {
  // 「性經歷」整個關掉時，私生活不擲成人向的事
  if (!sexRecordsOn()) return null
  const rng = new Rng(hashString(`${rec.id}:lust:${day}`))
  const r = lustRules()
  const scale = Math.min(3, everyDays / 3)
  const { lewdness, submission } = lustOf(rec)
  const town = rec.location ? locationById(rec.location).name : '城裡'
  const virgin = sexRecordOf(state, rec.id).virgin
  const firstNote = (first: boolean) => (first ? `——這是${rec.name}的第一次` : '')
  // 只擲自慰的人：人際關係裡沒打開（或總開關關著）、和主角夠親密、第一次留給劇情或主角
  const chaste = !canPair(state, rec.id) || devoted(state, rec.id) || keepsFirst(state, rec.id)
  // 娼妓：接客
  if (rec.tags?.includes('prostitute') && !chaste && rng.chance(r.client.chance)) {
    const n = rng.int(r.client.count[0], r.client.count[1]) * Math.max(1, Math.round(scale))
    const sex = rng.int(Math.ceil(n / 2), n)
    const text = `在${town}的娼館接了 ${n} 位客人`
    const first = addEncounter(state, rec.id, { day, with: [{ name: `${n} 位客人` }], sex, service: n, summary: text, anonKeys: Array.from({ length: n }, (_, i) => `client:${day}:${i}`) })
    grow(state, rec.id, day)
    ctx.paired.add(rec.id)
    return { text: text + firstNote(first), adult: { kind: 'client', ...(first ? { first } : {}) } }
  }
  const partnerP = Math.min(r.partner.max, (r.partner.base + (lewdness / 100) * r.partner.per_lewd) * scale) * (virgin ? r.partner.virgin_mult : 1)
  if (!ctx.paired.has(rec.id) && !chaste && rng.chance(partnerP)) {
    const partner = rng.chance(r.weights.pair / (r.weights.pair + r.weights.stranger + r.weights.service)) ? pickPartner(state, rng, rec, ctx) : undefined
    if (partner) {
      const sex = rng.int(1, 3)
      const text = rng.pick([`和${partner.name}在${town}共度了一夜`, `和${partner.name}偷偷發生了關係`, `和${partner.name}喝了酒，一起回了房間`])
      const first = addEncounter(state, rec.id, { day, with: [{ name: partner.name, id: partner.id }], sex, service: 0, summary: text })
      const back = `和${rec.name}在${town}共度了一夜`
      const pFirst = addEncounter(state, partner.id, { day, with: [{ name: rec.name, id: rec.id }], sex, service: 0, summary: back })
      grow(state, rec.id, day)
      grow(state, partner.id, day)
      ctx.paired.add(rec.id)
      ctx.paired.add(partner.id)
      ctx.touched.add(partner.id)
      pushNews(state, partner.id, { day, text: `${back}${pFirst ? `——這是${partner.name}的第一次` : ''}。`, adult: { kind: 'pair', with: rec.id, ...(pFirst ? { first: true } : {}) } })
      return { text: text + firstNote(first), adult: { kind: 'pair', with: partner.id, ...(first ? { first } : {}) } }
    }
    const who = rng.pick(STRANGERS)
    // 順從高的比較常替人服務
    const service = rng.chance(r.weights.service * (1 + submission / 50) / (r.weights.service * (1 + submission / 50) + r.weights.stranger))
    if (service) {
      const n = rng.int(1, 2)
      const text = rng.pick([`替一位${who}用嘴服務，抵了一晚的房錢`, `用手替一位${who}解決了，換到一條消息`, `被一位${who}半哄半逼地跪下來服侍了一回`])
      addEncounter(state, rec.id, { day, with: [{ name: who }], sex: 0, service: n, summary: text, anonKey: `stranger:${day}` })
      ctx.paired.add(rec.id)
      return { text, adult: { kind: 'service', with: who } }
    }
    const sex = rng.int(1, 3)
    const text = rng.pick([`在${town}的酒館和一位${who}看對了眼，共度了一夜`, `和同行的${who}在營火邊發生了關係`, `在旅店被一位${who}搭訕，順勢上了床`])
    const first = addEncounter(state, rec.id, { day, with: [{ name: who }], sex, service: 0, summary: text, anonKey: `stranger:${day}` })
    grow(state, rec.id, day)
    ctx.paired.add(rec.id)
    return { text: text + firstNote(first), adult: { kind: 'stranger', with: who, ...(first ? { first } : {}) } }
  }
  const soloP = Math.min(r.solo.max, (r.solo.base + (lewdness / 100) * r.solo.per_lewd) * scale)
  if (rng.chance(soloP)) {
    const n = rng.int(1, 1 + Math.floor(lewdness / 25)) * Math.max(1, Math.round(scale))
    const text = rng.pick([`夜裡一個人睡不著，偷偷自慰了 ${n} 次`, `洗澡的時候忍不住自己碰了起來（${n} 次）`, `看了些不該看的書，夜裡自己解決了 ${n} 次`])
    addEncounter(state, rec.id, { day, with: [], sex: 0, service: 0, solo: n, summary: text })
    return { text, adult: { kind: 'solo' } }
  }
  return null
}

/** 這一格能不能換成 next：空著，或現在的沒上鎖（主人、陷阱、寄生、拘束具的鎖）、不是獨特裝備、而且 next 比較好（估價：底材、材料、附魔） */
function replaceable(state: GameState, cur: EquippedGear | undefined, next: EquippedGear): boolean {
  if (!cur) return true
  if (cur.locked || cur.lock || cur.spec.lock) return false
  if (isUniqueGear(state, cur.name)) return false
  return gearPrice(next.spec) > gearPrice(cur.spec)
}

/** 獨特裝備（和 trade.ts 的 isUniqueItem 一樣；這裡不引用 trade.ts，避免循環引用） */
function isUniqueGear(state: GameState, name: string): boolean {
  const def = itemDef(name)
  if (def) return !!def.gear?.unique || !!def.tags?.includes('unique')
  return !!state.customItems?.[name]?.gear?.unique
}

/**
 * 升級的機率：基本 LEVEL_BASE，間隔越長越高（每 3 天算一份，最多三份），再依落後主角幾級調整——
 * 差一級 ×0.5、兩級 ×1、三級 ×1.5……最多 ×2.5：落後越多追得越快，快追上主角時很少升級。最高 50%。
 * 每 3 天擲一次時：差 1 級 5%、2 級 10%、3 級 15%、4 級 20%、5 級以上 25%
 */
export const LEVEL_BASE = 0.1
export function levelUpChance(gap: number, days: number): number {
  if (gap <= 0) return 0
  const scale = Math.min(3, days / 3)
  return Math.min(0.5, LEVEL_BASE * scale * Math.min(2.5, gap * 0.5))
}

/** NPC 升級時自己做的選擇：能力挑第一個、屬性點加在職業的主屬性（和生成 NPC 一樣） */
function settleLevelUp(c: Character) {
  for (const choices of c.pendingAbilityChoices ?? []) if (choices[0] && !c.abilities.includes(choices[0])) c.abilities.push(choices[0])
  delete c.pendingAbilityChoices
  const main = classDef(c.class).priority[0]
  if (main && c.attrPoints > 0) {
    c.attrs[main] = Math.min(attributeRules.score.max, c.attrs[main] + c.attrPoints)
    c.attrPoints = 0
  }
}

// ---- 近況 ----

export function newsOf(state: GameState, id: string): NpcNews[] {
  return state.npcLife?.news[id] ?? []
}

/** 給 AI 與畫面的近況文字：潤飾過的優先 */
export function newsText(n: NpcNews): string {
  return n.story ?? n.text
}

/**
 * 寫進 AI 潤飾的近況：每人一段，寫在那一天（找不到就寫在最後一則還沒寫的）；
 * 這個人在那之前還沒寫的近況已經寫進這一段，拿掉（不然畫面上會重複）。找不到人的略過。
 */
export function applyNewsStories(state: GameState, stories: { id: string; day?: number; story: string }[]) {
  for (const s of stories) {
    const list = state.npcLife?.news[s?.id]
    const open = (list ?? []).filter((x) => !x.story)
    const text = typeof s?.story === 'string' ? s.story.trim().slice(0, 400) : ''
    const n = open.find((x) => x.day === s.day) ?? open[open.length - 1]
    if (!list || !n || !text) continue
    n.story = text
    const merged = new Set(open.filter((x) => x !== n && x.day <= n.day))
    if (merged.size) state.npcLife!.news[s.id] = list.filter((x) => !merged.has(x))
  }
}

/** 還沒潤飾的近況（AI 潤飾用）：只看這些人 */
export function unpolished(state: GameState, ids: string[]): { id: string; news: NpcNews }[] {
  return ids.flatMap((id) => newsOf(state, id).filter((n) => !n.story).map((news) => ({ id, news })))
}
