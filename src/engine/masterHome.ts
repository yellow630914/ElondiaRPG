// 主人的家（data/rules/slavery.json 的 master_home，見 docs/COMPANIONS.md 第 3.4 節）：
// - 主角有主人時，主人在自己的城市有一棟房子：和買房一樣疊在城裡的一塊空地上（那塊地不再出售），地圖存在 state.homes（home.master）。
// - 主人照舊帶著主角行動，但離家太久會想回家：允許離家的天數依印記、主人的親密度與標籤；逾期後可能發生「主人要回家」事件。
// - 在主人的家裡要出門，先過出門檢定（主人今天同意才走得出大門）。
// - 逃亡後被找到、逾期被帶回家：直接回到主人的家，而且「嚴加看管」，之後出門與出城都更難。

import { locationById, slaveryRules, type Degree } from './data'
import { currentArea, getArea, placeAt, position, type Area } from './grid'
import { generateHome, homeOfArea, homeOnLot, lotsOf } from './homes'
import { npcRecord } from './npcs'
import { addAffinity, isBound, pcOf, punish } from './party'
import { contractTerms } from './slavery'
import { Rng } from './rng'
import { addHours } from './state'
import { arrive, daysToHours } from './travel'
import type { ContractRef, GameState, GameTime, Home, NpcRecord, Report } from './types'
import { shortestPath } from './world'

const rules = () => slaveryRules.master_home

function hoursOf(t: GameTime): number {
  return t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0
  return h
}

function contractOf(state: GameState): ContractRef | undefined {
  return pcOf(state).contract
}

export function masterHomeId(master: string): string {
  return `m-${master}`
}

/** 還沒有房子的空地 */
function freeLots(state: GameState, city: string) {
  return lotsOf(city).filter((l) => !homeOnLot(state, l.id))
}

/** 主人的家在哪座城：主人登錄的地點（聚落），否則主角現在所在的聚落 */
function homeCity(state: GameState, master: NpcRecord): string | undefined {
  for (const id of [master.location, state.location]) {
    if (!id) continue
    const loc = (() => {
      try {
        return locationById(id)
      } catch {
        return undefined
      }
    })()
    if (loc && loc.type !== 'dungeon' && freeLots(state, id).length) return id
  }
  return undefined
}

/** 目前主人的家（還沒建立時沒有） */
export function currentMasterHome(state: GameState): Home | undefined {
  const c = contractOf(state)
  return c?.master ? state.homes?.[masterHomeId(c.master)] : undefined
}

/** 現在站在主人的家裡 */
export function atMasterHome(state: GameState, area: Pick<Area, 'key' | 'kind'> = currentArea(state)): boolean {
  const home = homeOfArea(state, area)
  return !!home?.master && home.master === contractOf(state)?.master
}

/** 拿掉不是現任主人的家（換主人、獲釋時）；人還在裡面就站到門口的街上 */
function dropStale(state: GameState, keep?: string) {
  for (const home of Object.values(state.homes ?? {})) {
    if (!home.master || home.master === keep) continue
    if (position(state).area.startsWith(`home/${home.id}/`)) placeAt(state, getArea(state, home.lot.area), home.lot.street.x, home.lot.street.y)
    delete state.homes![home.id]
  }
}

/** 主人的身分決定房子的規格（沒寫的依空地的地段） */
function districtFor(master: NpcRecord, fallback: Home['district']): Home['district'] {
  for (const t of master.tags ?? []) {
    const d = rules().district[t]
    if (d) return d
  }
  return fallback
}

/**
 * 確保現任主人的家存在（主角有主人時），舊主人的家拿掉。
 * 第一次需要時決定在哪座城、挑一塊空地、生成地圖；找不到空地時沒有房子（也就沒有離家期限）。
 */
export function syncMasterHome(state: GameState): Home | undefined {
  const c = contractOf(state)
  dropStale(state, c?.master || undefined)
  if (!c?.master) return undefined
  const id = masterHomeId(c.master)
  const existing = state.homes?.[id]
  if (existing) return existing
  const master = npcRecord(state, c.master)
  if (!master) return undefined
  c.home ??= homeCity(state, master)
  if (!c.home) return undefined
  const lots = freeLots(state, c.home)
  if (!lots.length) return undefined
  const lot = lots[hash(master.id) % lots.length]!
  const base: Omit<Home, 'floors' | 'areas'> = {
    id, name: `${master.name}的家`, location: c.home, district: districtFor(master, lot.district),
    lot: { area: lot.area, x: lot.x, y: lot.y, street: lot.street }, bought: { ...state.time }, price_cc: 0, master: master.id,
  }
  // 用自己的種子生成（同一位主人的家長得一樣，也不動到遊戲的亂數）
  const home: Home = { ...base, ...generateHome(base, new Rng(hash(`${state.seed}:${master.id}`))) }
  // 出口通往門口的街道
  for (const a of Object.values(home.areas)) for (const cell of a.cells) if (cell.dir === 'out') cell.link = { area: lot.area, ...lot.street }
  ;(state.homes ??= {})[id] = home
  return home
}

/** 一樓的出口（進門的地方） */
function entrance(home: Home): { area: Area; x: number; y: number } {
  const ground = home.areas[home.floors.find((k) => home.areas[k]?.homeFloor === 'ground')!]!
  const i = ground.cells.findIndex((c) => c.dir === 'out')
  return { area: ground, x: i % ground.width, y: Math.floor(i / ground.width) }
}

// ---- 離家期限 ----

/** 允許離家的天數：(印記基本天數 + 親密度加成 + 標籤天數) × 標籤倍率，夾在 min～max（以半天為單位） */
export function allowedDays(state: GameState): number {
  const c = contractOf(state)
  if (!c?.master) return 0
  const r = rules()
  let days = Math.max(0, (r.days.pivot_exit_dc - contractTerms(c).exit_dc) * r.days.per_dc)
  days += Math.trunc((state.relationships?.[c.master]?.affinity ?? 0) / r.days.affinity_step)
  let mult = 1
  for (const t of npcRecord(state, c.master)?.tags ?? []) {
    days += r.tag_days[t] ?? 0
    mult *= r.tag_mult[t] ?? 1
  }
  return Math.max(r.days.min, Math.min(r.days.max, Math.round(days * mult * 2) / 2))
}

export interface HomeDeadline {
  home: Home
  /** 允許離家的天數 */
  days: number
  /** 在主人的家裡（期限從出門時算起） */
  atHome: boolean
  /** 期限 */
  due: GameTime
  /** 還剩幾小時（逾期為負） */
  hoursLeft: number
}

/** 離家期限：被主人帶著、主人有房子時才有 */
export function homeDeadline(state: GameState): HomeDeadline | undefined {
  if (!isBound(state)) return undefined
  const home = currentMasterHome(state)
  const c = contractOf(state)!
  if (!home) return undefined
  const days = allowedDays(state)
  const atHome = atMasterHome(state)
  const from = atHome ? state.time : c.homeAt ?? c.since
  const due = addHours(from, days * 24)
  return { home, days, atHome, due, hoursLeft: hoursOf(due) - hoursOf(state.time) }
}

/** 逾期的天數（沒有逾期時 0） */
export function overdueDays(state: GameState): number {
  const d = homeDeadline(state)
  return d && !d.atHome && d.hoursLeft < 0 ? -d.hoursLeft / 24 : 0
}

/** 逾期時「主人要回家」事件的機率 */
export function overdueChance(state: GameState): number {
  const days = overdueDays(state)
  if (days <= 0) return 0
  const o = rules().overdue
  return Math.min(o.max, o.base + o.per_day * days)
}

/** 走進或走出主人的家：離家期限重新算 */
export function touchMasterHome(state: GameState, from: Pick<Area, 'key' | 'kind'>, to: Pick<Area, 'key' | 'kind'>) {
  const c = contractOf(state)
  if (!c?.master || (!atMasterHome(state, from) && !atMasterHome(state, to))) return
  c.homeAt = { ...state.time }
}

/** 延長期限（主人寬限幾天） */
export function extendDeadline(state: GameState, hours: number) {
  const c = contractOf(state)
  if (!c?.master) return
  c.homeAt = addHours(c.homeAt ?? c.since, hours)
}

// ---- 嚴加看管 ----

/** 目前嚴加看管的點數（每 decay_days 天減 1 點） */
export function strictPoints(state: GameState): number {
  const s = contractOf(state)?.strict
  if (!s) return 0
  const days = (hoursOf(state.time) - hoursOf(s.since)) / 24
  return Math.max(0, s.points - Math.floor(days / rules().strict.decay_days))
}

export function addStrict(state: GameState, n: number) {
  const c = contractOf(state)
  if (!c || !n) return
  c.strict = { points: Math.max(0, Math.min(rules().strict.max, strictPoints(state) + n)), since: { ...state.time } }
}

// ---- 被帶回主人的家 ----

/**
 * 把隊伍帶回主人的家（被找到、逾期被帶回家）：在別的城市時花上路程的時間（記在報告的結束時間），站在一樓的出口。
 * 回傳一句說明；主人沒有房子時回傳空字串。
 */
export function sendToMasterHome(state: GameState, report: Report): string {
  const home = syncMasterHome(state)
  if (!home) return ''
  let hours = 0
  if (state.location !== home.location) {
    const path = shortestPath(state.location, home.location)
    hours = path ? daysToHours((path.days[0] + path.days[1]) / 2) : 0
    state.location = home.location
    arrive(state)
  }
  report.time.end = addHours(report.time.end, hours)
  const at = entrance(home)
  placeAt(state, at.area, at.x, at.y)
  const c = contractOf(state)!
  c.homeAt = { ...report.time.end }
  const days = Math.round((hours / 24) * 10) / 10
  return `被帶回${locationById(home.location).name}的「${home.name}」${hours ? `（路上約 ${days} 天）` : ''}。`
}

// ---- 出門 ----

/** 在主人的家裡，今天主人同意出門了嗎（不在主人的家裡時不用問） */
export function mayLeaveHouse(state: GameState): boolean {
  if (!isBound(state) || !atMasterHome(state)) return true
  return state.masterHousePass === state.time.day
}

export function houseRefusedToday(state: GameState): boolean {
  return state.masterHouseRefuse === state.time.day
}

/** 要走出主人家的大門時檢查 */
export function assertMayLeaveHouse(state: GameState) {
  if (mayLeaveHouse(state)) return
  const name = contractOf(state)!.masterName
  if (houseRefusedToday(state)) throw new Error(`${name}今天不准你出門。`)
  throw new Error(`要出門，先請求${name}同意（在主動行動裡「請求主人讓你出門」）。`)
}

export function leaveDc(state: GameState): number {
  const c = contractOf(state)!
  const l = rules().leave
  const aff = state.relationships?.[c.master]?.affinity ?? 0
  return l.base + c.obedience + strictPoints(state) - Math.floor(aff / l.affinity_step)
}

export function setupLeave(state: GameState) {
  if (!isBound(state) || !atMasterHome(state)) throw new Error('只有在主人的家裡才需要請求出門')
  if (mayLeaveHouse(state)) throw new Error('主人今天已經同意你出門了')
  if (houseRefusedToday(state)) throw new Error('主人今天已經拒絕了，明天再問')
  const c = contractOf(state)!
  const strict = strictPoints(state)
  return {
    attr: rules().leave.attr, dc: leaveDc(state), hours: rules().leave.hours, targetName: c.masterName,
    situational: strict ? [{ label: '嚴加看管', value: 0 }] : [],
    scene: `${currentMasterHome(state)?.name ?? '主人的家'}・請求出門${strict ? `（嚴加看管 ${strict} 點，DC 已提高）` : ''}`,
    outcomes: {
      critical: '主人爽快答應（親密度 +1）', success: '主人同意今天出門', partial: '主人勉強同意，要你早點回來',
      fail: '主人不准，今天不能出門', fumble: '主人不准，還覺得你想逃（輕度懲罰）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyLeave(state: GameState, report: Report, degree: Degree): string {
  const c = contractOf(state)!
  if (degree === 'critical' || degree === 'success' || degree === 'partial') {
    state.masterHousePass = state.time.day
    if (degree === 'critical') addAffinity(state, report, c.master, 1, '主人心情不錯')
    return degree === 'partial' ? `${c.masterName}勉強點了頭，要你早點回來。` : `${c.masterName}同意你今天出門。`
  }
  state.masterHouseRefuse = state.time.day
  if (degree === 'fumble') return `${c.masterName}起了疑心。${punish(state, 'light', report)}`
  return `${c.masterName}不准你今天出門。`
}

/** 主人的家的一行說明（給 AI 與畫面）：在哪、離家期限 */
export function masterHomeSummary(state: GameState): string {
  const d = homeDeadline(state)
  const home = d?.home ?? currentMasterHome(state)
  if (!home) return ''
  const where = `${contractOf(state)?.masterName ?? '主人'}的家在${locationById(home.location).name}`
  if (!d) return `${where}。`
  if (d.atHome) return `${where}，現在在家裡；出門後允許離家約 ${d.days} 天。`
  const left = d.hoursLeft / 24
  return left >= 0
    ? `${where}，允許離家約 ${d.days} 天，還剩約 ${Math.round(left * 10) / 10} 天。`
    : `${where}，已經離家超過期限約 ${Math.round(-left * 10) / 10} 天，主人隨時會要你回去。`
}
