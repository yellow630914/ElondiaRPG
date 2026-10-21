// 插圖生成：服務的模板（ChatGPT、NovelAI、ComfyUI）、角色形象插圖的提示詞、Danbooru 標籤轉換的提示詞。
// 送出請求的程式在 imageProviders.ts；設定存在瀏覽器（stores/image.ts），見 docs/PORTRAITS.md。

import { className, genderName, raceName } from '@/engine/data'
import { gearName } from '@/engine/gear'
import { npcRecord, npcTitle } from '@/engine/npcs'
import type { GameState } from '@/engine/types'
import type { Prompt } from './prompt'

export type ImageServiceId = 'openai' | 'novelai' | 'comfyui'

/** 一個生圖服務的設定（每個服務各自保存，切換服務不會弄丟 key） */
export interface ImageServiceConfig {
  apiKey: string
  baseURL: string
  /** OpenAI：模型；NovelAI：模型（ComfyUI 的模型與參數改放在設定組合裡，見 comfy.ts；這裡的舊值只用來轉換） */
  model: string
  width: number
  height: number
  steps: number
  /** CFG（提示詞的影響力） */
  scale: number
  sampler: string
  /** 負面提示詞（OpenAI 不支援） */
  negative: string
  /** 舊版 ComfyUI 的工作流程（升級時轉成設定組合） */
  workflow: string
  /** 額外的請求參數（JSON，合併進請求；NovelAI 合併進 parameters） */
  extra: string
}

export interface ImageServiceInfo {
  id: ImageServiceId
  name: string
  /** 預設的設定 */
  defaults: Omit<ImageServiceConfig, 'apiKey'>
  keyOptional?: boolean
  /** 這個服務適合 Danbooru 標籤（預設勾選轉換） */
  danbooru: boolean
  /** 設定畫面的說明 */
  note: string
  /** 可以選的尺寸（寬 × 高） */
  sizes: [number, number][]
}

export const NEGATIVE = 'lowres, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, jpeg artifacts, text, signature, watermark, username, blurry'

/** ComfyUI 的預設工作流程（API 格式）：一般的文生圖。代號會換成設定與提示詞 */
export const DEFAULT_COMFY_WORKFLOW = JSON.stringify({
  3: {
    class_type: 'KSampler',
    inputs: {
      seed: '%seed%', steps: '%steps%', cfg: '%scale%', sampler_name: '%sampler%', scheduler: 'normal', denoise: 1,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
  4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '%model%' } },
  5: { class_type: 'EmptyLatentImage', inputs: { width: '%width%', height: '%height%', batch_size: 1 } },
  6: { class_type: 'CLIPTextEncode', inputs: { text: '%prompt%', clip: ['4', 1] } },
  7: { class_type: 'CLIPTextEncode', inputs: { text: '%negative%', clip: ['4', 1] } },
  8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  9: { class_type: 'SaveImage', inputs: { filename_prefix: 'elondia', images: ['8', 0] } },
}, null, 2)

export const IMAGE_SERVICES: ImageServiceInfo[] = [
  {
    id: 'openai',
    name: 'ChatGPT（OpenAI 圖片 API）',
    defaults: { baseURL: 'https://api.openai.com/v1', model: 'gpt-image-1', width: 1024, height: 1536, steps: 0, scale: 0, sampler: '', negative: '', workflow: '', extra: '' },
    danbooru: false,
    note: '用 OpenAI 的 /images/generations。看得懂一般的句子描述（不需要 Danbooru 標籤）；不支援負面提示詞。也可以填相容的服務網址。',
    sizes: [[1024, 1536], [1024, 1024], [1536, 1024]],
  },
  {
    id: 'novelai',
    name: 'NovelAI',
    defaults: {
      baseURL: 'https://image.novelai.net', model: 'nai-diffusion-4-5-full', width: 832, height: 1216, steps: 28, scale: 5,
      sampler: 'k_euler_ancestral', negative: NEGATIVE, workflow: '', extra: '',
    },
    danbooru: true,
    note: '用 NovelAI 的 /ai/generate-image（key 是帳號設定裡的 Persistent API Token）。動漫模型只看得懂 Danbooru 標籤，建議勾選標籤轉換。瀏覽器直接呼叫被擋（CORS）時，把網址換成自己的轉送代理。',
    sizes: [[832, 1216], [1024, 1024], [1216, 832]],
  },
  {
    id: 'comfyui',
    name: 'ComfyUI（自架）',
    defaults: {
      baseURL: 'http://127.0.0.1:8188', model: 'model.safetensors', width: 832, height: 1216, steps: 28, scale: 6,
      sampler: 'euler_ancestral', negative: NEGATIVE, workflow: DEFAULT_COMFY_WORKFLOW, extra: '',
    },
    keyOptional: true,
    danbooru: true,
    note: '送出工作流程到 /prompt，等算完再下載圖片。ComfyUI 啟動時要加 --enable-cors-header。每個主模存成一組設定：Checkpoint 或 UNet（模型、文字編碼器、VAE 分開載入）模式只用 ComfyUI 內建的節點，可以加多個 LoRA 與高解析修復；也可以貼上自己的工作流程。按「讀取 ComfyUI 清單」可以直接選伺服器上的檔案，「從工作流程匯入」可以把跑得動的工作流程變成一組設定。',
    sizes: [[832, 1216], [1024, 1024], [1216, 832], [512, 768]],
  },
]

export function imageServiceInfo(id: ImageServiceId): ImageServiceInfo {
  return IMAGE_SERVICES.find((s) => s.id === id) ?? IMAGE_SERVICES[0]!
}

// ---- 角色形象插圖的提示詞 ----

/** 畫一個角色需要的資料 */
export interface PortraitSubject {
  id: string
  name: string
  gender: string
  race: string
  /** 職業或身分 */
  role: string
  level?: number
  appearance: string
  personality: string
  background: string
  gear: string[]
}

/** 隊伍成員或登場過的 NPC 的形象資料 */
export function portraitSubject(state: GameState, id: string): PortraitSubject | undefined {
  const m = state.party.find((x) => x.id === id)
  const rec = npcRecord(state, id)
  if (!m && !rec) return undefined
  const gender = m?.gender ?? rec?.gender
  // 主角的性別是自由輸入的文字；NPC 是性別 id
  const genderText = !gender ? '' : m?.isPlayer ? gender : genderName(gender)
  const gear = m ? Object.values(m.gear ?? {}).map((g) => g?.name).filter((n): n is string => !!n)
    : Object.values(rec?.character?.gear ?? {}).map((g) => g?.name).filter((n): n is string => !!n)
  const defGear = !gear.length && rec?.gear ? Object.values(rec.gear).filter((g) => !!g).map((g) => gearName(g!)) : []
  return {
    id,
    name: m?.name ?? rec!.name,
    gender: genderText,
    race: raceName(m?.race ?? rec!.race),
    role: m ? className(m.class) : npcTitle(rec!),
    level: m?.level ?? rec?.level,
    appearance: m?.appearance ?? rec?.appearance ?? '',
    personality: m?.personality ?? rec?.personality ?? '',
    background: m?.background ?? rec?.background ?? '',
    gear: [...gear, ...defGear],
  }
}

/** 預設的形象插圖提示詞（{代號} 會換成角色的資料；值是空的那一行整行拿掉） */
export const DEFAULT_PORTRAIT_TEMPLATE = [
  'A single-character portrait illustration for a fantasy role-playing game.',
  'Character: {name}, {gender} {race}, {role}.',
  'Appearance: {appearance}',
  'Outfit and equipment: {gear}',
  'Personality, shown through expression and pose: {personality}',
  'Background story hints: {background}',
  'Composition: upper body, facing the viewer, simple softly lit fantasy background, only one person, no text, no watermark.',
  'Art style: {style}',
].join('\n')

export const DEFAULT_STYLE = 'detailed anime-style fantasy illustration, painterly shading, soft lighting'

/** 把模板的代號換成角色的資料 */
export function portraitPrompt(subject: PortraitSubject, template: string, style: string): string {
  const values: Record<string, string> = {
    name: subject.name, gender: subject.gender, race: subject.race, role: subject.role,
    level: subject.level ? String(subject.level) : '', appearance: subject.appearance, personality: subject.personality,
    background: subject.background.slice(0, 200), gear: subject.gear.join('、'), style,
  }
  return template
    .split('\n')
    // 只有空值的代號：整行拿掉；有內容的照填
    .filter((line) => { const keys = [...line.matchAll(/\{(\w+)\}/g)].map((x) => x[1]!); return !keys.length || keys.some((k) => (values[k] ?? '').trim()) })
    .map((line) => line.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? ''))
    .map((line) => line.replace(/ {2,}/g, ' ').replace(/,\s*,/g, ',').replace(/\s+([,.])/g, '$1').trim())
    .filter(Boolean)
    .join('\n')
}

// ---- Danbooru 標籤 ----

/** 預設的標籤轉換指示（交給大語言模型） */
export const DEFAULT_TAG_INSTRUCTIONS = [
  '你是 AI 繪圖提示詞的轉換器。把使用者給的角色形象描述轉成 Danbooru 標籤格式的提示詞，給動漫風格的生圖模型（NovelAI、Stable Diffusion 的動漫模型等）使用。',
  '規則：',
  '1. 只輸出一行英文標籤，用「, 」分隔；不要任何說明、編號、引號或程式碼框。',
  '2. 順序：人數與性別（1girl、1boy、1other……）→ 外貌（髮色、髮型、眼睛顏色、膚色、體型、種族特徵，例如 pointy ears、cat ears、animal ears、tail、horns）→ 服裝與裝備 → 表情與姿勢 → 構圖（upper body、looking at viewer）→ 背景 → 畫質（masterpiece, best quality, very aesthetic）。',
  '3. 只用 Danbooru 上實際存在的標籤，空格不要換成底線；描述沒寫到的細節可以依角色設定合理補上，不要和描述衝突。',
  '4. 不要寫出角色名字或作品名稱。',
  '5. 大約 20～40 個標籤。',
].join('\n')

/** 交給大語言模型的轉換請求 */
export function tagPrompt(semantic: string, instructions: string, adult: boolean): Prompt {
  const safety = adult ? '' : '\n6. 不要加入裸露、性暗示或血腥的標籤。'
  return { system: `${instructions.trim()}${safety}`, user: `角色形象描述：\n${semantic}` }
}

/** 整理模型回傳的標籤：拿掉程式碼框與說明，換行改成逗號，去掉重複 */
export function cleanTags(text: string): string {
  const body = text
    .replace(/```[a-z]*\n?/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(tags?|標籤|prompt)\s*[:：]?$/i.test(l))
    .join(', ')
    .replace(/^(tags?|prompt|標籤)\s*[:：]\s*/i, '')
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of body.split(/[,，、]/)) {
    const t = raw.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ')
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    tags.push(t)
  }
  return tags.join(', ')
}
