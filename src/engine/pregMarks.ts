// 懷孕與產後虛弱對檢定的影響（docs/FAMILY.md 第 4.2 節）、泌乳的判斷（第 10 節）：看角色身上的標記（Character.pregMark），
// 標記由 pregnancy.ts 的 syncPregnancyMarks 每次結算時照 state.pregnancies 同步。
// 獨立成一個檔案：perks.ts 的 checkModifiers 會用到，不要引用 state.ts（避免循環引用）。

import familyJson from '@data/rules/family.json'
import { tagsAllowed } from './content'
import { genderDef, itemDef, type CheckFilter } from './data'
import { characterBody } from './look'
import { tattooTemplate } from './tattoos'
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

// ---- 泌乳（docs/FAMILY.md 第 10 節） ----

/** 有乳房、會泌乳的性別；對應不到的性別看體型 */
const LACT_GENDERS = ['female', 'futa', 'ts']
const LACT_BODIES = ['fem', 'andro']

/**
 * 這個人能不能泌乳：女性、扶她、TS；對應不到的性別（主角自由輸入、未知）看體型（陰柔、中性）。
 * 陽剛體型的主角一律不行（決定 13：不能用泌乳道具）
 */
export function canLactate(c: Pick<Character, 'race' | 'gender' | 'body' | 'isPlayer'>): boolean {
  const body = characterBody(c)
  if (c.isPlayer && body === 'masc') return false
  const g = genderDef(c.gender)?.id
  if (g && g !== 'unknown') return LACT_GENDERS.includes(g)
  return LACT_BODIES.includes(body)
}

/** 身上戴著會泌乳的裝備（泌乳之環）或紋著會泌乳的刺青（淫紋・乳泉） */
export function wornLactation(c: Pick<Character, 'gear' | 'tattoos'>): string | undefined {
  for (const g of Object.values(c.gear ?? {})) if (g && itemDef(g.name)?.lactation) return g.name
  for (const t of c.tattoos ?? []) if (t.template && tattooTemplate(t.template)?.lactation) return tattooTemplate(t.template)!.name
  return undefined
}

/** 現在在泌乳嗎：內容篩選「泌乳」打開、能泌乳，而且有來源（存檔的來源同步在標記上，裝備與刺青看身上） */
export function lactatingNow(c: Pick<Character, 'race' | 'gender' | 'body' | 'isPlayer' | 'gear' | 'tattoos' | 'pregMark'>): boolean {
  if (!tagsAllowed(['lactation']) || !canLactate(c)) return false
  return !!c.pregMark?.lactating || !!wornLactation(c)
}
