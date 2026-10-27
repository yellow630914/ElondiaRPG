// 儲存的角色：建立角色畫面的內容（名字、性別、體態、種族、職業、屬性、出生地、外貌與背景、特質、起始裝備、奴隸出身）存成範本，
// 下次開新遊戲時可以直接讀回來。存在瀏覽器的 localStorage，和存檔、世界分開；讀回時不合現在內容的欄位（被刪掉的特質、底材）由畫面略過。

import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'elondia.characters'
/** 最多存幾個角色 */
export const PRESET_LIMIT = 30

export interface CharacterDraft {
  name: string
  gender: string
  race: string
  classId: string
  bonus: Record<string, number>
  birthplace: string
  body?: string
  look?: Record<string, string>
  appearance: string
  background: string
  /** 身分標籤（舊的角色沒有） */
  tags?: string[]
  perks: string[]
  customPerks: unknown[]
  gear: Record<string, { base: string; tier: number }>
  slave?: {
    mode: 'candidate' | 'custom' | 'none'
    seed: number
    picked: number
    custom: Record<string, unknown>
    mark: unknown
  }
}

export interface CharacterPreset {
  id: string
  /** 存的時候的世界（只是提示：在別的世界讀回也可以） */
  world?: string
  savedAt: number
  draft: CharacterDraft
}

function load(): CharacterPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((p): p is CharacterPreset => !!p && typeof p === 'object' && typeof (p as CharacterPreset).id === 'string' && !!(p as CharacterPreset).draft) : []
  } catch {
    return []
  }
}

export const useCharacterPresets = defineStore('characterPresets', () => {
  const list = ref<CharacterPreset[]>(load())

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.value))
    } catch {
      throw new Error('瀏覽器的儲存空間不夠，存不了角色')
    }
  }

  /** 存一個角色：同名的覆蓋（回傳 true 表示覆蓋了） */
  function save(draft: CharacterDraft, world?: string): boolean {
    const copy = JSON.parse(JSON.stringify(draft)) as CharacterDraft
    const i = list.value.findIndex((p) => p.draft.name === copy.name)
    const preset: CharacterPreset = { id: i >= 0 ? list.value[i]!.id : `c${Date.now().toString(36)}`, savedAt: Date.now(), draft: copy, ...(world ? { world } : {}) }
    if (i < 0 && list.value.length >= PRESET_LIMIT) throw new Error(`最多存 ${PRESET_LIMIT} 個角色，請先刪掉一些`)
    const next = i >= 0 ? list.value.map((p, k) => (k === i ? preset : p)) : [preset, ...list.value]
    const prev = list.value
    list.value = next
    try {
      persist()
    } catch (e) {
      list.value = prev
      throw e
    }
    return i >= 0
  }

  function remove(id: string) {
    list.value = list.value.filter((p) => p.id !== id)
    persist()
  }

  return { list, save, remove }
})
