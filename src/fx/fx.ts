// 共用的特效層：飄字、閃光、抖動、碎裂、橫幅。
// 物件本身（飄字、粒子、碎片）走像素硬邊與逐格動畫；光暈、閃白、暗角用平滑光效疊在上面。
// 所有特效都畫在一層蓋住整個視窗、不吃滑鼠的 div 上，不擋操作；設定「關閉」時全部不播。

import { useSettings, type FxLevel } from '@/stores/settings'

function level(): FxLevel {
  try {
    return useSettings().effectsLevel()
  } catch {
    return 'off'
  }
}

/** 精簡：只留飄字、HP 殘影與橫幅（不抖動、不震畫面、沒有粒子） */
export const fxOn = () => level() !== 'off'
export const fxFull = () => level() === 'full'

let layerEl: HTMLElement | null = null
function layer(): HTMLElement {
  if (layerEl && layerEl.isConnected) return layerEl
  layerEl = document.createElement('div')
  layerEl.className = 'fx-layer'
  layerEl.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layerEl)
  return layerEl
}

function canAnimate(el: Element | null | undefined): el is HTMLElement {
  return !!el && typeof (el as HTMLElement).animate === 'function'
}

/** 加進特效層，動畫播完自己移除 */
function spawn(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): void {
  layer().appendChild(el)
  if (typeof el.animate !== 'function') { el.remove(); return }
  const a = el.animate(frames, { fill: 'forwards', ...opts })
  a.onfinish = () => el.remove()
  a.oncancel = () => el.remove()
}

// 同一張卡同時有好幾個飄字時錯開位置
const stacks = new WeakMap<Element, number>()

export interface FloatOpts {
  color?: string
  /** 幸運一擊：放大 */
  big?: boolean
  /** 失手、閃避：從側邊滑過 */
  slide?: boolean
  /** 放在卡片上緣（標語），預設在卡片中間（數字） */
  top?: boolean
  delay?: number
  /** 字前面加一個像素愛心（慾望） */
  heart?: boolean
}

/** 從卡片上方飄起一段字（傷害、治療、失手） */
export function floatText(anchor: Element | null | undefined, text: string, opts: FloatOpts = {}): void {
  if (!anchor || !fxOn()) return
  const r = anchor.getBoundingClientRect()
  const n = stacks.get(anchor) ?? 0
  stacks.set(anchor, n + 1)
  const el = document.createElement('span')
  el.className = `fx-float${opts.big ? ' big' : ''}${opts.slide ? ' slide' : ''}`
  if (opts.heart) el.appendChild(pixelHeart(opts.color ?? LUST_PINK[0]!))
  el.appendChild(document.createTextNode(text))
  if (opts.color) el.style.color = opts.color
  el.style.left = `${r.left + r.width / 2 + (n % 3) * 18 - (n % 3 === 2 ? 36 : 0)}px`
  el.style.top = `${opts.top ? r.top + 4 : r.top + Math.min(r.height / 2, 26) - n * 4}px`
  const frames: Keyframe[] = opts.slide
    ? [
        { transform: 'translate(-20%, -50%)', opacity: 0 },
        { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-90%, -50%)', opacity: 0 },
      ]
    : opts.big
      ? [
          { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
          { transform: 'translate(-50%, -80%) scale(1.5)', opacity: 1, offset: 0.18 },
          { transform: 'translate(-50%, -100%) scale(1.2)', opacity: 1, offset: 0.6 },
          { transform: 'translate(-50%, -190%) scale(1.2)', opacity: 0 },
        ]
      : [
          { transform: 'translate(-50%, -30%)', opacity: 0 },
          { transform: 'translate(-50%, -80%)', opacity: 1, offset: 0.15 },
          { transform: 'translate(-50%, -110%)', opacity: 1, offset: 0.6 },
          { transform: 'translate(-50%, -200%)', opacity: 0 },
        ]
  // 逐格往上（像素風），不是平滑滑動
  spawn(el, frames, { duration: opts.big ? 1100 : 900, delay: opts.delay ?? 0, easing: 'steps(14, end)' })
  setTimeout(() => stacks.set(anchor, Math.max(0, (stacks.get(anchor) ?? 1) - 1)), (opts.delay ?? 0) + 500)
}

/** 卡片抖一下（硬切的幾格位移） */
export function shake(el: Element | null | undefined, strength = 1): void {
  if (!canAnimate(el) || !fxFull()) return
  const d = 3 * strength
  el.animate(
    [
      { transform: 'translate(0, 0)' }, { transform: `translate(${-d}px, 0)` }, { transform: `translate(${d}px, ${-1 * strength}px)` },
      { transform: `translate(${-d / 1.5}px, 0)` }, { transform: `translate(${d / 2}px, 0)` }, { transform: 'translate(0, 0)' },
    ],
    { duration: 250, easing: 'steps(6, end)' },
  )
}

/** 卡片閃一下光（平滑光暈）；color 依傷害類型或治療 */
export function flash(el: Element | null | undefined, color: string, strong = false): void {
  if (!canAnimate(el) || !fxOn()) return
  el.animate(
    [
      { boxShadow: `0 0 0 1px ${color}, 0 0 ${strong ? 22 : 14}px ${color}, inset 0 0 ${strong ? 18 : 10}px ${color}88` },
      { boxShadow: `0 0 0 0 transparent, 0 0 0 transparent, inset 0 0 0 transparent` },
    ],
    { duration: strong ? 520 : 380, easing: 'ease-out' },
  )
}

/** 畫面震一下（幸運一擊、層主登場） */
export function screenShake(el: Element | null | undefined, strength = 1): void {
  if (!canAnimate(el) || !fxFull()) return
  const d = 4 * strength
  el.animate(
    [
      { transform: 'translate(0, 0)' }, { transform: `translate(${d}px, ${-d / 2}px)` }, { transform: `translate(${-d}px, ${d / 2}px)` },
      { transform: `translate(${d / 2}px, ${d / 2}px)` }, { transform: `translate(${-d / 2}px, 0)` }, { transform: 'translate(0, 0)' },
    ],
    { duration: 300, easing: 'steps(6, end)' },
  )
}

function pixel(x: number, y: number, color: string, size: number): HTMLElement {
  const p = document.createElement('i')
  p.className = 'fx-pixel'
  p.style.left = `${x}px`
  p.style.top = `${y}px`
  p.style.width = p.style.height = `${size}px`
  p.style.background = color
  return p
}

/** 敵人死亡：卡片碎成像素往下散落 */
export function shatter(el: Element | null | undefined, colors = ['#d8604e', '#9a8768', '#efe4cc', '#4a3a28']): void {
  if (!el || !fxFull()) return
  const r = el.getBoundingClientRect()
  const cols = 9
  const rows = 4
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const size = 4 + ((i + j) % 3) * 2
      const x = r.left + (r.width / cols) * (i + 0.5)
      const y = r.top + (r.height / rows) * (j + 0.5)
      const dx = (i - cols / 2) * (3 + (j % 2) * 2)
      const dy = 24 + j * 10 + ((i * 7) % 5) * 6
      spawn(pixel(x, y, colors[(i * 3 + j) % colors.length]!, size), [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${-8 - (i % 3) * 4}px)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ], { duration: 650 + ((i + j) % 4) * 70, easing: 'steps(10, end)' })
    }
  }
}

/** 一團往上飄的光粒子（勝利） */
export function sparkle(x: number, y: number, width: number, colors = ['#f0d083', '#e5b75a', '#fff3c4']): void {
  if (!fxFull()) return
  for (let i = 0; i < 26; i++) {
    const px = x + ((i * 37) % 100) / 100 * width - width / 2
    const py = y + ((i * 53) % 30) - 15
    const size = 3 + (i % 3) * 2
    spawn(pixel(px, py, colors[i % colors.length]!, size), [
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, -6px)', opacity: 1, offset: 0.2 },
      { transform: `translate(${((i % 5) - 2) * 6}px, ${-50 - (i % 4) * 18}px)`, opacity: 0 },
    ], { duration: 1000 + (i % 5) * 120, delay: (i % 6) * 60, easing: 'steps(12, end)' })
  }
}

export type BannerKind = 'encounter' | 'boss' | 'victory' | 'defeat'

/** 畫面中央的橫幅（遭遇、層主、勝利、戰敗），四周加暗角 */
export function banner(text: string, kind: BannerKind): void {
  if (!fxOn()) return
  const full = fxFull()
  const long = kind === 'victory' || kind === 'boss'
  const duration = long ? 1200 : 800
  if (full) {
    const v = document.createElement('div')
    v.className = `fx-vignette ${kind}`
    spawn(v, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration, easing: 'ease-out' })
  }
  const b = document.createElement('div')
  b.className = `fx-banner ${kind}`
  const t = document.createElement('span')
  t.textContent = text
  b.appendChild(t)
  spawn(b, [
    { transform: 'translate(-50%, -50%) scaleY(0)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scaleY(1.15)', opacity: 1, offset: 0.14 },
    { transform: 'translate(-50%, -50%) scaleY(1)', opacity: 1, offset: 0.22 },
    { transform: 'translate(-50%, -50%) scaleY(1)', opacity: 1, offset: 0.78 },
    { transform: 'translate(-50%, -50%) scaleY(0)', opacity: 0 },
  ], { duration, easing: 'steps(16, end)' })
  if (kind === 'victory') sparkle(window.innerWidth / 2, window.innerHeight / 2, Math.min(420, window.innerWidth * 0.6))
}

/** 升級：卡片上升起一道金色光柱，夾帶幾顆往上飄的像素 */
export function pillar(el: Element | null | undefined): void {
  if (!el || !fxOn()) return
  const r = el.getBoundingClientRect()
  const p = document.createElement('div')
  p.className = 'fx-pillar'
  p.style.left = `${r.left}px`
  p.style.top = `${r.top - 30}px`
  p.style.width = `${r.width}px`
  p.style.height = `${r.height + 30}px`
  spawn(p, [
    { opacity: 0, transform: 'scaleX(0.2)' },
    { opacity: 1, transform: 'scaleX(1)', offset: 0.2 },
    { opacity: 0.8, transform: 'scaleX(0.8)', offset: 0.7 },
    { opacity: 0, transform: 'scaleX(0.3)' },
  ], { duration: 1200, easing: 'ease-out' })
  sparkle(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.8)
}

/** 打造的槌敲火花：幾顆橘黃像素從一點迸開 */
export function sparks(el: Element | null | undefined, count = 12): void {
  if (!el || !fxFull()) return
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const colors = ['#fff3c4', '#ffd34d', '#ff9a3c']
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const d = 18 + (i % 3) * 8
    spawn(pixel(x, y, colors[i % 3]!, 3 + (i % 2)), [
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 4}px)`, opacity: 0 },
    ], { duration: 380, delay: (i % 4) * 90, easing: 'steps(6, end)' })
  }
}

/** 換區域：畫面上方浮出地名卡，約 1 秒後消失 */
export function placeCard(title: string, sub = ''): void {
  if (!fxOn()) return
  const b = document.createElement('div')
  b.className = 'fx-place'
  const t = document.createElement('b')
  t.textContent = title
  b.appendChild(t)
  if (sub) {
    const s = document.createElement('small')
    s.textContent = sub
    b.appendChild(s)
  }
  spawn(b, [
    { transform: 'translate(-50%, -8px)', opacity: 0 },
    { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.15 },
    { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%, -4px)', opacity: 0 },
  ], { duration: 1600, easing: 'ease-out' })
}

/** 畫面邊緣的一次脈動（通緝、警戒升高） */
export function edgePulse(color = '#d8604e'): void {
  if (!fxFull()) return
  const v = document.createElement('div')
  v.className = 'fx-edge'
  v.style.boxShadow = `inset 0 0 80px 10px ${color}aa`
  spawn(v, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 1400, easing: 'ease-in-out' })
}

/** 全畫面閃一下顏色（觸發遭遇時閃紅） */
export function screenFlash(color: string): void {
  if (!fxOn()) return
  const v = document.createElement('div')
  v.className = 'fx-edge'
  v.style.background = color
  spawn(v, [{ opacity: 0 }, { opacity: 0.35, offset: 0.2 }, { opacity: 0 }], { duration: 380, easing: 'steps(4, end)' })
}

/** 數字從 from 滾到 to（逐格跳，不是平滑） */
export function tween(from: number, to: number, ms: number, set: (v: number) => void): () => void {
  if (!fxOn() || typeof requestAnimationFrame !== 'function' || from === to) { set(to); return () => {} }
  const steps = 12
  const t0 = performance.now()
  let raf = 0
  const tick = (now: number) => {
    const k = Math.min(1, Math.floor(((now - t0) / ms) * steps) / steps)
    set(Math.round(from + (to - from) * k))
    if (k < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => { cancelAnimationFrame(raf); set(to) }
}

// ---- 慾望：粉色閃光、像素愛心、粉色粒子；高潮：圍著卡片的粉光呼吸燈，越來越急促、持續增亮，最後破裂 ----

/** 粉色系（亮到暗） */
export const LUST_PINK = ['#ff7ab8', '#ffb3d6', '#ff4f9a', '#ffe0ef', '#e0508f']

// 7 × 6 的像素愛心（不用 emoji，任何字型下長得都一樣）
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
const SVG_NS = 'http://www.w3.org/2000/svg'

/** 像素愛心（SVG，硬邊）；size 是寬度（像素） */
export function pixelHeart(color: string, size = 18): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 7 6')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(Math.round((size * 6) / 7)))
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.classList.add('fx-heart')
  HEART.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '#') return
    const r = document.createElementNS(SVG_NS, 'rect')
    r.setAttribute('x', String(x))
    r.setAttribute('y', String(y))
    r.setAttribute('width', '1')
    r.setAttribute('height', '1')
    r.setAttribute('fill', color)
    svg.appendChild(r)
  }))
  return svg
}

/** 粉色閃光：卡片的光暈加一層從中間散開的粉色（平滑光效） */
export function pinkFlash(el: Element | null | undefined, strong = false): void {
  if (!canAnimate(el) || !fxOn()) return
  flash(el, LUST_PINK[0]!, strong)
  const r = el.getBoundingClientRect()
  const g = document.createElement('div')
  g.className = 'fx-pink-glow'
  g.style.left = `${r.left}px`
  g.style.top = `${r.top}px`
  g.style.width = `${r.width}px`
  g.style.height = `${r.height}px`
  spawn(g, [{ opacity: 0 }, { opacity: strong ? 0.9 : 0.65, offset: 0.2 }, { opacity: 0 }], { duration: strong ? 620 : 460, easing: 'ease-out' })
}

/** 粉色粒子：從卡片中間往上、往外迸開的像素與小愛心 */
export function heartBurst(el: Element | null | undefined, count = 14): void {
  if (!el || !fxFull()) return
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + ((i / count) - 0.5) * Math.PI * 1.6
    const d = 26 + (i % 4) * 12
    const dx = Math.cos(a) * d
    const dy = Math.sin(a) * d - 10
    const color = LUST_PINK[i % LUST_PINK.length]!
    // 三顆裡有一顆是小愛心，其他是像素
    const node: HTMLElement | SVGSVGElement = i % 3 === 0 ? pixelHeart(color, 9 + (i % 2) * 3) : pixel(x, y, color, 3 + (i % 3))
    if (i % 3 === 0) {
      const wrap = document.createElement('i')
      wrap.className = 'fx-heart-particle'
      wrap.style.left = `${x}px`
      wrap.style.top = `${y}px`
      wrap.appendChild(node)
      spawn(wrap, [
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.4}px)) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy - 16}px)) scale(0.9)`, opacity: 0 },
      ], { duration: 820 + (i % 4) * 90, delay: (i % 5) * 30, easing: 'steps(12, end)' })
    } else {
      spawn(node as HTMLElement, [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy + 10}px)`, opacity: 0 },
      ], { duration: 600 + (i % 4) * 70, delay: (i % 5) * 25, easing: 'steps(10, end)' })
    }
  }
}

/** 慾望增加：粉色閃光 + 愛心飄字 + 粉色粒子 */
export function lustHit(el: Element | null | undefined, amount: number, big = false): void {
  if (!el) return
  floatText(el, `+${amount}`, { color: LUST_PINK[0], heart: true, big })
  pinkFlash(el, big)
  heartBurst(el, big ? 20 : 14)
}

/** 呼吸燈的節奏：越來越急促的幾次明暗（亮度 0～1、在整段動畫裡的位置） */
function breathFrames(): Keyframe[] {
  const a = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  const glow = (k: number) => `0 0 0 ${1 + k * 2}px #ff7ab8${a(80 + k * 175)}, 0 0 ${6 + k * 28}px ${2 + k * 8}px #ff4f9a${a(40 + k * 150)}, inset 0 0 ${4 + k * 18}px #ff7ab8${a(30 + k * 120)}`
  const out: Keyframe[] = [{ boxShadow: glow(0), opacity: 0, offset: 0 }]
  // 第一段（0～0.58）：呼吸，間隔越來越短，亮度也慢慢升高
  const peaks = [0.1, 0.22, 0.31, 0.38, 0.435, 0.48, 0.515, 0.545, 0.57]
  let prev = 0
  peaks.forEach((at, i) => {
    const low = (prev + at) / 2
    if (i > 0) out.push({ boxShadow: glow(0.12 + i * 0.03), opacity: 0.55, offset: low })
    out.push({ boxShadow: glow(0.45 + i * 0.045), opacity: 1, offset: at })
    prev = at
  })
  // 第二段（0.58～0.9）：不再暗下去，持續增亮
  out.push({ boxShadow: glow(0.9), opacity: 1, offset: 0.75 })
  out.push({ boxShadow: glow(1.25), opacity: 1, offset: 0.9 })
  // 第三段：最亮的一瞬，接著破裂（光圈消失，碎片另外飛出去）
  out.push({ boxShadow: glow(1.6), opacity: 1, offset: 0.94 })
  out.push({ boxShadow: glow(0), opacity: 0, offset: 1 })
  return out
}

/** 光圈破裂：沿著卡片的外框碎成粉色碎片往外飛 */
function ringShatter(r: DOMRect): void {
  const per = 14
  const pts: [number, number, number, number][] = []
  for (let i = 0; i < per; i++) {
    const t = (i + 0.5) / per
    pts.push([r.left + r.width * t, r.top, 0, -1], [r.left + r.width * t, r.bottom, 0, 1])
  }
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6
    pts.push([r.left, r.top + r.height * t, -1, 0], [r.right, r.top + r.height * t, 1, 0])
  }
  pts.forEach(([x, y, nx, ny], i) => {
    const d = 22 + (i % 5) * 9
    const side = ((i * 7) % 5) - 2
    const dx = nx * d + (ny ? side * 5 : 0)
    const dy = ny * d + (nx ? side * 5 : 0) + 12
    const color = LUST_PINK[i % LUST_PINK.length]!
    const node = i % 4 === 0 ? (() => {
      const w = document.createElement('i')
      w.className = 'fx-heart-particle'
      w.style.left = `${x}px`
      w.style.top = `${y}px`
      w.appendChild(pixelHeart(color, 10))
      return w
    })() : pixel(x, y, color, 3 + (i % 3) * 2)
    spawn(node, [
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 6}px) rotate(${side * 30}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy + 18}px) rotate(${side * 60}deg)`, opacity: 0 },
    ], { duration: 700 + (i % 4) * 80, easing: 'steps(12, end)' })
  })
}

/**
 * 高潮：圍著卡片的粉光呼吸燈——先越來越急促，接著持續增亮，最後破裂（碎片、畫面閃粉、浮出「高潮」）。
 * 回傳整段的長度（毫秒）。精簡模式沒有碎片
 */
export function climaxBreath(el: Element | null | undefined, label = '高潮'): number {
  if (!canAnimate(el) || !fxOn()) return 0
  const duration = 2300
  const r = el.getBoundingClientRect()
  const pad = 4
  const ring = document.createElement('div')
  ring.className = 'fx-climax-ring'
  ring.style.left = `${r.left - pad}px`
  ring.style.top = `${r.top - pad}px`
  ring.style.width = `${r.width + pad * 2}px`
  ring.style.height = `${r.height + pad * 2}px`
  spawn(ring, breathFrames(), { duration, easing: 'ease-in-out' })
  // 卡片本身也跟著微微發亮
  ;(el as HTMLElement).animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.12)', offset: 0.6 }, { filter: 'brightness(1.4)', offset: 0.93 }, { filter: 'brightness(1)' }], { duration, easing: 'ease-in' })
  setTimeout(() => {
    if (fxFull()) ringShatter(el.getBoundingClientRect())
    screenFlash('#ff7ab8')
    shake(el, 2)
    floatText(el, label, { color: LUST_PINK[0], top: true, big: true, heart: true })
  }, duration * 0.94)
  return duration
}
