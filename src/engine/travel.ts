// 旅行：沿最短路徑前進，逐日結算消耗與旅途事件，最後產生一份旅行報告。
// 旅途事件目前都是非戰鬥事件；遭遇戰需要中斷旅程，留待之後實作。

import { proficiency, snapshot } from './character'
import { locationById, regionById, slaveryRules, type RouteMode } from './data'
import { roll, withBonus, type Rng } from './rng'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type { Character, Effect, GameState, Report, TimelineEntry } from './types'
import { shortestPath } from './world'
import { assertNoStandoff, currentArea, enterLocation, placeOutside } from './grid'
import { arrivalCheck, gateCheck } from './security'
import { rejoinAway } from './companions'
import { assertMasterAllows, maybeMasterEvent, type MasterEventOptions } from './slavery'
import { ensureRoster, pruneNpcs, refreshRosters } from './population'

/** 官道沿途有旅店：每人每天食宿 */
export const ROAD_DAILY_CC = 15
/** 海路船資：每人每段 */
export const SEA_FARE_CC = 50
export const RATION = '乾糧'

export const MODE_NAME: Record<RouteMode, string> = {
  road: '官道', trail: '山道', wild: '荒野', sea: '海路', dive: '潛水', underground: '地底',
}

export const EVENT_CHANCE: Record<RouteMode, number> = {
  road: 0.15, trail: 0.3, wild: 0.45, sea: 0.25, dive: 0.2, underground: 0.3,
}

export interface TravelEvent {
  action: string
  /** 有 dc 時進行求生檢定，失敗則受傷 */
  dc?: number
  failDamage?: string
  failText?: string
  text: string
}

export const EVENTS: Record<RouteMode, TravelEvent[]> = {
  road: [
    { action: '遭遇・行商隊伍', text: '與往來的商隊同行一段路，交換了沿途見聞' },
    { action: '遭遇・巡邏騎士', text: '被巡邏騎士盤查身分後放行' },
    { action: '天候・驟雨', dc: 10, failDamage: '1d2', text: '及時找到屋簷避雨', failText: '被淋得全身濕透' },
  ],
  trail: [
    { action: '天候・山間濃霧', dc: 12, failDamage: '1d4', text: '在濃霧中穩步前進', failText: '在濃霧中失足擦傷' },
    { action: '發現・野獸足跡', text: '發現新鮮的野獸足跡，繞道避開' },
    { action: '天候・風雪', dc: 13, failDamage: '1d4', text: '找到避風處熬過風雪', failText: '在風雪中受凍' },
  ],
  wild: [
    { action: '天候・酷熱', dc: 13, failDamage: '1d6', text: '節省飲水撐過最熱的時段', failText: '因酷熱而虛脫' },
    { action: '發現・古戰場殘骸', text: '經過一片散落著鏽蝕兵器的古戰場' },
    { action: '天候・腐化瘴氣', dc: 14, failDamage: '1d6', text: '屏息穿過瘴氣帶', failText: '吸入瘴氣而頭暈目眩' },
  ],
  sea: [
    { action: '航行・浪湧', dc: 11, failDamage: '1d2', text: '穩住身子撐過浪湧', failText: '暈船嘔吐了半天' },
    { action: '航行・海豚群', text: '一群海豚在船邊並游了好一段距離' },
  ],
  dive: [{ action: '潛行・暗流', dc: 12, failDamage: '1d4', text: '順著暗流的縫隙下潛', failText: '被暗流捲得撞上礁石' }],
  underground: [{ action: '地下・落石', dc: 12, failDamage: '1d4', text: '避開了落石', failText: '被落石擦傷' }],
}

export function rollLegDays(rng: Rng, [min, max]: [number, number]): number {
  if (min === max) return min
  const steps = Math.round((max - min) * 2)
  return min + rng.int(0, steps) / 2
}

export function daysToHours(days: number): number {
  return Math.floor(days) * 24 + (days % 1) * 12
}

export function travel(state: GameState, destination: string, intent?: string, events: MasterEventOptions = {}): Report {
  const path = shortestPath(state.location, destination)
  if (!path || path.legs.length === 0) throw new Error(`無法前往 ${destination}`)
  assertNoStandoff(state)
  // 身為奴隸：出發前要主人同意
  assertMasterAllows(state)
  // 從聚落出發要經過城門盤查；被攔下時回傳盤查的紀錄，不會出發
  if (currentArea(state).kind === 'settlement') {
    const g = gateCheck(state)
    if (!g.ok) {
      if (g.report) return g.report
      throw new Error(g.reason)
    }
  }
  const before = state.party.map((c) => ({ ...c }))
  const members = state.party.map((c) => ({ ...c }))
  const timeline: TimelineEntry[] = []
  let money = 0
  let hours = 0
  let seq = 1
  const start = { ...state.time }

  withRng(state, (rng) => {
    timeline.push({ seq: seq++, time: start, actor: 'pc', action: `出發・前往${locationById(destination).name}`, result: 'none' })
    for (const leg of path.legs) {
      const days = rollLegDays(rng, leg.days)
      if (leg.mode === 'sea') money -= SEA_FARE_CC * members.length
      const fullDays = Math.max(1, Math.ceil(days))
      for (let d = 0; d < fullDays; d++) {
        const dayTime = addHours(start, hours + d * 24 + 12)
        // 每日花費：官道住旅店（野外與海路不用吃乾糧）
        if (leg.mode === 'road') money -= ROAD_DAILY_CC * members.length
        if (rng.chance(EVENT_CHANCE[leg.mode])) {
          timeline.push(resolveEvent(rng, rng.pick(EVENTS[leg.mode]), members, dayTime, seq++))
        }
      }
      hours += daysToHours(days)
      timeline.push({
        seq: seq++,
        time: addHours(start, hours),
        actor: 'pc',
        action: leg.to === destination ? `抵達${locationById(leg.to).name}` : `途經${locationById(leg.to).name}`,
        result: 'success',
      })
    }
  })

  const dest = locationById(destination)
  const via = path.legs.slice(0, -1).map((l) => locationById(l.to).name)
  const pc = player(state)
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'travel',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, to: destination, region: dest.region },
    party: members.map((m, i) => snapshot(m, before[i], pc)),
    timeline,
    outcome: {
      result: 'arrived',
      summary: `從${locationById(state.location).name}${via.length ? `經${via.join('、')}` : ''}抵達${dest.name}，耗時約 ${Math.round((hours / 24) * 10) / 10} 天。`,
      tags: [...new Set(path.legs.map((l) => MODE_NAME[l.mode]))],
    },
    changes: { money_cc: money },
    narration: { pov: 'second_person', length: 'short', tone: '旅途感', ...(intent ? { player_intent: intent } : {}) },
    lore_keys: [
      locationById(state.location).name,
      ...path.legs.map((l) => locationById(l.to).name),
      regionById(dest.region).name,
    ],
  }
  commitReport(state, report)
  arrive(state)
  // 被主人帶著時，旅途中可能有主人的突發事件
  maybeMasterEvent(state, slaveryRules.master_events.travel_chance, events)
  return report
}

/** 抵達 state.location：建立地圖與名單，進城盤查，逃開的同伴歸隊 */
export function arrive(state: GameState) {
  enterLocation(state)
  ensureRoster(state, state.location)
  refreshRosters(state)
  pruneNpcs(state)
  // 進城的盤查：付不出罰金就被擋在城外
  if (!arrivalCheck(state)) placeOutside(state)
  // 戰敗時逃開的同伴在聚落等著
  rejoinAway(state)
}

export function resolveEvent(rng: Rng, ev: TravelEvent, members: Character[], time: Report['time']['start'], seq: number): TimelineEntry {
  if (ev.dc === undefined) {
    return { seq, time, actor: 'pc', action: ev.action, result: 'none', effects: [{ type: 'note', text: ev.text }] }
  }
  const leader = members[0]!
  const bonus = proficiency(leader.level)
  const r = roll(rng, withBonus('1d20', bonus))
  const success = r.total >= ev.dc
  const effects: Effect[] = [{ type: 'note', text: success ? ev.text : (ev.failText ?? ev.text) }]
  if (!success && ev.failDamage) {
    for (const m of members) {
      const dmg = roll(rng, ev.failDamage).total
      m.hp = Math.max(1, m.hp - dmg)
      effects.push({ type: 'damage', target: m.id, amount: dmg })
    }
  }
  return {
    seq, time, actor: 'pc', action: `求生檢定・${ev.action}`,
    roll: { dice: withBonus('1d20', bonus), value: r.total, dc: ev.dc },
    result: success ? 'success' : 'fail',
    effects,
  }
}
