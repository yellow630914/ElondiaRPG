<script lang="ts">
// 最近一次操作是滑鼠還是鍵盤（所有對話框共用）
let lastInputWasPointer = false
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => { lastInputWasPointer = true }, true)
  window.addEventListener('keydown', () => { lastInputWasPointer = false }, true)
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import { ICON_PATHS, type IconName } from './ui/iconPaths'

// 以原生 <dialog> 實作的對話框（羊皮紙樣式）：Esc 或點背景關閉。
// icon 可以是介面圖示的名稱（見 ui/iconPaths.ts），也可以是 emoji。
// fixed：有分頁的對話框固定高度（等於視窗高度），切分頁時標題與分頁列不會跳動
// stay：不要因為開始了談判或等待中的行動而自動關掉（談判自己的對話框）
const props = withDefaults(defineProps<{ open: boolean; title: string; icon?: string; width?: string; inlineError?: boolean; fixed?: boolean; stay?: boolean }>(), { width: '960px', icon: undefined })
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement | null>(null)

const isIconName = (s: string | undefined): s is IconName => !!s && s in ICON_PATHS

// 用滑鼠打開的對話框關掉後，焦點回到原本的按鈕時不要留著焦點框（鍵盤操作時保留）
let opener: HTMLElement | null = null
function sync() {
  const d = el.value
  if (!d) return
  if (props.open && !d.open) {
    opener = lastInputWasPointer && document.activeElement instanceof HTMLElement ? document.activeElement : null
    d.showModal()
  } else if (!props.open && d.open) d.close()
}
function onClose() {
  emit('close')
  const o = opener
  opener = null
  if (o) setTimeout(() => { if (document.activeElement === o) o.blur() })
}

watch(() => props.open, () => nextTick(sync))
onMounted(sync)

// 對話框在瀏覽器的最上層，頁面上的東西都被蓋住：
// - 錯誤訊息在對話框裡也顯示一份（inline 時表示裡面的內容自己會顯示，例如交易視窗）
// - 在對話框裡開始了談判或等待中的行動（它們在頁面上）時，關掉對話框讓玩家看得到
const game = useGame()
const busy = computed(() => (game.state?.negotiations?.length ?? 0) + (game.state?.pendingAction ? 1 : 0))
watch(busy, (now, before) => {
  if (props.open && !props.stay && now > before) emit('close')
})

function onClick(e: MouseEvent) {
  // 點到對話框外的背景才關閉
  if (e.target === el.value) emit('close')
}
</script>

<template>
  <dialog ref="el" class="app-dialog parchment paper" :class="{ fixed }" :style="{ '--dialog-width': width }" @close="onClose" @click="onClick">
    <div class="dialog-inner">
      <header class="dialog-head">
        <h2>
          <GameIcon v-if="isIconName(icon)" class="icon" :name="icon" :size="22" />
          <span v-else-if="icon" class="icon">{{ icon }}</span>{{ title }}
        </h2>
        <slot name="head" />
        <button class="close ghost" aria-label="關閉" @click="emit('close')"><GameIcon name="close" :size="16" /></button>
      </header>
      <div class="dialog-body">
        <p v-if="open && game.error && !inlineError" class="dialog-error small row">
          <GameIcon name="warning" :size="14" /> {{ game.error }}
          <button class="small ghost" style="margin-left: auto" aria-label="關閉" @click="game.error = null"><GameIcon name="close" :size="12" /></button>
        </p>
        <slot v-if="open" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.app-dialog {
  width: min(var(--dialog-width), calc(100vw - 24px));
  max-height: calc(100vh - 40px);
  padding: 0;
  border: 6px solid #3a2818;
  border-image: linear-gradient(180deg, #5b3f24, #2e1f12) 1;
  border-radius: 0;
  box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #c99a45, 0 20px 60px #000;
  text-align: left;
}
.app-dialog::backdrop { background: #000b; }
/* 打開時從 96% 放大到 100%、淡入 */
.app-dialog[open] { animation: dialog-in 0.15s ease-out; }
.app-dialog[open]::backdrop { animation: backdrop-in 0.15s ease-out; }
@keyframes dialog-in { from { opacity: 0; transform: scale(0.96); } }
@keyframes backdrop-in { from { opacity: 0; } }
.dialog-inner { display: flex; flex-direction: column; max-height: calc(100vh - 52px); }
.app-dialog.fixed { height: calc(100vh - 40px); }
.app-dialog.fixed .dialog-inner { height: 100%; }
.app-dialog.fixed .dialog-body { flex: 1; min-height: 0; }
.dialog-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px 8px; position: relative;
}
.dialog-head::after {
  content: ''; position: absolute; left: 16px; right: 16px; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent, #8a6a3a, transparent);
}
.dialog-head h2 { margin: 0; font-size: var(--fs-xl); letter-spacing: 0.16em; display: flex; align-items: center; }
.icon { margin-right: 8px; color: var(--accent); }
.close { margin-left: auto; width: 30px; height: 30px; padding: 0; display: grid; place-items: center; border-color: #8a6a3a; color: #5b3a1e; }
.close:hover:not(:disabled) { background: #7a4a1e; color: var(--parchment); }
.dialog-body { padding: 14px 18px 18px; overflow-y: auto; }
.dialog-error { color: var(--danger); margin: 0 0 10px; }
</style>
