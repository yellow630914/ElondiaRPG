// 連不上 AI 服務時的說明（narrator/connectionHint.ts）
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectionHint, explainConnection, isConnectionError } from '@/narrator/connectionHint'

afterEach(() => vi.unstubAllGlobals())

describe('connection hints', () => {
  it('recognises "could not connect" errors from the SDKs and browsers, not errors the service returned', () => {
    for (const m of ['Connection error.', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed', 'net::ERR_CONNECTION_REFUSED']) {
      expect(isConnectionError(new Error(m)), m).toBe(true)
    }
    for (const m of ['401 Incorrect API key provided', '404 model not found', 'Request timed out.', '請先在設定中選擇模型']) {
      expect(isConnectionError(new Error(m)), m).toBe(false)
    }
  })

  it('explains a local proxy: is it running, the port, CORS and the local network permission', () => {
    const t = connectionHint('openai_compatible', { baseURL: 'http://127.0.0.1:3066/v1' }, 'https:')
    expect(t).toContain('連不上 127.0.0.1:3066')
    expect(t).toContain('服務已經啟動')
    expect(t).toContain('CORS')
    expect(t).toContain('允許存取區域網路上的裝置')
    expect(t).toContain('F12')
    for (const host of ['http://localhost:5001/v1', 'http://192.168.1.20:8080/v1', 'http://10.0.0.5/v1', 'http://172.20.0.2:3000/v1']) {
      expect(connectionHint('openai_compatible', { baseURL: host }, 'https:'), host).toContain('服務已經啟動')
    }
  })

  it('explains mixed content, remote services, official services and a malformed URL', () => {
    expect(connectionHint('openai_compatible', { baseURL: 'http://my-proxy.example.com/v1' }, 'https:')).toContain('混合內容')
    // 本機版（http 網頁）連 http 的服務不是混合內容
    expect(connectionHint('openai_compatible', { baseURL: 'http://my-proxy.example.com/v1' }, 'http:')).not.toContain('混合內容')
    expect(connectionHint('openai_compatible', { baseURL: 'https://api.example.com/v1' }, 'https:')).toContain('轉送代理')
    expect(connectionHint('anthropic', {}, 'https:')).toContain('連不上 Anthropic')
    expect(connectionHint('openai_compatible', { baseURL: '127.0.0.1:3066' }, 'https:')).toContain('Base URL 的格式不對')
  })

  it('keeps the original message, and leaves other errors alone', () => {
    const e = explainConnection(new Error('Connection error.'), 'openai_compatible', { baseURL: 'http://127.0.0.1:3066/v1' }, 'https:') as Error
    expect(e.message).toMatch(/^連不上 127\.0\.0\.1:3066：/)
    expect(e.message).toContain('（原本的錯誤：Connection error.）')
    const other = new Error('401 Unauthorized')
    expect(explainConnection(other, 'openai', {})).toBe(other)
  })

  it('shows the hint when the real SDK cannot reach a local proxy (listing models and writing)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const { listModels, streamNarration } = await import('@/narrator/providers')
    const config = { apiKey: 'x', model: 'm', baseURL: 'http://127.0.0.1:3066/v1' }
    await expect(listModels('openai_compatible', config)).rejects.toThrow(/連不上 127\.0\.0\.1:3066.*CORS/)
    const run = async () => { for await (const _ of streamNarration('openai_compatible', config, { system: 's', user: 'u' })) void _ }
    await expect(run()).rejects.toThrow(/連不上 127\.0\.0\.1:3066/)
  }, 30_000)

  it('a Base URL without http:// explains the format instead of an English URL error or an empty host', () => {
    for (const u of ['127.0.0.1:3066/v1', 'localhost:3066/v1', 'http//127.0.0.1:3066/v1']) {
      expect(connectionHint('openai_compatible', { baseURL: u }, 'https:'), u).toContain('開頭要有 http:// 或 https://')
      const e = explainConnection(new TypeError("Failed to construct 'URL': Invalid URL"), 'openai_compatible', { baseURL: u }) as Error
      expect(e.message, u).toContain('開頭要有 http:// 或 https://')
      expect(e.message).toContain('原本的錯誤')
    }
    // 前後的空白照常可以用
    expect(connectionHint('openai_compatible', { baseURL: ' http://127.0.0.1:3066/v1' }, 'https:')).toContain('連不上 127.0.0.1:3066')
    // 網址正確時，服務回的錯誤照原樣
    const other = new Error('401 Incorrect API key provided')
    expect(explainConnection(other, 'openai_compatible', { baseURL: 'http://127.0.0.1:3066/v1' })).toBe(other)
  })
})
