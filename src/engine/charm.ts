// 魅氣濃度（docs/LEWD_STATS.md 第 12 節）：每個聚落 1～4（lewd.json 的 charm：地區預設、個別地點覆蓋）。
// - 曝露名聲在這裡累積的速度（lewd.ts 的 lewdDaily）；每個地區的曝露名聲慢慢傳到相鄰地區
// - 近郊與地下城的怪物擲到「發情」的機率（combat.ts）
// - 濃度 4 的城門可以照規矩戴上拘束具進城（玩家自己選；「主角非自願」關掉時沒有這個選項）
// - 給 AI 的一句風氣（成人向的判定與敘事）

import { tagsAllowed } from './content'
import { geography, itemDef, itemRules, lewdRules, locationById, type LockGrade } from './data'
import { gearName } from './gear'
import { putOn } from './inventory'
import { addLewd } from './lewd'
import { pcOf } from './party'
import { commitReport } from './state'
import { securityReport } from './security'
import type { GameState, Report } from './types'

export function charmRules() {
  return lewdRules.charm
}

/** 這個地點的魅氣濃度 1～4（地下城、園區照所屬地區） */
export function charmLevel(locationId: string): number {
  const r = charmRules()
  const loc = locationById(locationId)
  return Math.max(1, Math.min(4, r.locations[loc.id] ?? r.regions[loc.region] ?? 2))
}

export function charmName(level: number): string {
  return charmRules().names[level] ?? ''
}

/** 曝露名聲在這裡累積的倍率 */
export function charmExposureMult(locationId: string): number {
  return charmRules().exposure_mult[charmLevel(locationId)] ?? 1
}

/** 怪物擲到「發情」的權重倍率 */
export function charmRutMult(locationId: string): number {
  return charmRules().rut_mult[charmLevel(locationId)] ?? 1
}

/** 給 AI 的一句風氣 */
export function charmNote(state: Pick<GameState, 'location'>): string {
  return charmRules().ai[charmLevel(state.location)] ?? ''
}

/** 有路直接相連的其他地區 */
export function neighborRegions(region: string): string[] {
  const of = (id: string) => geography.locations.find((l) => l.id === id)?.region
  const out = new Set<string>()
  for (const r of geography.routes) {
    const a = of(r.a)
    const b = of(r.b)
    if (a === region && b && b !== region) out.add(b)
    if (b === region && a && a !== region) out.add(a)
  }
  return [...out]
}

/** 每天一次：每個人在每個地區的曝露名聲讓相鄰地區慢慢追上它的一部分（每天 +1） */
export function spreadExposure(state: GameState) {
  const ratio = charmRules().spread.ratio
  for (const m of state.party) {
    const map = state.exposure?.[m.id]
    if (!map) continue
    const before = { ...map }
    const raise = new Set<string>()
    for (const [region, value] of Object.entries(before)) {
      const target = Math.floor(value * ratio)
      for (const n of neighborRegions(region)) if ((before[n] ?? 0) < target) raise.add(n)
    }
    for (const n of raise) addLewd(state, m, 'exposure', 1, undefined, n)
  }
}

// ---- 城門：照規矩戴上拘束具 ----

/** 這座城的城門能不能照規矩戴上拘束具進城（濃度夠、內容篩選允許「主角非自願」） */
export function charmGateOpen(state: Pick<GameState, 'location'>): boolean {
  const loc = locationById(state.location)
  return loc.type !== 'dungeon' && charmLevel(loc.id) >= charmRules().gate.min && tagsAllowed(['pc_unwilling']) && !!itemDef(charmRules().gate.item)?.gear
}

/**
 * 照規矩戴上拘束具：衛兵替主角戴上一件拘束具、用城裡的鎖鎖上，當天出入城門不用盤查（警戒時也一樣）。
 * 戲內是被要求的，戲外是玩家自己選的；鎖算主角自己的（之後可以自己打開，拘束具和鎖都歸主角）。
 */
export function charmGatePass(state: GameState): Report {
  if (!charmGateOpen(state)) throw new Error('這裡的城門沒有這個規矩')
  const r = charmRules().gate
  const loc = locationById(state.location)
  const pc = pcOf(state)
  const spec = itemDef(r.item)!.gear!
  const { target, back } = putOn(pc, r.item, spec)
  pc.gear![target]!.lock = r.lock as LockGrade
  ;(state.gatePass ??= {})[loc.id] = state.time.day
  delete state.gateBlock?.[loc.id]
  const lockName = itemRules.items.find((i) => i.lock === r.lock)?.name ?? lewdRules.locks.grades[r.lock as LockGrade]?.name ?? '鎖'
  const report = securityReport(state, `${loc.name}的規矩：外地人照規矩戴上拘束具，就能自由出入城門。衛兵替你戴上了${gearName(spec)}，用${lockName}鎖上，揮手放行${back.length ? `（${back.join('、')}收進行囊）` : ''}。`, 'success')
  report.outcome.tags = [...(report.outcome.tags ?? []), '照規矩戴上拘束具']
  if (back.length) report.changes.items_gained = back.map((n) => ({ name: n, qty: 1, owner: 'pc' }))
  report.narration = { ...report.narration, adult_scene: `${loc.name}的城門前，衛兵照當地的規矩替主角戴上${r.item}並鎖上，旁邊排隊的人都看著` }
  return commitReport(state, report)
}
