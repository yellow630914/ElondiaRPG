<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// 可以左右滑的分頁（手機版，docs/plan/MOBILE_UI_PLAN.md 2.6 節）。
// swipe 時所有分頁並排在一條軌道上，內容與分頁底線跟著手指移動；放開後拉過四分之一寬、或甩得夠快就換頁，不然彈回。
// 一開始先判斷方向：橫的才接手，直的交給上下捲動。第一頁往右、最後一頁往左拉得動但有阻力。
// 軌道的位移用每一頁自己的寬度（百分比）算，分頁之間留間距（樣稿 v2.2 用外層寬度算，越後面的分頁偏越多）。
// 只畫目前與左右相鄰的分頁（拖動時看得到隔壁），看過的分頁保留。
// 不 swipe（電腦版）時：all 為 true 時依序畫出所有分頁（例如交易視窗的左右兩欄），否則只畫目前的分頁。
export interface SwipeTab { id: string; label?: string }
const props = withDefaults(defineProps<{ tabs: SwipeTab[]; modelValue: string; swipe?: boolean; bar?: boolean; all?: boolean }>(), { swipe: false, bar: false, all: false })
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const idx = computed(() => Math.max(0, props.tabs.findIndex((t) => t.id === props.modelValue)))
const visited = ref(new Set<string>([props.modelValue]))
watch(() => props.modelValue, (v) => { visited.value.add(v) })
const shown = (i: number, id: string) => Math.abs(i - idx.value) <= 1 || visited.value.has(id)

const rootEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
const inkEl = ref<HTMLElement | null>(null)
const vpEl = ref<HTMLElement | null>(null)
const trackEl = ref<HTMLElement | null>(null)

/** 軌道與底線的位置。offset：拖動中的位移（px）；拖動中不加動畫才會黏手 */
function place(offset = 0, animate = true, scrollBar = animate) {
  const track = trackEl.value, vp = vpEl.value
  if (!track || !vp) return
  const i = idx.value
  const w = (track.children[0] as HTMLElement | undefined)?.getBoundingClientRect().width || 1
  for (const el of [track, vp, inkEl.value]) if (el) el.style.transition = animate ? '' : 'none'
  track.style.transform = `translateX(calc(${-i} * (100% + var(--gap)) + ${offset}px))`
  const pane = track.children[i] as HTMLElement | undefined
  if (pane) vp.style.height = `${pane.offsetHeight}px`
  // 底線跟著拖動的比例移到隔壁分頁
  const btns = barEl.value ? [...barEl.value.querySelectorAll<HTMLElement>('button')] : []
  const ink = inkEl.value
  if (ink && btns[i]) {
    const p = -offset / w
    const j = Math.max(0, Math.min(btns.length - 1, i + Math.sign(p)))
    const f = Math.min(1, Math.abs(p))
    const a = btns[i], b = btns[j] ?? a
    ink.style.width = `${a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f}px`
    ink.style.transform = `translateX(${a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f}px)`
    // 分頁列只橫向捲到看得到目前的分頁（不用 scrollIntoView：它也會捲動外層的頁面）
    const bar = barEl.value
    if (scrollBar && bar && (a.offsetLeft < bar.scrollLeft || a.offsetLeft + a.offsetWidth > bar.scrollLeft + bar.clientWidth)) {
      bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: animate ? 'smooth' : 'auto' })
    }
  }
}
function select(id: string) {
  emit('update:modelValue', id)
}
watch(idx, () => nextTick(() => place()))
watch(() => props.swipe, (on) => { if (on) nextTick(() => place(0, false)) })

// 目前分頁的內容長高或變矮時（展開清單、載入），容器跟著變
let ro: ResizeObserver | null = null
onMounted(() => {
  // 一打開就在後面的分頁（例如升級時直接開「能力」）：分頁列也要捲過去
  nextTick(() => place(0, false, true))
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => { if (props.swipe && !dragging) place(0, true, false) })
    watch([trackEl, idx], () => {
      ro?.disconnect()
      const pane = trackEl.value?.children[idx.value]
      if (pane) ro?.observe(pane)
    }, { immediate: true, flush: 'post' })
  }
})
onBeforeUnmount(() => ro?.disconnect())

// 滑動的範圍：整個頁面（對話框的內容區），內容很短時在下面的空白處滑也可以
let area: HTMLElement | null = null
function bindArea(on: boolean) {
  if (area) {
    area.removeEventListener('pointerdown', onDown)
    area.style.touchAction = ''
  }
  area = on ? ((rootEl.value?.closest('.dialog-body') as HTMLElement | null) ?? rootEl.value) : null
  if (area) {
    area.addEventListener('pointerdown', onDown)
    // 橫向的手勢交給我們，直向照舊捲動（不然手機瀏覽器會吃掉橫向拖動）
    area.style.touchAction = 'pan-y'
  }
}
onMounted(() => { watch(() => props.swipe, (on) => bindArea(on), { immediate: true }) })
onBeforeUnmount(() => bindArea(false))

// ── 拖動
let dragging = false
function onDown(e: PointerEvent) {
  if (!props.swipe || !e.isPrimary) return
  // 在輸入框、選單、拉桿上開始的不算（它們自己要用到橫向拖動或選字）
  if ((e.target as Element).closest('input, textarea, select, [data-no-swipe], .st-bar')) return
  // 頁面裡的其他分頁元件（例如角色詳情裡的頁面）不要搶
  const owner = (e.target as Element).closest('.swipe-tabs')
  if (owner && owner !== rootEl.value && rootEl.value?.contains(owner)) return
  const x0 = e.clientX, y0 = e.clientY
  const i = idx.value
  const n = props.tabs.length
  const w = (trackEl.value?.children[0] as HTMLElement | undefined)?.getBoundingClientRect().width || 1
  let axis: 'x' | 'y' | null = null
  let dx = 0
  let v = 0
  let last = { x: x0, t: performance.now() }
  const move = (m: PointerEvent) => {
    if (m.pointerId !== e.pointerId) return
    const mx = m.clientX - x0, my = m.clientY - y0
    if (!axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (axis === 'y') return end()
      dragging = true
    }
    dx = mx
    if ((i === 0 && dx > 0) || (i === n - 1 && dx < 0)) dx *= 0.3
    const now = performance.now()
    v = (m.clientX - last.x) / Math.max(1, now - last.t)
    last = { x: m.clientX, t: now }
    place(dx, false)
  }
  const up = (u: PointerEvent) => {
    if (u.pointerId !== e.pointerId) return
    end()
    if (axis !== 'x') return
    dragging = false
    let j = i
    if (dx < -w / 4 || v < -0.45) j = i + 1
    else if (dx > w / 4 || v > 0.45) j = i - 1
    j = Math.max(0, Math.min(n - 1, j))
    const to = props.tabs[j]
    if (j !== i && to) select(to.id)
    else place()
    // 拖動結束時，手指下的按鈕不要被按到
    if (Math.abs(dx) > 8) {
      const eat = (c: Event) => { c.stopPropagation(); c.preventDefault() }
      window.addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 300)
    }
  }
  const cancel = () => {
    end()
    if (axis === 'x') { dragging = false; place() }
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
}
</script>

<template>
  <div ref="rootEl" class="swipe-tabs" :class="{ swipe }">
    <nav v-if="bar" ref="barEl" class="st-bar">
      <button v-for="t in tabs" :key="t.id" type="button" :class="{ on: t.id === modelValue }" @click="select(t.id)">
        <slot name="tab" :tab="t">{{ t.label }}</slot>
      </button>
      <span ref="inkEl" class="ink" />
    </nav>
    <div v-if="swipe" ref="vpEl" class="st-viewport">
      <div ref="trackEl" class="st-track">
        <div v-for="(t, i) in tabs" :key="t.id" class="st-pane" :aria-hidden="t.id !== modelValue">
          <slot v-if="shown(i, t.id)" :id="t.id" />
        </div>
      </div>
    </div>
    <template v-else-if="all">
      <template v-for="t in tabs" :key="t.id"><slot :id="t.id" /></template>
    </template>
    <slot v-else :id="modelValue" />
  </div>
</template>

<style scoped>
.st-bar { position: relative; display: flex; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.st-bar::-webkit-scrollbar { display: none; }
.st-bar button {
  flex: 1 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; white-space: nowrap;
  background: none; border: none; border-radius: 0; box-shadow: none; color: var(--muted);
}
.st-bar button.on { color: var(--title); }
.ink {
  position: absolute; left: 0; bottom: 0; height: 2px; width: 0; background: var(--accent); pointer-events: none;
  transition: transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1), width 0.34s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.st-viewport { overflow: hidden; touch-action: pan-y; transition: height 0.3s cubic-bezier(0.22, 0.61, 0.36, 1); }
.st-track {
  --gap: 32px; display: flex; gap: var(--gap); align-items: flex-start; will-change: transform;
  transition: transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.st-pane { flex: 0 0 100%; min-width: 0; }
</style>
