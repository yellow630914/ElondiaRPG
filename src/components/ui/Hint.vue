<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import GameIcon from './GameIcon.vue'
import type { IconName } from './iconPaths'

// 「?」說明：滑鼠移上去、用鍵盤移到上面或點一下時顯示羊皮紙小框（對話框打開時自動聚焦不會跳出來）。
// 小框掛在 body 上（fixed 定位），不會被有捲軸的面板裁掉；用 popover 放進瀏覽器的最上層，
// 才不會被 showModal() 開的對話框（也在最上層）蓋住。點「?」不會觸發外面的 label。
// warn：改成三角形的警告圖示（提醒費用、風險；文字一樣移上去才顯示）。
// trigger 插槽：用別的東西（例如地圖上的小標籤）取代「?」圖示，一樣滑過、點一下就顯示。
const props = withDefaults(defineProps<{ text?: string; width?: number; warn?: boolean }>(), { text: '', width: 280, warn: false })
const icon = computed<IconName>(() => (props.warn ? 'caution' : 'question'))
const open = ref(false)
const pinned = ref(false)
const btn = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0, above: false })

async function show() {
  open.value = true
  await nextTick()
  const r = btn.value?.getBoundingClientRect()
  if (!r) return
  const w = Math.min(props.width, window.innerWidth - 16)
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
  // 不支援 popover 的瀏覽器照舊（對話框外的說明還是看得到）
  const p = pop.value as (HTMLElement & { showPopover?: () => void }) | null
  if (p?.showPopover && !p.matches(':popover-open')) p.showPopover()
  // 量出小框實際的高度再決定往上或往下：下面放不下、上面空間比較多時往上；兩邊都放不下時貼著視窗邊緣，不超出畫面
  const h = p?.offsetHeight || 160
  const below = window.innerHeight - r.bottom - 8
  const room = r.top - 8
  const above = h > below && room > below
  let top = above ? r.top - 8 : r.bottom + 8
  if (above && h > room) top = Math.min(window.innerHeight - 8, h + 8)
  if (!above && h > below) top = Math.max(8, window.innerHeight - h - 8)
  pos.value = { left, top, above }
}
/** 聚焦時：只有用鍵盤移過來的才顯示（對話框打開時瀏覽器自動聚焦、點過之後留著的焦點不算） */
function onFocus() {
  if (btn.value?.matches(':focus-visible')) void show()
}
function hide() {
  if (!pinned.value) open.value = false
}
function toggle(e?: Event) {
  e?.preventDefault()
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
    ref="btn" class="hint" :class="{ warn }" role="button" tabindex="0" :aria-label="warn ? '注意' : '說明'"
    @mouseenter="show" @mouseleave="hide" @focus="onFocus" @blur="hide" @click.stop="toggle" @keydown.enter.prevent="toggle()"
  >
    <slot name="trigger"><GameIcon :name="icon" :size="14" /></slot>
  </span>
  <Teleport to="body">
    <div
      v-if="open" ref="pop" popover="manual" class="hint-pop parchment"
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
.hint.warn { color: #d8a53a; border-radius: 0; }
.hint.warn:hover, .hint.warn:focus-visible { color: var(--gold-hi); }
.hint-pop {
  position: fixed; z-index: 1000; max-width: calc(100vw - 16px);
  padding: 10px 12px; font-size: var(--fs-sm); line-height: 1.7; white-space: pre-line;
  background: var(--tip-bg); color: var(--tip-text); border: 1px solid #b8955a; border-radius: 3px;
  box-shadow: 0 8px 24px #000c; pointer-events: none;
}
.hint-pop.above { transform: translateY(-100%); }
/* popover 的預設樣式（置中、inset: 0）拿掉，用上面算好的位置 */
.hint-pop[popover] { inset: auto; margin: 0; overflow: visible; }
</style>
