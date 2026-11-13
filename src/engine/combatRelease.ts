// 戰鬥中解放的加值（紙娃娃下方的總表；docs/LEWD_STATS.md 第 7、14.1、24 節，docs/FAMILY.md 第 4.3 節）：
// 拘束具、淫服、寄生物、懷孕的雙面效應，平常是減值、戰鬥中變成增益。拘束具的部分全身合計有上限（存檔規則），
// 每一項寫成「套上上限後的值」與「實際加總」，兩個不一樣時畫面寫成「迴避 +3（+5）」。和 combat.ts 開戰時算的一樣。

import type { Mods } from './data'
import { gameRule } from './gameRules'
import { MOD_NAME } from './gear'
import { parasiteTwoFace } from './parasites'
import { pregnancyTwoFace } from './pregCombat'
import { adultOutfitPieces, KEY_CUSTODY_NAME, outfitCombat, schoolsOf, twoFaceCombat } from './schools'
import { statusDef } from './data'
import type { Character, GameState } from './types'

export interface ReleaseRow {
  key: string
  name: string
  /** 戰鬥中實際生效的值（拘束具的部分套上全身上限） */
  value: number
  /** 還沒套上限的加總 */
  raw: number
  /** 鑰匙保管提高了這一項的上限：「眼罩的鑰匙交給同伴保管：迴避上限 +1」（滑鼠移上去看；沒有時沒有） */
  keyNote?: string
}

export interface CombatRelease {
  /** 慾望戰鬥關著、沒修流派：說明為什麼沒有 */
  off?: string
  rows: ReleaseRow[]
  /** 免疫的狀態（拘束程度 3） */
  immune: string[]
  /** 造成的慾望（淫服、寄生物） */
  lustBonus: number
  /** 懷孕後期：有隊友倒下時再加 */
  allyDown: ReleaseRow[]
  /** 來源：「拘束具 2 件」「淫服 3 件」「寄生」「懷孕」 */
  sources: string[]
}

const ORDER = ['initiative', 'hit', 'evade', 'save', 'damage', 'dr', 'ap_regen', 'crit']
const nameOf = (k: string) => (k === 'initiative' ? '先攻' : MOD_NAME[k] ?? k)

function add(into: Record<string, number>, mods: Mods | undefined) {
  for (const [k, v] of Object.entries(mods ?? {})) if (v) into[k] = (into[k] ?? 0) + v
}
function rows(value: Record<string, number>, raw: Record<string, number>): ReleaseRow[] {
  const keys = [...new Set([...Object.keys(value), ...Object.keys(raw)])].filter((k) => value[k] || raw[k])
  keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
  return keys.map((key) => ({ key, name: nameOf(key), value: value[key] ?? 0, raw: raw[key] ?? 0 }))
}

/** 這個人在戰鬥中解放的加值（雙面效應的合計） */
export function combatRelease(state: GameState | null | undefined, c: Character): CombatRelease {
  const out: CombatRelease = { rows: [], immune: [], lustBonus: 0, allyDown: [], sources: [] }
  if (!schoolsOf(c).length) return { ...out, off: '還沒修任何慾望流派：只有平常的檢定減值' }
  if (state && gameRule(state, 'lustMult') <= 0) return { ...out, off: '慾望戰鬥關閉：戰鬥中沒有增益' }
  const value: Record<string, number> = {}
  const raw: Record<string, number> = {}
  const tf = twoFaceCombat(c, state)
  add(value, { ...tf.mods, ...(tf.initiative ? { initiative: tf.initiative } : {}) } as Mods)
  add(raw, { ...tf.raw, ...(tf.rawInitiative ? { initiative: tf.rawInitiative } : {}) } as Mods)
  if (tf.active.length) out.sources.push(`拘束具 ${tf.active.length} 件`)
  // 鑰匙保管提高的上限：只標在那幾項上（畫面上那一項前面一把鑰匙，滑鼠移上去看是哪一件）
  const keyNotes: Record<string, string> = {}
  for (const f of tf.custody?.from ?? []) {
    for (const k of f.keys) keyNotes[k] = `${f.name}的鑰匙${KEY_CUSTODY_NAME[f.custody]}${f.servitude ? '（隸從派）' : ''}：${nameOf(k)}上限 +${tf.custody!.raise[k]}`
  }
  out.immune = tf.immune.map((id) => statusDef(id).name)
  const of = outfitCombat(c)
  const pt = parasiteTwoFace(c)
  const pf = pregnancyTwoFace(c)
  for (const m of [of.mods, pt.mods, pf.mods]) {
    add(value, m)
    add(raw, m)
  }
  if (Object.values(of.mods).some((v) => v) || of.lustBonus) out.sources.push(`淫服 ${adultOutfitPieces(c)} 件`)
  if (pt.active.length) out.sources.push('寄生')
  if (Object.values(pf.mods).some((v) => v)) out.sources.push('懷孕')
  out.lustBonus = of.lustBonus + pt.lustBonus
  out.rows = rows(value, raw).map((r) => (keyNotes[r.key] ? { ...r, keyNote: keyNotes[r.key] } : r))
  const down: Record<string, number> = {}
  add(down, pf.allyDown)
  out.allyDown = rows(down, down)
  return out
}
