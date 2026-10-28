import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { createPinia, setActivePinia } from 'pinia'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import {
  BUILTIN_PREPROCESSORS, cleanPreprocessed, cleanTags, DEFAULT_COMFY_WORKFLOW, DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_TAG_INSTRUCTIONS, IMAGE_SERVICES,
  portraitPrompt, portraitSubject, preprocessPrompt,
  type ImageServiceConfig, type ImageServiceId,
} from '@/narrator/imageInfo'
import { fillWorkflow, firstZipEntry, generateImage, novelAIBody, openAIBody } from '@/narrator/imageProviders'
import { useGame } from '@/stores/game'
import { useImageSettings } from '@/stores/image'
import { portraitKey, usePortraits } from '@/stores/portraits'

const cfg = (id: ImageServiceId, patch: Partial<ImageServiceConfig> = {}): ImageServiceConfig =>
  ({ apiKey: 'k', ...IMAGE_SERVICES.find((s) => s.id === id)!.defaults, ...patch })

function game() {
  const state = newGame({ name: '艾倫', race: 'elf', classId: 'ranger', seed: 21, gender: '女性', appearance: '銀色長髮，綠色眼睛' } as never)
  enterLocation(state)
  return state
}

/** 做一個只有一個檔案的 ZIP（method 0 不壓縮、8 deflate） */
function zip(data: Uint8Array, method: 0 | 8): Uint8Array {
  const body = method === 8 ? new Uint8Array(deflateRawSync(data)) : data
  const name = new TextEncoder().encode('image_0.png')
  const local = new Uint8Array(30 + name.length)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(8, method, true)
  lv.setUint16(26, name.length, true)
  local.set(name, 30)
  const cd = new Uint8Array(46 + name.length)
  const cv = new DataView(cd.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(10, method, true)
  cv.setUint32(20, body.length, true)
  cv.setUint32(24, data.length, true)
  cv.setUint16(28, name.length, true)
  cv.setUint32(42, 0, true)
  cd.set(name, 46)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint32(16, local.length + body.length, true)
  const out = new Uint8Array(local.length + body.length + cd.length + eocd.length)
  out.set(local, 0)
  out.set(body, local.length)
  out.set(cd, local.length + body.length)
  out.set(eocd, local.length + body.length + cd.length)
  return out
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('portrait prompts', () => {
  it('describes a party member and drops lines with nothing to say', () => {
    const state = game()
    const subject = portraitSubject(state, 'pc')!
    expect(subject).toMatchObject({ name: '艾倫', gender: '女性', race: '精靈', appearance: '銀色長髮，綠色眼睛' })
    expect(subject.gear.length).toBeGreaterThan(0)
    const text = portraitPrompt({ ...subject, personality: '', background: '' }, DEFAULT_PORTRAIT_TEMPLATE, 'watercolor')
    expect(text).toContain('Character: 艾倫, 女性 精靈')
    expect(text).toContain('Appearance: 銀色長髮，綠色眼睛')
    expect(text).toContain('Art style: watercolor')
    expect(text).not.toContain('Personality')
    expect(text).not.toContain('{')
    // 沒有刺青時整行拿掉；有刺青時寫出部位、名稱與外觀
    expect(text).not.toContain('Tattoos')
    const inked = portraitPrompt({ ...subject, tattoos: ['左手臂：荊棘之環（纏繞手臂的黑色荊棘）'] }, DEFAULT_PORTRAIT_TEMPLATE, 'watercolor')
    expect(inked).toContain('Tattoos and marks: 左手臂：荊棘之環（纏繞手臂的黑色荊棘）')
    state.party[0]!.tattoos = [{ kind: 'plain', place: 'left_arm', name: '荊棘之環', desc: '纏繞手臂的黑色荊棘', since: { ...state.time } } as never]
    expect(portraitSubject(state, 'pc')!.tattoos).toEqual([expect.stringContaining('荊棘之環（纏繞手臂的黑色荊棘）')])
  })

  it('describes a fixed NPC too', () => {
    const state = game()
    expect(portraitSubject(state, 'npc_selene')).toMatchObject({ name: '瑟琳' })
    expect(portraitSubject(state, 'nobody')).toBeUndefined()
  })

  it('preprocesses the description with the chosen instructions and cleans the answer', () => {
    const p = preprocessPrompt('a girl', '轉成標籤')
    expect(p.system).toBe('轉成標籤')
    expect(p.user).toContain('a girl')
    expect(cleanTags('```\nTags: 1girl, long hair，silver hair\nlong hair, "green eyes"\n```')).toBe('1girl, long hair, silver hair, green eyes')
    expect(cleanPreprocessed('```\nTags: 1girl, long hair\n```', 'tags')).toBe('1girl, long hair')
    // 原樣送出：只拿掉程式碼框，JSON 保持原樣
    expect(cleanPreprocessed('```json\n{"subject": "1girl"}\n```', 'text')).toBe('{"subject": "1girl"}')
    expect(BUILTIN_PREPROCESSORS.map((b) => b.id)).toEqual(['danbooru', 'english', 'json'])
  })
})

describe('image services', () => {
  it('fills a ComfyUI workflow, keeping numbers as numbers', () => {
    const wf = fillWorkflow(DEFAULT_COMFY_WORKFLOW, { prompt: '1girl, "elf"', negative: 'lowres', width: 832, height: 1216, seed: 7, steps: 20, scale: 6, sampler: 'euler', model: 'x.safetensors' })
    expect((wf['6'] as { inputs: { text: string } }).inputs.text).toBe('1girl, "elf"')
    expect((wf['5'] as { inputs: { width: number } }).inputs.width).toBe(832)
    expect((wf['3'] as { inputs: { seed: number; cfg: number } }).inputs).toMatchObject({ seed: 7, cfg: 6 })
    expect(() => fillWorkflow('{oops', {})).toThrow('JSON')
  })

  it('reads the image out of a NovelAI ZIP, stored or deflated', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8])
    for (const method of [0, 8] as const) {
      const blob = await firstZipEntry(zip(png, method))
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png)
    }
  })

  it('builds OpenAI and NovelAI requests with the size, negative prompt and extra parameters', () => {
    expect(openAIBody(cfg('openai', { extra: '{"quality":"high"}' }), { prompt: 'p' })).toEqual({ model: 'gpt-image-1', prompt: 'p', size: '1024x1536', n: 1, quality: 'high' })
    expect(() => openAIBody(cfg('openai', { extra: '[1]' }), { prompt: 'p' })).toThrow('JSON 物件')
    const nai = novelAIBody(cfg('novelai'), { prompt: '1girl', seed: 3 }) as { input: string; parameters: Record<string, unknown> }
    expect(nai.input).toBe('1girl')
    expect(nai.parameters).toMatchObject({ width: 832, height: 1216, seed: 3, sampler: 'k_euler_ancestral' })
    expect(nai.parameters.v4_prompt).toEqual({ caption: { base_caption: '1girl', char_captions: [] }, use_coords: false, use_order: true })
  })

  it('gets an image from OpenAI (base64)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: btoa('PNG!') }] }), { status: 200 }))
    const blob = await generateImage('openai', cfg('openai'), { prompt: 'a knight' })
    expect(await blob.text()).toBe('PNG!')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.openai.com/v1/images/generations')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer k')
  })

  it('queues a ComfyUI workflow, waits for it and downloads the result', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    let polls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/prompt')) return new Response(JSON.stringify({ prompt_id: 'abc' }))
      if (url.includes('/history/')) {
        polls++
        return new Response(JSON.stringify(polls < 2 ? {} : { abc: { outputs: { 9: { images: [{ filename: 'elondia_1.png', subfolder: '', type: 'output' }] } } } }))
      }
      return new Response(new Blob(['IMG']))
    })
    const p = generateImage('comfyui', cfg('comfyui'), { prompt: '1girl', seed: 1, check: false })
    await vi.advanceTimersByTimeAsync(4000)
    const blob = await p
    expect(await blob.text()).toBe('IMG')
    expect(calls[0]).toBe('http://127.0.0.1:8188/prompt')
    expect(calls.at(-1)).toContain('/view?filename=elondia_1.png')
  })
})

describe('portrait store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('says what is missing before generating', async () => {
    const g = useGame()
    g.state = game()
    const portraits = usePortraits()
    useImageSettings().service = 'openai'
    await portraits.generate(g.state, 'pc')
    const job = portraits.jobs[portraitKey(g.state, 'pc')]
    expect(job?.stage).toBe('error')
    expect(job?.error).toContain('還沒設定好')
    expect(job?.semantic).toContain('艾倫')
  })
})

describe('image prompt preprocessing settings', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to Danbooru tags for NovelAI and ComfyUI only', () => {
    const image = useImageSettings()
    expect(image.preprocess).toMatchObject({ openai: '', novelai: 'danbooru', comfyui: 'danbooru' })
    image.service = 'openai'
    expect(image.preprocessorFor()).toBeUndefined()
    expect(image.preprocessorFor('novelai')?.name).toBe('Danbooru 標籤')
  })

  it('migrates the old Danbooru checkbox and edited instructions', () => {
    localStorage.setItem('elondia.image', JSON.stringify({ danbooru: { openai: true, novelai: false } }))
    let image = useImageSettings()
    expect(image.preprocess).toMatchObject({ openai: 'danbooru', novelai: '', comfyui: 'danbooru' })
    expect(image.preprocessors).toEqual([])

    localStorage.setItem('elondia.image', JSON.stringify({ danbooru: { novelai: true }, tagInstructions: '只輸出 JSON' }))
    setActivePinia(createPinia())
    image = useImageSettings()
    expect(image.preprocessors).toEqual([{ id: 'c-legacy', name: 'Danbooru 標籤（自訂）', instructions: '只輸出 JSON', output: 'tags' }])
    expect(image.preprocess.novelai).toBe('c-legacy')
    // 沒改過的指示不另外建一份
    localStorage.setItem('elondia.image', JSON.stringify({ danbooru: { novelai: true }, tagInstructions: DEFAULT_TAG_INSTRUCTIONS }))
    setActivePinia(createPinia())
    expect(useImageSettings().preprocessors).toEqual([])
  })

  it('adds, copies and removes custom instructions', async () => {
    const image = useImageSettings()
    image.service = 'comfyui'
    const copy = image.addPreprocessor(image.preprocessorFor())
    expect(copy).toMatchObject({ id: 'c-1', name: 'Danbooru 標籤（自訂）', output: 'tags' })
    expect(image.preprocess.comfyui).toBe('c-1')
    image.service = 'openai'
    const fresh = image.addPreprocessor()
    fresh.name = 'JSON for my model'
    expect(image.preprocess.openai).toBe('c-2')
    await new Promise((r) => setTimeout(r, 0))
    // 存起來，下次讀得回來；不認得的選擇改回預設
    const saved = JSON.parse(localStorage.getItem('elondia.image')!)
    saved.preprocess.novelai = 'gone'
    localStorage.setItem('elondia.image', JSON.stringify(saved))
    setActivePinia(createPinia())
    const again = useImageSettings()
    expect(again.preprocessors.map((p) => p.name)).toEqual(['Danbooru 標籤（自訂）', 'JSON for my model'])
    expect(again.preprocess).toMatchObject({ openai: 'c-2', novelai: 'danbooru', comfyui: 'c-1' })
    again.removePreprocessor('c-1')
    expect(again.preprocess.comfyui).toBe('')
    expect(again.preprocessors.map((p) => p.id)).toEqual(['c-2'])
  })
})
