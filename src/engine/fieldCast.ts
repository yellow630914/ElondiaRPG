// 戰鬥外施放治療與護盾類的能力（docs/COMBAT_SYSTEM.md 第 9 節「戰鬥外施放」）。
// 回復量與護盾量和戰鬥裡同一條公式（combat.ts 的 resolveAuto），法術可以升環。
// 花費：法術花一個該環以上的法術環；技能有「每次休息」次數的照那個算，其他技能（每場戰鬥 N 次或不限）
// 在兩次長休之間戰鬥外最多用 N 次（不限的算 1 次），記在 usesPerRest 的 `field:<能力 id>`。
// 兩個入口：隊伍的「施放」（castOutsideCombat，直接結算），以及主動行動的「搭配能力」對夥伴使用時
// （actions.ts：準備時擲好、判定時套用，再加上玩家描述的行為交給判定）。

import { attrOf, castingAttr, mod, slotsLeft, snapshot } from './character'
import { abilityDef, locationById, type AbilityDef, type AttrId } from './data'
import { pcOf } from './party'
import { recordResource, spendSlot } from './resources'
import { roll } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Character, GameState, Report, ResourceChange } from './types'
import { upcastAbility, upcastLevels } from './upcast'

const FIELD_TARGETS = new Set(['self', 'ally', 'ally_or_downed', 'all_allies'])

/** 這個能力能不能在戰鬥外施放：有治療或護盾、必中結算、對自己或隊友 */
export function fieldCastable(a: AbilityDef): boolean {
  return (!!a.heal || !!a.shield) && a.resolve === 'auto' && FIELD_TARGETS.has(a.target)
}

/** 這位隊員會、戰鬥外能施放的能力 */
export function fieldAbilities(c: Character): AbilityDef[] {
  return c.abilities.map((id) => abilityDef(id)).filter((a) => !!a && fieldCastable(a))
}

const fieldKey = (a: AbilityDef) => `field:${a.id}`
/** 戰鬥外的使用次數上限（技能沒有「每次休息」次數時） */
const fieldLimit = (a: AbilityDef) => a.uses?.per_combat ?? 1

/** 能不能施放；可以時回傳 null */
export function fieldCastBlock(c: Character, a: AbilityDef): string | null {
  if (!c.abilities.includes(a.id)) return `${c.name}不會【${a.name}】`
  if (!fieldCastable(a)) return `【${a.name}】不能在戰鬥外使用`
  if (c.hp <= 0) return `${c.name}倒下了`
  if (a.type === 'spell') {
    const left = slotsLeft(c)
    return left.slice((a.circle ?? 1) - 1).some((n) => n > 0) ? null : `${c.name}沒有 ${a.circle ?? 1} 環以上的法術環了`
  }
  if (a.uses?.per_rest !== undefined) return (c.usesPerRest[a.id] ?? 0) < a.uses.per_rest ? null : `【${a.name}】要長休後才能再用`
  return (c.usesPerRest[fieldKey(a)] ?? 0) < fieldLimit(a) ? null : `【${a.name}】在戰鬥外要長休後才能再用`
}

/** 還剩幾次（法術是 null：看法術環） */
export function fieldUsesLeft(c: Character, a: AbilityDef): number | null {
  if (a.type === 'spell') return null
  if (a.uses?.per_rest !== undefined) return Math.max(0, a.uses.per_rest - (c.usesPerRest[a.id] ?? 0))
  return Math.max(0, fieldLimit(a) - (c.usesPerRest[fieldKey(a)] ?? 0))
}

/** 可以選的對象：對自己的只有施放者；群體的是全隊；單體的是隊友（「包括倒下的」才能選倒下的人） */
export function fieldTargets(state: GameState, c: Character, a: AbilityDef): Character[] {
  if (a.target === 'self') return [c]
  return state.party.filter((m) => a.target === 'ally_or_downed' || a.target === 'all_allies' || m.hp > 0)
}

/** 花掉施放的資源；回傳施放的環數（技能是 undefined）與說明 */
function spend(c: Character, a: AbilityDef, report?: Report): { circle?: number; cost: string; change: ResourceChange } {
  const block = fieldCastBlock(c, a)
  if (block) throw new Error(block)
  if (a.type === 'spell') {
    const circle = spendSlot(c, a.circle ?? 1)!
    const change: ResourceChange = { actor: c.id, kind: 'slot', delta: -1, detail: `${circle} 環（${a.name}）` }
    recordResource(report, change)
    return { circle, cost: `${circle} 環法術環`, change }
  }
  const key = a.uses?.per_rest !== undefined ? a.id : fieldKey(a)
  c.usesPerRest[key] = (c.usesPerRest[key] ?? 0) + 1
  const change: ResourceChange = { actor: c.id, kind: 'ability_use', delta: -1, detail: a.name }
  recordResource(report, change)
  return { cost: '一次使用次數', change }
}

export interface FieldEffect {
  target: string
  name: string
  /** 回復的生命（擲好的數字；套用時再扣掉超過上限的部分） */
  heal?: number
  /** 護盾（臨時生命值） */
  shield?: number
}

/** 擲回復量與護盾量（和戰鬥裡同一條公式） */
function rollEffects(state: GameState, c: Character, a: AbilityDef, targets: Character[]): FieldEffect[] {
  const attr: AttrId = !a.attr ? castingAttr(c.class) : a.attr === 'casting' ? castingAttr(c.class) : a.attr
  return withRng(state, (rng) => targets.map((t) => {
    const e: FieldEffect = { target: t.id, name: t.name }
    if (a.heal) {
      const h = a.heal
      e.heal = h.full ? t.maxHp : (h.flat ?? 0) + (h.dice ? roll(rng, h.dice).total : 0) + (h.mod ? mod(attrOf(c, attr)) : 0) + (h.level ? c.level : 0)
    }
    if (a.shield) e.shield = (a.shield.flat ?? 0) + (a.shield.level ?? 0) * c.level
    return e
  }))
}

/** 準備施放：檢查對象、花資源、擲效果（還沒套用） */
export function prepareFieldCast(state: GameState, casterId: string, abilityId: string, targetId?: string, report?: Report): {
  caster: Character; ability: AbilityDef; circle?: number; cost: string; change: ResourceChange; effects: FieldEffect[]
} {
  const caster = state.party.find((m) => m.id === casterId)
  if (!caster) throw new Error('隊伍中沒有這位角色')
  const base = abilityDef(abilityId)
  if (!base) throw new Error('沒有這個能力')
  const options = fieldTargets(state, caster, base)
  const targets = base.target === 'all_allies' ? options : base.target === 'self' ? [caster] : options.filter((m) => m.id === targetId)
  if (!targets.length) throw new Error(targetId ? '不能對這個人施放' : '要選一個對象')
  const used = spend(caster, base, report)
  const ability = used.circle ? upcastAbility(base, upcastLevels(base, used.circle)) : base
  return { caster, ability: base, ...(used.circle ? { circle: used.circle } : {}), cost: used.cost, change: used.change, effects: rollEffects(state, caster, ability, targets) }
}

/** 把擲好的效果套用到報告的隊伍快照（生命）與角色身上（護盾）；回傳說明 */
export function applyFieldEffects(state: GameState, report: Report, effects: FieldEffect[]): string[] {
  const out: string[] = []
  for (const e of effects) {
    const m = state.party.find((x) => x.id === e.target)
    if (!m) continue
    const parts: string[] = []
    if (e.heal !== undefined) {
      const snap = report.party.find((p) => p.id === m.id)
      const before = snap?.hp?.[1] ?? m.hp
      const after = Math.min(m.maxHp, before + e.heal)
      if (snap) snap.hp = [snap.hp?.[0] ?? m.hp, after, m.maxHp]
      else m.hp = after
      parts.push(after > before ? `回復 ${after - before} 點生命` : '生命已經是滿的')
    }
    if (e.shield) {
      m.tempHp = Math.max(m.tempHp ?? 0, e.shield)
      parts.push(`得到 ${e.shield} 點臨時生命（下一場戰鬥帶著，長休後消失）`)
    }
    out.push(`${m.name}${parts.join('、')}`)
  }
  return out
}

/** 隊伍的「施放」：直接結算，寫一筆日誌 */
export function castOutsideCombat(state: GameState, casterId: string, abilityId: string, targetId?: string): Report {
  if (state.combat) throw new Error('戰鬥中請在戰鬥畫面使用')
  if (state.pendingAction) throw new Error('還有一個行動等待判定')
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, 0.1) },
    location: { at: state.location, region: loc.region, scene: loc.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success', tags: ['戰鬥外施放'] },
    changes: {},
  }
  const cast = prepareFieldCast(state, casterId, abilityId, targetId, report)
  const lines = applyFieldEffects(state, report, cast.effects)
  const whom = cast.ability.target === 'self' ? '' : cast.ability.target === 'all_allies' ? '對全隊' : `對${cast.effects[0]!.name}`
  report.outcome.summary = `${cast.caster.name}${whom}施放了【${cast.ability.name}】${cast.circle ? `（${cast.circle} 環）` : ''}：${lines.join('；')}。`
  return commitReport(state, report)
}
