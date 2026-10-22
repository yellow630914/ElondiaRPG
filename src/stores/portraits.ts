// 角色的形象插圖：存在這個瀏覽器的 IndexedDB（圖片太大，放不進 localStorage）。
// 匯出存檔時可以選擇附上（轉成 data URL）；沒有任何存檔用到的局（種子）的圖會被清掉。
// 依「這一局（種子）＋角色 id」保存，所以不同存檔的主角不會互相蓋掉。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cleanPreprocessed, portraitPrompt, portraitSubject, preprocessPrompt } from '@/narrator/imageInfo'
import { generateImage } from '@/narrator/imageProviders'
import type { GameState } from '@/engine/types'
import { OTHER_USAGE, useGame } from './game'
import { useImageSettings } from './image'
import { useSettings } from './settings'

const DB = 'elondia-portraits'
const STORE = 'portraits'

export interface PortraitRecord {
  blob: Blob
  /** 生成時送出的提示詞（上傳的圖片沒有） */
  prompt?: string
  /** 有預處理時，預處理前的語意描述 */
  semantic?: string
  service?: string
  time: number
}

/** 正在生成：預處理提示詞（stage tags）、生成圖片，或出錯 */
export interface PortraitJob {
  stage: 'tags' | 'image' | 'error'
  error?: string
  semantic?: string
  tags?: string
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('這個瀏覽器不能保存圖片（沒有 IndexedDB）'))
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('打不開圖片資料庫'))
    })
  }
  return dbPromise
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('圖片資料庫出錯'))
  })
}

/** 這一局、這個角色的圖片 key */
export function portraitKey(state: Pick<GameState, 'seed'>, id: string): string {
  return `${state.seed}:${id}`
}

/** 放進匯出存檔的形象圖：圖片轉成 data URL */
export interface PortraitFile extends Omit<PortraitRecord, 'blob'> {
  data: string
}

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/png'};base64,${btoa(bin)}`
}

function fromDataUrl(url: string): Blob {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url)
  if (!m || !m[2] || !m[1]!.startsWith('image/')) throw new Error('形象圖的資料壞掉了')
  const bin = atob(m[3]!)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: m[1] })
}

export const usePortraits = defineStore('portraits', () => {
  /** key → 圖片網址（object URL）；null 表示查過了、沒有圖 */
  const urls = ref<Record<string, string | null>>({})
  const records = ref<Record<string, Omit<PortraitRecord, 'blob'>>>({})
  const jobs = ref<Record<string, PortraitJob>>({})
  const controllers = new Map<string, AbortController>()

  function show(key: string, rec: PortraitRecord | undefined) {
    const old = urls.value[key]
    if (old) URL.revokeObjectURL(old)
    urls.value[key] = rec ? URL.createObjectURL(rec.blob) : null
    if (rec) {
      const { blob: _b, ...meta } = rec
      records.value[key] = meta
    } else delete records.value[key]
  }

  /** 讀取一張圖（第一次顯示時） */
  async function load(key: string) {
    if (key in urls.value) return
    urls.value[key] = null
    try {
      show(key, await tx<PortraitRecord | undefined>('readonly', (s) => s.get(key)))
    } catch {
      // 讀不到就當作沒有圖
    }
  }

  async function put(key: string, rec: PortraitRecord) {
    await tx('readwrite', (s) => s.put(rec, key))
    show(key, rec)
  }

  async function remove(key: string) {
    await tx('readwrite', (s) => s.delete(key))
    show(key, undefined)
  }

  /** 上傳自己的圖片 */
  async function upload(key: string, file: File) {
    if (!file.type.startsWith('image/')) throw new Error('只能上傳圖片')
    await put(key, { blob: file, time: Date.now() })
  }

  /** 這個角色的語意描述（依提示詞模板與畫風） */
  function describe(state: GameState, id: string): string {
    const subject = portraitSubject(state, id)
    if (!subject) throw new Error('找不到這個角色')
    const image = useImageSettings()
    return portraitPrompt(subject, image.template, image.style)
  }

  /** 生成形象插圖：組成描述 →（選了預處理時）請大語言模型依指示改寫 → 送給生圖服務 */
  async function generate(state: GameState, id: string) {
    const key = portraitKey(state, id)
    if (jobs.value[key] && jobs.value[key]!.stage !== 'error') return
    const image = useImageSettings()
    const settings = useSettings()
    const game = useGame()
    const controller = new AbortController()
    controllers.set(key, controller)
    const job: PortraitJob = { stage: 'tags', semantic: describe(state, id) }
    jobs.value[key] = job
    try {
      if (!image.ready()) throw new Error('插圖生成還沒設定好（⚙️ 設定 → 🎨 插圖生成）')
      let prompt = job.semantic!
      const pre = image.preprocessorFor(image.service)
      if (pre) {
        const src = settings.sourceFor('tags')
        if (!settings.sourceReady(src.index)) throw new Error(`「插圖提示詞預處理」的模型來源（${src.name}）還沒設定好`)
        const collector = game.usageCollector(game.originOf('tags', src))
        const { completeText } = await import('@/narrator/providers')
        const text = await completeText(src.provider, src.config, preprocessPrompt(prompt, pre.instructions, settings.adult), controller.signal, collector.onUsage)
        collector.flush(OTHER_USAGE)
        prompt = cleanPreprocessed(text, pre.output)
        if (!prompt) throw new Error(`模型沒有回傳預處理的結果（${pre.name}）`)
        jobs.value[key] = { ...jobs.value[key]!, tags: prompt }
      }
      jobs.value[key] = { ...jobs.value[key]!, stage: 'image' }
      const blob = await generateImage(image.service, image.config(), {
        prompt, signal: controller.signal, ...(image.service === 'comfyui' ? { comfy: image.preset() } : {}),
      })
      await put(key, { blob, prompt, ...(prompt !== job.semantic ? { semantic: job.semantic } : {}), service: image.service, time: Date.now() })
      delete jobs.value[key]
    } catch (e) {
      const aborted = controller.signal.aborted
      if (aborted) delete jobs.value[key]
      else jobs.value[key] = { ...jobs.value[key]!, stage: 'error', error: e instanceof Error ? e.message : String(e) }
    } finally {
      controllers.delete(key)
    }
  }

  // ---- 跟著存檔匯出、匯入；清理沒有存檔用到的圖 ----

  async function allKeys(): Promise<string[]> {
    return (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String)
  }

  /** 這一局（種子）的圖片數量 */
  async function countFor(seed: number): Promise<number> {
    try {
      return (await allKeys()).filter((k) => k.startsWith(`${seed}:`)).length
    } catch {
      return 0
    }
  }

  /** 這一局的所有形象圖：角色 id → 圖片 */
  async function exportFor(seed: number): Promise<Record<string, PortraitFile>> {
    const out: Record<string, PortraitFile> = {}
    for (const key of (await allKeys()).filter((k) => k.startsWith(`${seed}:`))) {
      const rec = await tx<PortraitRecord | undefined>('readonly', (s) => s.get(key))
      if (!rec?.blob) continue
      const { blob, ...meta } = rec
      out[key.slice(`${seed}:`.length)] = { ...meta, data: await toDataUrl(blob) }
    }
    return out
  }

  /** 還原匯入存檔裡的形象圖（同一個角色已經有圖時換成檔案裡的）；回傳還原的張數 */
  async function importFor(seed: number, files: Record<string, PortraitFile>): Promise<number> {
    let n = 0
    for (const [id, f] of Object.entries(files)) {
      if (!id || typeof f?.data !== 'string') continue
      const { data, ...meta } = f
      await put(`${seed}:${id}`, { ...meta, blob: fromDataUrl(data), time: Number(meta.time) || Date.now() })
      n++
    }
    return n
  }

  /** 刪掉不屬於這些局（種子）的圖；回傳刪掉的張數 */
  async function pruneExcept(seeds: Set<number>): Promise<number> {
    const keep = new Set([...seeds].map(String))
    let n = 0
    for (const key of await allKeys()) {
      if (keep.has(key.split(':')[0]!)) continue
      await tx('readwrite', (s) => s.delete(key))
      if (key in urls.value) show(key, undefined)
      n++
    }
    return n
  }

  function cancel(key: string) {
    controllers.get(key)?.abort()
  }

  function clearError(key: string) {
    if (jobs.value[key]?.stage === 'error') delete jobs.value[key]
  }

  return { urls, records, jobs, load, upload, remove, describe, generate, cancel, clearError, countFor, exportFor, importFor, pruneExcept }
})
