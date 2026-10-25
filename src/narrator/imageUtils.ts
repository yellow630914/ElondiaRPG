// 生圖用的小工具：把底圖縮放成要的尺寸、遮罩轉成各服務要的格式、Blob 與 base64 互轉。
// 縮放與遮罩要用瀏覽器的 canvas（測試環境沒有，只測 base64）。

/** Blob 轉成 base64（不含 data: 前綴；NovelAI 的底圖與遮罩這樣送） */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function canvas(w: number, h: number): { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('這個瀏覽器不能處理圖片（沒有 canvas）')
  return { el, ctx }
}

export function canvasBlob(el: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => el.toBlob((b) => (b ? resolve(b) : reject(new Error('轉成圖片失敗'))), 'image/png'))
}

/** 把圖片縮放、裁切成 w × h（填滿，多出來的部分從中間裁掉），轉成 PNG */
export async function fitImage(blob: Blob, w: number, h: number): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const { el, ctx } = canvas(w, h)
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  img.close()
  return canvasBlob(el)
}

/**
 * 遮罩（白色是要重畫的地方、黑色保留）縮放成 w × h；
 * alpha：OpenAI 的格式，要重畫的地方是透明的、其他地方不透明
 */
export async function fitMask(blob: Blob, w: number, h: number, alpha = false): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const { el, ctx } = canvas(w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  img.close()
  if (alpha) {
    const data = ctx.getImageData(0, 0, w, h)
    for (let i = 0; i < data.data.length; i += 4) {
      const paint = data.data[i]! > 127
      data.data[i] = data.data[i + 1] = data.data[i + 2] = 0
      data.data[i + 3] = paint ? 0 : 255
    }
    ctx.putImageData(data, 0, 0)
  }
  return canvasBlob(el)
}
