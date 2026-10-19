// 檢定的成功程度（主動行動、談判共用）。

import { actionRules, type Degree } from './data'

/** 自然 20 大成功；自然 1 或差 fumble_margin 以上大失敗；超過 critical_margin 大成功；差 partial_margin 以內部分成功。 */
export function computeDegree(natural: number, total: number, dc: number): Degree {
  const d = actionRules.degrees
  if (natural === 20) return 'critical'
  if (natural === 1 || total <= dc - d.fumble_margin) return 'fumble'
  if (total >= dc + d.critical_margin) return 'critical'
  if (total >= dc) return 'success'
  if (total >= dc - d.partial_margin) return 'partial'
  return 'fail'
}

export const DEGREE_NAME: Record<Degree, string> = {
  critical: '大成功', success: '成功', partial: '部分成功', fail: '失敗', fumble: '大失敗',
}
