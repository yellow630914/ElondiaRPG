// 插圖生成的設定：用哪個生圖服務（各自的 key 與參數）、形象插圖的提示詞、要不要先轉成 Danbooru 標籤。
// 和模型來源一樣只存在這個瀏覽器的 localStorage。

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, DEFAULT_TAG_INSTRUCTIONS, IMAGE_SERVICES, imageServiceInfo,
  type ImageServiceConfig, type ImageServiceId,
} from '@/narrator/imageInfo'
import {
  comfyServer, fetchComfyOptions, newPreset, presetFromLegacy, presetFromWorkflow, presetIssues, sanitizePreset,
  type ComfyMode, type ComfyOptions, type ComfyPreset, type ImportedPreset,
} from '@/narrator/comfy'

const KEY = 'elondia.image'

interface SavedImageSettings {
  service: ImageServiceId
  configs: Record<ImageServiceId, ImageServiceConfig>
  /** 各服務要不要先請大語言模型把描述轉成 Danbooru 標籤（轉完直接送出標籤，不再套提示詞） */
  danbooru: Record<ImageServiceId, boolean>
  /** 形象插圖的提示詞模板（{name} 等代號） */
  template: string
  /** 畫風（模板的 {style}） */
  style: string
  /** 標籤轉換的指示 */
  tagInstructions: string
  /** ComfyUI 的設定組合（每個主模一組）與目前用的那一組 */
  comfyPresets: ComfyPreset[]
  comfyActive: string
}

function defaultConfigs(): Record<ImageServiceId, ImageServiceConfig> {
  return Object.fromEntries(IMAGE_SERVICES.map((s) => [s.id, { apiKey: '', ...s.defaults }])) as Record<ImageServiceId, ImageServiceConfig>
}

function defaults(): SavedImageSettings {
  return {
    service: 'openai',
    configs: defaultConfigs(),
    danbooru: Object.fromEntries(IMAGE_SERVICES.map((s) => [s.id, s.danbooru])) as Record<ImageServiceId, boolean>,
    template: DEFAULT_PORTRAIT_TEMPLATE,
    style: DEFAULT_STYLE,
    tagInstructions: DEFAULT_TAG_INSTRUCTIONS,
    comfyPresets: [],
    comfyActive: '',
  }
}

/** 設定組合：舊版只有一份 ComfyUI 工作流程，轉成第一組 */
function loadPresets(saved: Partial<SavedImageSettings> | null, comfy: ImageServiceConfig): { presets: ComfyPreset[]; active: string } {
  const list = Array.isArray(saved?.comfyPresets) ? saved!.comfyPresets.map((p, i) => sanitizePreset(p, `p-${i + 1}`)) : []
  // id 重複時重新編號
  const seen = new Set<string>()
  for (const p of list) {
    while (seen.has(p.id)) p.id = `${p.id}-x`
    seen.add(p.id)
  }
  const presets = list.length ? list : [presetFromLegacy(comfy)]
  const active = presets.some((p) => p.id === saved?.comfyActive) ? saved!.comfyActive! : presets[0]!.id
  return { presets, active }
}

function load(): SavedImageSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...base, ...presetsOf(loadPresets(null, base.configs.comfyui)) }
    const saved = JSON.parse(raw) as Partial<SavedImageSettings>
    const configs = defaultConfigs()
    for (const id of Object.keys(configs) as ImageServiceId[]) configs[id] = { ...configs[id], ...saved.configs?.[id] }
    return {
      ...base, ...saved,
      service: IMAGE_SERVICES.some((s) => s.id === saved.service) ? saved.service! : base.service,
      configs,
      danbooru: { ...base.danbooru, ...saved.danbooru },
      ...presetsOf(loadPresets(saved, configs.comfyui)),
    }
  } catch {
    return { ...base, ...presetsOf(loadPresets(null, base.configs.comfyui)) }
  }
}

const presetsOf = (x: { presets: ComfyPreset[]; active: string }) => ({ comfyPresets: x.presets, comfyActive: x.active })

export const useImageSettings = defineStore('image', () => {
  const initial = load()
  const service = ref(initial.service)
  const configs = ref(initial.configs)
  const danbooru = ref(initial.danbooru)
  const template = ref(initial.template)
  const style = ref(initial.style)
  const tagInstructions = ref(initial.tagInstructions)
  const comfyPresets = ref<ComfyPreset[]>(initial.comfyPresets)
  const comfyActive = ref(initial.comfyActive)
  /** 從 ComfyUI 讀到的清單（不保存，每次開啟設定時再讀） */
  const comfyOptions = ref<ComfyOptions | null>(null)
  const comfyLoading = ref(false)
  const comfyError = ref<string | null>(null)

  watch([service, configs, danbooru, template, style, tagInstructions, comfyPresets, comfyActive], () => {
    const data: SavedImageSettings = {
      service: service.value, configs: configs.value, danbooru: danbooru.value,
      template: template.value, style: style.value, tagInstructions: tagInstructions.value,
      comfyPresets: comfyPresets.value, comfyActive: comfyActive.value,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // 寫不進去時只在本次有效
    }
  }, { deep: true })

  /** 目前的服務設定 */
  const config = () => configs.value[service.value]
  /** 設定完成了嗎（有網址；需要 key 的服務有 key；ComfyUI 的設定組合選好了模型） */
  function ready(): boolean {
    const info = imageServiceInfo(service.value)
    const c = config()
    return !!c.baseURL && (!!c.apiKey || !!info.keyOptional) && (service.value !== 'comfyui' || !presetIssues(preset()).length)
  }

  // ---- ComfyUI 的設定組合 ----

  /** 目前用的設定組合 */
  function preset(): ComfyPreset {
    return comfyPresets.value.find((p) => p.id === comfyActive.value) ?? comfyPresets.value[0]!
  }

  function newId(): string {
    let n = comfyPresets.value.length + 1
    while (comfyPresets.value.some((p) => p.id === `p-${n}`)) n++
    return `p-${n}`
  }

  function uniqueName(name: string): string {
    let out = name.trim() || '新的設定'
    for (let i = 2; comfyPresets.value.some((p) => p.name === out); i++) out = `${name.trim() || '新的設定'} ${i}`
    return out
  }

  function addPreset(mode: ComfyMode = 'checkpoint'): ComfyPreset {
    const p = newPreset(newId(), uniqueName('新的設定'), mode)
    comfyPresets.value.push(p)
    comfyActive.value = p.id
    return p
  }

  function duplicatePreset(): ComfyPreset {
    const p = { ...JSON.parse(JSON.stringify(preset())) as ComfyPreset, id: newId() }
    p.name = uniqueName(`${preset().name} 複製`)
    comfyPresets.value.push(p)
    comfyActive.value = p.id
    return p
  }

  /** 刪掉目前這組（至少留一組） */
  function removePreset() {
    if (comfyPresets.value.length <= 1) throw new Error('至少要留一組設定')
    comfyPresets.value = comfyPresets.value.filter((p) => p.id !== comfyActive.value)
    comfyActive.value = comfyPresets.value[0]!.id
  }

  /** 從玩家的工作流程（API 格式）匯入成新的一組 */
  function importPreset(text: string): ImportedPreset & { added: ComfyPreset } {
    const result = presetFromWorkflow(text, comfyOptions.value?.loras ?? [])
    const added = sanitizePreset({ ...result.preset, id: newId(), name: uniqueName(result.name) })
    comfyPresets.value.push(added)
    comfyActive.value = added.id
    return { ...result, added }
  }

  /** 讀取 ComfyUI 上的模型、LoRA、取樣器清單 */
  async function loadComfyOptions() {
    comfyLoading.value = true
    comfyError.value = null
    try {
      comfyOptions.value = await fetchComfyOptions(comfyServer(configs.value.comfyui))
    } catch (e) {
      comfyError.value = e instanceof Error ? e.message : String(e)
    } finally {
      comfyLoading.value = false
    }
  }

  /** 這個服務恢復預設的參數（保留 key；ComfyUI 的設定組合不動） */
  function resetService(id: ImageServiceId) {
    configs.value[id] = { apiKey: configs.value[id].apiKey, ...imageServiceInfo(id).defaults }
  }

  return {
    service, configs, danbooru, template, style, tagInstructions, config, ready, resetService,
    comfyPresets, comfyActive, comfyOptions, comfyLoading, comfyError,
    preset, addPreset, duplicatePreset, removePreset, importPreset, loadComfyOptions,
  }
})
