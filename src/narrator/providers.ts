// AI 服務：Anthropic、OpenAI、Google Gemini，以及 OpenAI 相容格式（OpenRouter、DeepSeek、本機 Ollama 等）。
// API key 由玩家自行輸入，只存在瀏覽器的 localStorage，請求直接從瀏覽器送到各服務。

// 各家 SDK 在用到時才載入，只會下載玩家選用的那一家
import type { Prompt } from './prompt'
import type { ProviderConfig, ProviderId } from './providerInfo'

export type { ProviderConfig, ProviderId }

export class NarrationRefusedError extends Error {
  constructor(detail?: string) {
    super(`模型拒絕了這次請求${detail ? `（${detail}）` : ''}`)
  }
}

// 支援伺服器端拒絕備援（fallbacks: "default"）的 Claude 模型
const CLAUDE_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'])
const CLAUDE_DEFAULT_MAX_TOKENS = 64000

/** 以串流方式產生敘事，逐段回傳文字。 */
export async function* streamNarration(
  provider: ProviderId,
  config: ProviderConfig,
  prompt: Prompt,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!config.model) throw new Error('請先在設定中選擇模型')
  switch (provider) {
    case 'anthropic':
      yield* streamAnthropic(config, prompt, signal)
      return
    case 'openai':
    case 'openai_compatible':
      yield* streamOpenAI(provider, config, prompt, signal)
      return
    case 'gemini':
      yield* streamGemini(config, prompt, signal)
      return
  }
}

async function anthropicClient(config: ProviderConfig) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
}

async function geminiClient(config: ProviderConfig) {
  const { GoogleGenAI } = await import('@google/genai')
  return new GoogleGenAI({ apiKey: config.apiKey })
}

async function* streamAnthropic(config: ProviderConfig, prompt: Prompt, signal?: AbortSignal) {
  const client = await anthropicClient(config)
  const params = {
    model: config.model,
    max_tokens: config.maxTokens ?? CLAUDE_DEFAULT_MAX_TOKENS,
    system: prompt.system,
    messages: [{ role: 'user' as const, content: prompt.user }],
  }
  // 支援的模型開啟伺服器端備援：被安全分類器拒絕時，自動改由建議的備援模型完成
  const stream = CLAUDE_FALLBACK_MODELS.has(config.model)
    ? client.beta.messages.stream(
        { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },
        { signal },
      )
    : client.messages.stream(params, { signal })
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
  }
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') {
    throw new NarrationRefusedError(final.stop_details?.category ?? undefined)
  }
}

async function openAIClient(provider: ProviderId, config: ProviderConfig) {
  const { default: OpenAI } = await import('openai')
  return new OpenAI({
    // OpenAI SDK 一定要有 key；本機服務不檢查，給個佔位字串
    apiKey: config.apiKey || 'not-needed',
    ...(provider === 'openai_compatible' ? { baseURL: config.baseURL } : {}),
    dangerouslyAllowBrowser: true,
  })
}

async function* streamOpenAI(provider: ProviderId, config: ProviderConfig, prompt: Prompt, signal?: AbortSignal) {
  if (provider === 'openai_compatible' && !config.baseURL) throw new Error('請填寫 Base URL')
  const client = await openAIClient(provider, config)
  const stream = await client.chat.completions.create(
    {
      model: config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
      ...(config.maxTokens
        ? provider === 'openai'
          ? { max_completion_tokens: config.maxTokens }
          : { max_tokens: config.maxTokens }
        : {}),
    },
    { signal },
  )
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
    if (chunk.choices[0]?.finish_reason === 'content_filter') throw new NarrationRefusedError('content_filter')
  }
}

async function* streamGemini(config: ProviderConfig, prompt: Prompt, signal?: AbortSignal) {
  const ai = await geminiClient(config)
  const stream = await ai.models.generateContentStream({
    model: config.model,
    contents: prompt.user,
    config: {
      systemInstruction: prompt.system,
      ...(config.maxTokens ? { maxOutputTokens: config.maxTokens } : {}),
      ...(signal ? { abortSignal: signal } : {}),
    },
  })
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text
    if (chunk.promptFeedback?.blockReason) throw new NarrationRefusedError(String(chunk.promptFeedback.blockReason))
  }
}

/** 向服務查詢可用的模型清單。 */
export async function listModels(provider: ProviderId, config: ProviderConfig): Promise<string[]> {
  const ids: string[] = []
  switch (provider) {
    case 'anthropic': {
      const client = await anthropicClient(config)
      for await (const m of client.models.list()) ids.push(m.id)
      break
    }
    case 'openai':
    case 'openai_compatible': {
      const client = await openAIClient(provider, config)
      for await (const m of client.models.list()) ids.push(m.id)
      break
    }
    case 'gemini': {
      const ai = await geminiClient(config)
      const pager = await ai.models.list()
      for await (const m of pager) {
        if (m.name && (m.supportedActions ?? ['generateContent']).includes('generateContent')) {
          ids.push(m.name.replace(/^models\//, ''))
        }
      }
      break
    }
  }
  return ids.sort()
}
