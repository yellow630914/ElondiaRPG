// v-marquee：一行字放不下時往右捲到最後、停一下、跳回開頭再捲（戰鬥的敵人名字、城鎮的行情、流程圖的卡片共用）。
// 用法：<span v-marquee class="marquee"><span>文字</span></span>；換字、換寬度時重新量。樣式在 style.css 的 .marquee。
// v-marquee="false"：不捲動，放不下時照 .marquee 的樣式截斷成「…」（交易畫面）。
import type { Directive } from 'vue'

const fit = (el: HTMLElement) => {
  // 差 1px 也算放不下（不然會出現刪節號）
  const over = el.scrollWidth - el.clientWidth
  el.classList.toggle('run', over > 0)
  if (over > 0) {
    el.style.setProperty('--marq-d', `${-over}px`)
    el.style.setProperty('--marq-t', `${Math.max(3, over / 12 + 2)}s`)
  }
}
const obs = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => { for (const e of es) fit(e.target as HTMLElement) }) : null

export const vMarquee: Directive<HTMLElement, boolean | undefined> = {
  mounted: (el, b) => {
    if (b.value === false) return
    fit(el)
    obs?.observe(el)
  },
  updated: (el, b) => {
    if (b.value === false) {
      el.classList.remove('run')
      obs?.unobserve(el)
    } else fit(el)
  },
  unmounted: (el) => obs?.unobserve(el),
}
