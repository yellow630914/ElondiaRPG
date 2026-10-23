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
