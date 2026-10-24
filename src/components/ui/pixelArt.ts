// 像素圖：12×12 以內的格子，一格 = 2px，畫成 24×24 的 SVG path（和 Pixelarticons 的介面圖示同一個風格）。
// 「#」是實心格，其他字元是空格。預設置中；給 at（左上角的格子）時放在指定的位置，疊圖時用。

const cache = new Map<string, string>()

export function pixelPath(art: string, at?: { x: number; y: number }): string {
  const key = at ? `${at.x},${at.y}|${art}` : art
  const hit = cache.get(key)
  if (hit) return hit
  const rows = art.split('\n').filter((r) => r.length)
  const w = Math.max(...rows.map((r) => r.length))
  const ox = at ? at.x * 2 : Math.floor((24 - w * 2) / 2)
  const oy = at ? at.y * 2 : Math.floor((24 - rows.length * 2) / 2)
  // 每一列把連續的實心格合成一個長方形
  const parts: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue
      let end = x
      while (row[end + 1] === '#') end++
      parts.push(`M${ox + x * 2} ${oy + y * 2}h${(end - x + 1) * 2}v2h-${(end - x + 1) * 2}z`)
      x = end
    }
  })
  const d = parts.join('')
  cache.set(key, d)
  return d
}

/** 疊起來畫的一層：path、顏色（CSS 顏色，可以是 var(--x)）、透明度 */
export interface IconLayer { d: string; color: string; opacity?: number }
