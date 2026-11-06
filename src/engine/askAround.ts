// 在酒館打聽（P2；docs/TRAVEL_EVENTS.md 第 5.1 節）：請一輪酒、擲魅力檢定，揭露這個地區線索池裡隱藏的線索。
// 成功 1 則、大成功（自然 20 或超過 DC 10 以上）2 則；失敗只花了酒錢。同一間酒館一天一次，花 1 小時。

import { snapshot } from './character'
import { naturalCritOnly } from './checks'
import { formatMoney } from './money'
import { currentArea, currentCell } from './grid'
import { activeLeads, discoverLead, ensureLeadPool, leadPoolOn } from './leads'
import { locationById, regionById } from './data'
import { pcOf } from './party'
import { checkModifiers, modifierNote } from './perks'
import { roll, withBonus } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { GameState, Report } from './types'
import { attrParts, rollBreakdown, sumParts } from './rollParts'

/** 請一輪酒的錢 */
export const ASK_COST = 15
/** 打聽的 DC */
export const ASK_DC = 13

/** 還沒被知道的隱藏線索（這個地區） */
function hiddenHere(state: GameState) {
  const region = locationById(state.location).region
  ensureLeadPool(state, region)
  return activeLeads(state, region).filter((l) => l.visibility === 'hidden' && !l.known)
}

/** 現在能不能打聽：不能時回傳原因 */
export function askAroundBlock(state: GameState): string | null {
  if (!leadPoolOn()) return '線索池關著（設定 → 遊戲規則）'
  if (currentArea(state).kind !== 'settlement' || currentCell(state).kind !== 'tavern') return '要在酒館才能打聽'
  if (state.flags[`asked:${state.location}`] === state.time.day) return '今天已經在這裡打聽過了'
  if (state.money_cc < ASK_COST) return `要 ${formatMoney(ASK_COST)} 請一輪酒`
  if (!hiddenHere(state).length) return '這一帶最近沒什麼新的消息'
  return null
}

/** 打聽：請一輪酒、魅力檢定，揭露隱藏的線索 */
export function askAround(state: GameState): Report {
  const block = askAroundBlock(state)
  if (block) throw new Error(block)
  const pc = pcOf(state)
  const loc = locationById(state.location)
  const start = { ...state.time }
  const extra = checkModifiers(pc, { context: 'action', attr: 'cha' })
  const parts = [...attrParts(pc, 'cha'), ...extra]
  const dice = withBonus('1d20', sumParts(parts))
  const r = withRng(state, (rng) => roll(rng, dice))
  const natural = r.rolls[0] ?? r.total
  const ok = natural === 20 || (natural !== 1 && r.total >= ASK_DC)
  const critical = natural === 20 || (!naturalCritOnly(state) && r.total >= ASK_DC + 10)
  state.flags[`asked:${state.location}`] = state.time.day
  const found = ok ? hiddenHere(state).slice(0, critical ? 2 : 1).map((l) => discoverLead(state, l, `${loc.name}的酒館`)) : []
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'social',
    time: { start, end: addHours(start, 1) },
    location: { at: state.location, region: loc.region, scene: `${loc.name}的酒館` },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    timeline: [{ seq: 1, time: start, actor: pc.id, action: `魅力檢定・在酒館打聽消息${modifierNote(extra)}`, roll: { dice, value: r.total, dc: ASK_DC, ...rollBreakdown(r.rolls[0]!, parts) }, result: ok ? 'success' : 'fail' }],
    outcome: {
      result: ok ? 'success' : 'failure',
      summary: `你在${loc.name}的酒館請了一輪酒（${formatMoney(ASK_COST)}），向酒客們打聽最近的消息。${found.length
        ? `打聽到${found.map((it) => `「${it.title}」：${it.text}（第 ${it.until} 天前有效）`).join('；還有')}。記在冒險筆記。`
        : '大家喝得很開心，可是沒有人說出什麼有用的事。'}`,
      tags: ['打聽', ...(found.length ? ['情報'] : [])],
    },
    changes: { money_cc: -ASK_COST },
    narration: { pov: 'second_person', length: 'short', focus: found.length ? found.map((it) => `酒客說起：${it.title}（${it.text}）`) : ['酒客們東拉西扯，沒有什麼有用的消息'] },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  return commitReport(state, report)
}
