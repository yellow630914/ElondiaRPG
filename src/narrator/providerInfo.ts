// AI 服務的基本資料（不含 SDK，讓設定畫面不必載入各家 SDK）。

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openai_compatible'

export interface ProviderConfig {
  apiKey: string
  model: string
  /** 只有 OpenAI 相容格式需要 */
  baseURL?: string
  /** 留空則用各服務預設值 */
  maxTokens?: number
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  defaultModel: string
  modelHints: string[]
  keyHint: string
  needsBaseURL: boolean
  /** 本機服務可以不填 key */
  keyOptional?: boolean
  presets?: { name: string; baseURL: string }[]
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic（Claude）',
    defaultModel: 'claude-opus-5-5',
    modelHints: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    keyHint: 'sk-ant-...',
    needsBaseURL: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: '',
    modelHints: [],
    keyHint: 'sk-...',
    needsBaseURL: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-flash-latest',
    modelHints: ['gemini-flash-latest', 'gemini-pro-latest'],
    keyHint: 'AIza...',
    needsBaseURL: false,
  },
  {
    id: 'openai_compatible',
    name: 'OpenAI 相容格式',
    defaultModel: '',
    modelHints: [],
    keyHint: '依服務而定；本機服務可留空',
    needsBaseURL: true,
    keyOptional: true,
    presets: [
      { name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' },
      { name: 'DeepSeek', baseURL: 'https://api.deepseek.com' },
      { name: 'Ollama（本機）', baseURL: 'http://localhost:11434/v1' },
      { name: 'LM Studio（本機）', baseURL: 'http://localhost:1234/v1' },
    ],
  },
]

export function providerInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id)!
}

/** 一次 AI 呼叫的 token 用量（輸入含快取讀寫） */
export interface TokenUsage {
  /** 輸入 tokens（含讀取快取的部分） */
  input: number
  output: number
  /** 輸入中從提示詞快取讀取的部分 */
  cached?: number
}
