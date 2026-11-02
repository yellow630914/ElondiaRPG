// 局部匯入（docs/plan/WORLD_EDITOR_PLAN.md 第 1 節 E2）：把另一個世界（或檔案）的幾項內容帶進目前的世界。
// 選的項目一定連同它用到的東西（contentRefs.ts 的閉包）；和目前世界同一個 key 的項目：
// - 內容一樣：沿用，不寫第二份
// - 內容不同：玩家選「取代」「保留」或「另存一份」（另存只有自建的才行：改 id，加 8 碼指紋，包裡所有引用它的地方一起改）
// 另存的特殊任務，自己寫的劇情旗標也加上同一個後綴（不然開頭旗標和原本的任務重複，兩個任務會互相觸發）。
// 這裡只算要寫進去的東西；寫入、整理與檢查在 stores/content.ts。

import { entryOf, fingerprint, refKey, rewriteRefs, splitKey, type RefKey, type Section } from './contentRefs'
import type { ContentMods } from './mods'

export type ImportStatus = 'new' | 'same' | 'conflict'
export type ImportChoice = 'replace' | 'keep' | 'copy'

export interface ImportRow {
  key: RefKey
  status: ImportStatus
  /** 自建的（可以另存一份）；內建項目的修改只能取代或保留 */
  custom: boolean
  /** 目前世界的這一項是上次從同一個來源匯入、之後沒改過的：檔案的是新版本，建議取代 */
  newerVersion?: boolean
}

const isCustom = (v: unknown) => !!(v && typeof v === 'object' && (v as { custom?: boolean }).custom)

/**
 * 比較每一項和目前的世界。imported 是目前世界記的「上次匯入時的指紋」：
 * 目前的內容還是那個指紋（匯入後沒改過），檔案的又不一樣，就是新版本。
 */
export function compareRows(target: ContentMods, source: ContentMods, keys: Iterable<RefKey>, imported: Record<RefKey, string> = {}): ImportRow[] {
  return [...keys].map((key) => {
    const mine = entryOf(target, key)
    const theirs = entryOf(source, key)
    const custom = isCustom(theirs)
    if (mine === undefined) return { key, status: 'new', custom }
    const same = JSON.stringify(mine) === JSON.stringify(theirs)
    if (same) return { key, status: 'same', custom }
    const newerVersion = imported[key] !== undefined && imported[key] === fingerprint(mine)
    return { key, status: 'conflict', custom, ...(newerVersion ? { newerVersion } : {}) }
  })
}

/** 衝突時預設怎麼做：新版本取代，其他保留目前世界的 */
export function defaultChoice(row: ImportRow): ImportChoice {
  return row.newerVersion ? 'replace' : 'keep'
}

/** 另存一份的新 id：照每種內容的格式加上指紋（同一份內容另存幾次都是同一個 id） */
export function copyId(section: Section, id: string, hash: string): string {
  if (section === 'shops') return `${id}${hash}`.slice(0, 40) // shop_[a-z0-9]+：不能有底線
  if (section === 'conditions') return `mod_cond_${id.replace(/^mod_cond_/, '').slice(0, 16)}${hash}` // 最多 24 碼
  if (section === 'stories') return `${id.slice(0, 31)}_${hash}`
  return `${id}_${hash}`
}

/** 另存一份的物品名稱：看得懂的「（2）」「（3）」，不能和兩邊已有的名稱重複 */
export function copyItemName(name: string, taken: Set<string>): string {
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, 16)}（${i}）`
    if (!taken.has(n)) return n
  }
}

export interface ImportPackage {
  /** 要寫進目前世界的項目（已經改好名字） */
  mods: Partial<ContentMods>
  /** 另存一份時的改名：舊的 key → 新的 key */
  renamed: [RefKey, RefKey][]
  /** 和目前世界一樣、或選了保留的：不寫 */
  skipped: RefKey[]
  /** 寫進去的每一項的指紋（寫在世界的匯入紀錄） */
  fingerprints: Record<RefKey, string>
}

/**
 * 組出要寫進去的內容。keys 是閉包（全部都要帶）；choices 是衝突的選擇（沒寫時照 defaultChoice）。
 */
export function buildPackage(target: ContentMods, source: ContentMods, rows: ImportRow[], choices: Record<RefKey, ImportChoice> = {}): ImportPackage {
  const renames = new Map<string, string>()
  const renamed: [RefKey, RefKey][] = []
  const skipped: RefKey[] = []
  const take: RefKey[] = []
  const takenItems = new Set([...Object.keys(target.items), ...Object.keys(source.items)])
  const copiedStories: string[] = []
  for (const row of rows) {
    const choice = row.status === 'conflict' ? choices[row.key] ?? defaultChoice(row) : undefined
    if (row.status === 'same' || choice === 'keep') {
      skipped.push(row.key)
      continue
    }
    take.push(row.key)
    if (choice !== 'copy' || !row.custom) continue
    const [section, id] = splitKey(row.key)
    const next = section === 'items' ? copyItemName(id, takenItems) : copyId(section, id, fingerprint(entryOf(source, row.key)))
    takenItems.add(next)
    renames.set(id, next)
    renamed.push([row.key, refKey(section, next)])
    if (section === 'stories') copiedStories.push(row.key)
  }
  // 另存的任務自己寫的旗標：加上新 id 的後綴（開頭旗標不能和原本的任務重複）
  for (const key of copiedStories) {
    const hash = fingerprint(entryOf(source, key))
    for (const f of storyWrites(entryOf(source, key))) if (!renames.has(f)) renames.set(f, `${f.slice(0, 31)}_${hash}`)
  }
  const mods: Partial<Record<Section, Record<string, unknown>>> = {}
  const fingerprints: Record<RefKey, string> = {}
  for (const key of take) {
    const [section, id] = splitKey(key)
    const entry = rewriteRefs(JSON.parse(JSON.stringify(entryOf(source, key))), renames)
    const newId = renames.get(id) ?? id
    ;(mods[section] ??= {})[newId] = entry
    fingerprints[refKey(section, newId)] = fingerprint(entry)
  }
  return { mods: mods as Partial<ContentMods>, renamed, skipped, fingerprints }
}

/** 一個特殊任務自己寫的旗標（開頭、結果的設定與清除） */
function storyWrites(story: unknown): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, k = '') => {
    if (Array.isArray(v)) {
      if (k === 'start_flags' || k === 'set_flags' || k === 'clear_flags') for (const f of v) if (typeof f === 'string') out.add(f)
      for (const x of v) walk(x)
    } else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk)
  }
  walk(story)
  return out
}
