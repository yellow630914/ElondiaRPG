<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import GameIcon from '../ui/GameIcon.vue'
import { pushLayer } from './mobile'

// 手機版的半屏面板：從下往上滑出。拉把手往上拉到全螢幕、往下拉縮小或關掉；點外面、右上 × 或手機的返回鍵也會關。
// 從面板裡打開的全螢幕頁面蓋在面板上面，返回後面板還在。
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const full = ref(false)

let dropLayer: (() => void) | null = null
watch(() => props.open, (on) => {
  if (on && !dropLayer) dropLayer = pushLayer(() => emit('close'))
  else if (!on && dropLayer) {
    dropLayer()
    dropLayer = null
    full.value = false
  }
}, { immediate: true })
onBeforeUnmount(() => dropLayer?.())

function onGripDown(e: PointerEvent) {
  const y0 = e.clientY
  window.addEventListener('pointerup', (u) => {
    const dy = u.clientY - y0
    if (Math.abs(dy) < 8) full.value = !full.value
    else if (dy < -30) full.value = true
    else if (dy > 60) {
      if (full.value) full.value = false
      else emit('close')
    }
  }, { once: true })
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="sheet-wrap">
      <div class="scrim" @click="emit('close')" />
      <section class="sheet" :class="{ full }" role="dialog" :aria-label="title">
        <button class="grip" type="button" aria-label="展開或縮小面板" @pointerdown="onGripDown" />
        <header>
          <h2>{{ title }}</h2>
          <button class="x ghost" type="button" aria-label="關閉" @click="emit('close')"><GameIcon name="close" :size="18" /></button>
        </header>
        <div class="body"><slot /></div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-wrap { position: fixed; inset: 0; z-index: 40; }
.scrim { position: absolute; inset: 0; background: #000000a6; }
.sheet {
  position: absolute; left: 0; right: 0; bottom: 0; max-height: 72dvh; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #2a2017, #1d1611); border-top: 1px solid var(--accent); border-radius: 12px 12px 0 0;
  box-shadow: 0 -10px 30px #000b; transition: max-height 0.22s; padding-bottom: env(safe-area-inset-bottom, 0px);
}
.sheet.full { max-height: 94dvh; }
.grip { flex: none; display: grid; place-items: center; height: 22px; width: 100%; padding: 0; border: none; background: none; box-shadow: none; touch-action: none; }
.grip::before { content: ''; width: 44px; height: 4px; border-radius: 2px; background: var(--gold-lo); }
header { flex: none; display: flex; align-items: center; gap: 8px; padding: 0 14px 8px; }
h2 { margin: 0; flex: 1; font-size: var(--fs-lg); }
.x { width: 36px; height: 36px; padding: 0; display: grid; place-items: center; }
.body { overflow-y: auto; overscroll-behavior: contain; padding: 0 12px 16px; min-height: 0; }
/* 面板裡的面板（這裡的人、地點……）不要再有外框的邊距 */
.body :deep(.panel) { margin-bottom: 10px; }
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.22s ease-out; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(40%); }
</style>
