// 成人用品店兩個對話框的邊框裝飾（SVG，依對話框的大小畫）：
// - 淫服訂製：兩股紅線像藤蔓一樣沿著邊框纏繞（針腳、小捲鬚），上方一根針，左下角紅線編的淫紋
// - 淫器合煉：鎖鏈邊框（四角吊環、上方一把鎖），中間的法陣是鎖鏈構成的六芒星
// 呼吸光的動畫在 AdultDeco.vue 的樣式（class glow-pink、glow-rune）。

const NS = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>

function el(tag: string, attrs: Attrs, parent?: Element): SVGElement {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (parent) parent.appendChild(e)
  return e
}

let uid = 0
const nextId = (p: string) => `${p}${++uid}`

/** 淫服訂製：紅線藤蔓、針、淫紋 */
export function drawAtelier(svg: SVGSVGElement, w: number, h: number) {
  svg.innerHTML = ''
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const needleId = nextId('needle')
  const defs = el('defs', {}, svg)
  const lg = el('linearGradient', { id: needleId, x1: 0, x2: 1, y1: 0, y2: 0 }, defs)
  el('stop', { offset: 0, 'stop-color': '#f4f4f6' }, lg)
  el('stop', { offset: 0.5, 'stop-color': '#9ea2ad' }, lg)
  el('stop', { offset: 1, 'stop-color': '#e3e5ea' }, lg)
  const m = 8, per = 44, amp = 3.6
  // 沿著邊框一圈的點（從左上順時針）：位置與前進方向
  const pts: [number, number, number, number][] = []
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(L / 4))
    for (let i = 0; i < n; i++) pts.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, (x2 - x1) / L, (y2 - y1) / L])
  }
  edge(m, m, w - m, m); edge(w - m, m, w - m, h - m); edge(w - m, h - m, m, h - m); edge(m, h - m, m, m)
  const g = el('g', { class: 'glow-pink' }, svg)
  const strand = (phase: number, color: string, width: number) => {
    let d = ''
    pts.forEach(([x, y, dx, dy], i) => {
      const off = Math.sin((i * 4) / per * Math.PI * 2 + phase) * amp
      d += `${i ? 'L' : 'M'}${(x - dy * off).toFixed(1)} ${(y + dx * off).toFixed(1)}`
    })
    el('path', { d: `${d}Z`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 }, g)
  }
  strand(0, '#a8203d', 1.6)
  strand(Math.PI, '#d0476b', 1.3)
  // 捲鬚與小葉：每隔一段長出一個小卷（朝內）
  pts.forEach(([x, y, dx, dy], i) => {
    if (i % 23 !== 11) return
    const nx = -dy, ny = dx, s = i % 46 < 23 ? 1 : -1
    const bx = x + nx * 4, by = y + ny * 4
    const ex = bx + nx * 9 + dx * 8 * s, ey = by + ny * 9 + dy * 8 * s
    el('path', { d: `M${bx} ${by} Q${bx + nx * 10} ${by + ny * 10} ${ex} ${ey} q${-dx * 4 * s + nx * 3} ${-dy * 4 * s + ny * 3} ${-dx * 2 * s} ${-dy * 2 * s}`, fill: 'none', stroke: '#c23a5e', 'stroke-width': 1.1, opacity: 0.8 }, g)
    const lx = ex - dx * 3 * s, ly = ey - dy * 3 * s
    el('ellipse', { cx: lx, cy: ly, rx: 3.2, ry: 1.6, fill: '#d0476b', opacity: 0.55, transform: `rotate(${Math.atan2(dy, dx) * 57.3 + 35 * s} ${lx} ${ly})` }, g)
  })
  // 針腳
  pts.forEach(([x, y, dx, dy], i) => {
    if (i % 6) return
    const nx = -dy, ny = dx
    el('path', { d: `M${x - nx * 5 - dx * 2} ${y - ny * 5 - dy * 2}l${nx * 3 + dx * 2} ${ny * 3 + dy * 2}`, stroke: '#8f1d36', 'stroke-width': 1, opacity: 0.45 }, svg)
  })
  // 上方靠右：一根針（避開關閉鈕），紅線從針眼牽出來
  const small = w < 600
  const nx0 = w - (small ? 120 : 160), ny0 = 16
  const needle = el('g', { transform: `translate(${nx0} ${ny0}) rotate(-8) scale(1.5)` }, svg)
  el('path', { d: 'M0 0 L58 -2.2 L62 0 L58 2.2 Z', fill: `url(#${needleId})`, stroke: '#6b6f7a', 'stroke-width': 0.6 }, needle)
  el('ellipse', { cx: 6, cy: 0, rx: 3.4, ry: 1, fill: '#ecdcb6', stroke: '#6b6f7a', 'stroke-width': 0.5 }, needle)
  el('path', { d: `M${nx0 + 5} ${ny0 + 1} C ${nx0 - 14} ${ny0 + 14}, ${nx0 - 34} ${ny0 - 10}, ${nx0 - 64} ${m + 2}`, fill: 'none', stroke: '#a8203d', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, g)
  // 左下角：紅線編的淫紋（中央雙層心形、兩側翼刃、上方小心形、下方垂尖），歪一點、半透明
  const wrap = el('g', { transform: `translate(${small ? 96 : 140} ${h - (small ? 64 : 78)}) rotate(-11) scale(${small ? 0.72 : 1})`, opacity: 0.62 }, svg)
  const mark = el('g', { class: 'glow-pink' }, wrap)
  const half = (hg: Element) => {
    const shape = (d: string, fillOp = 0.22, c = '#a8203d', sw = 1.8) => {
      el('path', { d, fill: c, 'fill-opacity': fillOp, stroke: c, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, hg)
      el('path', { d, fill: 'none', stroke: '#ffd1de', 'stroke-width': 0.7, 'stroke-dasharray': '3 3.5', opacity: 0.85 }, hg)
    }
    shape('M0 30 C -16 18 -32 6 -32 -9 C -32 -21 -22 -29 -12 -29 C -5 -29 -1 -24 0 -18', 0.18, '#a8203d', 2.2)
    shape('M0 16 C -9 9 -17 2 -17 -6 C -17 -12 -12 -16 -7 -16 C -3 -16 -1 -13 0 -10', 0.3, '#c23a5e', 1.4)
    shape('M-28 -16 C -46 -28 -70 -32 -100 -52 C -88 -32 -72 -24 -54 -20 C -68 -14 -80 -6 -92 6 C -70 -4 -50 -6 -32 -2 Z', 0.26)
    shape('M-100 -52 C -114 -56 -120 -44 -113 -37 C -108 -32 -101 -36 -103 -42', 0, '#a8203d', 1.6)
    shape('M-24 12 C -44 26 -68 28 -96 18 C -78 30 -56 34 -38 28 C -48 36 -56 44 -58 56 C -46 44 -34 36 -22 22 Z', 0.22, '#c23a5e', 1.6)
    shape('M-34 -4 C -52 -2 -62 6 -64 16 C -58 10 -50 8 -42 10', 0, '#c23a5e', 1.2)
    shape('M0 -36 C -5 -40 -10 -43 -10 -47 C -10 -51 -7 -53 -4 -53 C -2 -53 0 -51 0 -49', 0.35, '#c23a5e', 1.3)
    shape('M-8 -30 C -14 -40 -24 -46 -36 -46 C -28 -42 -22 -36 -18 -28', 0.2, '#a8203d', 1.2)
  }
  half(el('g', {}, mark))
  half(el('g', { transform: 'scale(-1 1)' }, mark))
  el('path', { d: 'M0 28 C -6 40 -4 52 0 66 C 4 52 6 40 0 28 Z', fill: '#a8203d', 'fill-opacity': 0.3, stroke: '#a8203d', 'stroke-width': 1.6 }, mark)
  el('circle', { cx: 0, cy: 0, r: 3.6, fill: '#e65b86' }, mark)
}

/** 鏈環的金屬漸層 */
function steel(svg: Element): string {
  const id = nextId('steel')
  const lg = el('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 }, el('defs', {}, svg))
  el('stop', { offset: 0, 'stop-color': '#d9d6e2' }, lg)
  el('stop', { offset: 0.45, 'stop-color': '#8d88a0' }, lg)
  el('stop', { offset: 1, 'stop-color': '#4a4558' }, lg)
  return id
}

/** 沿著一條線排鏈環：一環正面（橢圓）、一環側面（細長條） */
function chainLine(parent: Element, x1: number, y1: number, x2: number, y2: number, grad: string, scale = 1) {
  const link = 12
  const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(L / (link * scale))), ang = Math.atan2(y2 - y1, x2 - x1) * 57.2958
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const gg = el('g', { transform: `translate(${(x1 + (x2 - x1) * t).toFixed(1)} ${(y1 + (y2 - y1) * t).toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${scale})` }, parent)
    if (i % 2 === 0) {
      el('ellipse', { cx: 0, cy: 0, rx: 7.5, ry: 4.2, fill: 'none', stroke: `url(#${grad})`, 'stroke-width': 2.4 }, gg)
      el('ellipse', { cx: 0, cy: -1, rx: 5.5, ry: 2.2, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.6, opacity: 0.5 }, gg)
    } else {
      el('rect', { x: -7.5, y: -1.6, width: 15, height: 3.2, rx: 1.6, fill: `url(#${grad})`, stroke: '#3a3546', 'stroke-width': 0.5 }, gg)
    }
  }
}

/** 淫器合煉：鎖鏈邊框、四角吊環、上方一把鎖 */
export function drawForge(svg: SVGSVGElement, w: number, h: number) {
  svg.innerHTML = ''
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const grad = steel(svg)
  const m = 9
  const g = el('g', { class: 'glow-rune' }, svg)
  chainLine(g, m + 10, m, w - m - 10, m, grad)
  chainLine(g, m + 10, h - m, w - m - 10, h - m, grad)
  chainLine(g, m, m + 10, m, h - m - 10, grad)
  chainLine(g, w - m, m + 10, w - m, h - m - 10, grad)
  for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]] as const) {
    el('circle', { cx: x, cy: y, r: 7, fill: '#ecdcb6', stroke: `url(#${grad})`, 'stroke-width': 3 }, g)
    el('circle', { cx: x, cy: y, r: 2.2, fill: '#6c4bd1' }, g)
  }
  const lk = el('g', { transform: `translate(${w / 2} ${m + 2})` }, g)
  el('path', { d: 'M-7 6 V1 A7 7 0 0 1 7 1 V6', fill: 'none', stroke: `url(#${grad})`, 'stroke-width': 2.6 }, lk)
  el('rect', { x: -10, y: 5, width: 20, height: 15, rx: 3, fill: '#6c4bd1', stroke: '#3a2a7a', 'stroke-width': 1 }, lk)
  el('path', { d: 'M0 10 v5', stroke: '#ecdcb6', 'stroke-width': 2, 'stroke-linecap': 'round' }, lk)
}

/** 中間的法陣：鎖鏈構成的六芒星（viewBox 200×200），外圈慢慢轉 */
export function drawHexa(svg: SVGSVGElement) {
  svg.innerHTML = ''
  svg.setAttribute('viewBox', '0 0 200 200')
  const grad = steel(svg)
  el('circle', { cx: 100, cy: 100, r: 94, fill: '#6c4bd10d', stroke: '#6c4bd166', 'stroke-width': 1.2 }, svg)
  const spin = el('g', { class: 'spin' }, svg)
  el('circle', { cx: 100, cy: 100, r: 86, fill: 'none', stroke: '#6c4bd199', 'stroke-dasharray': '2 6' }, spin)
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    el('text', { x: 100 + Math.cos(a) * 90, y: 100 + Math.sin(a) * 90 + 3, 'font-size': 8, 'text-anchor': 'middle', fill: '#6c4bd1aa' }, spin).textContent = '✦'
  }
  const star = el('g', { class: 'glow-rune' }, svg)
  const R = 74
  const P = (deg: number): [number, number] => [100 + R * Math.cos(deg * Math.PI / 180), 100 + R * Math.sin(deg * Math.PI / 180)]
  const tri = (a0: number) => {
    const ps = [P(a0), P(a0 + 120), P(a0 + 240)]
    for (let i = 0; i < 3; i++) chainLine(star, ps[i]![0], ps[i]![1], ps[(i + 1) % 3]![0], ps[(i + 1) % 3]![1], grad, 0.72)
    for (const [x, y] of ps) {
      el('circle', { cx: x, cy: y, r: 5, fill: '#ecdcb6', stroke: `url(#${grad})`, 'stroke-width': 2.4 }, star)
      el('circle', { cx: x, cy: y, r: 1.8, fill: '#6c4bd1' }, star)
    }
  }
  tri(-90)
  tri(90)
  el('circle', { cx: 100, cy: 100, r: 40, fill: '#ecdcb6cc', stroke: '#6c4bd1', 'stroke-width': 1.4 }, star)
}
