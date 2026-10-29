// 主角的身分標籤：和 NPC 共用 npc_tags.json 的標籤（例如貴族、皇族、神官、商人），建角時最多選 3 個。
// 存檔規則勾了「允許更換身分標籤」時，遊戲中可以在角色詳情裡改。
// 標籤的效果寫在 npc_tags.json 的 pc_effects（docs/NPC_SYSTEM.md 4.1 節）：不看聲望（security.ts 的 meetsReputation）、
// 檢定的加減（perks.ts 的 checkModifiers）、商店與神殿的價格（trade.ts、slavery.ts、tattooShop.ts）、
// 曝露名聲的累積（lewd.ts）、被賣時的身價（companions.ts）、戰鬥中的慾望抗性（combat.ts），以及給 AI 的身分說明。
import { npcTags, tagsExclusive, type NpcTagDef, type PcTagEffects } from './data'
import { matches, type CheckCtx } from './perks'
import type { Character } from './types'
import { pcOf } from './party'
import type { GameState } from './types'

export const PC_TAG_MAX = 3

/** 主角可以選的標籤（npc_tags.json 裡 player 不是 false 的） */
export function pcTagChoices(): [string, NpcTagDef][] {
  return Object.entries(npcTags.tags).filter(([, t]) => t.player !== false)
}

/** 整理主角的標籤：只留可以選的、不重複、和前面的不互斥，最多 3 個 */
export function sanitizePcTags(raw: unknown): string[] {
  const ok = new Set(pcTagChoices().map(([id]) => id))
  const out: string[] = []
  for (const t of Array.isArray(raw) ? raw : []) {
    if (typeof t !== 'string' || !ok.has(t) || out.includes(t) || out.some((o) => tagsExclusive(o, t))) continue
    out.push(t)
    if (out.length >= PC_TAG_MAX) break
  }
  return out
}

/** 主角有沒有帶著某種效果的標籤 */
export function pcTagEffect(state: GameState, effect: keyof NonNullable<NpcTagDef['pc_effects']>): boolean {
  return (pcOf(state).tags ?? []).some((t) => !!npcTags.tags[t]?.pc_effects?.[effect])
}

/** 這個角色身上標籤的效果（只有主角；隊友的標籤是 NPC 的身分，不算） */
function effectsOf(c: Pick<Character, 'tags' | 'isPlayer'> | undefined): { id: string; name: string; e: PcTagEffects }[] {
  if (!c?.isPlayer) return []
  return (c.tags ?? []).map((id) => ({ id, name: npcTags.tags[id]?.name ?? id, e: npcTags.tags[id]?.pc_effects ?? {} }))
}

/** 標籤的數值效果相乘（買價、賣價、神殿服務、曝露名聲、身價），沒有時是 1 */
export function pcTagMult(c: Pick<Character, 'tags' | 'isPlayer'> | undefined, key: 'buy_mult' | 'sell_mult' | 'service_mult' | 'exposure_mult' | 'slave_price_mult'): number {
  return effectsOf(c).reduce((m, x) => m * (x.e[key] ?? 1), 1)
}

/** 標籤的慾望抗性合計（負數是受到的慾望變少） */
export function pcTagLustResist(c: Pick<Character, 'tags' | 'isPlayer'> | undefined): number {
  return effectsOf(c).reduce((s, x) => s + (x.e.lust_resist ?? 0), 0)
}

/** 標籤對這次檢定的加減（每個標籤一行：「身分【貴族】+2」） */
export function pcTagModifiers(c: Pick<Character, 'tags' | 'isPlayer'>, ctx: CheckCtx): { label: string; value: number }[] {
  return effectsOf(c)
    .map((x) => ({ label: `身分【${x.name}】`, value: (x.e.checks ?? []).filter((k) => matches(k.check, ctx)).reduce((s, k) => s + k.bonus, 0) }))
    .filter((x) => x.value)
}

const KIND_NAME: Record<string, string> = {
  chat: '聊天', gift: '送禮', flatter: '獻媚', seduce: '誘惑', hire: '雇用', invite: '邀請入隊', intimidate: '威嚇', bluff: '蒙混',
  haggle: '殺價', bargain: '交涉', steal: '偷竊',
}
const CONTEXT_NAME: Record<string, string> = { travel: '旅途的危險', road: '旅途的事件', gate: '城門盤查', stealth: '潛行', negotiation: '談判' }
const pctText = (m: number) => `${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`

/** 標籤效果的說明（建角、角色詳情）：一項一句 */
export function pcTagEffectLines(id: string): string[] {
  const e = npcTags.tags[id]?.pc_effects
  if (!e) return []
  const out: string[] = []
  if (e.bypass_reputation) out.push('不必聲望也能進入王城、地標與神殿的服務')
  for (const k of e.checks ?? []) {
    const what = [...(k.check.kinds ?? []).map((x) => KIND_NAME[x] ?? x), ...(k.check.contexts ?? []).map((x) => CONTEXT_NAME[x] ?? x)].join('、')
    const vs = k.check.vs_tags?.length ? `（對${k.check.vs_tags.map((t) => npcTags.tags[t]?.name ?? t).join('、')}）` : ''
    out.push(`${what}${vs} ${k.bonus > 0 ? '+' : ''}${k.bonus}`)
  }
  if (e.buy_mult && e.buy_mult !== 1) out.push(`商店買價 ${pctText(e.buy_mult)}`)
  if (e.sell_mult && e.sell_mult !== 1) out.push(`賣價 ${pctText(e.sell_mult)}`)
  if (e.service_mult && e.service_mult !== 1) out.push(`神殿服務 ${pctText(e.service_mult)}`)
  if (e.exposure_mult && e.exposure_mult !== 1) out.push(`曝露名聲累積 ×${e.exposure_mult}（成人向）`)
  if (e.slave_price_mult && e.slave_price_mult !== 1) out.push(`被賣時的身價 ×${e.slave_price_mult}（成人向）`)
  if (e.lust_resist) out.push(`戰鬥中受到的慾望 ${pctText(1 + e.lust_resist)}（成人向）`)
  return out
}

/** 給 AI 的身分說明：「貴族（出身貴族……）、商人（……）」 */
export function pcTagSummary(c: Pick<Character, 'tags' | 'isPlayer'>): string {
  return (c.tags ?? []).map((id) => {
    const t = npcTags.tags[id]
    const hint = t?.pc_effects?.hint ?? t?.ai_hint
    return `${t?.name ?? id}${hint ? `（${hint}）` : ''}`
  }).join('、')
}

/** 遊戲中更換主角的標籤（存檔規則要允許） */
export function setPcTags(state: GameState, tags: unknown) {
  if (!state.options?.tagChange) throw new Error('這個存檔不允許更換身分標籤（可以在設定的「這個存檔的規則」打開）')
  const pc = pcOf(state)
  const next = sanitizePcTags(tags)
  if (next.length) pc.tags = next
  else delete pc.tags
}
