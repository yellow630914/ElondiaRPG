// 角色的形象插圖：存在這個瀏覽器的 IndexedDB（圖片太大，放不進 localStorage，也不放進存檔）。
// 依「這一局（種子）＋角色 id」保存，所以不同存檔的主角不會互相蓋掉。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cleanTags, portraitPrompt, portraitSubject, tagPrompt } from '@/narrator/imageInfo'
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
  /** 轉成 Danbooru 標籤時的語意描述 */
  semantic?: string
  service?: string
  time: number
}

/** 正在生成：轉換標籤、生成圖片，或出錯 */
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

  /** 生成形象插圖：組成描述 →（勾選時）請大語言模型轉成 Danbooru 標籤 → 送給生圖服務 */
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
      if (image.danbooru[image.service]) {
        const src = settings.sourceFor('tags')
        if (!settings.sourceReady(src.index)) throw new Error(`「插圖標籤轉換」的模型來源（${src.name}）還沒設定好`)
        const collector = game.usageCollector(game.originOf('tags', src))
        const { completeText } = await import('@/narrator/providers')
        const text = await completeText(src.provider, src.config, tagPrompt(prompt, image.tagInstructions, settings.adult), controller.signal, collector.onUsage)
        collector.flush(OTHER_USAGE)
        prompt = cleanTags(text)
        if (!prompt) throw new Error('模型沒有回傳標籤')
        jobs.value[key] = { ...jobs.value[key]!, tags: prompt }
      }
      jobs.value[key] = { ...jobs.value[key]!, stage: 'image' }
      const blob = await generateImage(image.service, image.config(), { prompt, signal: controller.signal })
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

  function cancel(key: string) {
    controllers.get(key)?.abort()
  }

  function clearError(key: string) {
    if (jobs.value[key]?.stage === 'error') delete jobs.value[key]
  }

  return { urls, records, jobs, load, upload, remove, describe, generate, cancel, clearError }
})
