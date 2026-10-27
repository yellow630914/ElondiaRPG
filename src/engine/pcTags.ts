// 主角的身分標籤：和 NPC 共用 npc_tags.json 的標籤（例如貴族、皇族、神官、商人），建角時最多選 3 個。
// 存檔規則勾了「允許更換身分標籤」時，遊戲中可以在角色詳情裡改。
// 標籤的效果寫在 npc_tags.json 的 pc_effects（目前只有 bypass_reputation：要聲望的場所都不看聲望，見 security.ts 的 meetsReputation）。
import { npcTags, tagsExclusive, type NpcTagDef } from './data'
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

/** 遊戲中更換主角的標籤（存檔規則要允許） */
export function setPcTags(state: GameState, tags: unknown) {
  if (!state.options?.tagChange) throw new Error('這個存檔不允許更換身分標籤（可以在設定的「這個存檔的規則」打開）')
  const pc = pcOf(state)
  const next = sanitizePcTags(tags)
  if (next.length) pc.tags = next
  else delete pc.tags
}
