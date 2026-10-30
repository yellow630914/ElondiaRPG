<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useContent } from '@/stores/content'
import { unsavedEdits } from './unsaved'

// 編輯器的表頭：名稱、內建／自建、未儲存，和儲存、放棄修改、恢復預設或刪除。捲動時留在畫面上。
// kind：builtin 內建（可以恢復預設）、custom 自建（可以刪除）、rules 只有一筆的設定（可以恢復預設，標籤只有「內建／已修改」）。
// 原版世界（唯讀）時儲存、恢復預設、刪除都停用。有未儲存的修改時回報給未儲存保護（unsaved.ts）。
const props = withDefaults(defineProps<{
  title: string
  kind: 'builtin' | 'custom' | 'rules'
  edited?: boolean
  dirty: boolean
  /** 儲存另外的條件（例如任務鏈有錯誤）；有說明時停用並顯示在按鈕上 */
  blocked?: string
  /** 用到這個項目的地方：有的話不能刪除 */
  usage?: string[]
  /** 沒有刪除按鈕（例如內建的特殊類型） */
  noRemove?: boolean
}>(), { edited: false, blocked: '', usage: () => [], noRemove: false })
const emit = defineEmits<{ save: []; discard: []; restore: []; remove: [] }>()
const content = useContent()

const tag = computed(() => (props.kind === 'custom' ? '自建' : props.kind === 'rules' ? (props.edited ? '已修改' : '內建') : props.edited ? '內建・已修改' : '內建'))
const readOnly = computed(() => content.readOnly)
// 回報給未儲存保護（同一時間只有一個編輯器打開）
watch(() => props.dirty, (v) => { unsavedEdits.value = v }, { immediate: true })
onBeforeUnmount(() => { unsavedEdits.value = false })
</script>

<template>
  <div class="row head">
    <h3><slot name="title">{{ title }}</slot></h3>
    <span class="tag">{{ tag }}</span>
    <slot name="tags" />
    <span v-if="dirty" class="tag unsaved">未儲存</span>
    <span class="spacer" />
    <button
      class="small primary" :disabled="readOnly || !dirty || !!blocked"
      :title="readOnly ? '原版世界不能修改' : blocked" @click="emit('save')"
    >💾 儲存</button>
    <button class="small" :disabled="!dirty" @click="emit('discard')">放棄修改</button>
    <button v-if="kind !== 'custom'" class="small" :disabled="readOnly || !edited" @click="emit('restore')">↩️ 恢復預設</button>
    <button
      v-else-if="!noRemove" class="small danger" :disabled="readOnly || usage.length > 0"
      :title="usage.length ? '還有地方用到，不能刪除（見下面的清單）' : ''" @click="emit('remove')"
    >🗑️ 刪除</button>
  </div>
</template>

<style scoped>
.head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.head h3 { margin: 0; }
.spacer { flex: 1; }
.unsaved { color: var(--danger); border-color: var(--danger); }
/* 有未儲存的修改時「儲存」發亮 */
.head button.primary:not(:disabled) { box-shadow: 0 0 0 1px var(--gold-hi), 0 0 12px #f0d08388; }
</style>
