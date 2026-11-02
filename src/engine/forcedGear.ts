// 主人強制裝備（docs/COMPANIONS.md 3.1 節）：主人從「主人會強制裝備」的物品（items.json 的 master_force）挑一件，
// 免費給主角裝上並鎖住；契約還在時不能卸下，也不能在那個欄位換別的（inventory.ts 的 lockedGear）。
// 陷阱鎖（docs/LEWD_STATS.md 第 27 節）：事件的 restrain 把拘束具鎖在主角身上，不綁契約；脫縛、鑰匙或鐵匠剪鎖才拿得下。

import { itemRules, lewdRules, LOCK_GRADES, TRAP_LOCK, type LockGrade } from './data'
import { tagsAllowed } from './content'
import { EXTRA_SLOT, gearKnown, gearRules, slotName } from './gear'
import { freeSlotsFor, putOn } from './inventory'
import { npcRecord } from './npcs'
import { pcOf } from './party'
import { lockName, masterLockGrade } from './schools'
import { withRng } from './state'
import type { GameState, Report } from './types'

/** 這位主人會強制主角裝上的物品：有 master_force、身分符合、主角還沒戴著、而且有能放的欄位 */
export function forcedGearPool(state: GameState, masterTags: string[] = []): string[] {
  const pc = pcOf(state)
  const wearing = new Set(Object.values(pc.gear ?? {}).map((g) => g?.name))
  return itemRules.items
    .filter((i) => i.master_force && i.gear && gearKnown(i.gear))
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
  const pc = pcOf(state)
  // 戴在原本的部位，不放額外飾品欄（docs/ITEMS.md 第 2 節）
  const native = freeSlotsFor(pc, spec).filter((x) => x !== EXTRA_SLOT)
  const { target, back } = putOn(pc, name, spec, native.find((x) => !pc.gear?.[x]) ?? native[0], master)
  // 拘束具：主人用自己的鎖鎖上（依身分，雙面效應的倍率）
  if (gearRules.bases[spec.base]?.bind) pc.gear![target]!.lock = masterLockGrade(rec?.tags ?? [])
  if (back.length) (report.changes.items_gained ??= []).push(...back.map((n) => ({ name: n, qty: 1, owner: 'pc' })))
  return `${rec?.name ?? '主人'}替主角在${slotName(target)}裝上了【${name}】，契約還在時拿不下來${back.length ? `（${back.join('、')}收進行囊）` : ''}`
}

/**
 * 陷阱鎖：把 item（拘束具）戴到主角身上、用 lock 等級的鎖鎖住（鎖的主人是陷阱，契約之外也拿不下）。
 * 優先放原本的部位（空的優先），都被鎖住時放額外飾品欄；換下來的放回行囊。物品自帶比較好的鎖時用自帶的。
 * 內容篩選關掉「主角非自願」、不是拘束具、沒有地方戴時不生效。回傳日誌的說明（沒生效時為空字串）
 */
export function restrainPc(state: GameState, report: Report, item: string, lock: LockGrade = 'white'): string {
  if (!tagsAllowed(['pc_unwilling'])) return ''
  const spec = itemRules.items.find((i) => i.name === item)?.gear
  if (!spec || !gearKnown(spec) || !gearRules.bases[spec.base]?.bind) return ''
  const pc = pcOf(state)
  const options = freeSlotsFor(pc, spec)
  const native = options.filter((x) => x !== EXTRA_SLOT)
  const slot = native.find((x) => !pc.gear?.[x]) ?? native[0] ?? (options.includes(EXTRA_SLOT) ? EXTRA_SLOT : undefined)
  if (!slot) return `${item}沒有地方戴（那些部位都被鎖住了）`
  // 事件寫的鎖和物品自帶的鎖取比較好的一把（自帶符文鎖的枷不會被陷阱的白鐵鎖換掉）
  const given: LockGrade = lewdRules.locks.grades[lock] ? lock : 'white'
  const grade = spec.lock && LOCK_GRADES.indexOf(spec.lock) > LOCK_GRADES.indexOf(given) ? spec.lock : given
  const { target, back } = putOn(pc, item, spec, slot, `${TRAP_LOCK}${item}`)
  pc.gear![target]!.lock = grade
  if (back.length) (report.changes.items_gained ??= []).push(...back.map((n) => ({ name: n, qty: 1, owner: 'pc' })))
  return `【${item}】被${lockName(grade)}鎖在主角的${slotName(target)}上，自己打不開（要脫縛、用鑰匙或找鐵匠剪鎖）${back.length ? `（${back.join('、')}收進行囊）` : ''}`
}
