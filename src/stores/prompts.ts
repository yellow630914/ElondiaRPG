// 提示詞設定：文風條目、其他提示詞條目、世界書的覆寫與新增條目。
// 可以同時存有好幾套（提示詞管理），隨時切換；跟著瀏覽器走（所有存檔共用），存在 localStorage。

import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { ComposeOptions } from '@/narrator/compose'
import type { LoreItem, LoreOverride, Worldbook } from '@/narrator/lore'
import {
  defaultPromptConfig, exportEntries as entriesFile, normalizeConfig, parseEntryFile, PRESET_CUSTOM, PRESET_STYLES,
  type PromptConfig, type PromptEntry,
} from '@/narrator/promptConfig'
import { useSettings } from './settings'

/** 舊版只有一套 */
const LEGACY_KEY = 'elondia.prompts'
const SETS_KEY = 'elondia.promptSets'

export interface PromptSet {
  id: string
  name: string
  config: PromptConfig
}

interface SetsFile {
  active: string
  sets: PromptSet[]
}

export type EntryList = 'styles' | 'custom'

function newSetId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 讀出所有提示詞組；舊版的設定變成「預設」 */
function loadSets(): SetsFile {
  try {
    const raw = localStorage.getItem(SETS_KEY)
    if (raw) {
      const f = JSON.parse(raw) as Partial<SetsFile>
      const sets = (Array.isArray(f.sets) ? f.sets : [])
        .filter((x): x is PromptSet => !!x && typeof x.id === 'string')
        .map((x) => ({ id: x.id, name: String(x.name || '未命名').slice(0, 30), config: normalizeConfig(x.config) }))
      if (sets.length) return { active: sets.some((x) => x.id === f.active) ? f.active! : sets[0]!.id, sets }
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    return { active: 'p-default', sets: [{ id: 'p-default', name: '預設', config: legacy ? normalizeConfig(JSON.parse(legacy)) : defaultPromptConfig() }] }
  } catch {
    return { active: 'p-default', sets: [{ id: 'p-default', name: '預設', config: defaultPromptConfig() }] }
  }
}

export const usePrompts = defineStore('prompts', () => {
  const initial = loadSets()
  const sets = ref<PromptSet[]>(initial.sets)
  const active = ref(initial.active)
  // 目前用的一組（編輯畫面與組合提示詞都讀這個）
  const config = ref<PromptConfig>(initial.sets.find((x) => x.id === initial.active)!.config)
  function persist() {
    try {
      localStorage.setItem(SETS_KEY, JSON.stringify({ active: active.value, sets: sets.value }))
    } catch {
      // 寫不進去時只在本次有效
    }
  }
  watch(
    config,
    (c) => {
      const cur = sets.value.find((x) => x.id === active.value)
      if (cur) cur.config = c
      persist()
    },
    { deep: true },
  )

  // ---- 提示詞組 ----

  const activeName = computed(() => sets.value.find((x) => x.id === active.value)?.name ?? '')

  /** 切到另一組（隨時可以，下一次呼叫 AI 就用新的） */
  function switchSet(id: string) {
    const target = sets.value.find((x) => x.id === id)
    if (!target || id === active.value) return
    active.value = id
    config.value = target.config
    persist()
  }

  /** 新的一組：複製另一組（不給時用預設內容） */
  function createSet(name: string, copyFrom?: string): string {
    const from = sets.value.find((x) => x.id === copyFrom)?.config
    const id = newSetId()
    sets.value.push({ id, name: name.trim().slice(0, 30) || '新的提示詞組', config: from ? normalizeConfig(JSON.parse(JSON.stringify(from))) : defaultPromptConfig() })
    persist()
    return id
  }

  function renameSet(id: string, name: string) {
    const x = sets.value.find((y) => y.id === id)
    if (!x || !name.trim()) return
    x.name = name.trim().slice(0, 30)
    persist()
  }

  function deleteSet(id: string) {
    if (sets.value.length <= 1) throw new Error('至少要留一組提示詞')
    sets.value = sets.value.filter((x) => x.id !== id)
    if (active.value === id) switchSet(sets.value[0]!.id)
    else persist()
  }

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
      splitNarrative: settings.splitJudgeNarrative(),
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

  // ---- 單獨匯出、匯入：文風、其他提示詞、世界書 ----

  /** 匯出文風或其他提示詞（只匯出開啟的，或全部） */
  function exportEntries(list: EntryList, onlyEnabled = false): string {
    const entries = config.value[list].filter((e) => !onlyEnabled || e.enabled)
    return JSON.stringify(entriesFile(list, entries), null, 2)
  }

  /** 匯入文風或其他提示詞，加在清單最後；名稱與內容都相同的條目略過。回傳新增與略過的數量 */
  function importEntries(list: EntryList, text: string, fileName?: string): { added: number; skipped: number } {
    const arr = config.value[list]
    let added = 0
    let skipped = 0
    for (const e of parseEntryFile(list, text, fileName)) {
      if (arr.some((x) => x.name === e.name && x.content.trim() === e.content.trim())) {
        skipped += 1
        continue
      }
      arr.push({ ...e, id: newId(list === 'styles' ? 'style' : 'custom') })
      added += 1
    }
    return { added, skipped }
  }

  /** 匯出整本世界書（SillyTavern 格式，含修改與新增的條目） */
  async function exportLore(): Promise<string> {
    await ensureLoaded()
    return JSON.stringify(loreMod.value!.exportWorldbook(items.value), null, 2)
  }

  /**
   * 匯入世界書檔案（SillyTavern 格式或本遊戲匯出的檔案）：
   * - 本遊戲匯出的內建條目：套用成覆寫（和預設相同就清掉覆寫）
   * - 其他條目：新增成自訂條目；內容和現有條目完全相同的略過
   */
  async function importLore(text: string): Promise<{ added: number; updated: number; skipped: number }> {
    await ensureLoaded()
    const mod = loreMod.value!
    const entries = mod.parseWorldbookFile(JSON.parse(text))
    const result = { added: 0, updated: 0, skipped: 0 }
    for (const e of entries) {
      const builtin = e.builtin && e.uid !== undefined ? Object.values(book.value!.entries).find((x) => x.uid === e.uid && x.content.trim()) : undefined
      if (builtin) {
        const d = mod.defaultLoreItem(builtin)
        const diff: LoreOverride = {}
        if (e.comment !== d.comment) diff.comment = e.comment
        if (e.content !== d.content) diff.content = e.content
        if (e.keys.join('\n') !== d.keys.join('\n')) diff.keys = e.keys
        if (e.mode !== d.mode) diff.mode = e.mode
        if (e.order !== d.order) diff.order = e.order
        if (e.adult !== d.adult) diff.adult = e.adult
        const before = JSON.stringify(config.value.lore[builtin.uid] ?? {})
        if (Object.keys(diff).length) config.value.lore[builtin.uid] = diff
        else delete config.value.lore[builtin.uid]
        if (before !== JSON.stringify(diff)) result.updated += 1
        else result.skipped += 1
        continue
      }
      if (items.value.some((x) => x.content.trim() === e.content.trim())) {
        result.skipped += 1
        continue
      }
      const item = addLore()
      Object.assign(item, { comment: e.comment, content: e.content, keys: e.keys, mode: e.mode, order: e.order, adult: e.adult })
      result.added += 1
    }
    return result
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
    sets, active, activeName, switchSet, createSet, renameSet, deleteSet,
    addEntry, duplicateEntry, removeEntry, moveEntry, restoreEntry, restorePresets, presetOf,
    isCustomLore, updateLore, resetLore, addLore, removeLore,
    exportEntries, importEntries, exportLore, importLore,
    exportConfig, importConfig, resetAll,
  }
})
