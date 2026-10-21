// 插圖生成的設定：用哪個生圖服務（各自的 key 與參數）、形象插圖的提示詞、要不要先轉成 Danbooru 標籤。
// 和模型來源一樣只存在這個瀏覽器的 localStorage。

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, DEFAULT_TAG_INSTRUCTIONS, IMAGE_SERVICES, imageServiceInfo,
  type ImageServiceConfig, type ImageServiceId,
} from '@/narrator/imageInfo'

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
  }
}

function load(): SavedImageSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<SavedImageSettings>
    const configs = defaultConfigs()
    for (const id of Object.keys(configs) as ImageServiceId[]) configs[id] = { ...configs[id], ...saved.configs?.[id] }
    return {
      ...base, ...saved,
      service: IMAGE_SERVICES.some((s) => s.id === saved.service) ? saved.service! : base.service,
      configs,
      danbooru: { ...base.danbooru, ...saved.danbooru },
    }
  } catch {
    return base
  }
}

export const useImageSettings = defineStore('image', () => {
  const initial = load()
  const service = ref(initial.service)
  const configs = ref(initial.configs)
  const danbooru = ref(initial.danbooru)
  const template = ref(initial.template)
  const style = ref(initial.style)
  const tagInstructions = ref(initial.tagInstructions)

  watch([service, configs, danbooru, template, style, tagInstructions], () => {
    const data: SavedImageSettings = {
      service: service.value, configs: configs.value, danbooru: danbooru.value,
      template: template.value, style: style.value, tagInstructions: tagInstructions.value,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // 寫不進去時只在本次有效
    }
  }, { deep: true })

  /** 目前的服務設定 */
  const config = () => configs.value[service.value]
  /** 設定完成了嗎（有網址；需要 key 的服務有 key；ComfyUI 有工作流程） */
  function ready(): boolean {
    const info = imageServiceInfo(service.value)
    const c = config()
    return !!c.baseURL && (!!c.apiKey || !!info.keyOptional) && (service.value !== 'comfyui' || !!c.workflow.trim())
  }
  /** 這個服務恢復預設的參數（保留 key） */
  function resetService(id: ImageServiceId) {
    configs.value[id] = { apiKey: configs.value[id].apiKey, ...imageServiceInfo(id).defaults }
  }

  return { service, configs, danbooru, template, style, tagInstructions, config, ready, resetService }
})
