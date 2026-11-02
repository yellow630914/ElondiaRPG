// 這個存檔的規則（state.options）：開新遊戲時選，之後可以在設定的「這個存檔的規則」改。
// 每一項都有預設值（和沒有這項規則時一樣），讀的時候一律夾在範圍內；舊存檔沒有的欄位就是預設。
// 戰敗掉落（defeatLoot）另外在 expedition.ts；難度（difficulty）的係數在下面。說明見 docs/SAVES.md 第 7 節。

import type { Difficulty, GameOptions, GameState } from './types'
import { companionRules, combatRules, enemies, isLayerBoss, MINION_TIERS, minionTier, type MinionTier } from './data'
// 直接讀 JSON：security.ts 會用到這裡，避免循環引用
import securityJson from '@data/rules/security.json'
import slaveryJson from '@data/rules/slavery.json'
import parasitesJson from '@data/rules/parasites.json'
import lewdJson from '@data/rules/lewd.json'

/** 數值類的存檔規則（戰敗掉落與難度不是數值，各自有自己的選單） */
export type NumericRule = Exclude<keyof GameOptions, 'defeatLoot' | 'difficulty' | 'tagChange'>

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
  masterEventMult: { label: '主人事件的機率', hint: `被主人帶著時，主人突發事件的機率乘上這個倍率（預設：走動每一步 ${pct(slaveryJson.master_events.step_chance)}、旅行每趟 ${pct(slaveryJson.master_events.travel_chance)}）。0 表示主人不會突然提出要求（離家逾期的「主人要回家」照樣會發生）。`, default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '不會發生' },
  parasiteMult: { label: '寄生發作的機率', hint: `身上的寄生物（寄生裝備、淫紋、寄生種子）發作的機率乘上這個倍率（預設：走動每一步 ${pct(parasitesJson.step_chance)}、旅途每天 ${pct(parasitesJson.travel_chance)}、長休之後 ${pct(parasitesJson.rest_chance)}；支配階段加倍）。0 表示不會發作。成人向內容。`, default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '不會發作' },
  dungeonEventMult: { label: '地下城事件的機率', hint: '地下城與近郊的色情事件（觸發陷阱、打開寶箱、採集、安全房長休）的機率乘上這個倍率。0 表示不會發生。成人向內容。', default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '不會發生' },
  brothelEventMult: { label: '娼館事件的機率', hint: `在娼館打工（接客）結束時發生事件的機率乘上這個倍率（預設 ${pct(lewdJson.brothel.work_event.base)}，淫亂越高越容易，最高 ${pct(lewdJson.brothel.work_event.max)}）。0 表示不會發生。成人向內容。`, default: 1, min: 0, max: 3, step: 0.25, unit: '倍', zero: '不會發生' },
  eventDc: { label: '事件檢定的難度', hint: '地下城事件與寄生物發作的檢定 DC 加減（這兩種事件的 DC 本來就依層、主角等級與侵蝕度的階段調整）。負數比較容易。成人向內容。', default: 0, min: -10, max: 10, step: 1, unit: 'DC' },
  lustMult: { label: '慾望戰鬥', hint: '戰鬥中所有慾望增加的倍率（慾望攻擊、媚毒、自己增加的慾望……）。慾望滿了會高潮：我方停止行動一回合、失去三分之一的生命（不會因此死亡，一場高潮三次倒下）；敵方受到三分之一生命的傷害。0 表示關閉：沒有慾望條，色情技能不能用，敵人也不用慾望攻擊。成人向內容。', default: 1, min: 0, max: 2, step: 0.25, unit: '倍', zero: '關閉' },
  skillLoadout: { label: '技能攜帶上限', hint: '每個角色戰鬥時最多帶幾個技能與法術（戲法不算）。學會的能力都留在技能庫，在角色詳情的「能力」頁勾選要帶哪些，戰鬥以外隨時可以換；超過上限時先帶最近學會的。0 表示不限，全部帶上。', default: 12, min: 0, max: 30, step: 1, unit: '個', zero: '不限' },
  gatherMult: { label: '採集量', hint: '近郊、地下城與特殊地圖的採集點，每一格採到幾份材料（小數的部分是機率，例如 1.5 是一半的機會多 1 份）。古錢的金額不受影響（看「報酬與戰利品的錢」）。', default: 2, min: 1, max: 5, step: 0.5, unit: '份' },
  escapeDc: { label: '逃跑與撤退的難度', hint: `戰鬥中撤退（預設 DC ${combatRules.flee_dc}）與地下城緊急撤退的 DC 加減。負數比較容易。`, default: 0, min: -10, max: 10, step: 1, unit: 'DC' },
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

// ---- 難度（combat.json 的 difficulty）：怪物的生命與輸出的係數，普通 = 1 ----

export interface DifficultyCoef {
  /** 怪物最大生命的係數 */
  hp: number
  /** 怪物造成的傷害的係數 */
  damage: number
}

export interface DifficultyDef extends DifficultyCoef {
  id: Difficulty
  name: string
  /** 小怪的係數，依小怪最淺出現的區域分開（1 人的城郊和 4 人的中層以下差很多）；hp、damage 是頭目的 */
  minions: Record<MinionTier, DifficultyCoef>
  desc: string
}

export const DIFFICULTY_IDS: Difficulty[] = ['story', 'easy', 'normal', 'hard', 'epic']

/** 各難度的係數（照 combat.json 的順序；資料裡沒寫的難度用普通的係數補） */
export const DIFFICULTY_DEFS: Record<Difficulty, DifficultyDef> = Object.fromEntries(
  DIFFICULTY_IDS.map((id) => {
    const d = combatRules.difficulty.levels.find((l) => l.id === id)
    const hp = d?.hp ?? 1
    const damage = d?.damage ?? 1
    const minions = Object.fromEntries(MINION_TIERS.map((t) => [t, { hp: d?.minions?.[t]?.hp ?? hp, damage: d?.minions?.[t]?.damage ?? damage }])) as Record<MinionTier, DifficultyCoef>
    return [id, { id, name: d?.name ?? id, hp, damage, minions, desc: d?.desc ?? '' }]
  }),
) as Record<Difficulty, DifficultyDef>

export const DEFAULT_DIFFICULTY: Difficulty =
  (DIFFICULTY_IDS as string[]).includes(combatRules.difficulty.default) ? combatRules.difficulty.default as Difficulty : 'normal'

/** 這個存檔的難度（舊存檔沒有、寫壞了都算普通） */
export function difficultyOf(state: Pick<GameState, 'options'> | null | undefined): Difficulty {
  const d = state?.options?.difficulty
  return d && DIFFICULTY_DEFS[d] ? d : DEFAULT_DIFFICULTY
}

/** 這個存檔的難度係數 */
export function difficultyRule(state: Pick<GameState, 'options'> | null | undefined): DifficultyDef {
  return DIFFICULTY_DEFS[difficultyOf(state)]
}

/** 一隻怪物在這個難度的係數：層主與有低血大招的特殊任務頭目用頭目的係數，其他小怪依最淺出現的區域 */
export function difficultyFor(def: DifficultyDef, enemyId: string): DifficultyCoef {
  if (isLayerBoss(enemyId) || Object.keys(enemies[enemyId]?.ability_hp_below ?? {}).length) return def
  return def.minions[minionTier(enemyId)]
}

/** 選單上的一行說明：頭目與各區域小怪的係數 */
export function difficultySummary(def: DifficultyDef): string {
  const f = (c: DifficultyCoef) => `生命 ×${c.hp}、傷害 ×${c.damage}`
  const m = def.minions
  const same = MINION_TIERS.every((t) => m[t].hp === def.hp && m[t].damage === def.damage)
  if (same) return `怪物${f(def)}`
  return `頭目${f(def)}；小怪 郊外${f(m.wild)}・周邊${f(m.outskirts)}・淺層${f(m.shallow)}・中層以下${f(m.deep)}`
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
