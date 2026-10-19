// 行囊：使用消耗品、更換裝備（戰鬥以外）。

import { snapshot } from './character'
import { armorDef, itemDef, locationById, regionById, weaponDef } from './data'
import { pcOf } from './party'
import { roll } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Character, GameState, Report } from './types'

function itemReport(state: GameState, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'trade',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: loc.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

function member(state: GameState, id: string): Character {
  const m = state.party.find((x) => x.id === id)
  if (!m) throw new Error('隊伍中沒有這位角色')
  return m
}

function take(state: GameState, name: string) {
  if (!state.inventory.some((i) => i.name === name && i.qty > 0)) throw new Error(`沒有${name}`)
  if (state.combat) throw new Error('戰鬥中不能這麼做')
}

export function canUse(name: string): boolean {
  return !!itemDef(name)?.use
}

export function canEquip(name: string): boolean {
  return !!itemDef(name)?.equip
}

/** 使用消耗品：回復生命值或法術環。 */
export function useItem(state: GameState, name: string, memberId: string): Report {
  take(state, name)
  const def = itemDef(name)
  if (!def?.use) throw new Error('這個東西不能使用')
  const m = member(state, memberId)
  const report = itemReport(state, 0.1)
  const snap = report.party.find((p) => p.id === m.id)!
  let text = ''
  if (def.use.heal) {
    if (m.hp >= m.maxHp) throw new Error(`${m.name}沒有受傷`)
    const before = m.hp
    const healed = withRng(state, (rng) => roll(rng, def.use!.heal!).total)
    snap.hp = [before, Math.min(m.maxHp, before + healed), m.maxHp]
    text = `回復 ${snap.hp[1] - before} 點生命值`
  } else if (def.use.slot) {
    const circle = [...m.slotsUsed.keys()].filter((i) => i < def.use!.slot! && (m.slotsUsed[i] ?? 0) > 0).pop()
    if (circle === undefined) throw new Error(`${m.name}沒有可以回復的法術環`)
    m.slotsUsed[circle]! -= 1
    text = `回復一個 ${circle + 1} 環法術環`
  }
  report.changes.items_lost = [{ name, qty: 1 }]
  report.outcome.summary = `${m.name}使用了${name}，${text}。`
  return commitReport(state, report)
}

/** 裝備武器或防具；換下來的裝備（目錄裡有的）放回行囊。 */
export function equipItem(state: GameState, name: string, memberId: string): Report {
  take(state, name)
  const def = itemDef(name)
  if (!def?.equip) throw new Error('這個東西不能裝備')
  const m = member(state, memberId)
  const report = itemReport(state, 0.1)
  let old: string
  if (def.equip.weapon) {
    old = weaponDef(m.weapon).name
    m.weapon = def.equip.weapon
  } else {
    old = armorDef(m.armor).name
    m.armor = def.equip.armor!
  }
  report.changes.items_lost = [{ name, qty: 1 }]
  if (itemDef(old)) report.changes.items_gained = [{ name: old, qty: 1, owner: 'pc' }]
  report.outcome.summary = `${m.name}換上了${name}${itemDef(old) ? `，把${old}收進行囊` : ''}。`
  return commitReport(state, report)
}
