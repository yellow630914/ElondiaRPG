import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { progression } from '@/engine/data'
import { PROVIDERS, type ProviderConfig, type ProviderId } from '@/narrator/providerInfo'

const KEY = 'elondia.settings'

interface SavedSettings {
  provider: ProviderId
  configs: Record<ProviderId, ProviderConfig>
  /** AI 細節描述：開啟時每次行動後自動請 AI 寫事件經過；關閉時只顯示戰報與事件簡述 */
  aiNarration: boolean
  /** AI 判定：主動行動由 AI 看骰值判定、酒館候選人由 AI 潤飾；關閉時依規則判定 */
  aiJudge: boolean
  /** 升級時的能力三選一，每組可以重抽的次數 */
  abilityRerolls: number
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
    aiNarration: false,
    aiJudge: false,
    abilityRerolls: progression.ability_rerolls,
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
    const saved = JSON.parse(raw) as Partial<SavedSettings> & { autoNarrate?: boolean }
    // 舊版設定叫 autoNarrate
    const aiNarration = saved.aiNarration ?? saved.autoNarrate ?? base.aiNarration
    delete saved.autoNarrate
    return { ...base, ...saved, aiNarration, configs: { ...base.configs, ...saved.configs } }
  } catch {
    return base
  }
}

export const useSettings = defineStore('settings', () => {
  const initial = load()
  const provider = ref(initial.provider)
  const configs = ref(initial.configs)
  const aiNarration = ref(initial.aiNarration)
  const aiJudge = ref(initial.aiJudge)
  const abilityRerolls = ref(initial.abilityRerolls)
  const adult = ref(initial.adult)
  const language = ref(initial.language)
  const loreBudget = ref(initial.loreBudget)

  watch(
    [provider, configs, aiNarration, aiJudge, abilityRerolls, adult, language, loreBudget],
    () => {
      const data: SavedSettings = {
        provider: provider.value,
        configs: configs.value,
        aiNarration: aiNarration.value,
        aiJudge: aiJudge.value,
        abilityRerolls: abilityRerolls.value,
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

  /** 重抽次數（夾在 0～99） */
  const rerollLimit = () => Math.max(0, Math.min(99, Math.floor(Number(abilityRerolls.value) || 0)))

  return { provider, configs, aiNarration, aiJudge, abilityRerolls, rerollLimit, adult, language, loreBudget, current, ready }
})
