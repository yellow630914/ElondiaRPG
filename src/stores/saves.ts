// 存檔欄位：手動存檔、快速存檔、自動存檔；以及一直自動保存的「進行中的遊戲」。
//
// 存檔可能很大（報告與敘事會越來越多），所以都放在 IndexedDB（elondia 資料庫）；
// 瀏覽器不支援 IndexedDB 時（或測試環境）改用 localStorage。
// 進行中的遊戲以前存在 localStorage（elondia.save 等），第一次啟動新版時會搬進 IndexedDB。

import { locationById } from '@/engine/data'
import type { ContentMods } from '@/engine/mods'
import { assertSchema } from '@/engine/state'
import type { GameState } from '@/engine/types'
import type { PortraitFile } from './portraits'

export type SlotKind = 'manual' | 'quick' | 'auto'

export interface SaveData {
  state: GameState
  narrations?: Record<string, unknown>
  usage?: Record<string, unknown>
  /** 存檔當時這個瀏覽器的自訂內容（「🛠️ 內容」）；匯入時可以合併 */
  content?: ContentMods
  /** 匯出時選擇附上的形象圖：角色 id → 圖片 */
  portraits?: Record<string, PortraitFile>
}

/** 存檔列表顯示用的摘要（不含整份存檔，列表載入比較快） */
export interface SlotMeta {
  id: string
  name: string
  kind: SlotKind
  /** 存檔的真實時間（毫秒） */
  savedAt: number
  pcName: string
  race: string
  cls: string
  level: number
  location: string
  time: GameState['time']
  reports: number
  party: number
  /** 這一局的種子（形象圖依種子保存；舊的存檔欄位沒有） */
  seed?: number
  /** 這一局用的世界 */
  world?: string
}

export const QUICK_SLOT = 'quick'
/** 自動存檔保留的份數（循環覆寫） */
export const AUTO_SLOTS = 3

export function slotMeta(id: string, name: string, kind: SlotKind, data: SaveData, savedAt = Date.now()): SlotMeta {
  const s = data.state
  const pc = s.party.find((m) => m.isPlayer) ?? s.party[0]!
  return {
    id, name, kind, savedAt,
    pcName: pc.name, race: pc.race, cls: pc.class, level: pc.level,
    location: s.location, time: { ...s.time }, reports: s.reports.length + (s.logArchive?.length ?? 0), party: s.party.length, seed: s.seed,
    ...(s.world ? { world: s.world.name } : {}),
  }
}

export function slotTitle(m: SlotMeta): string {
  const loc = (() => {
    try {
      return locationById(m.location).name
    } catch {
      return m.location
    }
  })()
  return `${m.pcName} Lv.${m.level}・${loc}・第 ${m.time.day} 天`
}

/** 檢查匯入的檔案是不是存檔 */
export function parseSaveFile(text: string): SaveData {
  const data = JSON.parse(text) as Partial<SaveData>
  if (!data.state?.party?.length || !Array.isArray(data.state.reports)) throw new Error('這不是《埃隆迪亞大陸》的存檔')
  assertSchema(data.state)
  return {
    state: data.state, narrations: data.narrations ?? {}, usage: data.usage ?? {},
    ...(data.content && typeof data.content === 'object' ? { content: data.content } : {}),
    ...(data.portraits && typeof data.portraits === 'object' ? { portraits: data.portraits } : {}),
  }
}

export function saveFileName(m: Pick<SlotMeta, 'pcName' | 'time'>): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  // 檔名只用英數字：有些瀏覽器與系統會丟掉中文檔名（角色名字仍在存檔內容與列表裡）
  const ascii = m.pcName.replace(/[^A-Za-z0-9_-]/g, '')
  return `elondia-${ascii ? `${ascii}-` : ''}day${m.time.day}-${stamp}.json`
}

// ---- 儲存位置 ----

export interface SlotStore {
  list(): Promise<SlotMeta[]>
  get(id: string): Promise<SaveData | undefined>
  put(meta: SlotMeta, data: SaveData): Promise<void>
  remove(id: string): Promise<void>
  rename(id: string, name: string): Promise<void>
}

const DB_NAME = 'elondia'
const DB_VERSION = 2
const META = 'slot_meta'
const DATA = 'slot_data'
/** 進行中的遊戲：state、narrations、usage 三筆 JSON 文字 */
const CURRENT = 'current'

let dbPromise: Promise<IDBDatabase> | null = null
/** 存檔欄位與進行中的遊戲共用同一個資料庫連線（版本升級時才不會互相卡住） */
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'id' })
      if (!d.objectStoreNames.contains(DATA)) d.createObjectStore(DATA)
      if (!d.objectStoreNames.contains(CURRENT)) d.createObjectStore(CURRENT)
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('打不開存檔資料庫'))
    r.onblocked = () => reject(new Error('存檔資料庫被其他分頁占用，請關掉其他《埃隆迪亞大陸》分頁後重新整理'))
  })
  // 打不開時下次再試
  dbPromise.catch(() => (dbPromise = null))
  return dbPromise
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function indexedDbStore(): SlotStore {
  const open = openDb
  return {
    async list() {
      const d = await open()
      return request(d.transaction(META).objectStore(META).getAll() as IDBRequest<SlotMeta[]>)
    },
    async get(id) {
      const d = await open()
      return request(d.transaction(DATA).objectStore(DATA).get(id) as IDBRequest<SaveData | undefined>)
    },
    async put(meta, data) {
      const d = await open()
      const tx = d.transaction([META, DATA], 'readwrite')
      tx.objectStore(META).put(meta)
      // 存成純 JSON 物件，避免把 Vue 的 Proxy 存進去
      tx.objectStore(DATA).put(JSON.parse(JSON.stringify(data)), meta.id)
      await done(tx)
    },
    async remove(id) {
      const d = await open()
      const tx = d.transaction([META, DATA], 'readwrite')
      tx.objectStore(META).delete(id)
      tx.objectStore(DATA).delete(id)
      await done(tx)
    },
    async rename(id, name) {
      const d = await open()
      const tx = d.transaction(META, 'readwrite')
      const store = tx.objectStore(META)
      const meta = await request(store.get(id) as IDBRequest<SlotMeta | undefined>)
      if (meta) store.put({ ...meta, name })
      await done(tx)
    },
  }
}

const LS_META = 'elondia.slots'
const LS_DATA = (id: string) => `elondia.slot.${id}`

function localStorageStore(): SlotStore {
  const read = (): SlotMeta[] => {
    try {
      return JSON.parse(localStorage.getItem(LS_META) ?? '[]') as SlotMeta[]
    } catch {
      return []
    }
  }
  const write = (list: SlotMeta[]) => localStorage.setItem(LS_META, JSON.stringify(list))
  return {
    async list() {
      return read()
    },
    async get(id) {
      const raw = localStorage.getItem(LS_DATA(id))
      return raw ? (JSON.parse(raw) as SaveData) : undefined
    },
    async put(meta, data) {
      localStorage.setItem(LS_DATA(meta.id), JSON.stringify(data))
      write([...read().filter((m) => m.id !== meta.id), meta])
    },
    async remove(id) {
      localStorage.removeItem(LS_DATA(id))
      write(read().filter((m) => m.id !== id))
    },
    async rename(id, name) {
      write(read().map((m) => (m.id === id ? { ...m, name } : m)))
    },
  }
}

let store: SlotStore | null = null

export function slotStore(): SlotStore {
  store ??= typeof indexedDB !== 'undefined' ? indexedDbStore() : localStorageStore()
  return store
}

/** 測試用：換成指定的儲存位置 */
export function useSlotStore(s: SlotStore) {
  store = s
}

export { localStorageStore }

// ---- 進行中的遊戲 ----

export type CurrentPart = 'state' | 'narrations' | 'usage'
/** 每一部分的 JSON 文字 */
export type CurrentData = Partial<Record<CurrentPart, string>>

/** 舊版放在 localStorage 的 key（localStorage 的儲存位置也沿用） */
export const CURRENT_LS_KEYS: Record<CurrentPart, string> = {
  state: 'elondia.save',
  narrations: 'elondia.narrations',
  usage: 'elondia.usage',
}
const PARTS = Object.keys(CURRENT_LS_KEYS) as CurrentPart[]

export interface CurrentStore {
  /** 存在哪裡（顯示用） */
  kind: 'indexeddb' | 'localstorage'
  read(): Promise<CurrentData>
  write(data: CurrentData): Promise<void>
  clear(): Promise<void>
}

function readLocalCurrent(): CurrentData {
  const out: CurrentData = {}
  for (const p of PARTS) {
    try {
      const raw = localStorage.getItem(CURRENT_LS_KEYS[p])
      if (raw) out[p] = raw
    } catch {
      // 被封鎖時當作沒有
    }
  }
  return out
}

function clearLocalCurrent() {
  for (const p of PARTS) {
    try {
      localStorage.removeItem(CURRENT_LS_KEYS[p])
    } catch {
      // 略過
    }
  }
}

function localCurrentStore(): CurrentStore {
  return {
    kind: 'localstorage',
    async read() {
      return readLocalCurrent()
    },
    async write(data) {
      // 空間不足時丟出錯誤，由遊戲顯示警告
      for (const p of PARTS) if (data[p] !== undefined) localStorage.setItem(CURRENT_LS_KEYS[p], data[p]!)
    },
    async clear() {
      clearLocalCurrent()
    },
  }
}

function indexedDbCurrentStore(): CurrentStore {
  return {
    kind: 'indexeddb',
    async read() {
      const d = await openDb()
      const store = d.transaction(CURRENT).objectStore(CURRENT)
      const out: CurrentData = {}
      for (const p of PARTS) {
        const v = await request(store.get(p) as IDBRequest<string | undefined>)
        if (typeof v === 'string') out[p] = v
      }
      return out
    },
    async write(data) {
      const d = await openDb()
      const tx = d.transaction(CURRENT, 'readwrite')
      for (const p of PARTS) if (data[p] !== undefined) tx.objectStore(CURRENT).put(data[p], p)
      await done(tx)
    },
    async clear() {
      const d = await openDb()
      const tx = d.transaction(CURRENT, 'readwrite')
      tx.objectStore(CURRENT).clear()
      await done(tx)
    },
  }
}

let current: CurrentStore | null = null

export function currentStore(): CurrentStore {
  current ??= typeof indexedDB !== 'undefined' ? indexedDbCurrentStore() : localCurrentStore()
  return current
}

/** 測試用：換成指定的儲存位置 */
export function useCurrentStore(s: CurrentStore | null) {
  current = s
}

let preloaded: CurrentData | null = null

/**
 * 啟動時（掛上畫面之前）讀出進行中的遊戲；IndexedDB 還沒有、localStorage 有舊版的資料時搬過去。
 * IndexedDB 打不開時改用 localStorage。
 */
export async function preloadCurrent(): Promise<void> {
  const legacy = readLocalCurrent()
  try {
    const store = currentStore()
    const data = await store.read()
    if (data.state || store.kind === 'localstorage') {
      preloaded = data
      // 已經搬過了：清掉舊版殘留的 localStorage
      if (store.kind === 'indexeddb' && legacy.state) clearLocalCurrent()
      return
    }
    if (legacy.state) {
      await store.write(legacy)
      clearLocalCurrent()
    }
    preloaded = legacy
  } catch (e) {
    console.warn('進行中的遊戲改存在 localStorage：', e)
    current = localCurrentStore()
    preloaded = legacy
  }
}

/** 遊戲 store 建立時取用啟動時讀出的資料；沒有預先讀過時（測試）直接讀 localStorage */
export function takePreloaded(): CurrentData {
  const data = preloaded ?? readLocalCurrent()
  preloaded = null
  return data
}
