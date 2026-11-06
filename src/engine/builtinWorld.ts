// 匯出、匯入內建世界（docs/CONTENT_EDITOR.md 的「匯出內建世界」）：
// - 匯出：原版世界的全部可編輯內容（怪物、物品、技能……），一種一個 JSON 檔，加上 README（md 與 txt），包成 zip。
//   每一筆是「內容編輯器存檔時的樣子」（整理過的），所以檔案裡看到的欄位就是遊戲會讀的欄位。
// - 匯入：讀改過的 zip，和內建的比較，只留真的改過的項目與新增的項目，建立成新的世界。
//   規則和遊戲裡手動編輯一樣：內建的不能刪除（拿掉的那一筆照原版），id 不能改（改了等於新增），不合規則的欄位會被調整或拿掉。
// 呼叫的時候要先套用原版（applyContent(emptyMods())），整理完再套回目前的世界（content store 負責）。

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  abilities, companionRules, enemies, itemRules, landmarks, masterEventPool, npcs, npcTags, perkRules, shopRules, slaveryRules, specialMaps, statuses, stories, storyCounters,
} from './data'
import { gearRules } from './gear'
import { normalizeMods, type ContentMods } from './mods'
import { currentBindRules } from './bindRulesMods'
import { POOL_IDS } from './masterEventMods'
import { travelEvents } from './road'
import { builtinJob } from './shopMods'
import { tattooRules } from './tattoos'
import { parasiteRules } from './parasites'
import { currentParasite } from './parasiteMods'
import { currentMarkRules } from './tattooMods'
import { editableOf } from './npcTagMods'
import { builtinEventRules } from './travelEventMods'

export type BuiltinSection =
  | 'enemies' | 'items' | 'bases' | 'materials' | 'abilities' | 'perks' | 'npcTags' | 'statuses' | 'conditions' | 'tattoos' | 'marks' | 'markRules' | 'parasites'
  | 'npcs' | 'stories' | 'landmarks' | 'specialMaps' | 'shops' | 'travelEvents' | 'eventRules' | 'bindRules' | 'masterEvents' | 'counters'

export interface SectionInfo {
  key: BuiltinSection
  /** 中文名稱（README、匯入結果） */
  name: string
  /** 只有一筆（rules）的設定 */
  single?: boolean
  /** 欄位說明在 Wiki 的哪一頁（內容指南） */
  guide?: string
}

/** 匯出的種類（照編輯器的順序）；類別圖示（上傳的圖）不在裡面 */
export const BUILTIN_SECTIONS: SectionInfo[] = [
  { key: 'enemies', name: '怪物', guide: '怪物（製作指南）' },
  { key: 'abilities', name: '技能', guide: '技能（製作指南）' },
  { key: 'statuses', name: '戰鬥狀態', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'items', name: '物品', guide: '物品、底材與材料（製作指南）' },
  { key: 'bases', name: '底材', guide: '物品、底材與材料（製作指南）' },
  { key: 'materials', name: '材料', guide: '物品、底材與材料（製作指南）' },
  { key: 'perks', name: '特質', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'npcTags', name: '身分標籤' },
  { key: 'conditions', name: '非戰鬥狀態', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'tattoos', name: '刺青圖樣', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'marks', name: '奴隸印記', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'markRules', name: '印記設定', single: true },
  { key: 'parasites', name: '寄生物', guide: '狀態、特質、刺青與奴隸印記（製作指南）' },
  { key: 'npcs', name: '固定 NPC', guide: '固定 NPC（製作指南）' },
  { key: 'stories', name: '特殊任務', guide: '特殊任務（製作指南）' },
  { key: 'landmarks', name: '地標', guide: '地標（製作指南）' },
  { key: 'specialMaps', name: '特殊地圖', guide: '特殊地圖（製作指南）' },
  { key: 'shops', name: '商店', guide: '商店（製作指南）' },
  { key: 'travelEvents', name: '旅途與城鎮事件', guide: '旅途與城鎮事件（製作指南）' },
  { key: 'eventRules', name: '事件設定', single: true, guide: '旅途與城鎮事件（製作指南）' },
  { key: 'bindRules', name: '雙面效應設定', single: true },
  { key: 'masterEvents', name: '主奴與娼館的事件' },
  { key: 'counters', name: '劇情計數器', guide: '特殊任務（製作指南）' },
]

export const BUILTIN_WORLD_TYPE = 'elondia-builtin-world'
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
type Entries = Record<string, unknown>
export type SectionEntries = Partial<Record<BuiltinSection, Entries>>

/** 內建商店能改的欄位（名字只是參考，改了不算） */
function shopView(id: string): Entries {
  const d = shopRules.types[id as keyof typeof shopRules.types]!
  const job = builtinJob(id)
  return {
    name: d.name, emoji: d.emoji, desc: d.desc, ai: d.ai,
    keeper: { title: d.keeper.title, tags: [...(d.keeper.tags ?? [])] },
    fixed: clone(d.fixed ?? []), buys: [...d.buys],
    ...(job ? { work: { dc: job.dc, rate_cc: job.rate_cc, desc: job.desc } } : {}),
  }
}

/** 目前套用的內容（呼叫前要先套用原版）：每種一份，原始的樣子（還沒整理） */
function rawEntries(): SectionEntries {
  return clone({
    enemies, abilities, statuses,
    items: Object.fromEntries(itemRules.items.map((i) => [i.name, i])),
    bases: gearRules.bases, materials: gearRules.materials,
    perks: Object.fromEntries(perkRules.perks.map((p) => [p.id, p])),
    // 身分標籤只匯出可以編輯的欄位（略過聲望這類寫死的效果不在裡面）
    npcTags: Object.fromEntries(Object.entries(npcTags.tags).map(([id, t]) => [id, editableOf(t)])),
    conditions: Object.fromEntries(Object.entries(companionRules.conditions).filter(([k]) => !k.startsWith('$'))),
    tattoos: tattooRules.templates, marks: slaveryRules.contracts, markRules: { rules: currentMarkRules() },
    parasites: Object.fromEntries(Object.keys(parasiteRules.parasites).map((id) => [id, currentParasite(id)])),
    npcs: Object.fromEntries(npcs.map((n) => [n.id, n])),
    stories: Object.fromEntries(stories.map((s) => [s.id, s])),
    landmarks, specialMaps,
    shops: Object.fromEntries(Object.keys(shopRules.types).map((id) => [id, shopView(id)])),
    travelEvents: Object.fromEntries(travelEvents.templates.map((t) => [t.id, t])),
    eventRules: { rules: builtinEventRules() },
    bindRules: { rules: currentBindRules() },
    masterEvents: Object.fromEntries(POOL_IDS.flatMap((pool) => masterEventPool(pool).map((d) => [d.id, { ...d, pool }]))),
    counters: storyCounters,
  }) as SectionEntries
}

/**
 * 內建世界的內容（呼叫前要先套用原版）：每一筆是內容編輯器存檔時的樣子（整理過的），
 * 商店是能改的欄位（整理過的商店只記和內建不一樣的地方，看不出原本的值）
 */
export function builtinWorldEntries(): SectionEntries {
  const raw = rawEntries()
  const norm = normalizeMods({ version: 1, ...raw }) as unknown as Record<string, Entries>
  const out: SectionEntries = {}
  for (const s of BUILTIN_SECTIONS) out[s.key] = s.key === 'shops' ? raw.shops! : clone(norm[s.key] ?? {})
  return out
}

// ---- zip ----

export interface BuiltinWorldManifest {
  type: typeof BUILTIN_WORLD_TYPE
  version: 1
  /** 匯出的日期 */
  exported: string
  sections: { key: BuiltinSection; name: string; file: string; count: number }[]
}

const fileOf = (key: BuiltinSection) => `content/${key}.json`
const ROOT = 'elondia-builtin-world/'

/** 包成 zip：world.json、content/<種類>.json、README.md、README.txt */
export function buildBuiltinWorldZip(entries: SectionEntries, readme: { md: string; txt: string }, date = new Date()): Uint8Array {
  const manifest: BuiltinWorldManifest = {
    type: BUILTIN_WORLD_TYPE, version: 1, exported: date.toISOString().slice(0, 10),
    sections: BUILTIN_SECTIONS.map((s) => ({ key: s.key, name: s.name, file: fileOf(s.key), count: Object.keys(entries[s.key] ?? {}).length })),
  }
  const files: Record<string, Uint8Array> = {
    [`${ROOT}README.md`]: strToU8(readme.md),
    // 記事本也能開：Windows 換行
    [`${ROOT}README.txt`]: strToU8(readme.txt.replace(/\r?\n/g, '\r\n')),
    [`${ROOT}world.json`]: strToU8(JSON.stringify(manifest, null, 2)),
  }
  for (const s of BUILTIN_SECTIONS) files[ROOT + fileOf(s.key)] = strToU8(JSON.stringify(entries[s.key] ?? {}, null, 2))
  return zipSync(files, { level: 6 })
}

/**
 * JSON 讀不了時給玩家看的說明：中文的原因，加上第幾行第幾字（瀏覽器的錯誤訊息是英文，而且各家寫法不同；
 * 有位置的換算成行與字，認不得的原因附上原文）
 */
export function jsonErrorText(text: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  let line: number | undefined
  let col: number | undefined
  const lc = /line (\d+) column (\d+)/i.exec(msg)
  if (lc) {
    line = Number(lc[1])
    col = Number(lc[2])
  } else {
    const pos = /position (\d+)/i.exec(msg)
    if (pos) {
      const before = text.slice(0, Number(pos[1]))
      line = before.split('\n').length
      col = before.length - before.lastIndexOf('\n')
    }
  }
  const rules: [RegExp, string][] = [
    [/unexpected end|end of (the )?data|unterminated|unexpected eof/i, '檔案在中途就結束了：括號或引號沒有成對'],
    [/after property value|expected ',' or '}'/i, '少了逗號（,）或右大括號（}）'],
    [/after array element|expected ',' or '\]'/i, '少了逗號（,）或右中括號（]）'],
    [/double-quoted property name|property name or '}'|expected property name|expected string literal/i, '這裡要寫用雙引號括起來的欄位名稱；多半是最後一項後面多了逗號，或欄位名稱用了單引號'],
    [/bad control character|control character/i, '文字裡有換行或定位字元：文字裡的換行要寫成 \\n'],
    [/bad escaped|bad escape|invalid escape/i, '反斜線（\\）的寫法不對：文字裡要寫反斜線時寫成 \\\\'],
    [/unexpected non-whitespace|after json/i, '資料結束之後還有多的東西（多半是多了一個右大括號，或兩份資料接在一起）'],
    [/unexpected token|unexpected character|unrecognized token|is not valid json/i, '這裡出現了不該有的字元（常見的是單引號、中文標點的逗號或引號、多了逗號）'],
  ]
  const why = rules.find(([re]) => re.test(msg))?.[1]
  const where = line ? `第 ${line} 行第 ${col} 字附近：` : ''
  return `${where}${why ?? 'JSON 格式錯誤'}${why ? '' : `（${msg}）`}`
}

export interface ReadBuiltinWorld {
  content: SectionEntries
  /** 讀不了的檔案（JSON 格式錯誤……） */
  errors: string[]
}

/**
 * 讀 zip：找 world.json 所在的資料夾（重新壓縮時多一層或少一層資料夾都可以），讀 content/ 底下的檔案。
 * 少了某種的檔案就是沒有改那一種
 */
export function readBuiltinWorldZip(bytes: Uint8Array): ReadBuiltinWorld {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('不是 zip 檔，或檔案壞了')
  }
  const names = Object.keys(files).filter((n) => !n.endsWith('/') && !n.startsWith('__MACOSX/'))
  const manifestPath = names.filter((n) => n === 'world.json' || n.endsWith('/world.json')).sort((a, b) => a.length - b.length)[0]
  if (!manifestPath) throw new Error('zip 裡找不到 world.json：請保留匯出時的檔案結構（world.json 與 content 資料夾）')
  const base = manifestPath.slice(0, -'world.json'.length)
  const errors: string[] = []
  const manifestText = strFromU8(files[manifestPath]!)
  let m: Partial<BuiltinWorldManifest>
  try {
    m = JSON.parse(manifestText) as Partial<BuiltinWorldManifest>
  } catch (e) {
    throw new Error(`world.json 讀不了：${jsonErrorText(manifestText, e)}`)
  }
  if (m?.type !== BUILTIN_WORLD_TYPE) throw new Error('world.json 不是「匯出內建世界」的檔案')
  const content: SectionEntries = {}
  for (const s of BUILTIN_SECTIONS) {
    const path = base + fileOf(s.key)
    const file = files[path]
    if (!file) continue
    const text = strFromU8(file)
    let v: unknown
    try {
      v = JSON.parse(text)
    } catch (e) {
      errors.push(`${s.name}（${fileOf(s.key)}）讀不了，${s.name}全部照原版：${jsonErrorText(text, e)}`)
      continue
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) errors.push(`${s.name}（${fileOf(s.key)}）讀不了，${s.name}全部照原版：最外層要是 { "id": {…}, … }`)
    else content[s.key] = v as Entries
  }
  const known = new Set(BUILTIN_SECTIONS.map((s) => base + fileOf(s.key)))
  for (const n of names) {
    if (n.startsWith(`${base}content/`) && n.endsWith('.json') && !known.has(n)) errors.push(`不認得的檔案，略過：${n.slice(base.length)}`)
  }
  return { content, errors }
}

// ---- 和內建比較 ----

/** 依 key 排序的 JSON（比較用） */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
}

/** 給玩家看的值：短的照寫，長的截斷 */
function shown(v: unknown): string {
  const t = typeof v === 'string' ? `「${v}」` : JSON.stringify(v) ?? ''
  return t.length > 40 ? `${t.slice(0, 38)}…` : t
}

/** 兩份資料不一樣的欄位（最多 n 個；陣列只到陣列本身），寫成「level：999 → 20」「foo：拿掉了（原本 3）」 */
function changedFields(a: unknown, b: unknown, n = 3, path = ''): string[] {
  if (canonical(a) === canonical(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out: string[] = []
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === 'custom') continue
      out.push(...changedFields((a as Entries)[k], (b as Entries)[k], n - out.length, path ? `${path}.${k}` : k))
      if (out.length >= n) break
    }
    return out
  }
  const name = path || '（整筆）'
  if (b === undefined) return [`${name}：拿掉了（寫的是 ${shown(a)}）`]
  if (a === undefined) return [`${name}：補上 ${shown(b)}`]
  return [`${name}：${shown(a)} → ${shown(b)}`]
}

/**
 * 整理玩家寫的內容（比較前）：id 去掉前後空白（去掉後是內建的那一筆就當那一筆），
 * 不是物件的整筆略過、照原版（寫成 null、字串、數字、陣列……），去掉空白後重複的 id 只留第一筆
 */
function tidyEntries(user: SectionEntries, builtin: SectionEntries, skipped: string[]): SectionEntries {
  const out: SectionEntries = {}
  for (const s of BUILTIN_SECTIONS) {
    const mine = user[s.key]
    if (!mine) continue
    const base = builtin[s.key] ?? {}
    const kept: Entries = {}
    for (const [rawId, raw] of Object.entries(mine)) {
      const id = rawId.trim()
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        const what = raw === null ? 'null' : Array.isArray(raw) ? '陣列' : typeof raw === 'string' ? '文字' : typeof raw === 'number' ? '數字' : typeof raw
        skipped.push(`${s.name} ${id || rawId}：要寫成 { … }，這裡寫的是${what === 'null' ? ' null ' : what}，整筆略過${id in base ? '（內建的照原版）' : ''}`)
        continue
      }
      if (!id || id in kept) {
        skipped.push(`${s.name} 「${rawId}」：${id ? `去掉前後的空白之後和「${id}」重複` : 'id 是空的'}，整筆略過`)
        continue
      }
      const entry = clone(raw) as Record<string, unknown>
      if (typeof entry.id === 'string' && entry.id !== id && entry.id.trim() === id) entry.id = id
      kept[id] = entry
    }
    out[s.key] = kept
  }
  return out
}

export interface BuiltinWorldDiff {
  /** 要存進新世界的內容（改過的內建項目與新增的項目） */
  mods: ContentMods
  /** 改過的內建項目、新增的項目（依種類） */
  changed: Partial<Record<BuiltinSection, string[]>>
  added: Partial<Record<BuiltinSection, string[]>>
  /** 寫了但不合規則、被調整或拿掉的欄位：「怪物 巨鼠：girl.chance」 */
  adjusted: string[]
  /** 整筆略過的（id 不對、格式不對） */
  skipped: string[]
}

/**
 * 和內建比較（呼叫前要先套用原版；會整理 user，自建的狀態、特質……會暫時登錄進遊戲資料，呼叫的人之後要重新套用內容）。
 * builtin 是 builtinWorldEntries() 的結果
 */
export function diffBuiltinWorld(input: SectionEntries, builtin: SectionEntries): BuiltinWorldDiff {
  const out: BuiltinWorldDiff = { mods: normalizeMods({}), changed: {}, added: {}, adjusted: [], skipped: [] }
  const user = tidyEntries(input, builtin, out.skipped)
  const builtinNorm = normalizeMods({ version: 1, ...clone(builtin) }) as unknown as Record<string, Entries>
  const userNorm = normalizeMods({ version: 1, ...clone(user) }) as unknown as Record<string, Entries>
  const mods = out.mods as unknown as Record<string, Entries>
  for (const s of BUILTIN_SECTIONS) {
    const mine = user[s.key]
    if (!mine) continue
    const norm = userNorm[s.key] ?? {}
    const base = builtin[s.key] ?? {}
    for (const [id, raw] of Object.entries(mine)) {
      const label = `${s.name} ${(raw as { name?: string } | null)?.name ?? id}`
      // 物品的 id 就是名字：只改 name 不改鍵時，name 會照鍵（沒有效果），提醒一行
      const itemName = s.key === 'items' ? (raw as { name?: unknown }).name : undefined
      if (typeof itemName === 'string' && itemName.trim() && itemName.trim() !== id) {
        out.adjusted.push(`物品 ${id}：name 寫的是「${itemName.trim()}」，和鍵「${id}」不一樣；物品的名字就是鍵，name 照鍵。要改名請改鍵（改了鍵等於新增一個物品）`)
      }
      // 單筆的設定只認 rules
      if (s.single && id !== 'rules') {
        out.skipped.push(`${label}：這一種只有 rules 一筆`)
        continue
      }
      const kept = norm[id]
      if (kept === undefined) {
        out.skipped.push(`${label}：id 或格式不對，整筆略過${id in base ? '（內建的照原版）' : ''}`)
        continue
      }
      const isBuiltin = id in base
      if (isBuiltin && canonical(kept) === canonical(builtinNorm[s.key]?.[id] ?? {})) continue
      ;(mods[s.key] ??= {})[id] = kept
      ;((isBuiltin ? out.changed : out.added)[s.key] ??= []).push(id)
      // 寫的和整理後的不一樣：被調整或拿掉的欄位（商店整理後只記和內建不一樣的地方，不比）
      if (s.key !== 'shops') {
        // 物品的 name 和鍵不一樣已經另外提醒過
        const fields = changedFields(raw, kept, 4).filter((f) => !(itemName !== undefined && f.startsWith('name：'))).slice(0, 3)
        if (fields.length) out.adjusted.push(`${label}：${fields.join('；')}`)
      }
    }
  }
  return out
}

/** 匯入結果的一句話：「改了 怪物 3、物品 1；新增 怪物 2」 */
export function diffSummary(d: Pick<BuiltinWorldDiff, 'changed' | 'added'>): string {
  const part = (m: BuiltinWorldDiff['changed']) => BUILTIN_SECTIONS.filter((s) => m[s.key]?.length).map((s) => `${s.name} ${m[s.key]!.length}`).join('、')
  const changed = part(d.changed)
  const added = part(d.added)
  return [changed && `改了 ${changed}`, added && `新增 ${added}`].filter(Boolean).join('；') || '沒有任何改動'
}

/** 匯入結果（記在建立的世界上，之後可以再看）：每類最多 MAX_REPORT_ITEMS 項 */
export interface BuiltinImportReport {
  /** 匯入的時間（毫秒） */
  at: number
  file: string
  summary: string
  /** 有沒有要特別注意的（讀不了的檔案） */
  warn: boolean
  lines: { label: string; items: string[]; more?: number }[]
}

export const MAX_REPORT_ITEMS = 100

/** 整理成匯入結果 */
export function importReport(file: string, d: BuiltinWorldDiff, errors: string[], problems: string[], at = Date.now()): BuiltinImportReport {
  const lines = [
    { label: '讀不了的檔案（那一種全部照原版）', items: errors },
    { label: '整筆略過的項目', items: d.skipped },
    { label: '不合規則、被調整或拿掉的欄位', items: d.adjusted },
    { label: '套用時發現的問題（有錯誤沒匯入的特殊任務、引用不存在的東西……）', items: problems },
  ].filter((l) => l.items.length).map((l) => ({ label: l.label, items: l.items.slice(0, MAX_REPORT_ITEMS), ...(l.items.length > MAX_REPORT_ITEMS ? { more: l.items.length - MAX_REPORT_ITEMS } : {}) }))
  return { at, file, summary: diffSummary(d), warn: errors.length > 0, lines }
}

/** 有沒有改到任何東西 */
export function hasChanges(d: Pick<BuiltinWorldDiff, 'changed' | 'added'>): boolean {
  return Object.values(d.changed).some((x) => x?.length) || Object.values(d.added).some((x) => x?.length)
}
