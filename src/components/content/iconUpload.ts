// 上傳物品圖示：在瀏覽器裡縮到 ICON_PX 以內、存成 PNG 的 data URL（保留透明背景）。
// 小張的像素圖用最近鄰放大到整數倍（不會糊掉），大張的圖平滑縮小。

import { ICON_MAX_CHARS, ICON_PX, sanitizeIcon } from '@/engine/itemIcons'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('讀不了這張圖'))
    }
    img.src = url
  })
}

/** 把圖片檔變成圖示的 data URL；太大或讀不了時丟出錯誤 */
export async function fileToIcon(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔（PNG、WebP、JPG、GIF）')
  const img = await loadImage(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('讀不了這張圖')
  const longest = Math.max(w, h)
  // 小圖：整數倍放大（最近鄰）；大圖：縮到 ICON_PX
  const scale = longest <= ICON_PX / 2 ? Math.floor(ICON_PX / longest) : Math.min(1, ICON_PX / longest)
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('這個瀏覽器不能處理圖片')
  ctx.imageSmoothingEnabled = scale < 1
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, cw, ch)
  let url = canvas.toDataURL('image/png')
  // 照片之類顏色很多的圖 PNG 太大時改用 WebP
  if (url.length > ICON_MAX_CHARS) url = canvas.toDataURL('image/webp', 0.85)
  const clean = sanitizeIcon(url)
  if (!clean) throw new Error('這張圖縮小後還是太大，換一張顏色簡單一點的圖')
  return clean
}

/**
 * 把圖片檔變成背景圖的 data URL（自建地下城）：最長邊縮到 1280 以內、存成 WebP；
 * 還是太大時再縮小、降低品質，最後還是太大就丟出錯誤。
 */
export async function fileToBackground(file: File, maxChars: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔（PNG、WebP、JPG）')
  const img = await loadImage(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('讀不了這張圖')
  for (const [edge, quality] of [[1280, 0.75], [1024, 0.65], [800, 0.6], [640, 0.55]] as const) {
    const scale = Math.min(1, edge / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('這個瀏覽器不能處理圖片')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    let url = canvas.toDataURL('image/webp', quality)
    // 不支援 WebP 的瀏覽器會給 PNG：改用 JPEG
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= maxChars) return url
  }
  throw new Error('這張圖縮小後還是太大，換一張小一點的圖')
}
