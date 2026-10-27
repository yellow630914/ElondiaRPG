import { afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { clearVertexTokens, parseServiceAccount, signServiceJwt, vertexModelUrl } from '@/narrator/vertexAuth'

// 服務帳戶 JSON（SillyTavern 的 Vertex AI 完整模式）：簽 JWT → 換 access token → 打 REST 串流
const subtle = (globalThis.crypto?.subtle ?? webcrypto.subtle) as SubtleCrypto

async function account() {
  const pair = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const der = Buffer.from(await subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
  const json = JSON.stringify({ type: 'service_account', project_id: 'my-proj', private_key: pem, client_email: 'bot@my-proj.iam.gserviceaccount.com' }, null, 2)
  return { json, publicKey: pair.publicKey }
}

const sse = (chunks: string[]) => new ReadableStream<Uint8Array>({
  start(c) {
    for (const s of chunks) c.enqueue(new TextEncoder().encode(s))
    c.close()
  },
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearVertexTokens()
})

describe('Vertex AI with a service account JSON', () => {
  it('reads the key file and builds the model URL by region', async () => {
    const { json } = await account()
    const sa = parseServiceAccount(json)!
    expect(sa.project_id).toBe('my-proj')
    expect(parseServiceAccount('AIzaSyKey')).toBeUndefined()
    expect(parseServiceAccount('{"foo": 1}')).toBeUndefined()
    expect(vertexModelUrl(sa, undefined, 'gemini-2.5-flash', 'streamGenerateContent'))
      .toBe('https://us-central1-aiplatform.googleapis.com/v1/projects/my-proj/locations/us-central1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse')
    expect(vertexModelUrl(sa, 'global', 'gemini-2.5-pro', 'generateContent'))
      .toBe('https://aiplatform.googleapis.com/v1/projects/my-proj/locations/global/publishers/google/models/gemini-2.5-pro:generateContent')
  })

  it('signs a JWT the token endpoint can verify', async () => {
    const { json, publicKey } = await account()
    const jwt = await signServiceJwt(parseServiceAccount(json)!, 1000)
    const [h, p, s] = jwt.split('.')
    const dec = (x: string) => Buffer.from(x, 'base64url')
    expect(JSON.parse(dec(p!).toString())).toMatchObject({ iss: 'bot@my-proj.iam.gserviceaccount.com', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 })
    expect(await subtle.verify('RSASSA-PKCS1-v1_5', publicKey, dec(s!), new TextEncoder().encode(`${h}.${p}`))).toBe(true)
  })

  it('streams the narration with the access token, reusing the token', async () => {
    const { json } = await account()
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.startsWith('https://oauth2')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
      // 一段事件被切在兩次讀取之間
      return new Response(sse([
        'data: {"candidates":[{"content":{"parts":[{"text":"想一下","thought":true}]}}]}\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":"你',
        '好"}]}}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"thoughtsTokenCount":1}}\r\n\r\n',
      ]))
    })
    const { completeText } = await import('@/narrator/providers')
    let usage: unknown
    const thoughts: string[] = []
    const cfg = { apiKey: json, model: 'gemini-2.5-flash', region: 'global' }
    const text = await completeText('vertex', cfg, { system: '系統', user: '使用者' }, undefined, (u) => (usage = u), (t) => thoughts.push(t))
    expect(text).toBe('你好')
    expect(thoughts).toEqual(['想一下'])
    expect(usage).toEqual({ input: 5, output: 3, cached: 0 })
    const call = calls.find((c) => c.url.includes('aiplatform'))!
    expect(call.url).toContain('/locations/global/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse')
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(call.init.body as string)).toMatchObject({ contents: [{ role: 'user', parts: [{ text: '使用者' }] }], systemInstruction: { parts: [{ text: '系統' }] } })
    await completeText('vertex', cfg, { system: 's', user: 'u' })
    expect(calls.filter((c) => c.url.startsWith('https://oauth2')).length).toBe(1)
  })

  it('reports a token failure instead of calling the model', async () => {
    const { json } = await account()
    vi.stubGlobal('fetch', async () => new Response('invalid_grant', { status: 400 }))
    const { listModels } = await import('@/narrator/providers')
    await expect(listModels('vertex', { apiKey: json, model: '' })).rejects.toThrow('換不到 access token')
  })
})
