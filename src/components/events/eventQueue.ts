// 需要玩家回應的事件，用同一個格式排成佇列，在事件視窗（EventCenter.vue）裡一件一件處理：
// - 擋住行動的（戰敗後的處境、對峙、刻印、主人的要求、旅途事件、城鎮事件）：不處理就不能移動、休息；排在前面
// - 可以晚點處理的（AI 提議的關係變化、升級、取得特質的機會）：可以按「稍後」
// 有新的事件時事件視窗自動打開；關掉之後畫面上方顯示「🔔 N 件待處理」。

import { ref } from 'vue'
import { roadTemplate } from '@/engine/road'
import { pendingTownEvent } from '@/engine/townEvents'
import type { GameState } from '@/engine/types'
import { contractOf } from '@/engine/tattoos'

export type GameEventKind = 'defeat' | 'standoff' | 'mark' | 'master' | 'road' | 'town' | 'suggestion' | 'levelup' | 'perk'

export interface GameEvent {
  /** 同一件事一直是同一個 id（用來判斷是不是新的事件、記住「稍後」） */
  id: string
  kind: GameEventKind
  icon: string
  title: string
  /** 不處理就不能移動、休息 */
  blocking: boolean
  /** 關係變化：哪一則提議；升級：哪一位隊員；特質：「隊員 id:機會 id」 */
  ref?: string
}

/** 事件視窗開著嗎 */
export const eventDialogOpen = ref(false)
/** 按了「稍後」的事件（這次開啟頁面內有效） */
export const snoozed = ref(new Set<string>())

function hash(v: unknown): string {
  const text = JSON.stringify(v) ?? ''
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** 目前所有要回應的事件（擋住行動的在前）；戰鬥中、正在判定行動時不列出擋住行動的事件 */
export function pendingEvents(state: GameState | null): GameEvent[] {
  if (!state || state.combat) return []
  const out: GameEvent[] = []
  // 正在判定的主動行動（例如回應主人的要求）：判定完再說
  if (!state.pendingAction) {
    if (state.pendingDefeat) out.push({ id: `defeat:${hash(state.pendingDefeat)}`, kind: 'defeat', icon: '⚠️', title: '倒下之後', blocking: true })
    if (state.standoff) out.push({ id: `standoff:${hash(state.standoff)}`, kind: 'standoff', icon: '⚠️', title: '對峙', blocking: true })
    if (state.pendingMark) out.push({ id: `mark:${hash(state.pendingMark)}`, kind: 'mark', icon: '🔥', title: '刻下契約印記', blocking: true })
    if (state.pendingMasterEvent) {
      const master = contractOf(state.party.find((m) => m.isPlayer))?.masterName || '主人'
      out.push({ id: `master:${hash(state.pendingMasterEvent)}`, kind: 'master', icon: '⛓️', title: `${master}的要求`, blocking: true })
    }
    if (state.roadEvent) out.push({ id: `road:${state.roadEvent.x}:${state.roadEvent.template}`, kind: 'road', icon: '🧭', title: roadTemplate(state.roadEvent.template)?.title ?? '旅途上的事', blocking: true })
    if (state.townEvent) out.push({ id: `town:${state.townEvent.template}:${state.townEvents?.last ?? 0}`, kind: 'town', icon: '🏘️', title: pendingTownEvent(state)?.title ?? '城裡的事', blocking: true })
  }
  for (const s of state.suggestions ?? []) {
    const name = state.relationships?.[s.npc]?.name ?? s.npc
    out.push({ id: `suggestion:${s.id}`, kind: 'suggestion', icon: '💞', title: `${name}和你的關係有了變化`, blocking: false, ref: s.id })
  }
  for (const m of state.party) {
    const choices = m.pendingAbilityChoices?.length ?? 0
    if (!choices && !(m.attrPoints > 0)) continue
    const what = [choices ? `選擇 ${choices} 項能力` : '', m.attrPoints > 0 ? `分配 ${m.attrPoints} 點屬性` : ''].filter(Boolean).join('、')
    out.push({ id: `levelup:${m.id}:${m.level}:${choices}:${m.attrPoints}`, kind: 'levelup', icon: '⬆️', title: `${m.name}升級了：${what}`, blocking: false, ref: m.id })
  }
  for (const m of state.party) {
    for (const o of m.perkOffers ?? []) {
      out.push({ id: `perk:${m.id}:${o.id}:${o.pitched ? 1 : 0}`, kind: 'perk', icon: '🌟', title: `${m.name}有機會學會特質（${o.source}）`, blocking: false, ref: `${m.id}:${o.id}` })
    }
  }
  return out
}

/** 還沒按「稍後」的事件（擋住行動的不能稍後） */
export function activeEvents(state: GameState | null): GameEvent[] {
  return pendingEvents(state).filter((e) => e.blocking || !snoozed.value.has(e.id))
}
