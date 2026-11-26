// MOSS-Image 的版面 JSON（docs/PORTRAITS.md 第 5.1 節）。
// AI 只寫「相對版面」：整張圖的描述、每個框佔畫面的百分比（x、y 各 0～100，原點在左上）；
// 程式依這一遍的畫布換算成 MOSS 要的座標（原點在畫面中心、單位是像素、[y1, x1, y2, x2]），
// 高解析修復的第二遍換成放大後的畫布再算一次。AI 沒給框、給錯（超出範圍、左右寫反、太小）時由這裡修正。

export type LayoutLabel = 'character' | 'object' | 'text'
export const LAYOUT_LABELS: LayoutLabel[] = ['character', 'object', 'text']

/** 一個框：x、y 是佔畫面的範圍（百分比，原點在左上） */
export interface LayoutItem {
  label: LayoutLabel
  caption: string
  x: [number, number]
  y: [number, number]
  /** label 是 text 時要畫出來的字 */
  text?: string
}

/** 相對版面（AI 寫的、程式組的；送出前換算成 MOSS 的版面 JSON） */
export interface RelativeLayout {
  /** 整張圖的描述（畫風、場景、鏡頭、光線、配色；人物細節寫在框裡） */
  caption: string
  items: LayoutItem[]
  /** 這張圖專屬的負面提示詞（接在設定組合的負面提示詞後面） */
  negative?: string
}

/** 最多幾個框 */
export const LAYOUT_MAX_ITEMS = 24
/** 框的最小邊長（百分比） */
const MIN_SPAN = 3

const clamp = (v: number) => Math.min(100, Math.max(0, v))
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** 一段範圍：[a, b]、"35-65"、"35–65%"；0～1 的小數當比例 */
function span(v: unknown, ratio: boolean): [number, number] | undefined {
  let pair: unknown[] | undefined
  if (Array.isArray(v)) pair = v
  else if (typeof v === 'string') pair = v.replace(/%/g, '').split(/\s*[-–~～,，]\s*/)
  if (!pair || pair.length < 2) return undefined
  let [a, b] = [Number(pair[0]), Number(pair[1])]
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined
  if (ratio) [a, b] = [a * 100, b * 100]
  ;[a, b] = [clamp(Math.min(a, b)), clamp(Math.max(a, b))]
  // 太窄的框撐開到最小邊長（以中心為準，不超出畫面）
  if (b - a < MIN_SPAN) {
    const mid = Math.min(100 - MIN_SPAN / 2, Math.max(MIN_SPAN / 2, (a + b) / 2))
    ;[a, b] = [mid - MIN_SPAN / 2, mid + MIN_SPAN / 2]
  }
  return [Math.round(a * 10) / 10, Math.round(b * 10) / 10]
}

/** 從 AI 的回覆裡挑出 JSON 物件（容忍程式碼框與前後的說明） */
function jsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const v = JSON.parse(text.slice(start, end + 1)) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** 整理一個框：x、y 各一段範圍，或 box: [x1, y1, x2, y2]；數字都不超過 1 時當成比例 */
export function sanitizeItem(raw: unknown): LayoutItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const caption = str(r.caption ?? r.prompt ?? r.description, 1200)
  if (!caption) return undefined
  const box = Array.isArray(r.box) && r.box.length >= 4 ? r.box.map(Number) : undefined
  const nums = box ?? [...(Array.isArray(r.x) ? r.x : []), ...(Array.isArray(r.y) ? r.y : [])].map(Number)
  const ratio = nums.length >= 4 && nums.every((n) => Number.isFinite(n) && Math.abs(n) <= 1)
  const x = box ? span([box[0], box[2]], ratio) : span(r.x, ratio)
  const y = box ? span([box[1], box[3]], ratio) : span(r.y, ratio)
  if (!x || !y) return undefined
  const text = str(r.text, 60)
  let label: LayoutLabel = LAYOUT_LABELS.includes(r.label as LayoutLabel) ? r.label as LayoutLabel : 'object'
  // 文字框一定要有字；沒寫字的當成一般物件
  if (label === 'text' && !text) label = 'object'
  return { label, caption, x, y, ...(label === 'text' ? { text } : {}) }
}

/**
 * 讀相對版面：AI 的回覆（JSON）或程式組好的 JSON。不是 JSON 時整段當成描述、沒有框
 * （例如設定組合是 MOSS、預處理卻選了 Danbooru 標籤）。
 */
export function parseLayout(text: string): RelativeLayout {
  const o = jsonObject(text)
  if (!o) return { caption: text.trim(), items: [] }
  // 也接受 MOSS 原本的寫法（summary.caption）
  const summary = o.summary && typeof o.summary === 'object' ? (o.summary as Record<string, unknown>).caption : undefined
  const caption = str(o.caption ?? summary ?? o.prompt, 8000)
  const items = (Array.isArray(o.items) ? o.items : []).map(sanitizeItem).filter((x): x is LayoutItem => !!x).slice(0, LAYOUT_MAX_ITEMS)
  const negative = Array.isArray(o.negative) ? o.negative.filter((x) => typeof x === 'string').join(', ') : str(o.negative, 1000)
  if (!caption && !items.length) return { caption: text.trim(), items: [] }
  return { caption, items, ...(negative ? { negative } : {}) }
}

/** 相對版面寫成文字（存在形象圖、插圖的紀錄裡，送出前再換算） */
export function layoutText(l: RelativeLayout): string {
  return JSON.stringify({ caption: l.caption, items: l.items, ...(l.negative ? { negative: l.negative } : {}) })
}

/** 換算成 MOSS 的版面 JSON：畫布 width × height，prefix（固定前綴、LoRA 觸發詞）接在描述前面 */
export function mossLayoutJson(l: RelativeLayout, width: number, height: number, prefix = ''): string {
  const px = (pct: number, size: number) => Math.round((pct / 100) * size - size / 2)
  const caption = [prefix.trim().replace(/[,，\s]+$/, ''), l.caption.trim()].filter(Boolean).join(', ')
  return JSON.stringify({
    summary: { meta: ['illustration'], canvas: 'single', caption },
    items: l.items.map((it) => ({
      label: it.label,
      caption: it.caption,
      ...(it.label === 'text' && it.text ? { text: it.text } : {}),
      bbox: [px(it.y[0], height), px(it.x[0], width), px(it.y[1], height), px(it.x[1], width)],
    })),
    bbox_coord_space: 'abs_centralized',
    bbox_format: 'yxyx',
  })
}

// ---- 沒有框時的預設框 ----

export type ShotSize = 'upper body' | 'cowboy shot' | 'full body'

/** 單人形象圖：依構圖的人物框 */
export function portraitBox(shot: ShotSize): Pick<LayoutItem, 'x' | 'y'> {
  if (shot === 'full body') return { x: [28, 72], y: [3, 97] }
  if (shot === 'cowboy shot') return { x: [20, 80], y: [3, 100] }
  return { x: [12, 88], y: [5, 100] }
}

/** 場景裡站在左、中、右的人（幾個人一起看，不讓框大面積重疊） */
export function positionBox(position: 'left' | 'center' | 'right', count: number): Pick<LayoutItem, 'x' | 'y'> {
  const y: [number, number] = count >= 3 ? [15, 98] : [8, 100]
  if (count <= 1) return { x: [25, 75], y }
  if (position === 'left') return { x: [4, count >= 3 ? 36 : 50], y }
  if (position === 'right') return { x: [count >= 3 ? 64 : 50, 96], y }
  return { x: [32, 68], y }
}
