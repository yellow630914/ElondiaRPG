// 行囊：使用消耗品、更換裝備（戰鬥以外）。

import { snapshot } from './character'
import { attrName, classDef, damageTypeName, itemDef, locationById, regionById, statusDef, type ItemUse } from './data'
import { gearRules, gearSpecOf, gearStats, slotName, slotsFor, syncGear } from './gear'
import { pcOf } from './party'
import { roll } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Character, GameState, GearSlot, Report } from './types'

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
  const use = itemDef(name)?.use
  return !!use && !use.combat_only && (!!use.heal || !!use.slot)
}

/** 消耗品效果的一行說明 */
export function useSummary(use?: ItemUse): string {
  if (!use) return ''
  const parts: string[] = []
  if (use.revive) parts.push(`救起倒下的隊友（${Math.round(use.revive * 100)}% 生命）`)
  if (use.heal) parts.push(`回復 ${use.heal} HP`)
  if (use.slot) parts.push(`回復 ${use.slot} 環以下的法術環`)
  if (use.cleanse) parts.push(`解除${use.cleanse.map((id) => statusDef(id).name).join('、')}`)
  if (use.status) parts.push(`${statusDef(use.status.id).name} ${use.status.turns} 回合`)
  if (use.temp_hp) parts.push(`暫時生命 ${use.temp_hp}`)
  if (use.ap) parts.push(`行動點 +${use.ap}`)
  const area = use.area === 'all' ? '所有敵人' : '一名敵人'
  if (use.damage) parts.push(`${area} ${use.damage.dice} ${damageTypeName(use.damage.type)}傷害`)
  if (use.apply) parts.push(`${use.damage ? '' : area}${statusDef(use.apply.status).name} ${use.apply.turns} 回合${use.apply.save ? `（${attrName(use.apply.save)}豁免 DC ${use.apply.dc}）` : ''}`)
  if (use.save) parts.push(`${attrName(use.save.attr)}豁免 DC ${use.save.dc}（成功減半）`)
  if (use.escape) parts.push('全隊脫離戰鬥')
  return parts.join('、') + (use.combat_only ? '・戰鬥中' : '')
}

export function canEquip(state: Pick<GameState, 'customItems'>, name: string): boolean {
  return !!gearSpecOf(state, name)
}

/** 使用消耗品（戰鬥以外）：回復生命值或法術環。其他效果只能在戰鬥中使用。 */
export function useItem(state: GameState, name: string, memberId: string): Report {
  take(state, name)
  const def = itemDef(name)
  if (!def?.use) throw new Error('這個東西不能使用')
  if (!canUse(name)) throw new Error('這個東西只能在戰鬥中使用')
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

/**
 * 穿上裝備：放進指定的欄位（沒指定時挑第一個空的、可以放的欄位）。
 * 雙手武器會空出副手；換下來的裝備放回行囊。
 */
export function equipItem(state: GameState, name: string, memberId: string, slot?: GearSlot): Report {
  take(state, name)
  const spec = gearSpecOf(state, name)
  if (!spec) throw new Error('這個東西不能裝備')
  const m = member(state, memberId)
  const options = slotsFor(spec).filter((x) => !(gearRules.races[m.race]?.blocked ?? []).includes(x))
  if (!options.length) throw new Error(`${m.name}無法使用這個欄位`)
  if (slot && !options.includes(slot)) throw new Error(`${name}不能放在${slotName(slot)}`)
  const gear = (m.gear ??= {})
  const target = slot ?? options.find((x) => !gear[x]) ?? options[0]!
  const stats = gearStats(spec)
  const main = gear.main_hand
  if (target === 'off_hand' && main && gearStats(main.spec).two_handed) throw new Error(`${main.name}要用雙手，副手空不出來`)
  const report = itemReport(state, 0.1)
  const back: string[] = []
  const removed = gear[target]
  if (removed) back.push(removed.name)
  if (target === 'main_hand' && stats.two_handed && gear.off_hand) {
    back.push(gear.off_hand.name)
    delete gear.off_hand
  }
  gear[target] = { name, spec }
  syncGear(m, classDef(m.class).weapon)
  report.changes.items_lost = [{ name, qty: 1 }]
  if (back.length) report.changes.items_gained = back.map((n) => ({ name: n, qty: 1, owner: 'pc' }))
  report.outcome.summary = `${m.name}在${slotName(target)}裝上了${name}${back.length ? `，把${back.join('、')}收進行囊` : ''}。`
  return commitReport(state, report)
}

/** 卸下裝備，放回行囊 */
export function unequipItem(state: GameState, memberId: string, slot: GearSlot): Report {
  if (state.combat) throw new Error('戰鬥中不能這麼做')
  const m = member(state, memberId)
  const g = m.gear?.[slot]
  if (!g) throw new Error(`${slotName(slot)}沒有裝備`)
  delete m.gear![slot]
  syncGear(m, classDef(m.class).weapon)
  const report = itemReport(state, 0.1)
  report.changes.items_gained = [{ name: g.name, qty: 1, owner: 'pc' }]
  report.outcome.summary = `${m.name}卸下了${g.name}。`
  return commitReport(state, report)
}
