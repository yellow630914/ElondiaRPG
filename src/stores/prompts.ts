// 提示詞設定：文風條目、其他提示詞條目、世界書的覆寫與新增條目。
// 跟著瀏覽器走（所有存檔共用），存在 localStorage。

import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { ComposeOptions } from '@/narrator/compose'
import type { LoreItem, LoreOverride, Worldbook } from '@/narrator/lore'
import {
  defaultPromptConfig, normalizeConfig, PRESET_CUSTOM, PRESET_STYLES, type PromptConfig, type PromptEntry,
} from '@/narrator/promptConfig'
import { useSettings } from './settings'

const KEY = 'elondia.prompts'

export type EntryList = 'styles' | 'custom'

function load(): PromptConfig {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeConfig(JSON.parse(raw)) : defaultPromptConfig()
  } catch {
    return defaultPromptConfig()
  }
}

export const usePrompts = defineStore('prompts', () => {
  const config = ref<PromptConfig>(load())
  watch(
    config,
    (c) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(c))
      } catch {
        // 寫不進去時只在本次有效
      }
    },
    { deep: true },
  )

  // 世界書與繁簡轉換字典很大，用到時才載入
  const book = shallowRef<Worldbook | null>(null)
  const loreMod = shallowRef<typeof import('@/narrator/lore') | null>(null)
  async function ensureLoaded() {
    loreMod.value ??= await import('@/narrator/lore')
    book.value ??= await loreMod.value.loadWorldbook()
  }

  const items = computed<LoreItem[]>(() =>
    book.value && loreMod.value ? loreMod.value.loreItems(book.value, config.value.lore, config.value.customLore) : [],
  )

  async function composeOptions(): Promise<ComposeOptions> {
    await ensureLoaded()
    const settings = useSettings()
    return {
      config: config.value,
      lore: items.value,
      adult: settings.adult,
      budgetChars: settings.loreBudget,
      language: settings.language,
    }
  }

  // ---- 文風與其他提示詞 ----

  function newId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }

  function addEntry(list: EntryList): PromptEntry {
    const e: PromptEntry = list === 'styles'
      ? { id: newId('style'), name: '新的文風', content: '', enabled: true, targets: ['narration', 'judge'] }
      : { id: newId('custom'), name: '新的提示詞', content: '', enabled: true, targets: ['narration', 'judge'], position: 'system' }
    config.value[list].push(e)
    return e
  }

  function duplicateEntry(list: EntryList, id: string) {
    const arr = config.value[list]
    const i = arr.findIndex((e) => e.id === id)
    if (i < 0) return
    const { preset: _preset, ...rest } = arr[i]!
    arr.splice(i + 1, 0, { ...rest, id: newId(list === 'styles' ? 'style' : 'custom'), name: `${rest.name}（複製）`, targets: [...rest.targets], enabled: false })
  }

  function removeEntry(list: EntryList, id: string) {
    config.value[list] = config.value[list].filter((e) => e.id !== id)
  }

  function moveEntry(list: EntryList, id: string, dir: -1 | 1) {
    const arr = config.value[list]
    const i = arr.findIndex((e) => e.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }

  function presetOf(list: EntryList, e: PromptEntry): PromptEntry | undefined {
    return (list === 'styles' ? PRESET_STYLES : PRESET_CUSTOM).find((p) => p.id === e.preset)
  }

  /** 內建條目恢復原文 */
  function restoreEntry(list: EntryList, id: string) {
    const e = config.value[list].find((x) => x.id === id)
    const p = e && presetOf(list, e)
    if (e && p) Object.assign(e, { name: p.name, content: p.content, targets: [...p.targets], ...(p.position ? { position: p.position } : {}) })
  }

  /** 把被刪掉的內建條目加回來 */
  function restorePresets(list: EntryList) {
    const arr = config.value[list]
    for (const p of list === 'styles' ? PRESET_STYLES : PRESET_CUSTOM) {
      if (!arr.some((e) => e.preset === p.id)) arr.push({ ...p, targets: [...p.targets], enabled: false })
    }
  }

  // ---- 世界書 ----

  function isCustomLore(uid: number) {
    return config.value.customLore.some((e) => e.uid === uid)
  }

  function updateLore(uid: number, patch: LoreOverride) {
    const custom = config.value.customLore.find((e) => e.uid === uid)
    if (custom) Object.assign(custom, patch)
    else config.value.lore[uid] = { ...config.value.lore[uid], ...patch }
  }

  function resetLore(uid: number) {
    delete config.value.lore[uid]
  }

  function addLore(): LoreItem {
    const base = loreMod.value?.CUSTOM_LORE_UID ?? 100000
    const uid = Math.max(base - 1, ...config.value.customLore.map((e) => e.uid)) + 1
    const e: LoreItem = { uid, comment: '新的世界書條目', content: '', keys: [], mode: 'keyword', order: 700, adult: false, builtin: false }
    config.value.customLore.push(e)
    return e
  }

  function removeLore(uid: number) {
    config.value.customLore = config.value.customLore.filter((e) => e.uid !== uid)
  }

  // ---- 匯出、匯入、重設 ----

  function exportConfig(): string {
    return JSON.stringify(config.value, null, 2)
  }

  function importConfig(text: string) {
    config.value = normalizeConfig(JSON.parse(text))
  }

  function resetAll() {
    config.value = defaultPromptConfig()
  }

  return {
    config, book, items, ensureLoaded, composeOptions,
    addEntry, duplicateEntry, removeEntry, moveEntry, restoreEntry, restorePresets, presetOf,
    isCustomLore, updateLore, resetLore, addLore, removeLore,
    exportConfig, importConfig, resetAll,
  }
})
