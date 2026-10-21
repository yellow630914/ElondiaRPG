// 送出生圖請求：OpenAI（/images/generations）、NovelAI（/ai/generate-image，回傳 ZIP）、ComfyUI（/prompt → /history → /view）。
// 請求直接從瀏覽器送出，key 只存在這個瀏覽器。

import type { ImageServiceConfig, ImageServiceId } from './imageInfo'

export interface ImageRequest {
  prompt: string
  /** 負面提示詞（沒有時用設定的） */
  negative?: string
  seed?: number
  signal?: AbortSignal
}

/** 產生一張圖片 */
export async function generateImage(service: ImageServiceId, cfg: ImageServiceConfig, req: ImageRequest): Promise<Blob> {
  switch (service) {
    case 'openai': return openAIImage(cfg, req)
    case 'novelai': return novelAIImage(cfg, req)
    case 'comfyui': return comfyImage(cfg, req)
  }
}

const trimURL = (u: string) => u.trim().replace(/\/+$/, '')

/** 額外參數（JSON 物件；空白時是空的） */
export function parseExtra(text: string): Record<string, unknown> {
  if (!text.trim()) return {}
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new Error('額外參數不是正確的 JSON')
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('額外參數要是一個 JSON 物件')
  return v as Record<string, unknown>
}

async function failure(res: Response, service: string): Promise<Error> {
  let detail = ''
  try {
    detail = (await res.text()).slice(0, 300)
  } catch {
    // 讀不到內容就算了
  }
  return new Error(`${service} 回應 ${res.status}${detail ? `：${detail}` : ''}`)
}

function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

// ---- OpenAI ----

export function openAIBody(cfg: ImageServiceConfig, req: ImageRequest): Record<string, unknown> {
  return { model: cfg.model, prompt: req.prompt, size: `${cfg.width}x${cfg.height}`, n: 1, ...parseExtra(cfg.extra) }
}

async function openAIImage(cfg: ImageServiceConfig, req: ImageRequest): Promise<Blob> {
  const res = await fetch(`${trimURL(cfg.baseURL || 'https://api.openai.com/v1')}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(openAIBody(cfg, req)),
    signal: req.signal,
  })
  if (!res.ok) throw await failure(res, 'OpenAI')
  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
  const first = data.data?.[0]
  if (first?.b64_json) return base64ToBlob(first.b64_json)
  if (first?.url) {
    const img = await fetch(first.url, { signal: req.signal })
    if (!img.ok) throw await failure(img, 'OpenAI（下載圖片）')
    return img.blob()
  }
  throw new Error('OpenAI 沒有回傳圖片')
}

// ---- NovelAI ----

export function novelAIBody(cfg: ImageServiceConfig, req: ImageRequest): Record<string, unknown> {
  const negative = req.negative ?? cfg.negative
  const seed = req.seed ?? Math.floor(Math.random() * 2 ** 32)
  const v4 = /diffusion-4/.test(cfg.model)
  return {
    input: req.prompt,
    model: cfg.model,
    action: 'generate',
    parameters: {
      params_version: 3, width: cfg.width, height: cfg.height, scale: cfg.scale, sampler: cfg.sampler, steps: cfg.steps,
      n_samples: 1, seed, ucPreset: 0, qualityToggle: true, noise_schedule: 'karras', cfg_rescale: 0,
      negative_prompt: negative,
      ...(v4 ? {
        v4_prompt: { caption: { base_caption: req.prompt, char_captions: [] }, use_coords: false, use_order: true },
        v4_negative_prompt: { caption: { base_caption: negative, char_captions: [] }, legacy_uc: false },
      } : {}),
      ...parseExtra(cfg.extra),
    },
  }
}

async function novelAIImage(cfg: ImageServiceConfig, req: ImageRequest): Promise<Blob> {
  const res = await fetch(`${trimURL(cfg.baseURL || 'https://image.novelai.net')}/ai/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(novelAIBody(cfg, req)),
    signal: req.signal,
  })
  if (!res.ok) throw await failure(res, 'NovelAI')
  const buf = new Uint8Array(await res.arrayBuffer())
  // 回傳的是 ZIP（裡面是 PNG）；有些代理直接回傳圖片
  if (buf[0] === 0x50 && buf[1] === 0x4b) return firstZipEntry(buf)
  return new Blob([buf], { type: res.headers.get('content-type') ?? 'image/png' })
}

/** 取出 ZIP 的第一個檔案（不壓縮或 deflate） */
export async function firstZipEntry(buf: Uint8Array): Promise<Blob> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // 從中央目錄讀大小（本地檔頭可能用資料描述，大小是 0）
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('看不懂回傳的 ZIP')
  const cd = view.getUint32(eocd + 16, true)
  if (view.getUint32(cd, true) !== 0x02014b50) throw new Error('看不懂回傳的 ZIP')
  const method = view.getUint16(cd + 10, true)
  const size = view.getUint32(cd + 20, true)
  const local = view.getUint32(cd + 42, true)
  const nameLen = view.getUint16(local + 26, true)
  const extraLen = view.getUint16(local + 28, true)
  const start = local + 30 + nameLen + extraLen
  const data = buf.slice(start, start + size)
  if (method === 0) return new Blob([data], { type: 'image/png' })
  if (method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Blob([await new Response(stream).arrayBuffer()], { type: 'image/png' })
  }
  throw new Error(`ZIP 的壓縮方式（${method}）不支援`)
}

// ---- ComfyUI ----

/**
 * 把工作流程裡的代號換成值：整個字串就是代號時換成原本的型別（數字就是數字），
 * 字串裡夾著代號時做文字取代。代號：%prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %model%
 */
export function fillWorkflow(workflow: string, vars: Record<string, string | number>): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(workflow)
  } catch {
    throw new Error('ComfyUI 的工作流程不是正確的 JSON')
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const whole = /^%(\w+)%$/.exec(v)
      if (whole && whole[1]! in vars) return vars[whole[1]!]
      return v.replace(/%(\w+)%/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  const out = walk(parsed)
  if (!out || typeof out !== 'object' || Array.isArray(out)) throw new Error('ComfyUI 的工作流程要是 API 格式的 JSON 物件')
  return out as Record<string, unknown>
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    clearTimeout(t)
    reject(new DOMException('已取消', 'AbortError'))
  }, { once: true })
})

async function comfyImage(cfg: ImageServiceConfig, req: ImageRequest): Promise<Blob> {
  const base = trimURL(cfg.baseURL || 'http://127.0.0.1:8188')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) }
  const prompt = fillWorkflow(cfg.workflow, {
    prompt: req.prompt, negative: req.negative ?? cfg.negative, width: cfg.width, height: cfg.height,
    seed: req.seed ?? Math.floor(Math.random() * 2 ** 32), steps: cfg.steps, scale: cfg.scale, sampler: cfg.sampler, model: cfg.model,
  })
  const res = await fetch(`${base}/prompt`, {
    method: 'POST', headers, body: JSON.stringify({ prompt, client_id: 'elondia', ...parseExtra(cfg.extra) }), signal: req.signal,
  })
  if (!res.ok) throw await failure(res, 'ComfyUI')
  const { prompt_id: id } = (await res.json()) as { prompt_id?: string }
  if (!id) throw new Error('ComfyUI 沒有回傳工作編號')
  // 等它算完（最多 10 分鐘）
  for (let i = 0; i < 400; i++) {
    await sleep(1500, req.signal)
    const h = await fetch(`${base}/history/${id}`, { headers, signal: req.signal })
    if (!h.ok) continue
    const hist = (await h.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder?: string; type?: string }[] }>; status?: { status_str?: string } }>
    const entry = hist[id]
    if (!entry) continue
    if (entry.status?.status_str === 'error') throw new Error('ComfyUI 執行工作流程時出錯（看 ComfyUI 的主控台）')
    const image = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])[0]
    if (!image) continue
    const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' })
    const img = await fetch(`${base}/view?${q}`, { headers, signal: req.signal })
    if (!img.ok) throw await failure(img, 'ComfyUI（下載圖片）')
    return img.blob()
  }
  throw new Error('ComfyUI 等太久了（超過 10 分鐘）')
}
