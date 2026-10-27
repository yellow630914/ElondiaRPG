import { describe, expect, it, vi } from 'vitest'

const made: unknown[] = []
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(opts: unknown) {
      made.push(opts)
    }
    models = {
      async generateContentStream() {
        return (async function* () {
          yield { candidates: [{ content: { parts: [{ text: '你好' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } }
        })()
      },
    }
  },
}))

describe('Vertex AI with an API key', () => {
  it('uses the Gemini SDK in Vertex mode', async () => {
    const { completeText } = await import('@/narrator/providers')
    let usage: unknown
    const text = await completeText('vertex', { apiKey: 'key', model: 'gemini-2.5-flash' }, { system: 's', user: 'u' }, undefined, (u) => (usage = u))
    expect(text).toBe('你好')
    expect(usage).toEqual({ input: 3, output: 1, cached: 0 })
    expect(made.at(-1)).toEqual({ apiKey: 'key', vertexai: true })
    await completeText('gemini', { apiKey: 'key', model: 'gemini-flash-latest' }, { system: 's', user: 'u' })
    expect(made.at(-1)).toEqual({ apiKey: 'key' })
  })

  it('cannot list models with the key', async () => {
    const { listModels } = await import('@/narrator/providers')
    await expect(listModels('vertex', { apiKey: 'key', model: '' })).rejects.toThrow('直接輸入模型名稱')
  })
})
