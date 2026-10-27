// Vertex AI 的服務帳戶（service account JSON）：和 SillyTavern 的「完整模式」一樣，
// 用 JSON 裡的私鑰簽一張 JWT，向 oauth2.googleapis.com 換 access token，再帶著它呼叫 Vertex AI。
// 兩個端點都允許瀏覽器跨網域呼叫，所以整個流程在瀏覽器裡完成；JSON 和 key 一樣只存在這台瀏覽器的 localStorage。
// API key（快速模式）走 @google/genai SDK（providers.ts）；SDK 的瀏覽器版只收 API key，所以服務帳戶這裡直接打 REST。

import type { ProviderConfig } from './providerInfo'

export interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/** key 欄位填的是服務帳戶的 JSON 時解析出來（不是時回傳 undefined） */
export function parseServiceAccount(text: string | undefined): ServiceAccount | undefined {
  const t = text?.trim()
  if (!t?.startsWith('{')) return undefined
  try {
    const j = JSON.parse(t) as Partial<ServiceAccount> & { type?: string }
    if (typeof j.client_email === 'string' && typeof j.private_key === 'string' && typeof j.project_id === 'string') {
      return { client_email: j.client_email, private_key: j.private_key, project_id: j.project_id }
    }
  } catch {
    // 不是 JSON：當成 API key
  }
  return undefined
}

/** 預設的區域：和 SillyTavern 一樣是 us-central1；global 用沒有區域前綴的網址 */
export const VERTEX_DEFAULT_REGION = 'us-central1'

/** 呼叫模型的網址（串流時加 alt=sse） */
export function vertexModelUrl(sa: ServiceAccount, region: string | undefined, model: string, method: 'streamGenerateContent' | 'generateContent'): string {
  const r = region?.trim() || VERTEX_DEFAULT_REGION
  const host = r === 'global' ? 'https://aiplatform.googleapis.com' : `https://${r}-aiplatform.googleapis.com`
  return `${host}/v1/projects/${sa.project_id}/locations/${r}/publishers/google/models/${encodeURIComponent(model)}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s))

/** PEM（-----BEGIN PRIVATE KEY-----）轉成 PKCS#8 的位元組 */
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '')
  const bin = atob(body)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

/** 簽一張換 token 用的 JWT（RS256，一小時有效，範圍 cloud-platform） */
export async function signServiceJwt(sa: ServiceAccount, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64urlText(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  } catch {
    throw new Error('服務帳戶 JSON 的 private_key 讀不出來，請重新下載金鑰檔')
  }
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`
}

// 換到的 token 先留著（同一個服務帳戶一小時內不必重換），提前一分鐘重換
const tokens = new Map<string, { token: string; until: number }>()

/** 用服務帳戶換 access token（有快取） */
export async function vertexAccessToken(sa: ServiceAccount, signal?: AbortSignal): Promise<string> {
  const hit = tokens.get(sa.client_email)
  if (hit && hit.until > Date.now()) return hit.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signServiceJwt(sa) }),
    signal,
  })
  if (!res.ok) throw new Error(`服務帳戶換不到 access token（${res.status}）：${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('服務帳戶換不到 access token')
  tokens.set(sa.client_email, { token: data.access_token, until: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000 })
  return data.access_token
}

/** 測試用：清掉換到的 token */
export function clearVertexTokens() {
  tokens.clear()
}

/** Gemini 回應的一段（REST 的 JSON，和 SDK 的形狀相同） */
export interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number }
  promptFeedback?: { blockReason?: string }
}

/** 請求的內容：和 SDK 送出的相同（system 放 systemInstruction） */
export function vertexBody(config: ProviderConfig, system: string, user: string, thinkingConfig?: Record<string, unknown>) {
  return {
    contents: [{ role: 'user', parts: [{ text: user }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      ...(config.maxTokens ? { maxOutputTokens: config.maxTokens } : {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  }
}

/** 用服務帳戶串流呼叫 Vertex AI：逐段回傳解析好的回應（SSE 的 data: 行） */
export async function* streamVertexService(sa: ServiceAccount, config: ProviderConfig, body: unknown, signal?: AbortSignal): AsyncGenerator<GeminiChunk> {
  const token = await vertexAccessToken(sa, signal)
  const res = await fetch(vertexModelUrl(sa, config.region, config.model, 'streamGenerateContent'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    if (res.status === 401) tokens.delete(sa.client_email)
    throw new Error(`Vertex AI 回應 ${res.status}：${text.slice(0, 300)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (value) buf += decoder.decode(value, { stream: true })
    // 一個事件以空行結束；每行 data: 後面是一段 JSON
    let i: number
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const event = buf.slice(0, i)
      buf = buf.slice(buf.slice(i).match(/^\r?\n\r?\n/)![0].length + i)
      const data = event.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
      if (data) yield JSON.parse(data) as GeminiChunk
    }
    if (done) break
  }
  const rest = buf.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
  if (rest) yield JSON.parse(rest) as GeminiChunk
}

/**
 * 用服務帳戶列出 Vertex AI 上 Google 的 Gemini 模型（Model Garden 的 publishers/google/models，只收 OAuth，不收 API key）。
 * 回傳模型名稱（例如 gemini-2.5-flash），最多翻 5 頁
 */
export async function listVertexModels(sa: ServiceAccount, region?: string, signal?: AbortSignal): Promise<string[]> {
  const token = await vertexAccessToken(sa, signal)
  const r = region?.trim() || VERTEX_DEFAULT_REGION
  const host = r === 'global' ? 'https://aiplatform.googleapis.com' : `https://${r}-aiplatform.googleapis.com`
  const ids = new Set<string>()
  let page = ''
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${host}/v1beta1/publishers/google/models?pageSize=100${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': sa.project_id },
      signal,
    })
    if (!res.ok) throw new Error(`已經換到 access token，但列不出模型（${res.status}）：${(await res.text()).slice(0, 200)}。可以直接輸入模型名稱，再按「測試連線」`)
    const data = (await res.json()) as { publisherModels?: { name?: string }[]; nextPageToken?: string }
    for (const m of data.publisherModels ?? []) {
      const id = m.name?.split('/').pop()
      if (id && /^gemini/.test(id)) ids.add(id)
    }
    if (!data.nextPageToken) break
    page = data.nextPageToken
  }
  return [...ids]
}
