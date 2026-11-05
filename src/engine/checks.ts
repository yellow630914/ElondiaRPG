// 檢定的成功程度（主動行動、談判共用）。

import { actionRules, type Degree } from './data'
import type { GameState } from './types'

/** 存檔規則「大成功、大失敗只看骰面」 */
export function naturalCritOnly(state: Pick<GameState, 'options'> | undefined): boolean {
  return !!state?.options?.naturalCrit
}

/**
 * 自然 20 大成功；自然 1 或差 fumble_margin 以上大失敗；超過 critical_margin 大成功；差 partial_margin 以內部分成功。
 * naturalOnly（存檔規則）：大成功、大失敗只看骰面，差多少都最多是成功或失敗。
 */
export function computeDegree(natural: number, total: number, dc: number, naturalOnly = false): Degree {
  const d = actionRules.degrees
  if (natural === 20) return 'critical'
  if (natural === 1) return 'fumble'
  if (!naturalOnly && total <= dc - d.fumble_margin) return 'fumble'
  if (!naturalOnly && total >= dc + d.critical_margin) return 'critical'
  if (total >= dc) return 'success'
  if (total >= dc - d.partial_margin) return 'partial'
  return 'fail'
}

export const DEGREE_NAME: Record<Degree, string> = {
  critical: '大成功', success: '成功', partial: '部分成功', fail: '失敗', fumble: '大失敗',
}

/** AI 給的成功程度照存檔規則收斂：只看骰面時，骰面不是 20 的大成功降成成功、不是 1 的大失敗降成失敗 */
export function clampDegree(degree: Degree, natural: number, naturalOnly: boolean): Degree {
  if (!naturalOnly) return degree
  if (degree === 'critical' && natural !== 20) return 'success'
  if (degree === 'fumble' && natural !== 1) return 'fail'
  return degree
}
