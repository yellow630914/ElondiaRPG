<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

// 以原生 <dialog> 實作的對話框：Esc 或點背景關閉。
const props = withDefaults(defineProps<{ open: boolean; title: string; icon?: string; width?: string }>(), { width: '960px' })
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement | null>(null)

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
  <dialog ref="el" class="app-dialog" :style="{ '--dialog-width': width }" @close="emit('close')" @click="onClick">
    <div class="dialog-inner">
      <header class="dialog-head">
        <h2><span v-if="icon" class="icon">{{ icon }}</span>{{ title }}</h2>
        <button class="small" aria-label="關閉" @click="emit('close')">✕</button>
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
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
}
.app-dialog::backdrop { background: #000a; }
.dialog-inner { display: flex; flex-direction: column; max-height: calc(100vh - 42px); }
.dialog-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--panel);
  position: sticky; top: 0;
}
.dialog-head h2 { margin: 0; }
.icon { margin-right: 6px; }
.dialog-body { padding: 14px 16px; overflow-y: auto; }
</style>
