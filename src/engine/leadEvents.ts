// 線索事件（P3；docs/TRAVEL_EVENTS.md 第 5.1 節）：線索池的一種線索是一件「事」，走到那一格時發生，等主角回應。
// - 模板和其他事件共用（travel_events.json 的 templates，scope: lead），依地區、地點、層數、內容標籤、主角體型、條件篩選。
// - 登場角色（cast，0～2 位，文字裡的 {a}、{b} 是名字，{a他}、{b他} 照性別換成他或她；效果的 NPC 寫 $a、$b）：擲線索池時決定。
//   一半的機會是這個地區主角認識的冒險者（不是固定 NPC、活著、不在隊上），其他是新生成的冒險者。
// - 選項由主角自己擲（和地下城事件一樣，DC 依那一層）；結果可以帶進臨時地圖（side_map：隱藏的洞窟、遺跡……，出口回到這一格）。
// - 沒人去處理、過期了：主角認識的登場角色記一則近況（模板的 offscreen）；沒見過面的新角色從存檔拿掉。

import { characterBody } from './look'
import { pcBodyAllowed, tagsAllowed } from './content'
import { geography, locationById, npcs as namedNpcs } from './data'
import { pcEventReport, resolvePcOption } from './dungeonEvents'
import { currentArea } from './grid'
import { finishIntel, intelById, type PointPlace } from './intel'
import { leadById } from './leads'
import { canLive, NEWS_KEEP, npcLifeOn } from './npcLife'
import { askingPrice, npcRecord } from './npcs'
import { pcOf } from './party'
import { generateResident } from './population'
import { applyPendingMove, travelEvents, type RoadTemplate } from './road'
import type { Rng } from './rng'
import { commitReport } from './state'
import { condMet, locationOpen } from './storyFlags'
import type { GameState, Intel, Lead, NpcRecord, Report } from './types'

/** 登場角色是主角認識的人的機率（其他是新生成的冒險者） */
export const CAST_KNOWN = 0.5
/** 新生成的登場角色的 id 開頭（過期時沒見過面的從存檔拿掉） */
const CAST_PREFIX = 'lead'

export function leadTemplates(): RoadTemplate[] {
  return travelEvents.templates.filter((t) => t.scope === 'lead')
}

export function leadTemplate(id: string | undefined): RoadTemplate | undefined {
  return id ? leadTemplates().find((t) => t.id === id) : undefined
}

/** 事件模板的「層」：0 近郊（地下城的周邊也是 0）、1 淺層 … 4 底層；線索的 tier 是 0 近郊、1～5 周邊到底層 */
export function placeLayer(p: Pick<PointPlace, 'tier'>): number {
  return p.tier === 0 ? 0 : p.tier - 1
}

/** 這個地方能放的線索事件 */
export function leadTemplatesFor(state: GameState, p: PointPlace, region: string): RoadTemplate[] {
  const layer = placeLayer(p)
  const body = characterBody(pcOf(state))
  return leadTemplates().filter((t) =>
    (!t.layers?.length || t.layers.includes(layer))
    && (!t.dungeons?.length || t.dungeons.includes(p.location))
    && (!t.regions?.length || t.regions.includes(region))
    && tagsAllowed(t.tags)
    && pcBodyAllowed(t.pc_body, body)
    && condMet(state, t.requires))
}

// ---- 登場角色 ----

function regionOf(location: string | undefined): string | undefined {
  if (!location) return undefined
  try {
    return locationById(location).region
  } catch {
    return undefined
  }
}

/** 正在別的線索裡登場的人（同一個人不會同時出現在兩件事裡） */
function castInUse(state: GameState): Set<string> {
  const out = new Set<string>()
  for (const pool of Object.values(state.leadPools ?? {})) {
    for (const l of pool.leads) if (l.status === 'active') for (const id of l.cast ?? []) out.add(id)
  }
  return out
}

/** 可以登場的熟人：這個地區、主角認識（有人際關係）、不是固定 NPC、活著、不在隊上、沒被制伏、沒留守 */
export function knownCast(state: GameState, region: string, used: Set<string> = castInUse(state)): NpcRecord[] {
  const inParty = new Set(state.party.map((m) => m.id))
  const fixed = new Set(namedNpcs.map((n) => n.id))
  return Object.keys(state.relationships ?? {})
    .map((id) => npcRecord(state, id))
    .filter((r): r is NpcRecord => !!r && !r.dead && !r.hostile && !r.staying && !fixed.has(r.id) && !inParty.has(r.id)
      && !state.captives?.npcs.includes(r.id) && !used.has(r.id) && canLive(r) && regionOf(r.location) === region)
}

/** 擲登場角色：每一位一半的機會是熟人，其他是新生成的冒險者（住在這個地區的聚落） */
export function pickCast(state: GameState, rng: Rng, n: number, region: string, used: Set<string> = castInUse(state)): string[] {
  const out: string[] = []
  const known = knownCast(state, region, used)
  const homes = geography.locations.filter((l) => l.region === region && l.type !== 'dungeon' && locationOpen(state, l.id))
  for (let i = 0; i < n; i++) {
    if (known.length && rng.chance(CAST_KNOWN)) {
      const rec = known.splice(rng.int(0, known.length - 1), 1)[0]!
      out.push(rec.id)
    } else if (homes.length) {
      const rec = generateResident(state, rng, locationById(rng.pick(homes).id), 'adventurer', CAST_PREFIX)
      // 新生成的登場角色最多比主角高 1 級（不然救個人就撿到高等的同伴）
      const cap = pcOf(state).level + 1
      if (rec.level > cap) {
        rec.level = cap
        rec.hire_cc = askingPrice(cap, rng)
      }
      out.push(rec.id)
    } else continue
    used.add(out[out.length - 1]!)
  }
  return out
}

// ---- 文字 ----

const DEFAULT_NAMES = ['一位冒險者', '另一位冒險者']

export function castNames(state: GameState, cast: string[] | undefined): string[] {
  return (cast ?? []).map((id, i) => npcRecord(state, id)?.name ?? DEFAULT_NAMES[i] ?? '某人')
}

/** 女性、TS、扶他用「她」，其他用「他」 */
function pronoun(state: GameState, id: string | undefined): string {
  const g = id ? npcRecord(state, id)?.gender : undefined
  return g === 'female' || g === 'ts' || g === 'futa' ? '她' : '他'
}

/** 登場角色的稱呼：名字與代名詞（{a}、{a他}、{b}、{b他}） */
export function castWords(state: GameState, cast: string[] | undefined): Record<string, string> {
  const names = castNames(state, cast)
  return {
    '{a}': names[0] ?? DEFAULT_NAMES[0]!, '{b}': names[1] ?? DEFAULT_NAMES[1]!,
    '{a他}': pronoun(state, cast?.[0]), '{b他}': pronoun(state, cast?.[1]),
  }
}

/** 文字裡的 {a}、{b}（名字）與 {a他}、{b他}（代名詞）換掉 */
export function fillCast(text: string, words: Record<string, string>): string {
  return text.replace(/\{[ab]他?\}/g, (k) => words[k] ?? k)
}

/** 換上登場角色的模板：文字的 {a}、{b} 換成名字（{a他}、{b他} 換成代名詞），效果裡的 $a、$b 換成 NPC id */
export function castTemplate(state: GameState, t: RoadTemplate, cast: string[] | undefined): RoadTemplate {
  const words = castWords(state, cast)
  const esc = (s: string) => JSON.stringify(s).slice(1, -1)
  const json = fillCast(JSON.stringify(t)
    .replace(/"\$a"/g, JSON.stringify(cast?.[0] ?? ''))
    .replace(/"\$b"/g, JSON.stringify(cast?.[1] ?? '')), Object.fromEntries(Object.entries(words).map(([k, v]) => [k, esc(v)])))
  const out = JSON.parse(json) as RoadTemplate
  // 登場角色不存在（$a 換成空字串）的效果拿掉
  for (const o of out.options ?? []) {
    for (const r of [o.success, o.fail]) {
      if (r?.effects) r.effects = r.effects.filter((e) => !('npc' in e) || e.npc !== '')
    }
  }
  return out
}

/** 登場角色的簡介（交給 AI） */
function castLines(state: GameState, cast: string[] | undefined): string[] {
  return (cast ?? []).flatMap((id, i) => {
    const r = npcRecord(state, id)
    if (!r) return []
    const known = !!state.relationships?.[id]
    return [`登場角色${i ? '乙' : '甲'}：${r.name}（Lv${r.level} 冒險者${known ? '，主角認識的人' : '，主角第一次見到'}）${r.personality ? `，${r.personality}` : ''}`]
  })
}

// ---- 走到那一格 ----

/** 線索或筆記裡的情報（同一個 id） */
function sourceOf(state: GameState, id: string): Lead | Intel | undefined {
  return leadById(state, id) ?? intelById(state, id)
}

/** 登場角色還能不能出場：活著、不在隊上、沒有敵對、沒被制伏（不能時回傳那個人的名字） */
export function castMissing(state: GameState, cast: string[] | undefined): string | undefined {
  for (const id of cast ?? []) {
    const r = npcRecord(state, id)
    if (!r || r.dead || r.hostile || state.party.some((m) => m.id === id) || state.captives?.npcs.includes(id)) return r?.name ?? id
  }
  return undefined
}

/** 線索作廢：線索與筆記裡的情報標成過期 */
function expireLead(state: GameState, id: string) {
  const lead = leadById(state, id)
  if (lead && lead.status === 'active') lead.status = 'expired'
  const it = intelById(state, id)
  if (it && it.status === 'active') it.status = 'expired'
}

/** 走上線索事件的格子：線索還有效、模板還在、登場角色都還能出場就開始，等主角回應；其他情況這一格作廢（線索過期） */
export function startLeadEvent(state: GameState, area: { key: string }, x: number, y: number, cell: { intel?: string; done?: boolean }): boolean {
  const id = cell.intel
  if (!id || cell.done) return false
  const src = sourceOf(state, id)
  if (!src || src.status !== 'active') {
    cell.done = true
    finishIntel(state, id)
    return false
  }
  // 模板被自訂內容拿掉、登場角色已經入隊／死了／敵對：這件事不會發生了
  if (!leadTemplate(src.template) || castMissing(state, src.cast)) {
    cell.done = true
    expireLead(state, id)
    return false
  }
  state.leadEvent = { lead: id, area: area.key, x, y }
  return true
}

/** 等待回應的線索事件（已經換上登場角色） */
export function pendingLeadEvent(state: GameState): RoadTemplate | undefined {
  const ev = state.leadEvent
  if (!ev) return undefined
  const src = sourceOf(state, ev.lead)
  const t = leadTemplate(src?.template)
  return t && src ? castTemplate(state, t, src.cast) : undefined
}

/** 自訂內容拿掉的事件：等待中的線索事件作廢 */
export function pruneLeadEvent(state: GameState) {
  if (state.leadEvent && (!pendingLeadEvent(state) || !leadEventHere(state))) delete state.leadEvent
}

/** 選一個回應：主角擲骰、套用結果；線索結束，這一格清掉 */
export function answerLeadEvent(state: GameState, index: number): Report {
  const ev = state.leadEvent
  const t = pendingLeadEvent(state)
  const o = t?.options?.[index]
  if (!ev || !t || !o) throw new Error('沒有這個選項')
  const src = sourceOf(state, ev.lead)
  // 認不認識要在套用選項之前看（好感效果會建立人際關係）
  const cast = castLines(state, src?.cast)
  const report = pcEventReport(state, t.title, '線索事件')
  resolvePcOption(state, report, t, o, '線索事件')
  if (cast.length) report.narration = { pov: 'second_person', ...report.narration, focus: [...(report.narration?.focus ?? []), ...cast] }
  for (const n of castNames(state, src?.cast)) report.lore_keys?.push(n)
  finishIntel(state, ev.lead)
  const area = state.areas?.[ev.area]
  const cell = area?.cells[ev.y * area.width + ev.x]
  if (cell) cell.done = true
  delete state.leadEvent
  const committed = commitReport(state, report)
  applyPendingMove(state)
  return committed
}

/** 還在這一區、站在那一格上嗎（離開了就作廢；讀檔時） */
export function leadEventHere(state: GameState): boolean {
  const ev = state.leadEvent
  return !!ev && currentArea(state).key === ev.area
}

// ---- 沒人去處理 ----

/** 過期的線索事件：主角認識的登場角色記一則近況；沒見過面的新角色從存檔拿掉（也不在別的線索裡） */
export function leadExpired(state: GameState, lead: Lead) {
  if (lead.event !== 'event' || !lead.cast?.length) return
  const t = leadTemplate(lead.template)
  const words = castWords(state, lead.cast)
  const day = Math.min(state.time.day, (lead.until ?? state.time.day) + 1)
  const place = (() => {
    try {
      return locationById(lead.location ?? '').name
    } catch {
      return '附近'
    }
  })()
  const text = fillCast(t?.offscreen || `{a}在${place}遇上了「${lead.title}」那件事，後來自己處理掉了。`, words)
  const used = castInUse(state)
  for (const id of lead.cast) {
    const rec = npcRecord(state, id)
    if (state.relationships?.[id]) {
      // NPC 近況關掉時不寫；已經入隊、死了、敵對、被制伏的人沒有「自己處理掉」這回事
      if (!npcLifeOn() || !rec || rec.dead || rec.hostile || state.party.some((m) => m.id === id) || state.captives?.npcs.includes(id)) continue
      const life = (state.npcLife ??= { last: state.time.day, news: {} })
      const list = (life.news[id] ??= [])
      list.push({ day, text, place })
      if (list.length > NEWS_KEEP) list.splice(0, list.length - NEWS_KEEP)
    } else if (id.startsWith(`${CAST_PREFIX}_`) && !used.has(id) && !state.party.some((m) => m.id === id) && state.npcs?.[id]) {
      delete state.npcs[id]
    }
  }
}
