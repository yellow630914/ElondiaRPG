// 隊伍畫面共用的顯示資訊：角色卡與角色詳情都用
import { attrSources, attrsOf, gearAffinities, slotMaxFor } from '@/engine/character'
import { abilityApCost } from '@/engine/combat'
import { abilityDef, attrName, damageTypeName, type AbilityDef, type AttrId } from '@/engine/data'
import { contractTerms } from '@/engine/slavery'
import { contractOf } from '@/engine/tattoos'
import type { Character, GearSlot } from '@/engine/types'
import type { IconName } from '../ui/iconPaths'

export type CharTab = 'stats' | 'perks' | 'gear' | 'tattoos' | 'profile' | 'abilities'
export const CHAR_TABS: { id: CharTab; label: string; icon: IconName }[] = [
  { id: 'stats', label: '屬性與戰鬥', icon: 'sliders' },
  { id: 'perks', label: '特質', icon: 'star' },
  { id: 'gear', label: '裝備', icon: 'shield' },
  { id: 'tattoos', label: '刺青', icon: 'feather' },
  { id: 'profile', label: '角色設定', icon: 'notebook' },
  { id: 'abilities', label: '能力', icon: 'sparkles' },
]

export const QUALITY_NAME: Record<string, string> = {
  common: '普通', uncommon: '優良', rare: '稀有', epic: '史詩', legendary: '傳說', mythic: '神話',
}
export const TYPE_NAME = { skill: '技能', spell: '法術', cantrip: '戲法' } as const

/** 裝備欄位的圖示（物品圖示做好之前先用欄位圖示） */
export const SLOT_ICON: Record<GearSlot, IconName> = {
  main_hand: 'sword', off_hand: 'shield', head: 'crown', body: 'shirt', legs: 'shirt', wrists: 'hand', feet: 'arrowDown',
  belt: 'minus', accessory: 'gem', ring_1: 'target', ring_2: 'target', piercing_1: 'sparkles', piercing_2: 'sparkles', leg_accessory: 'sparkles',
}

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function contractFor(m: Character) {
  const c = contractOf(m)
  return c ? { ...c, def: contractTerms(c) } : null
}

export function groupedAbilities(m: Character) {
  const list = m.abilities.map(abilityDef)
  return (['skill', 'spell', 'cantrip'] as const)
    .map((t) => ({
      type: t,
      items: list.filter((a) => a.type === t).sort((a, b) => (a.circle ?? a.unlock ?? 0) - (b.circle ?? b.unlock ?? 0)),
    }))
    .filter((g) => g.items.length > 0)
}

export function abilityMeta(a: AbilityDef): string {
  const parts: string[] = []
  if (a.type === 'spell') parts.push(`${a.circle} 環`)
  parts.push(a.type === 'cantrip' ? '0 AP' : `${abilityApCost(a)} AP`)
  if (a.attr) parts.push(a.attr === 'casting' ? '施法屬性' : attrName(a.attr))
  if (a.concentration) parts.push('專注')
  return parts.join('・')
}

/** 各環法術位：剩幾個、共幾個 */
export function spellSlots(m: Character): { circle: number; left: number; max: number }[] {
  return slotMaxFor(m.class, m.level, attrsOf(m)).map((n, i) => ({ circle: i + 1, left: Math.max(0, n - (m.slotsUsed[i] ?? 0)), max: n }))
}

export function slotsText(m: Character): string {
  const list = spellSlots(m)
  return list.length ? list.map((x) => `${x.circle}環 ${x.left}/${x.max}`).join('、') : '無'
}

/** 屬性的來源說明：基礎值與每一項加減（沒有加減時為空） */
export function attrNote(m: Character, a: AttrId): string {
  const parts = attrSources(m).filter((s) => s.attrs[a]).map((s) => `${s.label} ${signed(s.attrs[a]!)}`)
  return parts.length ? `基礎 ${m.attrs[a]}・${parts.join('・')}` : ''
}

export function affinityText(m: Character): string {
  const gear = gearAffinities(m)
  const entries = Object.entries(gear.resist).filter(([, v]) => v)
  if (!entries.length) return '無'
  return entries.map(([k, v]) => `${damageTypeName(k)} ×${Math.max(0, 1 + (v ?? 0))}`).join('、')
}
