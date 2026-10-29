import { ref } from 'vue'

// 手機版：寬度 720px 以下換成手機的版面（docs/plan/MOBILE_UI_PLAN.md）。平板橫拿照舊是電腦版。
const QUERY = '(max-width: 720px)'
const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null
export const isMobile = ref(!!mql?.matches)
mql?.addEventListener('change', (e) => { isMobile.value = e.matches })

// ── 手機的返回鍵（Android 返回鍵、iPhone 邊緣右滑、瀏覽器上一頁）
// 打開的半屏面板與全螢幕頁面依序疊起來；返回鍵先關最上面那一層，都關了才交給瀏覽器（離開遊戲）。
// 每一層在瀏覽記錄放一筆；用畫面上的按鈕關掉時，把多出來的那幾筆退回去（退回時的 popstate 不算按返回）。
type Layer = { close: () => void }
const layers: Layer[] = []
let pushed = 0
let ignorePop = 0
let scheduled = false

function sync() {
  scheduled = false
  if (ignorePop) return
  const want = layers.length
  try {
    while (pushed < want) {
      history.pushState({ elondiaLayer: pushed + 1 }, '')
      pushed++
    }
    if (pushed > want) {
      ignorePop++
      history.go(want - pushed)
      pushed = want
    }
  } catch {
    // 瀏覽記錄不能用時，返回鍵照瀏覽器原本的行為
  }
}
function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sync)
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePop) {
      ignorePop--
      schedule()
      return
    }
    pushed = Math.max(0, pushed - 1)
    const top = layers.at(-1)
    // 關掉之後那一層會自己 removeLayer；沒有關掉（例如必須先回應的事件）就把那一筆補回去
    top?.close()
    schedule()
  })
}

/** 打開一層（面板或頁面）；回傳關掉時要呼叫的函式。只在手機版使用 */
export function pushLayer(close: () => void): () => void {
  const layer: Layer = { close }
  layers.push(layer)
  schedule()
  return () => {
    const i = layers.indexOf(layer)
    if (i >= 0) layers.splice(i, 1)
    schedule()
  }
}

/** 主動行動列：「這裡的人」的「主動行動」按鈕請它展開並把游標放進文字框 */
export const OPEN_ACTION_EVENT = 'elondia:open-action'
