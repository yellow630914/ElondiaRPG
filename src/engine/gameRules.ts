// 這個存檔的規則（state.options）：開新遊戲時選，之後可以在設定的「這個存檔的規則」改。
// 每一項都有預設值（和沒有這項規則時一樣），讀的時候一律夾在範圍內；舊存檔沒有的欄位就是預設。
// 戰敗掉落（defeatLoot）另外在 expedition.ts。說明見 docs/SAVES.md 第 7 節。

import type { GameOptions, GameState } from './types'
import { companionRules, combatRules } from './data'
// 直接讀 JSON：security.ts 會用到這裡，避免循環引用
import securityJson from '@data/rules/security.json'

/** 數值類的存檔規則 */
export type NumericRule = Exclude<keyof GameOptions, 'defeatLoot'>

export interface RuleDef {
  label: string
  hint: string
  default: number
  min: number
  max: number
  step: number
  /** 顯示的單位（倍、小時、天……） */
  unit: string
  /** 設成 0 時的意思（例如「不限期限」） */
  zero?: string
}

export const RULE_DEFS: Record<NumericRule, RuleDef> = {
  xpMult: { label: '經驗值倍率', hint: '所有經驗值（戰鬥、委託、事件）乘上這個倍率。', default: 1, min: 0.25, max: 5, step: 0.25, unit: '倍' },
  moneyMult: { label: '報酬與戰利品的錢', hint: '委託報酬、特殊任務與事件給的錢、戰鬥與寶箱撿到的錢乘上這個倍率；賣東西與打工的收入、物價不變。', default: 1, min: 0.25, max: 5, step: 0.25, unit: '倍' },
  ambushMult: { label: '休息時被襲擊的機率', hint: `在野外、地下城、旅途上休息時被魔物襲擊的機率乘上這個倍率（預設：近郊 ${pct(companionRules.rest.ambush.wild)}、冒險區域 ${pct(companionRules.rest.ambush.dungeon)}、旅途 ${pct(companionRules.rest.ambush.road)}）。0 表示不會被襲擊；安全房與城裡一直是 0。`, default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '不會被襲擊' },
  travelEventMult: { label: '旅途事件的頻率', hint: '旅途上每天發生事件的機率乘上這個倍率（預設依路況 25%～55%，最高 100%）。0 表示一路平安。', default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '一路平安' },
  deadlineMult: { label: '委託的期限', hint: '公會委託的期限乘上這個倍率（預設城內 3 天、近郊 5 天、冒險區域 7 天＋路程每天 2 天）。0 表示不限期限。只影響之後接的委託；特殊任務的期限不變。', default: 1, min: 0, max: 5, step: 0.25, unit: '倍', zero: '不限期限' },
  shortRestHours: { label: '短休的時間', hint: `短休花幾小時（預設 ${companionRules.rest.short_hours}）。`, default: companionRules.rest.short_hours, min: 0.5, max: 4, step: 0.5, unit: '小時' },
  longRestHours: { label: '長休的時間', hint: `長休花幾小時（預設 ${companionRules.rest.long_hours}）。住旅店照樣住到隔天早上。`, default: companionRules.rest.long_hours, min: 2, max: 12, step: 1, unit: '小時' },
  alertDecayDays: { label: '衛兵警戒多久降一級', hint: `犯案被目擊後，城裡的警戒每隔幾天降 1（預設 ${securityJson.alert.decay_days}）。`, default: securityJson.alert.decay_days, min: 1, max: 30, step: 1, unit: '天' },
  blackMarketGear: { label: '黑市每天的珍品', hint: '知道黑市的城鎮，黑市每天刷新幾件獨特裝備（物品勾了「也會出現在黑市」的）。0 表示黑市不賣裝備。', default: 3, min: 0, max: 10, step: 1, unit: '件', zero: '不賣裝備' },
  escapeDc: { label: '逃跑與撤退的難度', hint: `戰鬥中撤退（預設 DC ${combatRules.flee_dc}）與地下城緊急撤退的 DC 加減。負數比較容易。`, default: 0, min: -10, max: 10, step: 1, unit: 'DC' },
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/** 讀一項存檔規則（沒有設定、不是數字時用預設，超出範圍的夾回來） */
export function gameRule(state: Pick<GameState, 'options'> | null | undefined, key: NumericRule): number {
  const d = RULE_DEFS[key]
  const v = Number(state?.options?.[key])
  return state?.options?.[key] === undefined || !Number.isFinite(v) ? d.default : Math.max(d.min, Math.min(d.max, v))
}

/** 整理存檔規則：數值夾在範圍內，和預設一樣的不存 */
export function sanitizeRules(raw: Partial<Record<NumericRule, unknown>> | undefined): Partial<Pick<GameOptions, NumericRule>> {
  const out: Partial<Pick<GameOptions, NumericRule>> = {}
  for (const key of Object.keys(RULE_DEFS) as NumericRule[]) {
    const v = raw?.[key]
    if (v === undefined || v === null || v === '') continue
    const n = gameRule({ options: { defeatLoot: 'half', [key]: Number(v) } }, key)
    if (n !== RULE_DEFS[key].default) out[key] = n
  }
  return out
}

/** 報酬類的錢乘上倍率（委託報酬、戰利品）；負數（花費）不變 */
export function rewardMoney(state: Pick<GameState, 'options'>, cc: number): number {
  return cc > 0 ? Math.round(cc * gameRule(state, 'moneyMult')) : cc
}
