// 檢定的加值拆解：日誌「經過」的每一筆擲骰記下骰面與各項加值（TimelineRoll 的 natural、parts、dc_parts），
// 畫面滑鼠移上去看「骰 11 + 魅力 +1 + 熟練 +2 = 14，對 DC 12」（narrator/describe.ts 的 rollDetail）。
// 各處產生擲骰時把這裡的結果展開進原本的 roll 物件，dice、value、dc 照舊。

import { attrOf, mod, proficiency } from './character'
import { attrName, type AttrId, type ToolKind } from './data'
import { checkModifiers, type CheckCtx } from './perks'
import { bestTool } from './tools'
import type { Character, GameState, RollPart, TimelineRoll } from './types'

/** 拿掉 0 的項目 */
export function nonZero(parts: RollPart[]): RollPart[] {
  return parts.filter((p) => p.value !== 0)
}

export function sumParts(parts: RollPart[]): number {
  return parts.reduce((sum, p) => sum + p.value, 0)
}

/** 屬性調整值與熟練加值（主動行動、事件檢定的基本組成） */
export function attrParts(c: Character, attr: AttrId): RollPart[] {
  return [{ label: attrName(attr), value: mod(attrOf(c, attr)) }, { label: '熟練', value: proficiency(c.level) }]
}

/** 屬性、熟練加上情境修正（特質、狀態、身分、裝備……；和 checkBonus 算的是同一批） */
export function checkParts(c: Character, ctx: CheckCtx & { attr: AttrId }): RollPart[] {
  return [...attrParts(c, ctx.attr), ...checkModifiers(c, ctx)]
}

/** 行囊裡最好的那件工具的加值（沒有時是空的；和 toolBonus 一樣） */
export function toolParts(state: GameState, kind: ToolKind): RollPart[] {
  const t = bestTool(state, kind)
  return t ? [{ label: t.name, value: t.bonus }] : []
}

/**
 * 時間軸 roll 物件要多加的拆解欄位。parts 是骰面以外的所有加值（0 的會拿掉），
 * naturals 是擲兩次時的兩個骰面；dcParts 是 DC 的組成（只有一項時不記，看 dc 就知道）。
 */
export function rollBreakdown(
  natural: number, parts: RollPart[], opts: { naturals?: number[]; dcParts?: RollPart[]; dcName?: string } = {},
): Pick<TimelineRoll, 'natural' | 'naturals' | 'parts' | 'dc_parts' | 'dc_name'> {
  const kept = nonZero(parts)
  const dcParts = opts.dcParts ? nonZero(opts.dcParts) : []
  return {
    natural,
    ...(opts.naturals && opts.naturals.length > 1 ? { naturals: [...opts.naturals] } : {}),
    ...(kept.length ? { parts: kept } : {}),
    ...(dcParts.length > 1 ? { dc_parts: dcParts } : {}),
    ...(opts.dcName ? { dc_name: opts.dcName } : {}),
  }
}
