// 奴隸主動找主角（docs/COMPANIONS.md 2.9 節；data/rules/slavery.json 的 slave_events）：
// 「找主人做點什麼」的反向版本——主角帶著自己的奴隸時，走動與旅行之後，隊伍裡的一位奴隸可能主動來找主角
// （送吃的、求休息、說起往事、夜裡鑽進被窩……）。事件用主人事件的格式（事件庫 slave），主角從回應裡選一個：
// {actor} 是那位奴隸；親密度看奴隸對主角；主僕關係（bondStyle.ts）調整權重、有專屬事件。

import { slaveryRules, type MasterEventDef } from './data'
import { bondOf, bondWeight } from './bondStyle'
import { gameRule } from './gameRules'
import { currentArea } from './grid'
import { ownHomeOfArea } from './homes'
import { npcRecord } from './npcs'
import { trainees } from './ownerTraining'
import { withRng } from './state'
import type { Character, GameState, PendingMasterEvent } from './types'

const rules = () => slaveryRules.slave_events

function hoursOf(state: GameState): number {
  const t = state.time
  return t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60
}

/** 現在有沒有別的事要先處理（和主人的突發事件一樣） */
function busy(state: GameState): boolean {
  return !!(state.combat || state.pendingAction || state.standoff || state.pendingMark || state.pendingMasterEvent
    || state.dungeonEvent || state.parasiteEvent || state.leadEvent)
}

/** 這件事會不會發生在這位奴隸身上：奴隸對主角的親密度、奴隸的標籤、在不在主角的房子裡、兩人的主僕關係 */
export function slaveEventFits(state: GameState, slave: Character, e: MasterEventDef): boolean {
  const aff = state.relationships?.[slave.id]?.affinity ?? 0
  if (e.affinity_min !== undefined && aff < e.affinity_min) return false
  if (e.affinity_max !== undefined && aff > e.affinity_max) return false
  const tags = npcRecord(state, slave.id)?.tags ?? []
  if (e.tags?.length && !e.tags.some((t) => tags.includes(t))) return false
  if (e.tags_none?.some((t) => tags.includes(t))) return false
  if (e.at_home !== undefined && e.at_home !== !!ownHomeOfArea(state, currentArea(state))) return false
  return bondWeight(e, bondOf(state, slave.id)) > 0
}

/** 走動或旅行之後：帶著自己的奴隸時，可能有一位奴隸主動來找主角（等主角回應） */
export function maybeSlaveEvent(state: GameState, chance: number): PendingMasterEvent | undefined {
  if (busy(state)) return undefined
  const slaves = trainees(state)
  if (!slaves.length) return undefined
  const now = hoursOf(state)
  if (state.lastSlaveEvent !== undefined && now - state.lastSlaveEvent < rules().cooldown_hours) return undefined
  const events = rules().events
  const options = slaves.map((s) => ({ s, list: events.filter((e) => slaveEventFits(state, s, e)) })).filter((x) => x.list.length)
  if (!options.length) return undefined
  const picked = withRng(state, (rng) => {
    if (!rng.chance(Math.min(1, chance * gameRule(state, 'slaveEventMult')))) return undefined
    const { s, list } = rng.pick(options)
    const style = bondOf(state, s.id)
    let r = rng.next() * list.reduce((sum, e) => sum + bondWeight(e, style), 0)
    const e = list.find((x) => (r -= bondWeight(x, style)) < 0) ?? list[list.length - 1]!
    return { s, e }
  })
  if (!picked) return undefined
  return startSlaveEvent(state, picked.s, picked.e)
}

/** 開始一件奴隸主動找主角的事件 */
export function startSlaveEvent(state: GameState, slave: Character, e: MasterEventDef): PendingMasterEvent {
  state.lastSlaveEvent = hoursOf(state)
  state.pendingMasterEvent = { id: e.id, pool: 'slave', actor: slave.id, text: e.text.split('{actor}').join(slave.name).split('{master}').join(slave.name) }
  return state.pendingMasterEvent
}

/** 旅途地圖上放不放奴隸的事件格（帶著自己的奴隸時） */
export function slaveTravelChance(state: GameState): number {
  return trainees(state).length ? Math.min(1, rules().travel_chance * gameRule(state, 'slaveEventMult')) : 0
}
