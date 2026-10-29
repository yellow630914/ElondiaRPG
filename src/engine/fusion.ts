// 淫器合煉（成人向，docs/LEWD_STATS.md 第 22 節；規則在 lewd.json 的 fusion）：
// 在鐵匠鋪把一件武器和一件拘束具合成「淫器」——平常是拘束具（雙面效應照算，日常的檢定減值加重），戰鬥時展開成那件武器。
// 最近 10 天裡穿了幾天決定展開後的武器傷害倍率；穿得太少展開不了。可以拆回原本的兩件。

import { weaponFor } from './character'
import { itemDef, lewdRules, type WeaponDef } from './data'
import { gearKnown, gearRules, gearSpecOf, gearStats, registerGear } from './gear'
import { formatMoney } from './money'
import { commitReport } from './state'
import { baseReport } from './town'
import { currentCell } from './grid'
import type { Character, GameState, GearSpec, Report } from './types'

export const fusionRules = () => lewdRules.fusion

const specOf = (state: GameState, name: string) => gearSpecOf(state, name)
const isRestraint = (spec?: GearSpec) => !!spec && gearKnown(spec) && !!gearRules.bases[spec.base]?.bind && !spec.fused
const isWeapon = (spec?: GearSpec) => !!spec && gearKnown(spec) && !!gearStats(spec).weapon && !spec.fused

/** 站在能合煉的店（鐵匠鋪） */
export function fusionHere(state: GameState): boolean {
  return fusionRules().shops.includes(currentCell(state).kind)
}

/** 行囊裡可以合煉的武器與拘束具、可以拆開的淫器 */
export function fusionCandidates(state: GameState): { weapons: string[]; restraints: string[]; fused: string[] } {
  const names = state.inventory.filter((i) => i.qty > 0).map((i) => i.name)
  return {
    weapons: names.filter((n) => isWeapon(specOf(state, n))),
    restraints: names.filter((n) => isRestraint(specOf(state, n))),
    fused: names.filter((n) => !!specOf(state, n)?.fused),
  }
}

function report(state: GameState, summary: string): Report {
  const r = baseReport(state, 'trade', 1)
  r.outcome.summary = summary
  r.outcome.tags = ['淫器']
  return r
}

/** 合煉：武器和拘束具各一件，收費，換成一件淫器 */
export function fuseGear(state: GameState, weapon: string, restraint: string): Report {
  if (!fusionHere(state)) throw new Error('要在鐵匠鋪才能合煉')
  const c = fusionCandidates(state)
  if (!c.weapons.includes(weapon)) throw new Error(`行囊裡沒有可以合煉的武器「${weapon}」`)
  if (!c.restraints.includes(restraint)) throw new Error(`行囊裡沒有可以合煉的拘束具「${restraint}」`)
  const fee = fusionRules().fee_cc
  if (state.money_cc < fee) throw new Error(`錢不夠（要 ${formatMoney(fee)}）`)
  const base = specOf(state, restraint)!
  const spec: GearSpec = { ...base, fused: { weapon: specOf(state, weapon)!, weaponName: weapon, restraint } }
  const name = registerGear(state, spec, `淫器・${restraint}`, `平常是${restraint}，戰鬥時展開成${weapon}。`)
  const r = report(state, `鐵匠把${weapon}和${restraint}合煉成「${name}」，收費 ${formatMoney(fee)}。`)
  r.changes.money_cc = -fee
  r.changes.items_lost = [{ name: weapon, qty: 1 }, { name: restraint, qty: 1 }]
  r.changes.items_gained = [{ name, qty: 1, owner: 'pc' }]
  return commitReport(state, r)
}

/** 拆開：還原成原本的武器與拘束具，不收錢 */
export function splitGear(state: GameState, name: string): Report {
  if (!fusionHere(state)) throw new Error('要在鐵匠鋪才能拆開')
  const f = specOf(state, name)?.fused
  if (!f || !state.inventory.some((i) => i.name === name && i.qty > 0)) throw new Error(`行囊裡沒有淫器「${name}」`)
  const weapon = itemDef(f.weaponName)?.gear ? f.weaponName : registerGear(state, f.weapon, f.weaponName)
  const restraintSpec: GearSpec = { ...specOf(state, name)! }
  delete restraintSpec.fused
  const restraint = itemDef(f.restraint)?.gear ? f.restraint : registerGear(state, restraintSpec, f.restraint)
  const r = report(state, `鐵匠把「${name}」拆回${weapon}和${restraint}。`)
  r.changes.items_lost = [{ name, qty: 1 }]
  r.changes.items_gained = [{ name: weapon, qty: 1, owner: 'pc' }, { name: restraint, qty: 1, owner: 'pc' }]
  for (const m of state.party) delete m.wornDays?.[name]
  return commitReport(state, r)
}

// ---- 穿著的天數與展開 ----

/** 每天一次（lewd.ts 的 lewdDaily）：記下身上的淫器穿了哪幾天，只留最近 days 天 */
export function recordFusedWear(state: GameState, day: number) {
  const keep = fusionRules().days
  for (const m of state.party) {
    for (const g of Object.values(m.gear ?? {})) {
      if (!g?.spec.fused) continue
      const days = ((m.wornDays ??= {})[g.name] ??= [])
      if (!days.includes(day)) days.push(day)
      m.wornDays[g.name] = days.filter((d) => d > day - keep)
    }
  }
}

/** 最近 days 天裡穿了幾天 */
export function wornDaysOf(state: Pick<GameState, 'time'>, c: Pick<Character, 'wornDays'>, name: string): number {
  const keep = fusionRules().days
  return (c.wornDays?.[name] ?? []).filter((d) => d > state.time.day - keep).length
}

/** 穿了這麼多天的武器傷害倍率（展開不了時是 0） */
export function fusionMult(days: number): number {
  return fusionRules().tiers.find(([min]) => days >= min)?.[1] ?? 0
}

/** 戰鬥時展開的淫器：身上第一件穿夠天數的，回傳展開的武器與倍率 */
export function fusedWeapon(state: Pick<GameState, 'time'>, c: Character): { name: string; weapon: WeaponDef; mult: number } | undefined {
  for (const g of Object.values(c.gear ?? {})) {
    const f = g?.spec.fused
    if (!f || !gearKnown(f.weapon)) continue
    const mult = fusionMult(wornDaysOf(state, c, g!.name))
    const id = gearStats(f.weapon).weapon
    if (mult > 0 && id) return { name: g!.name, weapon: weaponFor({ weapon: id, level: c.level }), mult }
  }
  return undefined
}
