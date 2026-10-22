import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { setAdultContent } from '@/engine/content'
import { companionRules, progression } from '@/engine/data'
import { setLongRestGap } from '@/engine/rest'
import type { Report } from '@/engine/types'
import { PROVIDERS, type ProviderConfig, type ProviderId } from '@/narrator/providerInfo'

const KEY = 'elondia.settings'

/** 會呼叫 AI 的功能（見 docs/PROMPTS.md 第 1 節） */
export type AiFeature = 'narration' | 'adult' | 'judge' | 'roster' | 'shop' | 'negotiation' | 'tags'

export const AI_FEATURES: { id: AiFeature; name: string; desc: string; prose: boolean }[] = [
  { id: 'narration', name: '敘事正文', desc: '所有日誌的詳細經過：戰鬥、旅行、事件，以及主動行動判定之後的經過；也可以在每則日誌手動生成', prose: true },
  { id: 'adult', name: '成人場景正文', desc: '成人向開啟時，帶親密場景的日誌（娼館、主人的邀約、戰敗後的遭遇、AI 判定認為有親密場景的行動）改用這個來源寫經過；提示詞用套用到「成人場景」的文風與其他提示詞', prose: true },
  { id: 'judge', name: '主動行動判定', desc: '看骰值決定成敗與後果，只回傳 JSON；經過交給「敘事正文」（除非下方勾選「判定時順便寫出經過」）', prose: false },
  { id: 'roster', name: '居民潤飾', desc: '第一次到一個地點時，設計居民的名字、外貌與性格（JSON）', prose: false },
  { id: 'shop', name: '商店清單', desc: '第一次進店時設計今天的交易清單（JSON）', prose: false },
  { id: 'negotiation', name: '談判方式', desc: '開始談判時設計可以採取的方式（JSON）', prose: false },
  { id: 'tags', name: '插圖提示詞預處理', desc: '生成形象插圖前，依選的預處理指示改寫角色描述（例如轉成 Danbooru 標籤、JSON）；插圖設定選了「生圖提示詞預處理」時才用', prose: false },
]

/** 模型來源：一組服務、key 與模型。每個來源對各服務各自保存設定，切換服務不會弄丟 key。 */
export interface ModelSource {
  name: string
  provider: ProviderId
  configs: Record<ProviderId, ProviderConfig>
}

export const SOURCE_COUNT = 3

/** 自動寫出經過的日誌種類 */
export type NarrateKind = 'action' | 'combat' | 'travel' | 'event' | 'rest' | 'social' | 'trade'

export const NARRATE_KINDS: { id: NarrateKind; name: string; desc: string }[] = [
  { id: 'action', name: '🎲 主動行動', desc: '擲骰判定的行動：聊天、送禮、偷竊、雇傭、談判、蒙混……（AI 判定的行動不受「AI 細節描述」開關影響）' },
  { id: 'combat', name: '⚔️ 戰鬥', desc: '戰報' },
  { id: 'travel', name: '🧭 旅行', desc: '旅途與抵達' },
  { id: 'event', name: '📜 事件與委託', desc: '陷阱、採集、對峙、委託' },
  { id: 'rest', name: '🛏️ 休息', desc: '短休、長休' },
  { id: 'social', name: '💬 交流', desc: '沒有擲骰的交流：直接雇用、城門、繳罰金……' },
  { id: 'trade', name: '🛒 交易', desc: '買賣（通常不需要）' },
]

/** 日誌屬於哪一種（決定要不要自動寫出經過） */
export function narrateKindOf(report: Report): NarrateKind {
  if (report.check) return 'action'
  switch (report.kind) {
    case 'combat': return 'combat'
    case 'travel': return 'travel'
    case 'rest': return 'rest'
    case 'trade': return 'trade'
    case 'social': return 'social'
    case 'action': return 'action'
    default: return 'event'
  }
}

interface SavedSettings {
  sources: ModelSource[]
  /** 各功能使用哪一個來源（索引） */
  routes: Record<AiFeature, number>
  /** 判定與正文同一個來源時，判定順便寫出經過（省一次呼叫）；預設分開 */
  judgeWritesNarrative: boolean
  /** 開啟 AI 細節描述時，哪些日誌自動寫出經過 */
  narrateKinds: Record<NarrateKind, boolean>
  /** AI 細節描述：開啟時每次行動後自動請 AI 寫事件經過；關閉時只顯示戰報與事件簡述 */
  aiNarration: boolean
  /** AI 判定：主動行動由 AI 看骰值判定、居民與商店清單由 AI 設計；關閉時依規則判定 */
  aiJudge: boolean
  /** 升級時的能力三選一，每組可以重抽的次數 */
  abilityRerolls: number
  /** 兩次長休至少隔幾小時（0～24） */
  longRestGap: number
  /** 完整保留最近幾則日誌（更早的封存，見 docs/SAVES.md 第 6 節） */
  logKeep: number
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

function defaultNarrateKinds(): Record<NarrateKind, boolean> {
  return Object.fromEntries(NARRATE_KINDS.map((k) => [k.id, k.id !== 'trade'])) as Record<NarrateKind, boolean>
}

function cloneSource(s: ModelSource, name: string): ModelSource {
  return { name, provider: s.provider, configs: JSON.parse(JSON.stringify(s.configs)) as Record<ProviderId, ProviderConfig> }
}

function defaults(): SavedSettings {
  const first: ModelSource = { name: '來源 1', provider: 'anthropic', configs: defaultConfigs() }
  return {
    sources: [first, cloneSource(first, '來源 2'), cloneSource(first, '來源 3')],
    routes: defaultRoutes(),
    judgeWritesNarrative: false,
    narrateKinds: defaultNarrateKinds(),
    aiNarration: false,
    aiJudge: false,
    abilityRerolls: progression.ability_rerolls,
    longRestGap: companionRules.rest.long_rest_gap_hours,
    logKeep: 200,
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
    // 舊版沒有「成人場景正文」：和敘事正文用同一個來源
    const routes = { ...defaultRoutes(), ...(saved.routes ? { adult: saved.routes.narration ?? 0 } : {}), ...saved.routes }
    for (const k of Object.keys(routes) as AiFeature[]) if (!(routes[k] >= 0 && routes[k] < SOURCE_COUNT)) routes[k] = 0
    const { autoNarrate: _a, provider: _p, configs: _c, ...rest } = saved
    return { ...base, ...rest, aiNarration, sources, routes, narrateKinds: { ...base.narrateKinds, ...saved.narrateKinds } }
  } catch {
    return base
  }
}

export const useSettings = defineStore('settings', () => {
  const initial = load()
  const sources = ref(initial.sources)
  const routes = ref(initial.routes)
  const judgeWritesNarrative = ref(initial.judgeWritesNarrative)
  const narrateKinds = ref(initial.narrateKinds)
  const aiNarration = ref(initial.aiNarration)
  const aiJudge = ref(initial.aiJudge)
  const abilityRerolls = ref(initial.abilityRerolls)
  const longRestGap = ref(initial.longRestGap)
  // 引擎的長休間隔
  watch(longRestGap, (h) => setLongRestGap(h), { immediate: true })
  const logKeep = ref(initial.logKeep)
  const adult = ref(initial.adult)
  // 引擎的成人向開關（娼館／按摩店等名稱、成人向事件）
  watch(adult, setAdultContent, { immediate: true })
  const language = ref(initial.language)
  const loreBudget = ref(initial.loreBudget)

  watch(
    [sources, routes, judgeWritesNarrative, narrateKinds, aiNarration, aiJudge, abilityRerolls, longRestGap, logKeep, adult, language, loreBudget],
    () => {
      const data: SavedSettings = {
        sources: sources.value,
        routes: routes.value,
        judgeWritesNarrative: judgeWritesNarrative.value,
        narrateKinds: narrateKinds.value,
        aiNarration: aiNarration.value,
        aiJudge: aiJudge.value,
        abilityRerolls: abilityRerolls.value,
        // 欄位清空時存成預設，下次打開設定不會是空的
        longRestGap: typeof longRestGap.value === 'number' && Number.isFinite(longRestGap.value) ? longRestGap.value : companionRules.rest.long_rest_gap_hours,
        logKeep: logKeep.value,
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

  /** 判定只回傳 JSON，經過交給敘事正文：預設如此；只有勾選「順便寫出經過」而且同一個來源時才合併 */
  const splitJudgeNarrative = () => !judgeWritesNarrative.value || sourceIndex('judge') !== sourceIndex('narration')

  /** 寫這則日誌的經過用哪個功能的來源：帶親密場景（成人向開啟時）用「成人場景正文」 */
  function narrationFeature(report: Report): 'narration' | 'adult' {
    return adult.value && report.narration?.adult_scene ? 'adult' : 'narration'
  }

  /** 這則日誌要不要自動寫出經過：AI 判定的主動行動只看種類開關，其他還要開啟 AI 細節描述 */
  function autoNarrates(report: Report): boolean {
    const kind = narrateKindOf(report)
    if (!narrateKinds.value[kind]) return false
    return aiNarration.value || (kind === 'action' && report.check?.source === 'ai')
  }

  /** 把一個來源的設定複製到另一個（例如只想換模型） */
  function copySource(from: number, to: number) {
    const src = sources.value[from]
    if (!src || !sources.value[to] || from === to) return
    sources.value[to] = cloneSource(src, sources.value[to]!.name)
  }

  /** 重抽次數（夾在 0～99） */
  const rerollLimit = () => Math.max(0, Math.min(99, Math.floor(Number(abilityRerolls.value) || 0)))
  /** 完整保留的日誌數（夾在 50～5000） */
  const logKeepLimit = () => Math.max(50, Math.min(5000, Math.floor(Number(logKeep.value) || 200)))

  return {
    sources, routes, judgeWritesNarrative, narrateKinds, autoNarrates, aiNarration, aiJudge, abilityRerolls, rerollLimit, longRestGap, logKeep, logKeepLimit, adult, language, loreBudget,
    sourceReady, sourceIndex, sourceFor, ready, splitJudgeNarrative, narrationFeature, copySource,
  }
})
