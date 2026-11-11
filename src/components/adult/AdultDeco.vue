<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { drawAtelier, drawForge } from './deco'

// 成人用品店對話框的邊框裝飾：鋪滿對話框（放在 AppDialog 的 frame 插槽），對話框大小變了就重畫
const props = defineProps<{ kind: 'atelier' | 'forge' }>()
const svg = ref<SVGSVGElement | null>(null)
let ro: ResizeObserver | null = null

function draw() {
  const s = svg.value
  const box = s?.parentElement
  if (!s || !box) return
  const w = box.clientWidth, h = box.clientHeight
  if (!w || !h) return
  if (props.kind === 'atelier') drawAtelier(s, w, h)
  else drawForge(s, w, h)
}

onMounted(() => {
  draw()
  const box = svg.value?.parentElement
  if (box && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => draw())
    ro.observe(box)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <svg ref="svg" class="adult-deco" aria-hidden="true" />
</template>

<style>
/* 鋪滿對話框、在內容後面 */
.adult-deco { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 0; }
.app-dialog.variant-atelier .dialog-inner, .app-dialog.variant-forge .dialog-inner { position: relative; z-index: 1; }
/* 邊緣的呼吸光 */
dialog.app-dialog.variant-atelier[open] { animation: adult-breathe-pink 3.6s ease-in-out infinite; }
dialog.app-dialog.variant-forge[open] { animation: adult-breathe-rune 3.6s ease-in-out infinite; }
@keyframes adult-breathe-pink {
  0%, 100% { box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #c99a45, 0 0 10px 1px #ff8fb655, inset 0 0 14px #ff8fb633, 0 20px 60px #000; }
  50% { box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #d0476b, 0 0 22px 4px #ff8fb6bb, inset 0 0 28px #ff8fb666, 0 20px 60px #000; }
}
@keyframes adult-breathe-rune {
  0%, 100% { box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #c99a45, 0 0 10px 1px #a77bff55, inset 0 0 14px #a77bff33, 0 20px 60px #000; }
  50% { box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #6c4bd1, 0 0 22px 4px #a77bffbb, inset 0 0 28px #a77bff55, 0 20px 60px #000; }
}
.adult-deco .glow-pink, .adult-hexa .glow-pink { animation: adult-glow-pink 3.6s ease-in-out infinite; }
.adult-deco .glow-rune, .adult-hexa .glow-rune { animation: adult-glow-rune 3.6s ease-in-out infinite; }
@keyframes adult-glow-pink { 0%, 100% { filter: drop-shadow(0 0 1px #f39ab8) drop-shadow(0 0 2px #f39ab866); opacity: 0.75; } 50% { filter: drop-shadow(0 0 4px #ff8fb6) drop-shadow(0 0 10px #ff8fb6aa); opacity: 1; } }
@keyframes adult-glow-rune { 0%, 100% { filter: drop-shadow(0 0 1px #b59bff); opacity: 0.8; } 50% { filter: drop-shadow(0 0 4px #b59bff) drop-shadow(0 0 9px #9a77ffaa); opacity: 1; } }
.adult-hexa .spin { transform-origin: 100px 100px; animation: adult-spin 40s linear infinite; }
@keyframes adult-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .app-dialog.variant-atelier, .app-dialog.variant-forge, .adult-deco .glow-pink, .adult-deco .glow-rune, .adult-hexa .glow-pink, .adult-hexa .glow-rune, .adult-hexa .spin { animation: none; }
}
</style>
