<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { locationById } from '@/engine/data'
import { currentArea } from '@/engine/grid'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

// 背景氛圍：整頁背景的晝夜色調、地城的灰塵與暗角、野外依地區飄落的東西。
// 都畫在所有面板後面（z-index -1），很淡，不影響閱讀；精簡與關閉時只留晝夜色調（關閉時連色調也不漸變）。

const game = useGame()
const settings = useSettings()

const hour = computed(() => game.state?.time.hour ?? 12)
/** 晝夜色調：清晨與黃昏偏暖、白天中性、夜晚偏藍暗 */
const tint = computed(() => {
  const h = hour.value
  if (h >= 5 && h < 7) return 'rgba(255, 150, 70, 0.10)'
  if (h >= 7 && h < 17) return 'rgba(0, 0, 0, 0)'
  if (h >= 17 && h < 19) return 'rgba(255, 110, 50, 0.13)'
  if (h >= 19 && h < 21) return 'rgba(40, 60, 140, 0.20)'
  return 'rgba(20, 35, 110, 0.30)'
})

type Weather = 'dust' | 'leaves' | 'snow' | 'ash' | 'sand' | null
const area = computed(() => {
  const s = game.state
  if (!s) return null
  try {
    return currentArea(s)
  } catch {
    return null
  }
})
const weather = computed<Weather>(() => {
  const a = area.value
  if (!a) return null
  if (a.kind === 'dungeon' || a.kind === 'side' || a.kind === 'special') return 'dust'
  if (a.kind !== 'wild' && a.kind !== 'road') return null
  const region = locationById(a.location)?.region
  return ({ forest: 'leaves', north: 'snow', south: 'ash', west: 'sand' } as Record<string, Weather>)[region ?? ''] ?? null
})
/** 地城越深越暗（周邊 0 層、淺層 1……） */
const depth = computed(() => (area.value && (area.value.kind === 'dungeon' || area.value.kind === 'side' || area.value.kind === 'special') ? Math.min(3, (area.value.layer ?? 0) + 1) : 0))
const full = computed(() => settings.effectsLevel() === 'full')

const canvas = ref<HTMLCanvasElement | null>(null)
interface P { x: number; y: number; vx: number; vy: number; s: number; c: string; t: number }
let parts: P[] = []
let raf = 0
let last = 0

const STYLE: Record<Exclude<Weather, null>, { n: number; colors: string[]; size: [number, number]; vx: [number, number]; vy: [number, number] }> = {
  dust: { n: 34, colors: ['#c9b48a55', '#efe4cc40', '#9a876855'], size: [2, 3], vx: [-6, 6], vy: [-4, 4] },
  leaves: { n: 22, colors: ['#7cba6a88', '#b6a04a88', '#c97a3a77'], size: [3, 5], vx: [8, 22], vy: [14, 28] },
  snow: { n: 48, colors: ['#ffffffaa', '#dfeaffaa'], size: [2, 4], vx: [-6, 6], vy: [18, 36] },
  ash: { n: 40, colors: ['#9a8a8077', '#ff7a3a88', '#5a4a4488'], size: [2, 3], vx: [-4, 8], vy: [-18, -6] },
  sand: { n: 30, colors: ['#e6c48a55', '#c9a06a55'], size: [2, 3], vx: [30, 60], vy: [-2, 4] },
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function seed(w: Weather, width: number, height: number) {
  parts = []
  if (!w) return
  const st = STYLE[w]
  for (let i = 0; i < st.n; i++) {
    parts.push({ x: rand(0, width), y: rand(0, height), vx: rand(...st.vx), vy: rand(...st.vy), s: Math.round(rand(...st.size)), c: st.colors[i % st.colors.length]!, t: rand(0, 6.28) })
  }
}

function frame(now: number) {
  raf = 0
  const c = canvas.value
  if (!c || !full.value || !weather.value || document.hidden) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const dt = Math.min(0.05, (now - (last || now)) / 1000)
  last = now
  const w = c.width
  const h = c.height
  ctx.clearRect(0, 0, w, h)
  for (const p of parts) {
    p.t += dt
    // 葉子和雪左右飄；灰燼往上飄
    const sway = weather.value === 'leaves' || weather.value === 'snow' ? Math.sin(p.t * 1.6) * 12 : 0
    p.x += (p.vx + sway) * dt
    p.y += p.vy * dt
    if (p.y > h + 8) { p.y = -8; p.x = rand(0, w) }
    if (p.y < -8) { p.y = h + 8; p.x = rand(0, w) }
    if (p.x > w + 8) p.x = -8
    if (p.x < -8) p.x = w + 8
    ctx.fillStyle = p.c
    // 整數座標：像素顆粒，不模糊
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s)
  }
  raf = requestAnimationFrame(frame)
}

function start() {
  const c = canvas.value
  if (!c) return
  // 半解析度畫，放大後就是像素顆粒
  c.width = Math.ceil(window.innerWidth / 2)
  c.height = Math.ceil(window.innerHeight / 2)
  seed(weather.value, c.width, c.height)
  c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
  last = 0
  if (!raf && full.value && weather.value) raf = requestAnimationFrame(frame)
}
function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
function restart() {
  stop()
  start()
}
// 切到別的分頁時暫停，省電
function onVisible() {
  if (document.hidden) stop()
  else if (!raf) { last = 0; if (full.value && weather.value) raf = requestAnimationFrame(frame) }
}

watch([weather, full], restart)
onMounted(() => {
  start()
  window.addEventListener('resize', restart)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', restart)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <div class="tint" :style="{ background: tint }" />
    <div v-if="depth" class="vignette" :style="{ opacity: 0.25 + depth * 0.18 }" />
    <canvas v-show="full && weather" ref="canvas" class="particles" />
  </div>
</template>

<style scoped>
.ambient { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
.tint { position: absolute; inset: 0; transition: background 3s ease; }
.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 35%, #000 100%); transition: opacity 1.5s ease; }
.particles { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
</style>
