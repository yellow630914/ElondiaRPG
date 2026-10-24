// 把戰鬥紀錄的一筆轉成要播的特效（純資料，畫面在 CombatView 播）。
// 只讀紀錄裡已經有的東西：目標、傷害量、傷害類型、幸運一擊、大失敗、倒下。

import { statuses } from '@/engine/data'
import type { TimelineEntry } from '@/engine/types'

/** 傷害數字的顏色（依傷害類型的名稱，紀錄裡存的是名稱） */
const ELEMENT_COLOR: Record<string, string> = {
  火焰: '#ff9a3c',
  寒冰: '#7cc8ff',
  閃電: '#ffe45c',
  雷鳴: '#ffe45c',
  酸蝕: '#b6e04a',
  毒素: '#7cdc5a',
  神聖: '#ffd76a',
  暗影: '#b07cff',
  奧術: '#d58cff',
  心靈: '#ff8cc8',
}
export const PHYSICAL_COLOR = '#f4ece0'
export const HEAL_COLOR = '#7cdc6a'
export const MISS_COLOR = '#a89a84'
export const CRIT_COLOR = '#ffd34d'
export const BUFF_COLOR = '#7cc8ff'
export const DEBUFF_COLOR = '#c27cff'

export function elementColor(element?: string): string {
  return (element && ELEMENT_COLOR[element]) || PHYSICAL_COLOR
}

export type CombatCue =
  | { kind: 'damage'; target: string; amount: number; color: string; crit: boolean; area: boolean }
  | { kind: 'heal'; target: string; amount: number }
  | { kind: 'miss'; target: string; text: string }
  | { kind: 'fumble'; actor: string }
  | { kind: 'crit'; target: string }
  | { kind: 'down'; target: string; enemy: boolean }
  | { kind: 'status'; target: string; name: string; buff: boolean }

const DOWN = new Set(['倒下', '死亡'])

export function cuesFor(t: TimelineEntry): CombatCue[] {
  const effects = t.effects ?? []
  const cues: CombatCue[] = []
  const hitTargets = new Set(effects.filter((e) => e.type === 'damage' && e.target).map((e) => e.target!))
  const area = hitTargets.size > 1
  const crit = t.result === 'critical'
  // 一個目標受到好幾種傷害時合成一個數字，顏色取最大的那一種
  const sums = new Map<string, { amount: number; top: number; element?: string }>()
  for (const e of effects) {
    if (e.type !== 'damage' || !e.target) continue
    const s = sums.get(e.target) ?? { amount: 0, top: -1 }
    s.amount += e.amount ?? 0
    if ((e.amount ?? 0) > s.top) { s.top = e.amount ?? 0; s.element = e.element }
    sums.set(e.target, s)
  }
  for (const [target, s] of sums) cues.push({ kind: 'damage', target, amount: s.amount, color: elementColor(s.element), crit, area })
  for (const e of effects) {
    if (e.type === 'heal' && e.target && (e.amount ?? 0) > 0) cues.push({ kind: 'heal', target: e.target, amount: e.amount! })
  }
  if (crit && t.target && sums.size) cues.push({ kind: 'crit', target: t.target })
  const landed = sums.size > 0 || effects.some((e) => e.type === 'heal' || e.type === 'status_add')
  if (t.target && t.target !== t.actor && !landed && !t.roll?.save && (t.result === 'fail' || t.result === 'fumble')) {
    cues.push({ kind: 'miss', target: t.target, text: '失手' })
  }
  if (t.result === 'fumble') cues.push({ kind: 'fumble', actor: t.actor })
  for (const e of effects) {
    if (e.type !== 'status_add' || !e.target || !e.status) continue
    if (DOWN.has(e.status)) cues.push({ kind: 'down', target: e.target, enemy: e.status === '死亡' })
    else cues.push({ kind: 'status', target: e.target, name: e.status, buff: Object.values(statuses).find((x) => x.name === e.status)?.kind === 'buff' })
  }
  return cues
}

/**
 * 還沒播到的紀錄對 HP 的影響（傷害為正）：畫面上的 HP 條等特效播到那一筆才變。
 * 臨時 HP 先吸收的部分不另外算，播完時一定跟真實值一致。
 */
export function unplayedHpDelta(pending: TimelineEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of pending) {
    for (const e of t.effects ?? []) {
      if (!e.target || !e.amount) continue
      if (e.type === 'damage') out[e.target] = (out[e.target] ?? 0) + e.amount
      else if (e.type === 'heal') out[e.target] = (out[e.target] ?? 0) - e.amount
    }
  }
  return out
}
