import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { PROVIDERS, type ProviderConfig, type ProviderId } from '@/narrator/providerInfo'

const KEY = 'elondia.settings'

interface SavedSettings {
  provider: ProviderId
  configs: Record<ProviderId, ProviderConfig>
  autoNarrate: boolean
  adult: boolean
  language: 'zh-Hant' | 'zh-Hans'
  loreBudget: number
}

function defaults(): SavedSettings {
  return {
    provider: 'anthropic',
    configs: Object.fromEntries(
      PROVIDERS.map((p) => [p.id, { apiKey: '', model: p.defaultModel, ...(p.presets ? { baseURL: p.presets[0]!.baseURL } : {}) }]),
    ) as Record<ProviderId, ProviderConfig>,
    autoNarrate: false,
    adult: false,
    language: 'zh-Hant',
    loreBudget: 12000,
  }
}

function load(): SavedSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<SavedSettings>
    return { ...base, ...saved, configs: { ...base.configs, ...saved.configs } }
  } catch {
    return base
  }
}

export const useSettings = defineStore('settings', () => {
  const initial = load()
  const provider = ref(initial.provider)
  const configs = ref(initial.configs)
  const autoNarrate = ref(initial.autoNarrate)
  const adult = ref(initial.adult)
  const language = ref(initial.language)
  const loreBudget = ref(initial.loreBudget)

  watch(
    [provider, configs, autoNarrate, adult, language, loreBudget],
    () => {
      const data: SavedSettings = {
        provider: provider.value,
        configs: configs.value,
        autoNarrate: autoNarrate.value,
        adult: adult.value,
        language: language.value,
        loreBudget: loreBudget.value,
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(data))
      } catch {
        // 無痕模式等情況下寫不進去，設定只在本次有效
      }
    },
    { deep: true },
  )

  const current = () => configs.value[provider.value]
  const ready = () => {
    const cfg = current()
    const info = PROVIDERS.find((p) => p.id === provider.value)!
    return !!cfg.model && (!!cfg.apiKey || !!info.keyOptional) && (!info.needsBaseURL || !!cfg.baseURL)
  }

  return { provider, configs, autoNarrate, adult, language, loreBudget, current, ready }
})
