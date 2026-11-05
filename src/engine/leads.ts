// 地區的線索池（P1；規劃見 docs/TRAVEL_EVENTS.md 第 5 節「線索池」）：
// - 每個地區（geography.json 的地區）一個池子，玩家走進那個地區的近郊或地下城時才擲；過了「線索池更新的天數」（設定）再擲一批。
// - 每批 LEAD_SLOTS 格，每格照權重抽一種線索，也可能空著。線索是一個事件點：盤踞的強敵、藏寶處、流浪商人、冒險者的遺物。
// - 線索事件（event）：一件有登場角色的事（leadEvents.ts），走到那一格時發生；沒有合適的模板時改成盤踞的強敵。
// - 一部分分給情報商（買得到），其他隱藏（情報物品解讀時揭露；之後的酒館打聽也會用到）。
// - 不管有沒有人知道，進入那一區時都放上地圖（intel.ts 的 ensureIntelPoints）；沒人知道的走過去就觸發，同時記進冒險筆記。
// - 線索的 id 就是事件點的 id：知道之後記進 state.intel（同一個 id），完成、過期照情報的規則。

import { dungeonEncounters, enemies, geography, locationById, type DungeonLayerId } from './data'
import { dungeonPlaces, makePoint, type PointEvent, type PointPlace } from './intel'
import { wildEncounters } from './data'
import { pcOf } from './party'
import type { Rng } from './rng'
import { withRng } from './state'
import { locationOpen } from './storyFlags'
import { castWords, fillCast, leadExpired, leadTemplatesFor, pickCast } from './leadEvents'
import type { GameState, Intel, Lead } from './types'

export type { Lead }

/** 每批幾格 */
export const LEAD_SLOTS = 6
/** 每格空著的機率 */
export const LEAD_EMPTY = 0.3
/** 分給情報商的機率（其他隱藏） */
export const LEAD_INFORMANT = 0.4
/** 各種線索的權重 */
export const LEAD_WEIGHTS: Record<LeadEvent, number> = { combat: 3, chest: 2, merchant: 1, relic: 2, event: 3 }
export type LeadEvent = PointEvent | 'event'
/** 太深的地方不放：那一層最強的怪物比主角高這麼多級以上 */
const LEVEL_SLACK = 4

// ---- 設定（畫面呼叫，和 NPC 近況一樣） ----

let poolDays = 7

/** 線索池更新的天數（0 = 關閉：情報商照舊每天隨機賣事件點） */
export function setLeadPool(opts: { days?: number }) {
  if (opts.days !== undefined && Number.isFinite(opts.days)) poolDays = Math.max(0, Math.min(30, Math.round(opts.days)))
}

export function leadPoolDays(): number {
  return poolDays
}

export function leadPoolOn(): boolean {
  return poolDays > 0
}

// ---- 池子 ----

/** 這個地區可以放線索的地方：聚落的近郊、地下城有遭遇表的每一層（劇情條件成立的；太深的不放） */
export function regionPlaces(state: GameState, region: string): PointPlace[] {
  const level = pcOf(state).level
  const out: PointPlace[] = []
  for (const l of geography.locations.filter((x) => x.region === region && locationOpen(state, x.id))) {
    if (l.type !== 'dungeon') out.push({ location: l.id, table: wildEncounters(region), tier: 0 })
    else if (dungeonEncounters[l.id]) out.push(...dungeonPlaces(l.id))
  }
  const fits = out.filter((p) => Math.max(1, ...p.table.flat().map(([id]) => enemies[id]?.level ?? 1)) <= level + LEVEL_SLACK)
  return fits.length ? fits : out.filter((p) => p.tier <= 1)
}

function pick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const keys = Object.keys(weights) as T[]
  let r = rng.next() * keys.reduce((s, k) => s + weights[k], 0)
  for (const k of keys) if ((r -= weights[k]) < 0) return k
  return keys[keys.length - 1]!
}

/** 擲一批新的線索（還沒被知道、沒完成的舊線索作廢；已經知道的照它的期限） */
function rollPool(state: GameState, region: string) {
  const day = state.time.day
  const pools = (state.leadPools ??= {})
  const old = pools[region]?.leads ?? []
  for (const l of old) {
    if (l.status === 'active' && !l.known) {
      l.status = 'expired'
      leadExpired(state, l)
    }
  }
  const keep = old.filter((l) => l.status === 'active' && l.known && (l.until ?? day) >= day)
  const places = regionPlaces(state, region)
  const leads: Lead[] = withRng(state, (rng) => {
    const out: Lead[] = []
    const used = new Set(keep.map((l) => `${l.location}:${l.layer ?? ''}`))
    const usedTemplates = new Set(keep.map((l) => l.template).filter(Boolean))
    for (let i = 0; i < LEAD_SLOTS; i++) {
      if (rng.chance(LEAD_EMPTY)) continue
      const free = places.filter((p) => !used.has(`${p.location}:${p.layer ?? ''}`))
      if (!free.length) break
      const p = rng.pick(free)
      used.add(`${p.location}:${p.layer ?? ''}`)
      const id = `lead-${region}-${day}-${i}`
      const visibility = rng.chance(LEAD_INFORMANT) ? 'informant' as const : 'hidden' as const
      let event = pick(rng, LEAD_WEIGHTS)
      if (event === 'event') {
        // 線索事件：這個地方能放的模板（這一批還沒用過的優先），擲登場角色
        const all = leadTemplatesFor(state, p, region)
        const fresh = all.filter((t) => !usedTemplates.has(t.id))
        const t = (fresh.length ? fresh : all).length ? rng.pick(fresh.length ? fresh : all) : undefined
        if (t) {
          usedTemplates.add(t.id)
          const cast = pickCast(state, rng, Math.max(0, Math.min(2, t.cast ?? 0)), region)
          const words = castWords(state, cast)
          const base = makePoint(state, p, 'chest', poolDays)
          out.push({
            title: fillCast(t.title, words), text: fillCast(t.text, words).slice(0, 160),
            location: p.location, ...(p.layer ? { layer: p.layer } : {}), level: base.level, until: day + poolDays,
            id, region, tier: p.tier, event: 'event', template: t.id, ...(cast.length ? { cast } : {}), visibility, status: 'active',
          })
          continue
        }
        event = 'combat'
      }
      const point = makePoint(state, p, event, poolDays)
      out.push({ ...point, id, region, tier: p.tier, event, visibility, status: 'active' })
    }
    return out
  })
  pools[region] = { day, leads: [...keep, ...leads] }
}

/** 這個地區的池子（到期了就擲新的一批；設定關掉時不擲） */
export function ensureLeadPool(state: GameState, region: string) {
  if (!leadPoolOn()) return
  const pool = state.leadPools?.[region]
  if (!pool || state.time.day >= pool.day + poolDays) rollPool(state, region)
}

/** 過期的線索 */
function expireLeads(state: GameState) {
  for (const pool of Object.values(state.leadPools ?? {})) {
    for (const l of pool.leads) {
      if (l.status === 'active' && l.until !== undefined && state.time.day > l.until) {
        l.status = 'expired'
        leadExpired(state, l)
      }
    }
  }
}

/** 還有效的線索（可以只看某個地區） */
export function activeLeads(state: GameState, region?: string): Lead[] {
  expireLeads(state)
  const pools = region ? [state.leadPools?.[region]] : Object.values(state.leadPools ?? {})
  return pools.flatMap((p) => p?.leads ?? []).filter((l) => l.status === 'active')
}

export function leadById(state: GameState, id: string | undefined): Lead | undefined {
  if (!id) return undefined
  for (const pool of Object.values(state.leadPools ?? {})) {
    const l = pool.leads.find((x) => x.id === id)
    if (l) return l
  }
  return undefined
}

/** 這一區（某地點的近郊或地下城的某一層）有效的線索 */
export function leadsAt(state: GameState, location: string, layer?: DungeonLayerId): Lead[] {
  const region = locationById(location).region
  return activeLeads(state, region).filter((l) => l.location === location && (l.layer ?? undefined) === layer)
}

/** 線索的事件點內容（去掉池子用的欄位） */
export function leadPoint(lead: Lead): Omit<Intel, 'id' | 'from' | 'time' | 'status' | 'kind'> {
  const { id: _id, region: _r, tier: _t, visibility: _v, known: _k, status: _s, ...point } = lead
  return point
}

/** 把線索記進冒險筆記（買到、解讀、自己遇到）；已經知道的不重複記 */
export function discoverLead(state: GameState, lead: Lead, source?: string): Intel {
  const known = state.intel?.find((i) => i.id === lead.id)
  if (known) return known
  lead.known = true
  const it: Intel = {
    ...leadPoint(lead), id: lead.id, kind: 'point', from: state.location, time: { ...state.time }, status: 'active',
    ...(source ? { source } : {}),
  }
  ;(state.intel ??= []).push(it)
  return it
}

/** 走到一個沒人知道的線索：記進筆記（自己遇到的） */
export function stumbleOnLead(state: GameState, id: string | undefined) {
  const lead = leadById(state, id)
  if (lead && lead.status === 'active' && !lead.known) discoverLead(state, lead, '自己遇到')
}

/** 線索結束（打倒強敵、打開寶物、遇到商人） */
export function finishLead(state: GameState, id: string | undefined) {
  const lead = leadById(state, id)
  if (lead && lead.status === 'active') lead.status = 'done'
}

/** 情報商賣的線索：所在地區分給情報商、還沒被知道的（7 天路程內） */
export function informantLeads(state: GameState, near: Set<string>): Lead[] {
  const region = locationById(state.location).region
  ensureLeadPool(state, region)
  return activeLeads(state, region).filter((l) => l.visibility === 'informant' && !l.known && !!l.location && near.has(l.location))
}

/** 情報物品解讀時揭露的線索：所在地區隱藏的、還沒被知道的；事件種類對得上的優先 */
export function hiddenLeadFor(state: GameState, events?: PointEvent[], location?: string): Lead | undefined {
  const region = locationById(location ?? state.location).region
  ensureLeadPool(state, region)
  const list = activeLeads(state, region).filter((l) => l.visibility === 'hidden' && !l.known)
  const match = list.filter((l) => (!events || events.includes(l.event as PointEvent)) && (!location || l.location === location))
  return match[0] ?? list.find((l) => !events || events.includes(l.event as PointEvent))
}
