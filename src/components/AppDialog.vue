<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import GameIcon from './ui/GameIcon.vue'
import { ICON_PATHS, type IconName } from './ui/iconPaths'

// 以原生 <dialog> 實作的對話框（羊皮紙樣式）：Esc 或點背景關閉。
// icon 可以是介面圖示的名稱（見 ui/iconPaths.ts），也可以是 emoji。
const props = withDefaults(defineProps<{ open: boolean; title: string; icon?: string; width?: string }>(), { width: '960px', icon: undefined })
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement | null>(null)

const isIconName = (s: string | undefined): s is IconName => !!s && s in ICON_PATHS

function sync() {
  const d = el.value
  if (!d) return
  if (props.open && !d.open) d.showModal()
  else if (!props.open && d.open) d.close()
}

watch(() => props.open, () => nextTick(sync))
onMounted(sync)

function onClick(e: MouseEvent) {
  // 點到對話框外的背景才關閉
  if (e.target === el.value) emit('close')
}
</script>

<template>
  <dialog ref="el" class="app-dialog parchment paper" :style="{ '--dialog-width': width }" @close="emit('close')" @click="onClick">
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
.dialog-inner { display: flex; flex-direction: column; max-height: calc(100vh - 52px); }
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
</style>
