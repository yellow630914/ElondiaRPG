// 淫鬥場（成人向，docs/LEWD_STATS.md 第 21 節；規則在 lewd.json 的 arena）：
// 魅氣濃的城鎮，站在娼館或酒館可以報名三種擂臺——淫物場、拘束戰鬥場（上場前戴一件拘束具）、性戰場（只算慾望）。
// 每贏幾場往上一級對手，輸了連勝歸零；輸了不損失錢、沒有戰敗事件（比賽就是比賽）。

import { charmLevel } from './charm'
import { startCombat, type CombatState } from './combat'
import { gameRule } from './gameRules'
import { itemDef, lewdRules, locationById, type EncounterGroup, type LewdKey } from './data'
import { gearRules } from './gear'
import { applyEffects } from './effects'
import { currentCell } from './grid'
import { putOn } from './inventory'
import { addLewd } from './lewd'
import { formatMoney } from './money'
import { pcOf } from './party'
import { addItem, removeItem, withRng } from './state'
import type { GameState, GearSlot, Report } from './types'

export const arenaRules = () => lewdRules.arena

/** 這裡能不能報名：魅氣濃度夠、站在娼館或酒館、慾望戰鬥開著、不在戰鬥中 */
export function arenaBlocked(state: GameState): string | undefined {
  const r = arenaRules()
  const loc = locationById(state.location)
  if (loc.type === 'dungeon') return '這裡沒有淫鬥場'
  if (charmLevel(loc.id) < r.charm_min) return '這座城沒有淫鬥場'
  if (!r.cells.includes(currentCell(state).kind)) return '淫鬥場的入口在娼館或酒館'
  if (gameRule(state, 'lustMult') <= 0) return '這個存檔關閉了慾望戰鬥'
  if (state.combat || state.pendingAction || state.pendingDefeat) return '現在不能這麼做'
  return undefined
}

export function arenaHere(state: GameState): boolean {
  return !arenaBlocked(state)
}

function record(state: GameState, ring: string) {
  return ((state.arena ??= {})[state.location] ??= {})[ring] ??= { streak: 0, best: 0 }
}

/** 這個擂臺現在的對手等級（0 起算）：每贏 streak_per_tier 場升一級 */
export function arenaTier(state: GameState, ring: string): number {
  const r = arenaRules()
  const tiers = r.rings[ring]?.tiers ?? []
  const streak = state.arena?.[state.location]?.[ring]?.streak ?? 0
  return Math.min(tiers.length - 1, Math.floor(streak / r.streak_per_tier))
}

export function arenaOpponent(ring: string, tier: number): EncounterGroup {
  const tiers = arenaRules().rings[ring]?.tiers ?? []
  return tiers[Math.min(tier, tiers.length - 1)] ?? []
}

/** 這一場的報名費與獎金 */
export function arenaPurse(tier: number, wager = false): { fee: number; prize: number } {
  const r = arenaRules()
  const mult = wager ? r.wager.mult : 1
  return { fee: r.fee * mult, prize: (r.prize.base + r.prize.per_tier * tier) * mult }
}

/** 行囊裡可以帶上拘束戰鬥場的拘束具 */
export function arenaRestraints(state: GameState): string[] {
  return state.inventory.filter((i) => i.qty > 0 && !!gearRules.bases[itemDef(i.name)?.gear?.base ?? '']?.bind).map((i) => i.name)
}

/** 報名：付報名費、（拘束戰鬥場）戴上拘束具，開打 */
export function startArena(state: GameState, ring: string, opts: { restraint?: string; wager?: boolean } = {}): CombatState {
  const why = arenaBlocked(state)
  if (why) throw new Error(why)
  const def = arenaRules().rings[ring]
  if (!def) throw new Error('沒有這個擂臺')
  const tier = arenaTier(state, ring)
  const { fee } = arenaPurse(tier, opts.wager)
  if (state.money_cc < fee) throw new Error(`報名費不夠（要 ${formatMoney(fee)}）`)
  const pc = pcOf(state)
  let restraint: { name: string; slot: GearSlot } | undefined
  if (def.restraint) {
    const name = opts.restraint
    if (!name || !arenaRestraints(state).includes(name)) throw new Error('要選一件行囊裡的拘束具戴上')
    const spec = itemDef(name)!.gear!
    const { target, back } = putOn(pc, name, spec)
    removeItem(state.inventory, name, 1)
    for (const b of back) addItem(state.inventory, b, 1)
    // 鎖上，雙面效應的戰鬥增益才生效
    pc.gear![target]!.lock = 'white'
    restraint = { name, slot: target }
  }
  state.money_cc -= fee
  return startCombat(state, arenaOpponent(ring, tier), {
    scene: `${locationById(state.location).name}的淫鬥場・${def.name}`,
    arena: { ring, tier, fee, ...(opts.wager ? { wager: true } : {}), ...(restraint ? { restraint } : {}) },
    ...(def.lust_only ? { lustOnly: true } : {}),
  })
}

/** 戰後（finishCombat 呼叫）：拿掉上場前戴的拘束具、記連勝、發獎金與獎品；賭注賽輸了另外有代價 */
export function settleArena(state: GameState, combat: CombatState, report: Report) {
  const m = combat.arena
  if (!m) return
  const r = arenaRules()
  const def = r.rings[m.ring]
  const pc = pcOf(state)
  if (m.restraint && pc.gear?.[m.restraint.slot]?.name === m.restraint.name) {
    delete pc.gear[m.restraint.slot]
    ;(report.changes.items_gained ??= []).push({ name: m.restraint.name, qty: 1, owner: 'pc' })
  }
  const rec = record(state, m.ring)
  const lines = [`（${def?.name ?? '淫鬥場'}，報名費 ${formatMoney(m.fee)}）`]
  if (combat.status === 'victory') {
    rec.streak += 1
    rec.best = Math.max(rec.best, rec.streak)
    const { prize } = arenaPurse(m.tier, m.wager)
    const rare = def?.rare
    const extra = withRng(state, (rng) => [
      ...(rng.chance(r.item_chance) ? [rng.pick(r.items)] : []),
      ...(m.tier >= r.book_tier && rng.chance(r.book_chance) ? [rng.pick(r.books)] : []),
      // 這個擂臺專屬的稀有獎品（對手夠強時）
      ...(rare?.items.length && m.tier >= rare.tier && rng.chance(rare.chance) ? [rng.pick(rare.items)] : []),
    ])
    applyEffects(state, report, [{ type: 'money', amount: prize }, ...extra.map((name) => ({ type: 'item' as const, name, qty: 1 }))])
    lines.push(`贏了，連勝 ${rec.streak} 場，獎金 ${formatMoney(prize)}${extra.length ? `，另外拿到${extra.join('、')}` : ''}。`)
  } else {
    rec.streak = 0
    lines.push('輸了，連勝歸零。')
    if (m.wager) for (const [k, v] of Object.entries(r.wager.loss)) if (v) addLewd(state, pc, k as LewdKey, v, report)
  }
  report.outcome.summary = `${report.outcome.summary ?? ''}${lines.join('')}`
  report.outcome.tags = [...(report.outcome.tags ?? []), '淫鬥場']
}
