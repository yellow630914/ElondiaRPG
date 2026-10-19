// 遊戲狀態、時間與報告提交。

import { gainXp, createPlayer } from './character'
import { locationById } from './data'
import { Rng } from './rng'
import type { GameState, GameTime, InventoryItem, Report } from './types'

export const START_LOCATION = 'soriel'
export const START_MONEY_CC = 500

export function newGame(opts: { name: string; race: string; classId: string; seed?: number }): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31)
  return {
    version: 1,
    seed,
    rngState: seed,
    time: { day: 1, hour: 8, minute: 0 },
    location: START_LOCATION,
    money_cc: START_MONEY_CC,
    party: [createPlayer(opts.name, opts.race, opts.classId)],
    inventory: [{ name: '乾糧', qty: 5 }],
    quests: [],
    recruited: [],
    reputation: {},
    flags: {},
    reports: [],
    nextReportNo: 1,
  }
}

export function player(state: GameState) {
  const pc = state.party.find((c) => c.isPlayer)
  if (!pc) throw new Error('no player character')
  return pc
}

/** 用狀態裡的亂數種子執行一段邏輯，結束後寫回種子。 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rngState)
  try {
    return fn(rng)
  } finally {
    state.rngState = rng.state
  }
}

export function addHours(time: GameTime, hours: number): Required<GameTime> {
  const totalMinutes =
    ((time.day - 1) * 24 + (time.hour ?? 0)) * 60 + (time.minute ?? 0) + Math.round(hours * 60)
  return {
    day: Math.floor(totalMinutes / 1440) + 1,
    hour: Math.floor((totalMinutes % 1440) / 60),
    minute: totalMinutes % 60,
  }
}

export function formatTime(time: GameTime): string {
  const hh = String(time.hour ?? 0).padStart(2, '0')
  const mm = String(time.minute ?? 0).padStart(2, '0')
  return `第 ${time.day} 天 ${hh}:${mm}`
}

export function newReportId(state: GameState): string {
  return `r-${String(state.nextReportNo++).padStart(6, '0')}`
}

export function addItem(inv: InventoryItem[], name: string, qty: number, quality?: string) {
  const item = inv.find((i) => i.name === name)
  if (item) item.qty += qty
  else inv.push(quality ? { name, qty, quality } : { name, qty })
}

/** 扣除物品，回傳實際扣掉的數量。 */
export function removeItem(inv: InventoryItem[], name: string, qty: number): number {
  const i = inv.findIndex((it) => it.name === name)
  if (i < 0) return 0
  const item = inv[i]!
  const taken = Math.min(item.qty, qty)
  item.qty -= taken
  if (item.qty <= 0) inv.splice(i, 1)
  return taken
}

/**
 * 把報告的結果套用到遊戲狀態，並把報告加進事件紀錄。
 * 經驗值造成的升級在這裡結算，結果會補寫進 report.changes.level_up。
 * 隊伍的 HP/MP 以報告 party 快照的「事件後」數值為準。
 */
export function commitReport(state: GameState, report: Report): Report {
  const c = report.changes
  state.time = { day: report.time.end.day, hour: report.time.end.hour ?? 0, minute: report.time.end.minute ?? 0 }
  if (report.kind === 'travel' && report.outcome.result === 'arrived' && report.location.to) {
    locationById(report.location.to)
    state.location = report.location.to
  }
  for (const snap of report.party) {
    const member = state.party.find((m) => m.id === snap.id)
    if (!member) continue
    if (snap.hp) member.hp = Math.max(0, Math.min(member.maxHp, snap.hp[1]))
    if (snap.mp) member.mp = Math.max(0, Math.min(member.maxMp, snap.mp[1]))
  }
  if (c.money_cc) state.money_cc += c.money_cc
  for (const item of c.items_gained ?? []) addItem(state.inventory, item.name, item.qty, item.quality)
  for (const item of c.items_lost ?? []) removeItem(state.inventory, item.name, item.qty)
  for (const a of c.affinity ?? []) {
    const npc = state.party.find((m) => m.id === a.npc)
    if (npc) npc.affinity = a.after
  }
  for (const r of c.reputation ?? []) state.reputation[r.faction] = (state.reputation[r.faction] ?? 0) + r.delta
  if (c.flags) Object.assign(state.flags, c.flags)

  if (c.xp?.length) {
    withRng(state, (rng) => {
      for (const x of c.xp!) {
        const member = state.party.find((m) => m.id === x.actor)
        if (!member || !x.amount) continue
        const from = member.level
        if (gainXp(member, x.amount, rng) > 0) {
          ;(c.level_up ??= []).push({ actor: member.id, from, to: member.level })
        }
      }
    })
  }

  state.reports.push(report)
  return report
}
