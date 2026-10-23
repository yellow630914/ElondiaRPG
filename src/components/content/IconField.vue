<script setup lang="ts">
import { computed, ref } from 'vue'
import ItemIcon from '../items/ItemIcon.vue'
import type { DrawSource } from '../items/itemIcon'
import Hint from '../ui/Hint.vue'
import { fileToIcon } from './iconUpload'

// 圖示欄位：上傳一張圖覆蓋內建的圖示，移除後換回內建的（fallback）
const props = defineProps<{ modelValue?: string; fallback: DrawSource; hint?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const input = ref<HTMLInputElement>()
const error = ref('')
const shown = computed<DrawSource>(() => (props.modelValue ? { kind: 'image', src: props.modelValue } : props.fallback))

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  error.value = ''
  try {
    emit('update:modelValue', await fileToIcon(file))
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <div class="icon-field">
    <span class="item-tile big"><ItemIcon :source="shown" :size="40" /></span>
    <span class="item-tile"><ItemIcon :source="shown" :size="24" /></span>
    <div class="side">
      <div class="row">
        <button type="button" class="small" :disabled="disabled" @click="input?.click()">上傳圖片…</button>
        <button v-if="modelValue" type="button" class="small" :disabled="disabled" @click="emit('update:modelValue', undefined)">移除（用內建的）</button>
        <span class="small muted">{{ modelValue ? '上傳的圖' : '內建的圖' }}</span>
        <Hint :text="hint ?? '上傳的圖會縮到 48×48 以內，保留透明背景；存在這個世界裡，匯出世界包時一起帶走。建議用透明背景的方形圖。'" />
      </div>
      <p v-if="error" class="small error">{{ error }}</p>
    </div>
    <input ref="input" type="file" accept="image/png,image/webp,image/jpeg,image/gif" hidden @change="pick" />
  </div>
</template>

<style scoped>
.icon-field { display: flex; align-items: center; gap: 8px; }
.item-tile.big { width: 52px; height: 52px; }
.side { display: grid; gap: 2px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.error { color: var(--danger); margin: 0; }
</style>
