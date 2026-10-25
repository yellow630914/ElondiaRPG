// 主人強制裝備（docs/COMPANIONS.md 3.1 節）：主人從「主人會強制裝備」的物品（items.json 的 master_force）挑一件，
// 免費給主角裝上並鎖住；契約還在時不能卸下，也不能在那個欄位換別的（inventory.ts 的 lockedGear）。

import { itemRules } from './data'
import { gearKnown, itemShown, slotName } from './gear'
import { freeSlotsFor, putOn } from './inventory'
import { npcRecord } from './npcs'
import { pcOf } from './party'
import { withRng } from './state'
import type { GameState, Report } from './types'

/** 這位主人會強制主角裝上的物品：有 master_force、身分符合、主角還沒戴著、而且有能放的欄位 */
export function forcedGearPool(state: GameState, masterTags: string[] = []): string[] {
  const pc = pcOf(state)
  const wearing = new Set(Object.values(pc.gear ?? {}).map((g) => g?.name))
  return itemRules.items
    .filter((i) => i.master_force && i.gear && gearKnown(i.gear) && itemShown(i))
    .filter((i) => !i.master_force!.tags?.length || i.master_force!.tags.some((t) => masterTags.includes(t)))
    .filter((i) => !wearing.has(i.name) && freeSlotsFor(pc, i.gear!).length > 0)
    .map((i) => i.name)
}

/** 主人替主角裝上一件（item 沒寫時從可用的裡面隨機挑）；換下來的放回行囊。回傳日誌的說明（沒有可用的時候為空字串） */
export function forceEquip(state: GameState, report: Report, master: string, item?: string): string {
  const rec = npcRecord(state, master)
  const pool = forcedGearPool(state, rec?.tags ?? [])
  const name = item && pool.includes(item) ? item : pool.length ? withRng(state, (rng) => rng.pick(pool)) : undefined
  if (!name) return ''
  const spec = itemRules.items.find((i) => i.name === name)!.gear!
  const { target, back } = putOn(pcOf(state), name, spec, undefined, master)
  if (back.length) (report.changes.items_gained ??= []).push(...back.map((n) => ({ name: n, qty: 1, owner: 'pc' })))
  return `${rec?.name ?? '主人'}替主角在${slotName(target)}裝上了【${name}】，契約還在時拿不下來${back.length ? `（${back.join('、')}收進行囊）` : ''}`
}
