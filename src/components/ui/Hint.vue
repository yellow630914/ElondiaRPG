<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import GameIcon from './GameIcon.vue'

// 「?」說明：滑鼠移上去、聚焦或點一下時顯示羊皮紙小框。
// 小框掛在 body 上（fixed 定位），不會被有捲軸的面板裁掉。
const props = withDefaults(defineProps<{ text?: string; width?: number }>(), { text: '', width: 280 })
const open = ref(false)
const pinned = ref(false)
const btn = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0, above: false })

async function show() {
  open.value = true
  await nextTick()
  const r = btn.value?.getBoundingClientRect()
  if (!r) return
  const w = Math.min(props.width, window.innerWidth - 16)
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
  const above = r.bottom + 160 > window.innerHeight && r.top > 160
  pos.value = { left, top: above ? r.top - 8 : r.bottom + 8, above }
}
function hide() {
  if (!pinned.value) open.value = false
}
function toggle() {
  pinned.value = !pinned.value
  if (pinned.value) void show()
  else open.value = false
}
function onOutside(e: MouseEvent) {
  if (pinned.value && !btn.value?.contains(e.target as Node)) {
    pinned.value = false
    open.value = false
  }
}
window.addEventListener('click', onOutside)
onBeforeUnmount(() => window.removeEventListener('click', onOutside))
</script>

<template>
  <span
    ref="btn" class="hint" role="button" tabindex="0" aria-label="說明"
    @mouseenter="show" @mouseleave="hide" @focus="show" @blur="hide" @click.stop="toggle" @keydown.enter.prevent="toggle"
  >
    <GameIcon name="question" :size="14" />
  </span>
  <Teleport to="body">
    <div
      v-if="open" class="hint-pop parchment"
      :class="{ above: pos.above }"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${width}px` }"
    >
      <slot>{{ text }}</slot>
    </div>
  </Teleport>
</template>

<style scoped>
.hint { display: inline-flex; color: var(--muted); cursor: help; vertical-align: middle; border-radius: 50%; }
.hint:hover, .hint:focus-visible { color: var(--accent); outline: none; }
.hint-pop {
  position: fixed; z-index: 1000; max-width: calc(100vw - 16px);
  padding: 10px 12px; font-size: var(--fs-sm); line-height: 1.7; white-space: pre-line;
  background: var(--tip-bg); color: var(--tip-text); border: 1px solid #b8955a; border-radius: 3px;
  box-shadow: 0 8px 24px #000c; pointer-events: none;
}
.hint-pop.above { transform: translateY(-100%); }
</style>
