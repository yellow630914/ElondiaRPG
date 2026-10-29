// 鑰匙與脫縛（docs/LEWD_STATS.md 第 16 節）：別人鎖在身上的拘束具（主人強制戴上的）可以試著掙開，或用鑰匙打開。
// 自己鎖的隨時可以打開（inventory.ts 的 unlockGear），不需要這些。
// 戰鬥中的拘束（狀態有 struggle）用掙脫、撕開擺脫，見 combat.ts。

import { classDef, itemDef, itemRules, lewdRules, LOCK_GRADES, type Degree, type LockGrade } from './data'
import { slotName, syncGear } from './gear'
import { recalc } from './character'
import { addLewdStat, lewdOf } from './lewd'
import { PARASITE_LOCK } from './parasites'
import { isFugitive, pcOf, punish } from './party'
import { bindsOf, lockName } from './schools'
import { masterNearby } from './slavery'
import { contractOf } from './tattoos'
import type { Character, GameState, GearSlot, Report } from './types'

export const unbindRules = () => lewdRules.unbind

/** 這一格是別人鎖上、自己打不開的拘束具：主人強制戴上的（契約還在時），寄生物不算 */
export function stuckRestraint(m: Character, slot: GearSlot): { name: string; lock: LockGrade; bind: number; master: string } | undefined {
  const g = m.gear?.[slot]
  if (!g?.locked || g.locked.startsWith(PARASITE_LOCK) || !contractOf(m)) return undefined
  const b = bindsOf(m).find((x) => x.slot === slot)
  if (!b) return undefined
  return { name: g.name, lock: b.lock ?? lewdRules.locks.master_default, bind: b.bind, master: g.locked }
}

/** 身上所有掙不開的拘束具 */
export function stuckRestraints(m: Character): GearSlot[] {
  return (Object.keys(m.gear ?? {}) as GearSlot[]).filter((s) => !!stuckRestraint(m, s))
}

/** 雙手被綁住（身上有「束縛雙手」的拘束具） */
export function handsBound(m: Character): boolean {
  return bindsOf(m).some((b) => b.kind === 'hands')
}

/** 嘗試脫縛的 DC 與組成（主動行動與畫面的提示用）；雙手被綁的減值照雙面效應算在檢定上（schools.ts 的 bindModifiers） */
export function unbindDc(m: Character, slot: GearSlot): { dc: number; parts: { label: string; value: number }[] } {
  const r = unbindRules()
  const s = stuckRestraint(m, slot)
  if (!s) throw new Error(`${slotName(slot)}沒有掙不開的拘束具`)
  const parts = [
    { label: lockName(s.lock), value: r.lock_dc[s.lock] ?? 0 },
    { label: `拘束程度 ${s.bind}`, value: s.bind * r.bind_dc },
  ]
  const ease = Math.floor(lewdOf(m).endurance / r.endurance_per)
  if (ease) parts.push({ label: '忍耐', value: -ease })
  return { dc: r.base + parts.reduce((a, p) => a + p.value, 0), parts: parts.filter((p) => p.value) }
}

/** 主動行動的對象：「隊員 id:欄位」 */
export function parseUnbindTarget(state: GameState, target: string | undefined): { m: Character; slot: GearSlot } {
  const [id, slot] = (target ?? '').split(':')
  const m = state.party.find((x) => x.id === id)
  if (!m || !slot) throw new Error('要選一件掙不開的拘束具')
  if (!stuckRestraint(m, slot as GearSlot)) throw new Error(`${m.name}的${slotName(slot as GearSlot)}沒有掙不開的拘束具`)
  return { m, slot: slot as GearSlot }
}

/** 主人看得到：還沒逃走的奴隸（主人帶在身邊），或逃亡奴隸的主人就在附近 */
function masterWatching(state: GameState, m: Character, master: string): boolean {
  if (m.id !== pcOf(state).id || contractOf(m)?.master !== master) return false
  return !isFugitive(state) || masterNearby(state)
}

export function setupUnbind(state: GameState, target?: string) {
  const { m, slot } = parseUnbindTarget(state, target)
  const s = stuckRestraint(m, slot)!
  const { dc } = unbindDc(m, slot)
  const watched = masterWatching(state, m, s.master)
  const r = unbindRules()
  return {
    attr: r.attr, dc, targetName: s.name, situational: [], actor: m.id,
    scene: `${m.name}・${slotName(slot)}的${s.name}`,
    outcomes: {
      critical: `${lockName(s.lock)}被弄壞，${s.name}可以卸下了`,
      success: `${lockName(s.lock)}被弄壞，${s.name}可以卸下了`,
      partial: '鬆動了一點，但還是掙不開',
      fail: watched ? '掙不開，被主人發現：輕度懲罰' : '掙不開',
      fumble: `越掙越緊，順從 +${r.fumble_submission}${watched ? '；被主人當場抓到：嚴厲懲罰' : ''}`,
    } as Partial<Record<Degree, string>>,
  }
}

/** 解開：鎖拿掉、不再是主人鎖上的（拘束具留在身上，之後可以自己卸下） */
function release(m: Character, slot: GearSlot) {
  const g = m.gear![slot]!
  delete g.lock
  delete g.locked
  syncGear(m, classDef(m.class).weapon)
  recalc(m)
}

export function applyUnbind(state: GameState, report: Report, target: string, degree: Degree): string {
  const { m, slot } = parseUnbindTarget(state, target)
  const s = stuckRestraint(m, slot)!
  const r = unbindRules()
  if (degree === 'critical' || degree === 'success') {
    release(m, slot)
    return `${m.name}弄壞了${s.name}上的${lockName(s.lock)}，終於可以把它卸下來了。`
  }
  if (degree === 'partial') return `${s.name}鬆動了一點，但還是掙不開。`
  const watched = masterWatching(state, m, s.master)
  const lines = [`${m.name}怎麼掙都掙不開${s.name}。`]
  if (degree === 'fumble') {
    const d = addLewdStat(m, 'submission', r.fumble_submission, report)
    lines.push(`越掙越緊，勒得${m.name}動彈不得${d ? `（順從 +${d}）` : ''}。`)
  }
  if (watched) lines.push(punish(state, degree === 'fumble' ? 'heavy' : 'light', report))
  return lines.join('')
}

// ---- 鑰匙 ----

/** 鑰匙打得開這把鎖嗎（同等級以下） */
export function keyFits(key: LockGrade, lock: LockGrade): boolean {
  return LOCK_GRADES.indexOf(key) >= LOCK_GRADES.indexOf(lock)
}

/** 行囊裡打得開這一格的鑰匙（等級低的排前面） */
export function keysFor(state: GameState, m: Character, slot: GearSlot): string[] {
  const s = stuckRestraint(m, slot)
  if (!s) return []
  return state.inventory
    .filter((i) => i.qty > 0 && itemDef(i.name)?.key && keyFits(itemDef(i.name)!.key!, s.lock))
    .sort((a, b) => LOCK_GRADES.indexOf(itemDef(a.name)!.key!) - LOCK_GRADES.indexOf(itemDef(b.name)!.key!))
    .map((i) => i.name)
}

/** 用鑰匙打開別人鎖上的拘束具：鑰匙用掉，鎖歸自己（放進行囊）。回傳日誌的說明與拿到的鎖 */
export function openWithKey(m: Character, slot: GearSlot, key: string): { text: string; lock?: string } {
  const s = stuckRestraint(m, slot)
  if (!s) throw new Error(`${slotName(slot)}沒有需要鑰匙的鎖`)
  const grade = itemDef(key)?.key
  if (!grade) throw new Error(`${key}不是鑰匙`)
  if (!keyFits(grade, s.lock)) throw new Error(`${key}打不開${lockName(s.lock)}`)
  release(m, slot)
  const lock = itemRules.items.find((i) => i.lock === s.lock)?.name
  return { text: `${m.name}用${key}打開了${s.name}上的${lockName(s.lock)}，可以把它卸下來了。`, ...(lock ? { lock } : {}) }
}
