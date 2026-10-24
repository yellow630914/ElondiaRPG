// 主角的體態：建角時選體型與各部位（詞條來自 npc_traits.json，和 NPC 的外貌同一套），寫成外貌的開頭。
// 主角的性別是自由輸入的文字，這裡先對應成性別 id（對不上時當作未知）。

import { genderDef } from './data'
import { bodyOf, BODIES, describeLook, LOOK_PARTS, lookOptions, type Body } from './traits'
import type { Character } from './types'

/** 性別文字對應到的性別 id（男、女性、偽娘……）；對不上時 undefined */
export function genderId(gender: string | undefined): string | undefined {
  return genderDef(gender)?.id
}

/** 角色的體型：主角建角時選的優先，否則依種族與性別 */
export function characterBody(c: Pick<Character, 'race' | 'gender' | 'body'>): Body {
  return c.body && BODIES.includes(c.body) ? c.body : bodyOf(c.race, genderId(c.gender))
}

/** 整理建角選的體態：只留這個體型、種族、性別可以選的詞條 */
export function sanitizeLook(raw: Record<string, unknown> | undefined, body: Body, race: string, gender?: string): Record<string, string> {
  const out: Record<string, string> = {}
  const id = genderId(gender)
  for (const part of LOOK_PARTS) {
    const v = raw?.[part]
    if (typeof v === 'string' && lookOptions(part, body, race, id).includes(v)) out[part] = v
  }
  return out
}

/** 體態寫成外貌的開頭，接上玩家自己寫的外貌 */
export function lookAppearance(look: Record<string, string>, free?: string): string {
  return [describeLook(look), free?.trim()].filter(Boolean).join('')
}
