// 多出來的經驗的用途（docs/PERKS.md 4.3 節；data/rules/progression.json 的 xp_sinks）：
// 鑽研特質（一次學特質的機會：三選一，或寫說法交給 AI）、苦練屬性（20 級以上換一點屬性點）、鑽研技能（多學一個技能：三選一）。
// 花費 = base × mult ^ 已經換過幾次，三種各算各的（Character.xpSinks）；從目前的經驗扣，還沒滿級時會延後升級。

import { attributeRules, progression } from './data'
import { abilityChoices, learnable } from './character'
import { learnablePerks, offerPerks } from './perks'
import type { Rng } from './rng'
import type { Character } from './types'

export type XpSink = 'perk' | 'attr' | 'ability'
export const XP_SINKS: XpSink[] = ['perk', 'attr', 'ability']

const rule = (kind: XpSink) => progression.xp_sinks[kind]

export function xpSinkName(kind: XpSink): string {
  return rule(kind).name
}

/** 換過幾次 */
export function xpSinkCount(c: Character, kind: XpSink): number {
  return c.xpSinks?.[kind] ?? 0
}

/** 下一次的花費：base × mult ^ 換過幾次 */
export function xpSinkCost(c: Character, kind: XpSink): number {
  const r = rule(kind)
  return Math.round(r.base * r.mult ** xpSinkCount(c, kind))
}

/** 鑽研特質的選項來源（和升級一樣：慾望流派的特質不在裡面） */
const perkPool = (c: Character) => learnablePerks(c).filter((p) => !p.school)

/** 不能換的原因（可以時是 undefined） */
export function xpSinkBlocked(c: Character, kind: XpSink): string | undefined {
  const r = rule(kind)
  if (c.level < r.min_level) return `${r.min_level} 級之後才能${r.name}`
  if (kind === 'perk' && c.perkOffers?.some((o) => o.source.startsWith(r.name))) return '先處理上一次鑽研特質的機會'
  if (kind === 'perk' && !perkPool(c).length) return '沒有還能學的特質'
  if (kind === 'attr' && attributeRules.attributes.every((a) => c.attrs[a.id] >= attributeRules.score.max)) return '屬性都到上限了'
  if (kind === 'ability' && c.pendingAbilityChoices?.length) return '先選完還沒選的技能'
  if (kind === 'ability' && !learnable(c).length) return '沒有還能學的技能'
  const cost = xpSinkCost(c, kind)
  if (c.xp < cost) return `經驗不夠（要 ${cost}，現在 ${c.xp}）`
  return undefined
}

/** 用經驗換：扣經驗、記一次，給特質的機會、屬性點或技能三選一。回傳一句說明 */
export function spendXp(c: Character, kind: XpSink, rng: Rng): string {
  const why = xpSinkBlocked(c, kind)
  if (why) throw new Error(why)
  const r = rule(kind)
  const cost = xpSinkCost(c, kind)
  const n = xpSinkCount(c, kind) + 1
  if (kind === 'perk') {
    const pool = perkPool(c)
    const picks: string[] = []
    while (picks.length < 3 && pool.length) picks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!.id)
    if (!offerPerks(c, `${r.name}（第 ${n} 次）`, picks)) throw new Error('沒有還能學的特質')
  } else if (kind === 'attr') {
    c.attrPoints += 1
  } else {
    c.pendingAbilityChoices = [...(c.pendingAbilityChoices ?? []), abilityChoices(c, rng)]
  }
  c.xp -= cost
  ;(c.xpSinks ??= {})[kind] = n
  const what = kind === 'perk' ? '一次學特質的機會（在事件視窗選）' : kind === 'attr' ? '一點屬性點' : '一次技能三選一（在能力分頁選）'
  return `${c.name}${r.name}：花了 ${cost} 經驗，得到${what}。`
}
