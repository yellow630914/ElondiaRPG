// 和這裡的人互動：聊天、送禮、獻媚（見 docs/NPC_SYSTEM.md 第 8 節）。
// 都是主動行動：先擲骰，再由 AI 或規則判定；親密度由程式依成功程度改變，AI 只能補充關係文字與旗標。

import { lifeTier } from './character'
import { actionRules, economy, itemDef, locationById, tagDef, type ActionKind, type Degree } from './data'
import { formatMoney } from './money'
import { npcRecord, npcTitle } from './npcs'
import { addAffinity, pcOf } from './party'
import { presentHere } from './population'
import { ensureRelationship } from './social'
import type { GameState, NpcRecord, Report } from './types'

export type InteractionKind = 'chat' | 'gift' | 'flatter'
export const INTERACTIONS: InteractionKind[] = ['chat', 'gift', 'flatter']

export function isInteraction(kind: ActionKind): kind is InteractionKind {
  return (INTERACTIONS as string[]).includes(kind)
}

/** 財富等級：標籤中最高的（沒有標籤為 1） */
export function wealthOf(rec: Pick<NpcRecord, 'tags'>): number {
  return Math.max(1, ...(rec.tags ?? []).map((t) => tagDef(t)?.wealth ?? 1))
}

/** 物品的價值（目錄價格或自創物品的價格） */
export function itemValue(state: GameState, name: string): number {
  return itemDef(name)?.price_cc ?? state.customItems?.[name]?.price_cc ?? 0
}

/** 禮物的價值加成：價格每達到一級門檻 +1 */
export function giftBonus(state: GameState, rec: Pick<NpcRecord, 'tags'>, item: string): number {
  const k = actionRules.kinds.gift
  const living = economy.commoner_living_cc_per_day
  const scale = k.wealth_scale ?? [1]
  const threshold = living * (scale[Math.min(wealthOf(rec), scale.length - 1)] ?? 1)
  const price = itemValue(state, item)
  return (k.value_steps ?? []).filter((step) => price >= threshold * step).length
}

/** 這次互動各成功程度的親密度變化 */
export function affinityTable(state: GameState, kind: InteractionKind, rec: NpcRecord, item?: string): Record<Degree, number> {
  const base = { ...actionRules.kinds[kind].affinity! }
  if (kind === 'gift' && item) {
    const bonus = giftBonus(state, rec, item)
    for (const d of ['critical', 'success', 'partial'] as Degree[]) base[d] += bonus
  }
  return base
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export interface InteractionSetup {
  dc: number
  targetName: string
  situational: { label: string; value: number }[]
  outcomes: Partial<Record<Degree, string>>
  scene: string
}

/** 參考 DC 與各成功程度的結果；也檢查對象在不在、禮物有沒有 */
export function setupInteraction(state: GameState, kind: InteractionKind, target?: string, item?: string): InteractionSetup {
  const rec = target ? npcRecord(state, target) : undefined
  if (!rec) throw new Error('要選一個對象')
  if (state.party.some((m) => m.id === rec.id)) throw new Error('隊友不需要這樣互動，可以用自由行動')
  if (!presentHere(state, rec.id)) throw new Error('對方不在這裡')
  if (rec.hostile) throw new Error(`${rec.name}對你充滿敵意，不想理你`)
  if (kind === 'gift') {
    if (!item) throw new Error('要選一件禮物')
    if (!state.inventory.some((i) => i.name === item && i.qty > 0)) throw new Error(`沒有${item}`)
  }
  // 互動過就算認識了
  ensureRelationship(state, rec)
  const pc = pcOf(state)
  const def = actionRules.kinds[kind]
  const rel = state.relationships?.[rec.id]
  let dc = (def.base ?? 12) + 2 * Math.max(0, lifeTier(rec.level) - lifeTier(pc.level))
  if (rel) dc -= Math.floor(rel.affinity / 25)
  const situational: { label: string; value: number }[] = []
  if (kind === 'flatter' && def.status_dc) {
    const gap = wealthOf(rec) - 2
    if (gap > 0) situational.push({ label: '對方身分高貴', value: -def.status_dc * gap })
  }
  const table = affinityTable(state, kind, rec, item)
  const outcomes = Object.fromEntries(
    (Object.keys(table) as Degree[]).map((d) => [d, `${rec.name}的親密度 ${signed(table[d])}${kind === 'gift' && d === 'fumble' ? '，禮物被退回' : ''}`]),
  ) as Record<Degree, string>
  const where = locationById(state.location).name
  return { dc, targetName: rec.name, situational, outcomes, scene: `${where}・${npcTitle(rec)}${rec.name}` }
}

/** 套用機制結果：親密度、送出的禮物 */
export function applyInteraction(state: GameState, report: Report, kind: InteractionKind, target: string, degree: Degree, item?: string): string {
  const rec = npcRecord(state, target)!
  const delta = affinityTable(state, kind, rec, item)[degree]
  const reason = { chat: '聊天', gift: item ? `收到${item}` : '收到禮物', flatter: '被奉承' }[kind]
  if (delta) addAffinity(state, report, target, delta, reason)
  if (kind === 'gift' && item) {
    if (degree === 'fumble') return `${rec.name}把${item}退了回來。`
    report.changes.items_lost = [...(report.changes.items_lost ?? []), { name: item, qty: 1 }]
    const value = itemValue(state, item)
    return `把${item}${value ? `（價值 ${formatMoney(value)}）` : ''}送給了${rec.name}。`
  }
  return ''
}
