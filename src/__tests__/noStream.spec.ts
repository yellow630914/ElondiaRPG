// 不用串流傳輸（ProviderConfig.stream = false，或自訂參數寫 "stream": false）：整段收下
import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeText } from '@/narrator/providers'

afterEach(() => vi.unstubAllGlobals())

function stubFetch() {
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    bodies.push(body)
    if (body.stream) {
      const sse = 'data: {"id":"x","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"串流"},"finish_reason":null}]}\n\ndata: [DONE]\n\n'
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 1, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: '整段的回答', reasoning_content: '想了一下' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  return bodies
}

const base = { apiKey: 'k', model: 'm', baseURL: 'https://api.example.com/v1' }
const prompt = { system: 's', user: 'u' }

describe('不用串流傳輸', () => {
  it('設定關掉串流：請求 stream: false，整段收下，思考與用量照樣回報', async () => {
    const bodies = stubFetch()
    const thoughts: string[] = []
    const usage: unknown[] = []
    const text = await completeText('openai_compatible', { ...base, stream: false }, prompt, undefined, (u) => usage.push(u), (t) => thoughts.push(t))
    expect(text).toBe('整段的回答')
    expect(bodies[0]!.stream).toBe(false)
    expect(thoughts).toEqual(['想了一下'])
    expect(usage).toEqual([{ input: 10, output: 5, cached: 0 }])
  })

  it('自訂參數寫 "stream": false 也算（之前會被蓋掉）', async () => {
    const bodies = stubFetch()
    expect(await completeText('openai_compatible', { ...base, extraBody: '{"stream": false, "top_k": 20}' }, prompt)).toBe('整段的回答')
    expect(bodies[0]).toMatchObject({ stream: false, top_k: 20 })
  })

  it('預設照樣串流', async () => {
    const bodies = stubFetch()
    expect(await completeText('openai_compatible', base, prompt)).toBe('串流')
    expect(bodies[0]!.stream).toBe(true)
  })
})
