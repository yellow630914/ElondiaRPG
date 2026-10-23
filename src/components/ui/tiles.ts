// 地圖格的像素圖塊：用程式畫 16×16 的圖塊，轉成 data URL 快取起來（同一種圖塊有幾種變化，避免整片看起來一模一樣）。

export type TileKind =
  | 'void' | 'wall_town' | 'wall_dungeon' | 'forest' | 'water'
  | 'cobble' | 'grass' | 'stone' | 'dirt' | 'wood'
  | 'roof_red' | 'roof_blue' | 'roof_brown' | 'roof_purple' | 'roof_green' | 'roof_gold'

const SIZE = 16
const VARIANTS = 4
const cache = new Map<string, string>()

function rng(seed: number) {
  let x = seed * 16807 % 2147483647 || 1
  return () => (x = (x * 16807) % 2147483647) / 2147483647
}

type Px = (x: number, y: number, c: string) => void

function speckle(px: Px, r: () => number, base: string[], density: number) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (r() < density) px(x, y, base[Math.floor(r() * base.length)]!)
}

function drawTile(ctx: CanvasRenderingContext2D, kind: TileKind, variant: number) {
  const r = rng(variant * 97 + kind.length * 131 + kind.charCodeAt(0) * 7)
  const px: Px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1) }
  const fill = (c: string) => { ctx.fillStyle = c; ctx.fillRect(0, 0, SIZE, SIZE) }
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h) }
  switch (kind) {
    case 'void':
      fill('#0b0907'); speckle(px, r, ['#14100c'], 0.03); return
    case 'wall_town':
    case 'wall_dungeon': {
      const [base, mortar, hi] = kind === 'wall_town' ? ['#4a4038', '#2c2520', '#5c5248'] : ['#2e2a30', '#18161a', '#3c3840']
      fill(base)
      for (let y = 0; y < SIZE; y += 4) {
        rect(0, y, SIZE, 1, mortar)
        for (let x = (y / 4) % 2 ? 0 : 4; x < SIZE; x += 8) rect(x, y, 1, 4, mortar)
      }
      speckle(px, r, [hi], 0.05)
      return
    }
    case 'forest':
      fill('#22381c'); speckle(px, r, ['#1a2c16', '#2e4a24'], 0.35)
      for (let i = 0; i < 3; i++) {
        const cx = 2 + Math.floor(r() * 11), cy = 2 + Math.floor(r() * 9)
        rect(cx - 2, cy, 5, 3, '#2f5a26'); rect(cx - 1, cy - 1, 3, 1, '#3f7030'); rect(cx, cy + 3, 1, 2, '#4a3420')
      }
      return
    case 'water':
      fill('#24506f'); speckle(px, r, ['#1f4663'], 0.08)
      for (let y = 2 + variant % 3; y < SIZE; y += 5) {
        const s = Math.floor(r() * 10)
        for (let x = s; x < s + 4; x++) px(x % SIZE, y, '#5f97be')
        px((s + 4) % SIZE, y + 1, '#3f7398')
      }
      return
    case 'cobble':
      fill('#6e604c'); speckle(px, r, ['#62553f', '#7c6d56'], 0.25)
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(r() * 14), y = Math.floor(r() * 14)
        rect(x, y, 2, 1, '#54483a'); px(x, y + 1, '#857560')
      }
      return
    case 'grass':
      fill('#4a7236'); speckle(px, r, ['#3c622c', '#5c8a44'], 0.28)
      for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 15), y = 1 + Math.floor(r() * 14); px(x, y, '#6fa04a'); px(x, y - 1, '#6fa04a') }
      return
    case 'stone':
      fill('#4a4644'); speckle(px, r, ['#403c3a', '#56524e'], 0.3)
      rect(0, 7 + (variant % 2), SIZE, 1, '#3a3634'); rect(7 + (variant % 3), 0, 1, SIZE, '#3a3634')
      return
    case 'dirt':
      fill('#7a6040'); speckle(px, r, ['#6a5236', '#8a6e4c'], 0.28); return
    case 'wood':
      fill('#7a5634')
      for (let y = 0; y < SIZE; y += 4) rect(0, y, SIZE, 1, '#5a3e24')
      for (let y = 0; y < SIZE; y += 4) rect((variant * 5 + y * 3) % SIZE, y, 1, 4, '#5a3e24')
      speckle(px, r, ['#8a6640'], 0.06)
      return
    default: {
      // 屋頂：上面瓦片、下面牆與門窗
      const roof: Record<string, [string, string, string]> = {
        roof_red: ['#a04a32', '#7a3422', '#c06a4a'], roof_blue: ['#3d5f8a', '#2a4466', '#5a80aa'],
        roof_brown: ['#7a5a2e', '#5a3f1e', '#9a7a44'], roof_purple: ['#5e4280', '#422c5e', '#7e60a0'],
        roof_green: ['#3f6a3a', '#2c4c28', '#5a8a50'], roof_gold: ['#a8823a', '#7a5c22', '#d0aa5a'],
      }
      const [a, b, c] = roof[kind] ?? roof.roof_brown!
      fill(a)
      for (let y = 0; y < 11; y += 3) rect(0, y, SIZE, 1, b)
      for (let y = 1; y < 11; y += 3) for (let x = (y % 2) * 2; x < SIZE; x += 4) px(x, y, c)
      rect(0, 11, SIZE, 5, '#c9b48a'); rect(0, 11, SIZE, 1, '#00000055')
      rect(6, 12, 4, 4, '#4a3420')
      rect(2, 12, 2, 2, '#e8c860'); rect(12, 12, 2, 2, '#e8c860')
    }
  }
}

/** 圖塊的 data URL（同一格每次都拿到同一種變化） */
export function tileUrl(kind: TileKind, x = 0, y = 0): string {
  const variant = Math.abs(x * 7 + y * 13) % VARIANTS
  const key = `${kind}:${variant}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  drawTile(ctx, kind, variant)
  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}
