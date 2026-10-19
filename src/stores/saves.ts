// 存檔欄位：手動存檔、快速存檔、自動存檔。
//
// 目前進行中的遊戲一直自動存在 localStorage（elondia.save）；這裡的「存檔欄位」是另外保存的快照，
// 可以隨時讀回。存檔可能很大（報告與敘事會越來越多），所以放在 IndexedDB；
// 瀏覽器不支援 IndexedDB 時（或測試環境）改用 localStorage。

import { locationById } from '@/engine/data'
import type { GameState } from '@/engine/types'

export type SlotKind = 'manual' | 'quick' | 'auto'

export interface SaveData {
  state: GameState
  narrations?: Record<string, unknown>
  usage?: Record<string, unknown>
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
    location: s.location, time: { ...s.time }, reports: s.reports.length, party: s.party.length,
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
  return { state: data.state, narrations: data.narrations ?? {}, usage: data.usage ?? {} }
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
const META = 'slot_meta'
const DATA = 'slot_data'

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
  let db: Promise<IDBDatabase> | null = null
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore(META, { keyPath: 'id' })
        r.result.createObjectStore(DATA)
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    }))
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
