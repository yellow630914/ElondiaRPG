// 套裝（docs/ITEMS.md 2.3 節）：把身上的裝備存成一套，紙娃娃上一鍵換裝。
// - 每個隊員最多 GEAR_SET_MAX 套，存在角色身上（Character.gearSets）。
// - 一格三種：換成這件（item）、這一格脫掉（off）、不動（沒寫）。存成套裝時，身上沒穿的格子是「不動」；鎖住的不存。
// - 換套裝：先看預覽（planGearSet），再一次換好（applyGearSet，約 15 分鐘、一則日誌）。
//   鎖住的（主人強制、詛咒、寄生、上鎖的拘束具鑰匙不在身上）、行囊裡沒有的、在別人身上的、穿不上的跳過，寫出原因。
// - 先把要換的格子全部脫下來，再一件一件穿上（戒指、耳環在兩格之間交換、雙手武器都照順序處理）；穿不上的格子換回原本的那件。

import { classDef } from './data'
import { classWeaponBlock, gearSpecOf, slotNameFor, syncGear } from './gear'
import { recalc } from './character'
import { itemReport, lockedGear, lockItemName, putOn } from './inventory'
import { commitReport } from './state'
import type { Character, GameState, GearSet, GearSetSlot, GearSlot, Report } from './types'

export const GEAR_SET_MAX = 5
export const GEAR_SET_HOURS = 0.25

/** 換套裝時處理欄位的順序（主手先，雙手武器才會先佔掉副手） */
export const GEAR_SET_SLOTS: GearSlot[] = [
  'main_hand', 'off_hand', 'head', 'body', 'legs', 'wrists', 'feet', 'belt', 'accessory', 'ring_1', 'ring_2',
  'piercing_1', 'piercing_2', 'leg_accessory', 'underwear_top', 'underwear_bottom',
  'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5', 'extra_6', 'extra_7', 'extra_8',
]

export type GearSetMode = 'put' | 'off' | 'keep'
export function slotMode(e: GearSetSlot | undefined): GearSetMode {
  if (!e) return 'keep'
  return e.off || !e.item ? 'off' : 'put'
}

function member(state: GameState, id: string): Character {
  const m = state.party.find((x) => x.id === id)
  if (!m) throw new Error('隊伍中沒有這位角色')
  return m
}

function setAt(m: Character, index: number): GearSet {
  const set = m.gearSets?.[index]
  if (!set) throw new Error('沒有這個套裝')
  return set
}

/** 身上現在的裝備（鎖住的不算）變成套裝的格子 */
function currentSlots(m: Character): GearSet['slots'] {
  const slots: GearSet['slots'] = {}
  for (const slot of GEAR_SET_SLOTS) {
    const g = m.gear?.[slot]
    if (g && !lockedGear(m, slot)) slots[slot] = { item: g.name }
  }
  return slots
}

/** 把身上現在穿的存成新的套裝 */
export function saveGearSet(state: GameState, memberId: string, name?: string): number {
  const m = member(state, memberId)
  const sets = (m.gearSets ??= [])
  if (sets.length >= GEAR_SET_MAX) throw new Error(`每人最多 ${GEAR_SET_MAX} 套`)
  sets.push({ name: cleanName(name) || `套裝 ${sets.length + 1}`, slots: currentSlots(m) })
  return sets.length - 1
}

/** 用身上現在穿的覆蓋這一套（名字不變） */
export function overwriteGearSet(state: GameState, memberId: string, index: number) {
  const m = member(state, memberId)
  setAt(m, index).slots = currentSlots(m)
}

const cleanName = (s: string | undefined) => (s ?? '').trim().slice(0, 12)

export function renameGearSet(state: GameState, memberId: string, index: number, name: string) {
  const n = cleanName(name)
  if (!n) throw new Error('請輸入名稱')
  setAt(member(state, memberId), index).name = n
}

export function deleteGearSet(state: GameState, memberId: string, index: number) {
  const m = member(state, memberId)
  setAt(m, index)
  m.gearSets!.splice(index, 1)
  if (!m.gearSets!.length) delete m.gearSets
}

/** 改一格：換成這件（只在記得是哪一件時）、脫掉、不動 */
export function setGearSetSlot(state: GameState, memberId: string, index: number, slot: GearSlot, mode: GearSetMode) {
  const set = setAt(member(state, memberId), index)
  const e = set.slots[slot]
  if (mode === 'keep') delete set.slots[slot]
  else if (mode === 'off') set.slots[slot] = { ...(e?.item ? { item: e.item } : {}), off: true }
  else {
    if (!e?.item) throw new Error('這一格沒有記下要換上哪一件')
    set.slots[slot] = { item: e.item }
  }
}

export interface GearSetRow {
  slot: GearSlot
  label: string
  now?: string
  /** 換成哪一件；null 是脫掉 */
  want: string | null
  status: 'put' | 'off' | 'same' | 'skip'
  reason?: string
}

/** 這件現在在誰身上（不算 m 自己） */
function wornBy(state: GameState, m: Character, name: string): Character | undefined {
  return state.party.find((x) => x !== m && Object.values(x.gear ?? {}).some((g) => g?.name === name))
}

/**
 * 換上這一套會怎樣：每一格的現在、換成、結果（換上、脫掉、一樣、換不了與原因）。
 * 只列套裝寫了的格子；要脫掉的格子本來就空著時不列
 */
export function planGearSet(state: GameState, memberId: string, index: number): GearSetRow[] {
  const m = member(state, memberId)
  const set = setAt(m, index)
  const rows: GearSetRow[] = []
  const freed = new Set<string>()
  // 要換掉的格子上的東西（換套裝時會先脫下來，可以穿到別格）
  for (const slot of GEAR_SET_SLOTS) {
    const e = set.slots[slot]
    const g = m.gear?.[slot]
    if (!e || !g || lockedGear(m, slot)) continue
    if (slotMode(e) === 'off' || e.item !== g.name) freed.add(g.name)
  }
  const inBag = (name: string) => state.inventory.some((i) => i.name === name && i.qty > 0)
  for (const slot of GEAR_SET_SLOTS) {
    const e = set.slots[slot]
    if (!e) continue
    const label = slotNameFor(slot, m.race)
    const g = m.gear?.[slot]
    const lock = lockedGear(m, slot)
    const base = { slot, label, ...(g ? { now: g.name } : {}) }
    if (slotMode(e) === 'off') {
      if (!g) continue
      rows.push(lock ? { ...base, want: null, status: 'skip', reason: `${g.name}鎖著` } : { ...base, want: null, status: 'off' })
      continue
    }
    const item = e.item!
    if (g?.name === item) { rows.push({ ...base, want: item, status: 'same' }); continue }
    if (lock) { rows.push({ ...base, want: item, status: 'skip', reason: `${g!.name}鎖著` }); continue }
    const spec = gearSpecOf(state, item)
    if (!spec) { rows.push({ ...base, want: item, status: 'skip', reason: '這件裝備已經不存在' }); continue }
    const block = state.options?.classWeapons && slot === 'main_hand' ? classWeaponBlock(m.class, spec) : null
    if (block) { rows.push({ ...base, want: item, status: 'skip', reason: block }); continue }
    if (!inBag(item) && !freed.has(item)) {
      const other = wornBy(state, m, item)
      rows.push({ ...base, want: item, status: 'skip', reason: other ? `在${other.name}身上` : '行囊裡沒有了' })
      continue
    }
    rows.push({ ...base, want: item, status: 'put' })
  }
  return rows
}

/** 身上現在穿的和哪一套一樣（套裝寫了的格子都符合）；都不是時 -1 */
export function wornGearSet(m: Character): number {
  return (m.gearSets ?? []).findIndex((set) => Object.entries(set.slots).every(([slot, e]) => {
    const g = m.gear?.[slot as GearSlot]
    return slotMode(e) === 'off' ? !g : g?.name === e!.item
  }) && Object.keys(set.slots).length > 0)
}

/** 換上這一套：一則日誌，約 15 分鐘 */
export function applyGearSet(state: GameState, memberId: string, index: number): Report {
  if (state.combat) throw new Error('戰鬥中不能換裝')
  const m = member(state, memberId)
  const set = setAt(m, index)
  const rows = planGearSet(state, memberId, index)
  // 行囊的增減先記在這裡，最後一起寫進日誌（commitReport 才真的加減）
  const ledger = new Map<string, number>()
  const add = (name: string, n: number) => ledger.set(name, (ledger.get(name) ?? 0) + n)
  const have = (name: string) => (state.inventory.find((i) => i.name === name)?.qty ?? 0) + (ledger.get(name) ?? 0)
  const old = new Map<GearSlot, string>()
  // 第一輪：要換的格子先脫下來（自己鎖上、鑰匙在身上的拘束具：打開，鎖收回行囊）
  for (const r of rows) {
    if (r.status !== 'put' && r.status !== 'off') continue
    const g = m.gear?.[r.slot]
    if (!g) continue
    old.set(r.slot, g.name)
    delete m.gear![r.slot]
    add(g.name, 1)
    const lock = g.lock && !g.locked ? lockItemName(g.lock) : undefined
    if (lock) add(lock, 1)
  }
  // 第二輪：穿上
  const put: string[] = []
  const skipped: string[] = rows.filter((r) => r.status === 'skip').map((r) => `${r.label}（${r.reason}）`)
  const wear = (name: string, slot: GearSlot) => {
    const spec = gearSpecOf(state, name)!
    const { back } = putOn(m, name, spec, slot)
    add(name, -1)
    for (const b of back) add(b, 1)
  }
  for (const r of rows) {
    if (r.status !== 'put') continue
    const item = r.want!
    try {
      if (have(item) <= 0) throw new Error('行囊裡沒有了')
      wear(item, r.slot)
      put.push(item)
    } catch (e) {
      skipped.push(`${r.label}（${e instanceof Error ? e.message : String(e)}）`)
      // 穿不上：換回原本的那件
      const prev = old.get(r.slot)
      if (prev && have(prev) > 0 && !m.gear?.[r.slot]) {
        try { wear(prev, r.slot) } catch { /* 原本的也穿不回去：留在行囊 */ }
      }
    }
  }
  syncGear(m, classDef(m.class).weapon)
  recalc(m)
  const off = rows.filter((r) => r.status === 'off').map((r) => r.now!)
  const report = itemReport(state, GEAR_SET_HOURS)
  const lost = [...ledger].filter(([, n]) => n < 0).map(([name, n]) => ({ name, qty: -n }))
  const gained = [...ledger].filter(([, n]) => n > 0).map(([name, n]) => ({ name, qty: n, owner: 'pc' as const }))
  if (lost.length) report.changes.items_lost = lost
  if (gained.length) report.changes.items_gained = gained
  const parts = [
    put.length ? `換上${put.join('、')}` : '',
    off.length ? `脫下${off.join('、')}` : '',
  ].filter(Boolean)
  report.outcome.summary = `${m.name}換上了「${set.name}」${parts.length ? `：${parts.join('，')}` : '（沒有要換的）'}。${skipped.length ? `沒換：${skipped.join('、')}。` : ''}`
  report.outcome.tags = ['換裝']
  return commitReport(state, report)
}
