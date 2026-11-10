// 懷孕與產後虛弱對檢定的影響（docs/FAMILY.md 第 4.2 節）：看角色身上的標記（Character.pregMark），
// 標記由 pregnancy.ts 的 syncPregnancyMarks 每次結算時照 state.pregnancies 同步。
// 獨立成一個檔案：perks.ts 的 checkModifiers 會用到，不要引用 state.ts（避免循環引用）。

import familyJson from '@data/rules/family.json'
import type { CheckFilter } from './data'
import type { CheckCtx } from './perks'
import type { Character, PregnancyStage } from './types'

interface FamilyRules {
  stages: { id: PregnancyStage; name: string; at: number }[]
  checks: Partial<Record<PregnancyStage, { check: CheckFilter; bonus: number }[]>>
  postpartum: { days: number; fail_days: number; check: number }
}

export const familyRules = familyJson as unknown as FamilyRules & Record<string, unknown>

export function pregnancyStageName(stage: PregnancyStage | undefined): string {
  return familyRules.stages.find((s) => s.id === stage)?.name ?? ''
}

/** 懷孕與產後虛弱的檢定修正（正數是加值）；matches 由呼叫端傳進來（perks.ts），避免互相引用 */
export function pregnancyModifiers(c: Pick<Character, 'pregMark'>, ctx: CheckCtx, matches: (f: CheckFilter, ctx: CheckCtx) => boolean): { label: string; value: number }[] {
  const mark = c.pregMark
  if (!mark) return []
  const out: { label: string; value: number }[] = []
  // 還沒察覺的懷孕沒有減值（未察覺階段本來就沒有，這裡再保險一次）
  if (mark.stage && mark.stage !== 'hidden') {
    for (const e of familyRules.checks[mark.stage] ?? []) if (matches(e.check, ctx)) out.push({ label: `懷孕・${pregnancyStageName(mark.stage)}`, value: e.bonus })
  }
  if (mark.postpartum && familyRules.postpartum.check) out.push({ label: '產後虛弱', value: -familyRules.postpartum.check })
  return out
}
