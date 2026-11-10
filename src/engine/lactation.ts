// 泌乳（成人向，docs/FAMILY.md 第 10 節）。和懷孕是兩個獨立的狀態，懷孕後期只是來源之一。
// - 來源存在 state.lactation（角色 id，主角是 pc）：懷孕後期（到生產後 30 天）、胎生的苗床、道具（催乳茶、魔乳果、催乳藥劑）、事件。
//   裝備（泌乳之環）與刺青（淫紋・乳泉）不存，看身上（pregMarks.ts 的 wornLactation）。
// - 內容篩選「泌乳」關掉時一律不生效、道具不能用；能泌乳的是女性、扶她、TS（對應不到的看體型），陽剛體型的主角不能用泌乳道具。
// - 效果：敏感的有效值 +5（lewd.ts 的 lewdOf）；在聚落裡胸前真空或曝露時，曝露名聲每天多 +1（lewd.ts 的 lewdDaily）；
//   戰鬥中（修了流派、慾望戰鬥開著）慾望上限 +10%、受到的慾望 +10%，肉體派契合 ×1.2（combat.ts 的 initLust）。
// - 嬰兒的餵養不連到泌乳；泌乳只交給成人向的提示詞，提示詞裡不會同時出現嬰兒。

import familyJson from '@data/rules/family.json'
import { tagsAllowed } from './content'
import { mod, attrOf, proficiency } from './character'
import { hasSchool, schoolsOf } from './schools'
import { addAffinity, pcOf } from './party'
import { canLactate, lactatingNow, wornLactation } from './pregMarks'
import { baseLewd } from './lewd'
import { withRng } from './state'
import { roll as diceRoll } from './rng'
import type { Character, GameState, LactationSource, Report } from './types'

interface LactationRules {
  /** 生產後還會泌乳幾天 */
  after_birth_days: number
  /** 敏感的有效值加多少 */
  sensitivity: number
  /** 在聚落裡胸前真空或曝露時，曝露名聲每天多加多少 */
  exposure: number
  /** 戰鬥中（修了流派）：慾望上限、受到的慾望的比例；肉體派的倍率 */
  combat: { max: number; taken: number; flesh_mult: number }
  /** 給自由的夥伴用：魅力檢定 DC = base − 淫亂 / lewd_div − 親密度 / affinity_div；失敗親密度 fail_affinity */
  consent: { base: number; lewd_div: number; affinity_div: number; fail_affinity: number }
}

export const lactationRules = (familyJson as unknown as { lactation: LactationRules }).lactation

const keyOf = (state: GameState, c: Pick<Character, 'id' | 'isPlayer'>) => (c.isPlayer || state.party.find((m) => m.isPlayer)?.id === c.id ? 'pc' : c.id)

/** 存檔的來源（還沒到期的） */
export function lactationSources(state: GameState, key: string): LactationSource[] {
  return (state.lactation?.[key] ?? []).filter((s) => s.until === undefined || s.until >= state.time.day)
}

/** 加一個來源；同一種、同一個 ref 的取比較晚的到期日 */
export function addLactation(state: GameState, key: string, src: LactationSource) {
  const list = (state.lactation ??= {})[key] ?? []
  const same = list.find((s) => s.kind === src.kind && s.ref === src.ref)
  if (same) {
    if (same.until !== undefined && (src.until === undefined || src.until > same.until)) {
      if (src.until === undefined) delete same.until
      else same.until = src.until
    }
  } else list.push({ ...src })
  state.lactation![key] = list
}

/** 拿掉某幾種來源（斷乳藥拿掉道具與事件的；生產時把懷孕的換成有期限的） */
export function removeLactation(state: GameState, key: string, kinds: LactationSource['kind'][]) {
  const list = state.lactation?.[key]
  if (!list) return
  const left = list.filter((s) => !kinds.includes(s.kind))
  if (left.length) state.lactation![key] = left
  else delete state.lactation![key]
}

/** 每次結算：拿掉到期的來源 */
export function pruneLactation(state: GameState) {
  for (const [key, list] of Object.entries(state.lactation ?? {})) {
    const left = list.filter((s) => s.until === undefined || s.until >= state.time.day)
    if (left.length) state.lactation![key] = left
    else delete state.lactation![key]
  }
}

/** 這個角色現在在泌乳嗎（看篩選、身體、存檔的來源與身上的裝備刺青） */
export function isLactating(state: GameState, c: Character): boolean {
  return lactatingNow({ ...c, pregMark: { ...c.pregMark, lactating: lactationSources(state, keyOf(state, c)).length > 0 } })
}

/** 角色詳情的一行 */
export function lactationLine(state: GameState, c: Character): string {
  if (!isLactating(state, c)) return ''
  const srcs = lactationSources(state, keyOf(state, c))
  const parts = srcs.map((s) => (s.kind === 'pregnancy' ? (s.until === undefined ? '懷孕後期' : `產後（到第 ${s.until} 天）`) : s.kind === 'brood' ? '苗床' : `${s.ref ?? '事件'}（到第 ${s.until} 天）`))
  const worn = wornLactation(c)
  if (worn) parts.push(`${worn}（戴著的時候）`)
  return `泌乳中：${parts.join('、')}`
}

/** 戰鬥中的效果（修了流派、慾望戰鬥開著時由 combat.ts 呼叫）：慾望上限與受到的慾望的比例 */
export function lactationCombat(state: GameState, c: Character): { max: number; taken: number } {
  if (!isLactating(state, c) || !schoolsOf(c).length) return { max: 0, taken: 0 }
  const r = lactationRules.combat
  const mult = hasSchool(c, 'flesh') ? r.flesh_mult : 1
  return { max: Math.round(r.max * mult * 100) / 100, taken: Math.round(r.taken * mult * 100) / 100 }
}

/** 不能用泌乳道具的原因（可以時為 undefined） */
export function lactationUseBlock(c: Character): string | undefined {
  if (!tagsAllowed(['lactation'])) return '內容篩選關掉了「泌乳」'
  if (!canLactate(c)) return `${c.name}的身體不會泌乳`
  return undefined
}

/** 自由的夥伴（自願、雇傭）要先答應才肯喝；奴隸、主角自己不用問 */
export function needsConsent(c: Character): boolean {
  return !c.isPlayer && (c.bond === 'voluntary' || c.bond === 'hired')
}

export function consentDc(state: GameState, c: Character): number {
  const r = lactationRules.consent
  const affinity = state.relationships?.[c.id]?.affinity ?? 0
  return Math.round(r.base - baseLewd(c).lewdness / r.lewd_div - affinity / r.affinity_div)
}

/**
 * 用泌乳的道具（useItem 呼叫）：days 是泌乳幾天，stop 是斷乳藥。回傳日誌的一句話；
 * 自由的夥伴不肯時回傳 refused（道具不會用掉）
 */
export function useLactationItem(state: GameState, report: Report, c: Character, item: string, use: { lactation?: number; stop_lactation?: boolean }): { text: string; refused?: boolean } {
  const block = lactationUseBlock(c)
  if (block) throw new Error(block)
  const key = keyOf(state, c)
  if (use.stop_lactation) {
    const had = lactationSources(state, key).some((s) => s.kind === 'item' || s.kind === 'event')
    if (!had) throw new Error(`${c.name}沒有道具或事件造成的泌乳`)
    removeLactation(state, key, ['item', 'event'])
    const still = isLactating(state, c)
    return { text: `道具造成的泌乳停了${still ? '（懷孕或身上戴著的東西還會讓她泌乳）' : ''}` }
  }
  if (needsConsent(c)) {
    const pc = pcOf(state)
    const dc = consentDc(state, c)
    const bonus = mod(attrOf(pc, 'cha')) + proficiency(pc.level)
    const r = withRng(state, (rng) => diceRoll(rng, `1d20${bonus >= 0 ? '+' : ''}${bonus}`))
    const natural = r.rolls[0] ?? r.total
    const ok = natural === 20 || (natural !== 1 && r.total >= dc)
    report.timeline = [{ seq: 1, time: { ...state.time }, actor: pc.id, action: `說服${c.name}用${item}`, roll: { dice: r.dice, value: r.total, dc }, result: ok ? 'success' : 'fail' }]
    if (!ok) {
      addAffinity(state, report, c.id, lactationRules.consent.fail_affinity, `硬要${c.name}用${item}`)
      return { text: `${c.name}紅著臉拒絕了，${item}沒有用掉`, refused: true }
    }
  }
  const days = Math.max(1, Math.round(use.lactation ?? 1))
  addLactation(state, key, { kind: 'item', ref: item, until: state.time.day + days - 1 })
  return { text: `${days} 天內會泌乳（到第 ${state.time.day + days - 1} 天）` }
}

/** 懷孕後期開始泌乳；生產時改成生產後 after_birth_days 天（pregnancy.ts 呼叫） */
export function pregnancyLactation(state: GameState, key: string, birth: boolean) {
  removeLactation(state, key, ['pregnancy'])
  addLactation(state, key, birth ? { kind: 'pregnancy', until: state.time.day + lactationRules.after_birth_days } : { kind: 'pregnancy' })
}

/** 交給 AI 的一行（只在成人向的敘事與判定送）：隊伍裡在泌乳的人 */
export function lactationPrompt(state: GameState): string {
  const who = state.party.filter((m) => isLactating(state, m)).map((m) => (m.isPlayer ? '主角' : m.name))
  return who.length ? `\n正在泌乳：${who.join('、')}（乳房脹滿、會泌出乳汁）` : ''
}
