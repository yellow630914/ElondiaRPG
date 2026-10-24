<script setup lang="ts">
// 整頁背景圖：放在背景氛圍（晝夜色調、粒子）底下。換地點時舊圖淡出、新圖淡入。
// 有背景圖時 html[data-bg] 讓面板稍微透明，透出一點背景（style.css）。
import { computed, watchEffect } from 'vue'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import { backgroundFor } from './backgrounds'

const game = useGame()
const settings = useSettings()

const url = computed(() => (settings.background ? backgroundFor(game.state) : null))
const brightness = computed(() => Math.max(20, Math.min(100, Number(settings.backgroundBrightness) || 60)) / 100)

watchEffect(() => {
  if (typeof document === 'undefined') return
  if (url.value) document.documentElement.dataset.bg = 'on'
  else delete document.documentElement.dataset.bg
})
</script>

<template>
  <div class="bg-layer" aria-hidden="true">
    <Transition name="bg-fade">
      <div v-if="url" :key="url" class="bg" :style="{ backgroundImage: `url(${url})`, filter: `brightness(${brightness}) saturate(0.9)` }" />
    </Transition>
    <div v-if="url" class="shade" />
  </div>
</template>

<style scoped>
.bg-layer { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
.bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
/* 四周壓暗，和介面的深咖啡色接起來 */
.shade { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 40%, #0f0b08cc 100%), linear-gradient(180deg, #0f0b0899 0%, transparent 18%, transparent 82%, #0f0b08aa 100%); }
.bg-fade-enter-active, .bg-fade-leave-active { transition: opacity 1.2s ease; }
.bg-fade-enter-from, .bg-fade-leave-to { opacity: 0; }
</style>
