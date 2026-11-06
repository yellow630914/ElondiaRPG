// 學工藝（docs/CRAFTING.md 第 1 節，R21 的 K5）：站在對應的店（crafts.json 的 skills.shop）付學費、花時間，工藝升一級。
// 店裡最多教到 tuition 的長度（Lv.2）；之後只能靠製作升級。不用擲骰，學會的那一級經驗從 0 起算。

import { craftRules, CRAFT_IDS, type CraftId } from './data'
import { currentCell } from './grid'
import { closedHere } from './landmarks'
import { formatMoney } from './money'
import { pcOf } from './party'
import { trainDays } from './perks'
import { commitReport } from './state'
import { shopKey, shopTypeForCell, tradeReport } from './trade'
import type { GameState, Report } from './types'
import { craftName, skillOf } from './crafting'

export interface CraftLesson {
  craft: CraftId
  name: string
  /** 現在的等級與學完的等級 */
  from: number
  to: number
  price_cc: number
  /** 練習的總時數 */
  hours: number
  days: number
  blocked?: string
}

/** 主角在這裡可以學的工藝（這一格的店教的、還沒到店裡教的上限） */
export function craftLessons(state: GameState): CraftLesson[] {
  const type = shopTypeForCell(currentCell(state).kind)
  if (!type || closedHere(state)) return []
  const pc = pcOf(state)
  return CRAFT_IDS.filter((id) => craftRules.skills[id].shop === type).flatMap((id) => {
    const from = skillOf(pc, id).level
    const t = craftRules.tuition[from]
    if (!t) return []
    return [{
      craft: id, name: craftName(id), from, to: from + 1, price_cc: t.price_cc, hours: t.hours, days: trainDays(t.hours).days,
      ...(state.money_cc < t.price_cc ? { blocked: `錢不夠（要 ${formatMoney(t.price_cc)}）` } : {}),
    }]
  })
}

/** 學一級工藝：付學費、花時間（每天練 8 小時），等級 +1、經驗從 0 起算 */
export function learnCraft(state: GameState, id: CraftId): Report {
  const lesson = craftLessons(state).find((l) => l.craft === id)
  if (!lesson) throw new Error(`這裡學不到${craftName(id)}（店裡最多教到 Lv.${craftRules.tuition.length}）`)
  if (lesson.blocked) throw new Error(lesson.blocked)
  const pc = pcOf(state)
  const report = tradeReport(state, shopKey(state, shopTypeForCell(currentCell(state).kind)!), trainDays(lesson.hours).elapsed)
  report.changes.money_cc = -lesson.price_cc
  pc.crafts = { ...pc.crafts, [id]: { level: lesson.to, xp: 0 } }
  report.outcome.summary = `付了 ${formatMoney(lesson.price_cc)}，花${lesson.days > 1 ? ` ${lesson.days} 天` : ''}練了 ${lesson.hours} 小時，學會了${lesson.name}（Lv.${lesson.from} → Lv.${lesson.to}）。`
  report.outcome.tags = ['學工藝']
  return commitReport(state, report)
}
