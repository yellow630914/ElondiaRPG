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
}

/** 從卡片上方飄起一段字（傷害、治療、失手） */
export function floatText(anchor: Element | null | undefined, text: string, opts: FloatOpts = {}): void {
  if (!anchor || !fxOn()) return
  const r = anchor.getBoundingClientRect()
  const n = stacks.get(anchor) ?? 0
  stacks.set(anchor, n + 1)
  const el = document.createElement('span')
  el.className = `fx-float${opts.big ? ' big' : ''}${opts.slide ? ' slide' : ''}`
  el.textContent = text
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
