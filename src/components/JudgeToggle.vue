<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useSettings } from '@/stores/settings'
import AiToggles from './AiToggles.vue'
import GameIcon from './ui/GameIcon.vue'

// 冒險頁面的「AI」按鈕：按鈕上顯示這裡相關的狀態（行動旁邊是誰判定，日誌是否自動寫出經過），
// 點開泡泡視窗列出所有 AI 開關（和設定頁同一組，見 AiToggles）。
// 泡泡掛在 body 上（fixed 定位），用 popover 放進瀏覽器的最上層，不會被面板或對話框蓋住。
const props = withDefaults(defineProps<{ show?: 'judge' | 'narration' }>(), { show: 'judge' })
const settings = useSettings()
const on = () => (props.show === 'judge' ? settings.judgesWithAi() : settings.aiNarration && settings.ready('narration'))
const label = () => (props.show === 'judge' ? (on() ? 'AI 判定' : '規則判定') : on() ? 'AI 細節描述' : 'AI 細節描述：關')
const open = ref(false)
const btn = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0 })
const WIDTH = 340

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  const p = pop.value as (HTMLElement & { showPopover?: () => void }) | null
  if (p?.showPopover && !p.matches(':popover-open')) p.showPopover()
  place()
}
/** 放在按鈕下方，下面放不下就放上方，都放不下時貼著視窗邊緣（顯示之後才量得到高度） */
function place() {
  const r = btn.value?.getBoundingClientRect()
  if (!r) return
  const w = Math.min(WIDTH, window.innerWidth - 16)
  const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
  const h = pop.value?.offsetHeight ?? 0
  const below = r.bottom + 8
  const above = r.top - 8 - h
  const top = below + h <= window.innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, window.innerHeight - h - 8)
  pos.value = { left, top }
}
// 點泡泡外面關起來（泡泡裡的「?」說明也掛在 body 上，不算外面）
function onOutside(e: MouseEvent) {
  const t = e.target as Node
  if (!open.value || btn.value?.contains(t) || pop.value?.contains(t)) return
  if (t instanceof Element && t.closest('.hint-pop')) return
  open.value = false
}
window.addEventListener('click', onOutside)
onBeforeUnmount(() => window.removeEventListener('click', onOutside))

function moreSettings() {
  open.value = false
  window.dispatchEvent(new CustomEvent('elondia:open-settings', { detail: 'narration' }))
}
</script>

<template>
  <span class="judge-toggle small">
    <button
      ref="btn" type="button" class="ghost small ai-btn" :class="{ on: on() }" :aria-expanded="open"
      :title="`${label()}：點開調整所有 AI 開關`" @click.stop="toggle"
    >
      <GameIcon name="sparkles" :size="13" />{{ label() }}
    </button>
    <Teleport to="body">
      <div v-if="open" ref="pop" popover="manual" class="ai-pop parchment" :style="{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${WIDTH}px` }">
        <div class="pop-head"><b>AI 開關</b><button type="button" class="ghost small" aria-label="關閉" @click="open = false"><GameIcon name="close" :size="13" /></button></div>
        <p v-if="!settings.ready()" class="small muted">還沒有設定好的模型來源，所有 AI 功能都不會呼叫。</p>
        <AiToggles />
        <a href="#" class="small more" @click.prevent="moreSettings">完整設定（日誌種類、模型來源）…</a>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.judge-toggle { white-space: nowrap; }
.ai-btn { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; }
.ai-btn.on { color: var(--accent); border-color: var(--accent); }
.ai-pop {
  position: fixed; z-index: 999; max-width: calc(100vw - 16px); white-space: normal;
  padding: 10px 12px; font-size: var(--fs-sm); line-height: 1.6;
  background: var(--tip-bg); color: var(--tip-text); border: 1px solid #b8955a; border-radius: 3px; box-shadow: 0 8px 24px #000c;
}
.ai-pop[popover] { inset: auto; margin: 0; overflow: visible; }
.pop-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.more { display: inline-block; margin-top: 8px; }
</style>
