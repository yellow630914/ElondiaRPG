import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { progression } from '@/engine/data'
import { PROVIDERS, type ProviderConfig, type ProviderId } from '@/narrator/providerInfo'

const KEY = 'elondia.settings'

/** 會呼叫 AI 的功能（見 docs/PROMPTS.md 第 1 節） */
export type AiFeature = 'narration' | 'judge' | 'roster' | 'shop' | 'negotiation'

export const AI_FEATURES: { id: AiFeature; name: string; desc: string; prose: boolean }[] = [
  { id: 'narration', name: '敘事正文', desc: '每則日誌的詳細經過（AI 細節描述、重新生成敘事），以及判定與正文分開時主動行動的經過', prose: true },
  { id: 'judge', name: '主動行動判定', desc: '看骰值決定成敗與後果（JSON）。和「敘事正文」同一個來源時，順便寫出經過（省一次呼叫）；不同來源時，經過改由敘事正文的來源撰寫', prose: false },
  { id: 'roster', name: '居民潤飾', desc: '第一次到一個地點時，設計居民的名字、外貌與性格（JSON）', prose: false },
  { id: 'shop', name: '商店清單', desc: '第一次進店時設計今天的交易清單（JSON）', prose: false },
  { id: 'negotiation', name: '談判方式', desc: '開始談判時設計可以採取的方式（JSON）', prose: false },
]

/** 模型來源：一組服務、key 與模型。每個來源對各服務各自保存設定，切換服務不會弄丟 key。 */
export interface ModelSource {
  name: string
  provider: ProviderId
  configs: Record<ProviderId, ProviderConfig>
}

export const SOURCE_COUNT = 3

interface SavedSettings {
  sources: ModelSource[]
  /** 各功能使用哪一個來源（索引） */
  routes: Record<AiFeature, number>
  /** AI 細節描述：開啟時每次行動後自動請 AI 寫事件經過；關閉時只顯示戰報與事件簡述 */
  aiNarration: boolean
  /** AI 判定：主動行動由 AI 看骰值判定、居民與商店清單由 AI 設計；關閉時依規則判定 */
  aiJudge: boolean
  /** 升級時的能力三選一，每組可以重抽的次數 */
  abilityRerolls: number
  adult: boolean
  language: 'zh-Hant' | 'zh-Hans'
  loreBudget: number
}

function defaultConfigs(): Record<ProviderId, ProviderConfig> {
  return Object.fromEntries(
    PROVIDERS.map((p) => [p.id, { apiKey: '', model: p.defaultModel, ...(p.presets ? { baseURL: p.presets[0]!.baseURL } : {}) }]),
  ) as Record<ProviderId, ProviderConfig>
}

function defaultRoutes(): Record<AiFeature, number> {
  return Object.fromEntries(AI_FEATURES.map((f) => [f.id, 0])) as Record<AiFeature, number>
}

function cloneSource(s: ModelSource, name: string): ModelSource {
  return { name, provider: s.provider, configs: JSON.parse(JSON.stringify(s.configs)) as Record<ProviderId, ProviderConfig> }
}

function defaults(): SavedSettings {
  const first: ModelSource = { name: '來源 1', provider: 'anthropic', configs: defaultConfigs() }
  return {
    sources: [first, cloneSource(first, '來源 2'), cloneSource(first, '來源 3')],
    routes: defaultRoutes(),
    aiNarration: false,
    aiJudge: false,
    abilityRerolls: progression.ability_rerolls,
    adult: false,
    language: 'zh-Hant',
    loreBudget: 12000,
  }
}

type OldSettings = Partial<SavedSettings> & { autoNarrate?: boolean; provider?: ProviderId; configs?: Record<ProviderId, ProviderConfig> }

function load(): SavedSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as OldSettings
    // 舊版設定叫 autoNarrate
    const aiNarration = saved.aiNarration ?? saved.autoNarrate ?? base.aiNarration
    // 舊版只有一組服務設定：當作來源 1，來源 2、3 先複製一份（只要改模型就好）
    let sources = Array.isArray(saved.sources) ? saved.sources : null
    if (!sources) {
      const first: ModelSource = { name: '來源 1', provider: saved.provider ?? 'anthropic', configs: { ...defaultConfigs(), ...saved.configs } }
      sources = [first, cloneSource(first, '來源 2'), cloneSource(first, '來源 3')]
    }
    sources = Array.from({ length: SOURCE_COUNT }, (_, i) => {
      const s = sources![i] ?? cloneSource(sources![0] ?? base.sources[0]!, `來源 ${i + 1}`)
      return { name: s.name || `來源 ${i + 1}`, provider: s.provider ?? 'anthropic', configs: { ...defaultConfigs(), ...s.configs } }
    })
    const routes = { ...defaultRoutes(), ...saved.routes }
    for (const k of Object.keys(routes) as AiFeature[]) if (!(routes[k] >= 0 && routes[k] < SOURCE_COUNT)) routes[k] = 0
    const { autoNarrate: _a, provider: _p, configs: _c, ...rest } = saved
    return { ...base, ...rest, aiNarration, sources, routes }
  } catch {
    return base
  }
}

export const useSettings = defineStore('settings', () => {
  const initial = load()
  const sources = ref(initial.sources)
  const routes = ref(initial.routes)
  const aiNarration = ref(initial.aiNarration)
  const aiJudge = ref(initial.aiJudge)
  const abilityRerolls = ref(initial.abilityRerolls)
  const adult = ref(initial.adult)
  const language = ref(initial.language)
  const loreBudget = ref(initial.loreBudget)

  watch(
    [sources, routes, aiNarration, aiJudge, abilityRerolls, adult, language, loreBudget],
    () => {
      const data: SavedSettings = {
        sources: sources.value,
        routes: routes.value,
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

  function sourceReady(i: number): boolean {
    const s = sources.value[i]
    if (!s) return false
    const cfg = s.configs[s.provider]
    const info = PROVIDERS.find((p) => p.id === s.provider)!
    return !!cfg.model && (!!cfg.apiKey || !!info.keyOptional) && (!info.needsBaseURL || !!cfg.baseURL)
  }

  /** 功能使用的來源 */
  function sourceIndex(feature: AiFeature): number {
    return routes.value[feature] ?? 0
  }

  /** 呼叫 AI 用的服務與設定 */
  function sourceFor(feature: AiFeature): { index: number; name: string; provider: ProviderId; config: ProviderConfig } {
    const index = sourceIndex(feature)
    const s = sources.value[index] ?? sources.value[0]!
    return { index, name: s.name, provider: s.provider, config: s.configs[s.provider] }
  }

  /** 功能的來源設定完成了嗎（不指定時：任何一個功能能用就算） */
  const ready = (feature?: AiFeature) =>
    feature ? sourceReady(sourceIndex(feature)) : AI_FEATURES.some((f) => sourceReady(sourceIndex(f.id)))

  /** 判定與正文用不同的來源：判定只回傳 JSON，經過改由敘事正文的來源撰寫 */
  const splitJudgeNarrative = () => sourceIndex('judge') !== sourceIndex('narration')

  /** 把一個來源的設定複製到另一個（例如只想換模型） */
  function copySource(from: number, to: number) {
    const src = sources.value[from]
    if (!src || !sources.value[to] || from === to) return
    sources.value[to] = cloneSource(src, sources.value[to]!.name)
  }

  /** 重抽次數（夾在 0～99） */
  const rerollLimit = () => Math.max(0, Math.min(99, Math.floor(Number(abilityRerolls.value) || 0)))

  return {
    sources, routes, aiNarration, aiJudge, abilityRerolls, rerollLimit, adult, language, loreBudget,
    sourceReady, sourceIndex, sourceFor, ready, splitJudgeNarrative, copySource,
  }
})
