// 懷孕與產後虛弱在戰鬥中的效果（docs/FAMILY.md 第 4.3 節）。
// - 懷孕的雙面效應：平常是檢定減值（pregMarks.ts），修了任何流派、慾望戰鬥開著時，戰鬥中依階段反轉成增益；
//   後期另外在有隊友倒下時傷害 +2（combat.ts 每回合開始時看有沒有隊友倒下）。還沒察覺時沒有效果。
// - 產後虛弱：戰鬥中生命上限 ×0.8（不論有沒有修流派、慾望戰鬥有沒有開）。

import familyJson from '@data/rules/family.json'
import { schoolsOf } from './schools'
import type { Mods } from './data'
import type { Character, PregnancyStage } from './types'

interface TwoFaceRules {
  two_face: Partial<Record<PregnancyStage, Mods>> & { late_ally_down?: Mods }
  postpartum: { combat_max_hp?: number }
}
const rules = familyJson as unknown as TwoFaceRules

/** 懷孕的雙面效應（戰鬥中的修正與隊友倒下時的修正）；沒修流派、還沒察覺時是空的 */
export function pregnancyTwoFace(c: Pick<Character, 'pregMark' | 'perks' | 'customPerks' | 'race'>): { mods: Mods; allyDown?: Mods } {
  const stage = c.pregMark?.known ? c.pregMark.stage : undefined
  if (!stage || stage === 'hidden' || !schoolsOf(c).length) return { mods: {} }
  const mods = { ...(rules.two_face[stage] ?? {}) }
  const allyDown = stage === 'late' && rules.two_face.late_ally_down ? { ...rules.two_face.late_ally_down } : undefined
  return { mods, ...(allyDown ? { allyDown } : {}) }
}

/** 產後虛弱時戰鬥中的生命上限比例（沒有時是 1） */
export function postpartumMaxHp(c: Pick<Character, 'pregMark'>): number {
  return c.pregMark?.postpartum ? rules.postpartum.combat_max_hp ?? 1 : 1
}
