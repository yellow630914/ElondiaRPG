// 野外與地下城遇到敵對的冒險者：對峙與複合檢定（見 docs/NPC_SYSTEM.md 第 8.1 節）。
//
// 1. 靠近到 sight 格以內：主角先擲潛行（靈巧）對抗對方的察覺。
// 2. 沒被發現：悄悄避開、偷襲（戰鬥先手）、或主動現身（應對檢定 +2）。
//    被發現：蒙混（魅力）、威嚇（力量，依雙方等級修正）、付過路費、或開戰。

import { checkBonus } from './perks'
import { attrOf, mod, proficiency, snapshot } from './character'
import { locationById, population, regionById, type Degree } from './data'
import { startCombat, type CombatState } from './combat'
import { currentArea } from './grid'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { pcOf } from './party'
import { isHostile, peopleHere } from './population'
import { roll, withBonus } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { GameState, NpcRecord, Report, Standoff } from './types'

function eventReport(state: GameState, summary: string, result: Report['outcome']['result'], minutes = 5): Report {
  const area = currentArea(state)
  const loc = locationById(area.location)
  const pc = pcOf(state)
  const start = { ...state.time }
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, minutes / 60) },
    location: { at: area.location, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result, summary, tags: ['對峙'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

export function standoffFoes(state: GameState): NpcRecord[] {
  return (state.standoff?.npcs ?? []).map((id) => npcRecord(state, id)).filter((r): r is NpcRecord => !!r && !r.dead)
}

function names(list: NpcRecord[]): string {
  return list.map((r) => r.name).join('、')
}

/** 移動後檢查：附近有敵對的冒險者時開始對峙（主角先擲潛行） */
export function checkHostiles(state: GameState): Report | undefined {
  if (state.combat || state.standoff || state.pendingAction) return undefined
  const area = currentArea(state)
  if (area.kind === 'settlement' || area.kind === 'home') return undefined
  const day = state.time.day
  const near = peopleHere(state).filter((p) => p.dist <= population.hostility.sight && isHostile(state, p.rec, area.kind) && state.avoided?.[p.rec.id] !== day)
  if (!near.length) return undefined
  // 同一支隊伍的人一起
  const first = near[0]!.rec
  const foes = first.group
    ? peopleHere(state).map((p) => p.rec).filter((r) => r.group === first.group)
    : [first]
  const maxLevel = Math.max(...foes.map((r) => r.level))
  const dc = 10 + Math.floor(maxLevel / 2) + (foes.length - 1)
  const pc = pcOf(state)
  const bonus = mod(attrOf(pc, 'dex')) + proficiency(pc.level) + checkBonus(pc, { context: 'stealth', attr: 'dex' })
  const dice = withBonus('1d20', bonus)
  const r = withRng(state, (rng) => roll(rng, dice))
  const detected = r.total < dc
  const demand = population.hostility.toll_per_level * foes.reduce((s, f) => s + f.level, 0)
  state.standoff = { npcs: foes.map((f) => f.id), area: area.key, detected, demand_cc: demand, day }
  const report = eventReport(
    state,
    detected
      ? `在${area.name}被${names(foes)}發現了，對方擋住去路。`
      : `在${area.name}發現了${names(foes)}，對方還沒注意到你。`,
    detected ? 'failure' : 'success',
  )
  report.others = foes.map((f) => ({ id: f.id, name: f.name, level: f.level }))
  report.timeline = [{
    seq: 1, time: report.time.start, actor: 'pc', action: '靈巧檢定・潛行',
    roll: { dice, value: r.total, dc }, result: detected ? 'fail' : 'success',
  }]
  return commitReport(state, report)
}

function requireStandoff(state: GameState): Standoff {
  if (!state.standoff) throw new Error('現在沒有在對峙')
  return state.standoff
}

function endStandoff(state: GameState, avoided: boolean) {
  const s = state.standoff
  if (!s) return
  if (avoided) {
    state.avoided ??= {}
    for (const id of s.npcs) state.avoided[id] = state.time.day
  }
  delete state.standoff
}

/** 沒被發現：悄悄避開 */
export function avoidFoes(state: GameState): Report {
  const s = requireStandoff(state)
  if (s.detected) throw new Error('已經被發現了')
  const foes = standoffFoes(state)
  endStandoff(state, true)
  return commitReport(state, eventReport(state, `悄悄避開了${names(foes)}。`, 'success'))
}

/** 沒被發現：主動現身（之後的應對檢定 +2） */
export function revealSelf(state: GameState) {
  const s = requireStandoff(state)
  if (s.detected) throw new Error('已經被發現了')
  s.detected = true
  s.revealed = true
}

/** 開戰：沒被發現時是偷襲（主角先手） */
export function fightFoes(state: GameState, surprise?: 'party' | 'enemy'): CombatState {
  const s = requireStandoff(state)
  const foes = standoffFoes(state)
  const area = currentArea(state)
  const side = surprise ?? (s.detected ? undefined : 'party')
  endStandoff(state, false)
  // 敵對的冒險者攔路：就算是主角先偷襲，也算對方挑起的
  return startCombat(state, undefined, { npcs: foes.map((f) => f.id), scene: area.name, aggressor: 'npc', ...(side ? { surprise: side } : {}) })
}

/** 付過路費 */
export function payToll(state: GameState): Report {
  const s = requireStandoff(state)
  if (!s.detected) throw new Error('對方還沒發現你')
  if (state.money_cc < s.demand_cc) throw new Error('錢不夠')
  const foes = standoffFoes(state)
  const report = eventReport(state, `付給${names(foes)} ${formatMoney(s.demand_cc)}，對方讓開了路。`, 'neutral')
  report.changes.money_cc = -s.demand_cc
  endStandoff(state, true)
  return commitReport(state, report)
}

// ---- 蒙混、威嚇：主動行動（看得到骰值的 AI 或規則判定） ----

export function setupStandoff(state: GameState, kind: 'bluff' | 'intimidate', base: number) {
  const s = requireStandoff(state)
  if (!s.detected) throw new Error('對方還沒發現你，可以先避開或偷襲')
  const foes = standoffFoes(state)
  if (!foes.length) throw new Error('對方已經不在了')
  const maxLevel = Math.max(...foes.map((f) => f.level))
  const situational: { label: string; value: number }[] = []
  if (s.revealed) situational.push({ label: '主動現身', value: 2 })
  if (kind === 'intimidate') {
    const mine = state.party.filter((m) => m.hp > 0).reduce((t, m) => t + m.level, 0)
    const theirs = foes.reduce((t, f) => t + f.level, 0)
    const edge = Math.max(-4, Math.min(4, Math.trunc((mine - theirs) / 2)))
    if (edge) situational.push({ label: edge > 0 ? '我方人多勢眾' : '對方人多勢眾', value: edge })
  }
  const half = Math.round(s.demand_cc / 2)
  return {
    dc: base + Math.floor(maxLevel / 2),
    targetName: names(foes),
    situational,
    scene: currentArea(state).name,
    outcomes: {
      critical: '對方被唬住，讓開了路（今天不會再找麻煩）',
      success: '對方讓開了路',
      partial: `對方鬆口：付 ${formatMoney(half)} 就放行（也可以拒絕、開戰）`,
      fail: '談判破裂，開戰',
      fumble: '激怒了對方，對方先手',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyStandoff(state: GameState, degree: Degree): string {
  const s = state.standoff
  if (!s) return ''
  const foes = standoffFoes(state)
  switch (degree) {
    case 'critical':
    case 'success':
      endStandoff(state, true)
      return `${names(foes)}讓開了路。`
    case 'partial':
      s.demand_cc = Math.round(s.demand_cc / 2)
      return `${names(foes)}要求 ${formatMoney(s.demand_cc)} 的過路費。`
    case 'fail':
      fightFoes(state)
      return '談判破裂，雙方動手。'
    case 'fumble':
      fightFoes(state, 'enemy')
      return '激怒了對方，對方搶先出手。'
  }
}
