// 自訂內容之間的關聯（docs/plan/WORLD_EDITOR_PLAN.md 第 1 節 E1）：局部匯入、匯出時，選了一項就一定要帶上它用到的東西。
// 只讀資料，不改任何規則。和 usage.ts 是同一件事的兩個方向：usage.ts 回答「誰用到 X」（擋刪除），這裡回答「X 用到誰」。
//
// 「A 關聯到 B」：
// - A 的資料裡寫了 B 的 id 或名稱（任何深度的字串值或物件的 key；特殊地圖的格子位置寫成 sm/<id>）
// - A 是物品、B 是掉落它的怪物（掉落存在怪物身上）
// - A 寫了 B 產生的制式裝備（自建的底材或材料自動產生的物品，名稱不在自訂內容裡）
// - A 讀到的劇情旗標或計數器是 B 寫的（設定、清除、加減）
// 只算 mods 裡有的項目（自建的與修改過的內建）：沒修改的內建每個世界都有。

import { itemDef } from './data'
import type { ContentMods } from './mods'

export type Section = Exclude<keyof ContentMods, 'version'>
/** 一項內容：`區塊:id`（物品是 `items:名稱`） */
export type RefKey = string

export const REF_SECTIONS: Section[] = ['statuses', 'conditions', 'tattoos', 'marks', 'markRules', 'landmarks', 'specialMaps', 'shops', 'abilities', 'perks', 'materials', 'bases', 'items', 'enemies', 'npcs', 'stories', 'travelEvents', 'eventRules', 'bindRules', 'masterEvents', 'categoryIcons', 'counters']
/** 只有一筆的設定（或依類別的圖示）：可以被選，但不會因為字串剛好一樣就被當成關聯 */
const SINGLETONS = new Set<Section>(['markRules', 'eventRules', 'bindRules', 'categoryIcons'])

export const refKey = (section: Section, id: string): RefKey => `${section}:${id}`
export function splitKey(key: RefKey): [Section, string] {
  const i = key.indexOf(':')
  return [key.slice(0, i) as Section, key.slice(i + 1)]
}

export function entryOf(m: ContentMods, key: RefKey): unknown {
  const [section, id] = splitKey(key)
  return (m[section] as Record<string, unknown> | undefined)?.[id]
}

/** mods 裡所有的項目 */
export function contentKeys(m: ContentMods): RefKey[] {
  return REF_SECTIONS.flatMap((s) => Object.keys((m[s] as Record<string, unknown> | undefined) ?? {}).map((id) => refKey(s, id)))
}

const READ_FLAGS = new Set(['flags', 'flags_none', 'flags_any'])
const WRITE_FLAGS = new Set(['set_flags', 'clear_flags', 'start_flags'])
const cleanFlag = (f: string) => f.replace(/^story:/, '')

interface Scan {
  strings: Set<string>
  readFlags: Set<string>
  writeFlags: Set<string>
  readCounters: Set<string>
  writeCounters: Set<string>
}

/** 走過一筆內容：所有字串值與物件的 key、讀寫的旗標與計數器 */
function scan(v: unknown, out: Scan, parentKey = ''): void {
  if (typeof v === 'string') {
    out.strings.add(v)
    if (v.startsWith('sm/')) out.strings.add(v.slice(3))
    return
  }
  if (Array.isArray(v)) {
    if (READ_FLAGS.has(parentKey)) for (const f of v) if (typeof f === 'string') out.readFlags.add(cleanFlag(f))
    if (WRITE_FLAGS.has(parentKey)) for (const f of v) if (typeof f === 'string') out.writeFlags.add(cleanFlag(f))
    for (const x of v) scan(x, out, parentKey)
    return
  }
  if (!v || typeof v !== 'object') return
  const o = v as Record<string, unknown>
  // 效果「旗標」也是寫旗標
  if (o.type === 'flag' && typeof o.key === 'string') out.writeFlags.add(cleanFlag(o.key))
  for (const [k, x] of Object.entries(o)) {
    if (k === 'counters' && x && typeof x === 'object' && !Array.isArray(x)) {
      // 結果的計數器是加減（數字），條件的是範圍（物件）
      for (const [c, d] of Object.entries(x as Record<string, unknown>)) (typeof d === 'number' ? out.writeCounters : out.readCounters).add(c)
    }
    out.strings.add(k)
    scan(x, out, k)
  }
}

export interface RefGraph {
  /** 每一項關聯到哪些項目（不含自己） */
  refs: Map<RefKey, Set<RefKey>>
  /** 每一項讀到的旗標裡，在這份內容裡沒有人寫的（AI、引擎或目標世界的其他內容寫的）：只提示 */
  external: Map<RefKey, string[]>
}

/**
 * 建立關聯：m 是來源的內容。制式裝備的名稱用目前套用的遊戲資料查（itemDef），
 * 所以分析別的世界時先套用那個世界的內容（stores/content.ts 會在沙盒裡做）。
 */
export function buildRefs(m: ContentMods): RefGraph {
  const keys = contentKeys(m)
  // 字串 → 項目（同一個字串可能是好幾種內容的 id，例如戰鬥狀態與非戰鬥狀態都有 blessed：都算）
  const byId = new Map<string, RefKey[]>()
  for (const key of keys) {
    const [section, id] = splitKey(key)
    if (SINGLETONS.has(section)) continue
    const list = byId.get(id) ?? []
    list.push(key)
    byId.set(id, list)
  }
  const scans = new Map<RefKey, Scan>()
  for (const key of keys) {
    const s: Scan = { strings: new Set(), readFlags: new Set(), writeFlags: new Set(), readCounters: new Set(), writeCounters: new Set() }
    scan(entryOf(m, key), s)
    scans.set(key, s)
  }
  // 旗標與計數器：誰寫
  const flagWriters = new Map<string, RefKey[]>()
  const counterWriters = new Map<string, RefKey[]>()
  for (const [key, s] of scans) {
    for (const f of s.writeFlags) flagWriters.set(f, [...(flagWriters.get(f) ?? []), key])
    for (const c of s.writeCounters) counterWriters.set(c, [...(counterWriters.get(c) ?? []), key])
  }
  // 物品 → 掉落它的怪物
  const droppers = new Map<string, RefKey[]>()
  for (const [id, e] of Object.entries(m.enemies)) {
    for (const l of (e as { loot?: { item: string }[] }).loot ?? []) droppers.set(l.item, [...(droppers.get(l.item) ?? []), refKey('enemies', id)])
  }

  const refs = new Map<RefKey, Set<RefKey>>()
  const external = new Map<RefKey, string[]>()
  for (const [key, s] of scans) {
    const out = new Set<RefKey>()
    const [section, id] = splitKey(key)
    for (const str of s.strings) {
      for (const k of byId.get(str) ?? []) out.add(k)
      // 自建的底材或材料產生的制式裝備
      if (!byId.has(str)) {
        const gear = safeItemDef(str)?.gear
        if (gear) {
          if (m.bases[gear.base]) out.add(refKey('bases', gear.base))
          if (m.materials[gear.material]) out.add(refKey('materials', gear.material))
        }
      }
    }
    if (section === 'items') for (const k of droppers.get(id) ?? []) out.add(k)
    const missing: string[] = []
    for (const f of s.readFlags) {
      const w = flagWriters.get(f)
      if (w) for (const k of w) out.add(k)
      else missing.push(f)
    }
    for (const c of s.readCounters) for (const k of counterWriters.get(c) ?? []) out.add(k)
    out.delete(key)
    refs.set(key, out)
    if (missing.length) external.set(key, missing)
  }
  return { refs, external }
}

function safeItemDef(name: string) {
  try {
    return itemDef(name)
  } catch {
    return undefined
  }
}

/** 選了這些項目時，一定要一起帶的全部項目（包括選的） */
export function closure(graph: RefGraph, picked: Iterable<RefKey>): Set<RefKey> {
  const out = new Set<RefKey>()
  const stack = [...picked]
  while (stack.length) {
    const k = stack.pop()!
    if (out.has(k) || !graph.refs.has(k)) continue
    out.add(k)
    for (const r of graph.refs.get(k)!) if (!out.has(r)) stack.push(r)
  }
  return out
}

/** 誰用到這一項（反方向；只顯示，不自動帶） */
export function usersOf(graph: RefGraph, key: RefKey): RefKey[] {
  return [...graph.refs].filter(([, set]) => set.has(key)).map(([k]) => k)
}

/** 從 mods 拿出這些項目（深拷貝） */
export function pickMods(m: ContentMods, keys: Iterable<RefKey>): Partial<ContentMods> {
  const out: Partial<Record<Section, Record<string, unknown>>> = {}
  for (const key of keys) {
    const [section, id] = splitKey(key)
    const v = entryOf(m, key)
    if (v === undefined) continue
    ;(out[section] ??= {})[id] = JSON.parse(JSON.stringify(v))
  }
  return out as Partial<ContentMods>
}

/** 內容的指紋：8 碼十六進位（FNV-1a），內容一樣就一樣 */
export function fingerprint(v: unknown): string {
  const s = JSON.stringify(v) ?? ''
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 換掉內容裡所有等於舊名字的字串值與物件的 key（含 sm/<id> 的格子位置）：另存一份時改 id 用 */
export function rewriteRefs<T>(v: T, renames: Map<string, string>): T {
  if (!renames.size) return v
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') {
      if (renames.has(x)) return renames.get(x)
      if (x.startsWith('sm/') && renames.has(x.slice(3))) return `sm/${renames.get(x.slice(3))}`
      return x
    }
    if (Array.isArray(x)) return x.map(walk)
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [renames.get(k) ?? k, walk(y)]))
    return x
  }
  return walk(v) as T
}
