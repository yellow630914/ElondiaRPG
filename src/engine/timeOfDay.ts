// 特殊任務與事件的時段（docs/STORY_QUESTS.md「時段」）：
// - 任務點只在白天或夜裡進行（StoryNode.hours）：時段不對時不算「在這裡」，不跳出、不擋路，⭐ 照樣在地圖上，到了那個時段再來（或在原地等）。
// - 結果把時間往前推（StoryOutcome.time）：經過幾小時，或推到夜裡、隔天早上。只往前推，不會倒回去；旅途中不調整（旅程照天數走）。
// 白天與夜裡和光線、固定 NPC 的出沒、地標的開放時間一樣看 maps.json 的 lighting.day_hours（light.ts 的 isNight）。

import { isNight } from './light'
import { addHours } from './state'
import type { GameState, GameTime, Report } from './types'

export type DayPart = 'day' | 'night'
export type TimeTarget = 'night' | 'morning'

/** 結果的時間：先經過 hours 小時，再推到下一個 until 的時刻 */
export interface TimeJump {
  hours?: number
  until?: TimeTarget
}

/** 推到夜裡是晚上 20 點；推到早上是 8 點（和在旅店睡到隔天一樣） */
export const TARGET_HOUR: Record<TimeTarget, number> = { night: 20, morning: 8 }
export const DAY_PART_NAME: Record<DayPart, string> = { day: '白天', night: '夜裡' }
export const TARGET_NAME: Record<TimeTarget, string> = { night: '到夜裡（20 點）', morning: '到隔天早上（8 點）' }
/** 結果最多經過幾小時（十天） */
export const MAX_JUMP_HOURS = 240

export function dayPartOk(time: GameTime, part: DayPart | undefined): boolean {
  return !part || (part === 'night') === isNight(time)
}

/** 從 time 推到 until 要經過幾小時：夜裡已經是夜裡時不動；早上是下一個 8 點（現在 8 點以前是今天的） */
export function hoursUntil(time: GameTime, until: TimeTarget): number {
  const now = (time.hour ?? 0) + (time.minute ?? 0) / 60
  const target = TARGET_HOUR[until]
  if (until === 'night') return isNight(time) ? 0 : Math.max(0, target - now)
  return now < target ? target - now : 24 - now + target
}

/** 時間推到哪裡（沒有要推時是原本的時間） */
export function jumpFrom(time: GameTime, j: TimeJump | undefined): Required<GameTime> {
  let t = addHours(time, Math.max(0, Math.min(MAX_JUMP_HOURS, j?.hours ?? 0)))
  if (j?.until) t = addHours(t, hoursUntil(t, j.until))
  return t
}

/** 結果的說明（冒險筆記、編輯器）：「經過 3 小時，再到夜裡（20 點）」 */
export function timeJumpText(j: TimeJump | undefined): string {
  if (!j) return ''
  return [j.hours ? `經過 ${j.hours} 小時` : '', j.until ? TARGET_NAME[j.until] : ''].filter(Boolean).join('，再')
}

/**
 * 套用結果的時間：把報告的結束時間往後推（提交報告時遊戲時間跟著走，跨日的變化照常結算），
 * 並告訴 AI 結束時是什麼時候。旅途中不調整。回傳給玩家看的一句話（沒有變化時空字串）
 */
export function applyTimeJump(state: GameState, report: Report, j: TimeJump | undefined): string {
  if (!j || (!j.hours && !j.until) || state.road) return ''
  const from = report.time.end
  const to = jumpFrom(from, j)
  const passed = (((to.day - from.day) * 24 + (to.hour - (from.hour ?? 0))) * 60 + (to.minute - (from.minute ?? 0))) / 60
  if (passed <= 0) return ''
  report.time = { ...report.time, end: to }
  const when = isNight(to) ? '夜裡' : '白天'
  const label = `時間來到第 ${to.day} 天 ${String(to.hour).padStart(2, '0')}:${String(to.minute).padStart(2, '0')}（${when}）`
  report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), `結束時${label}，經過要寫出時間的流逝`] }
  return `${label}。`
}
