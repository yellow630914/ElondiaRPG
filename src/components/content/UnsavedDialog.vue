<script setup lang="ts">
import { computed } from 'vue'
import AppDialog from '../AppDialog.vue'
import { answerUnsaved, unsavedAsk, unsavedSave } from './unsaved'

// 世界編輯器的未儲存保護：離開有未儲存修改的項目前，問要儲存、放棄，還是留下來（unsaved.ts）
const blocked = computed(() => unsavedSave.value?.blocked || (!unsavedSave.value ? '這一項不能從這裡儲存' : ''))
</script>

<template>
  <AppDialog :open="!!unsavedAsk" title="還沒儲存" icon="💾" width="440px" @close="answerUnsaved('stay')">
    <p>這一項還有未儲存的修改。</p>
    <p v-if="blocked" class="small warn-text">現在不能儲存：{{ blocked }}</p>
    <div class="row">
      <button class="primary" :disabled="!!blocked" @click="answerUnsaved('save')">💾 儲存</button>
      <button class="danger" @click="answerUnsaved('discard')">放棄修改</button>
      <span class="spacer" />
      <button @click="answerUnsaved('stay')">留在這裡</button>
    </div>
  </AppDialog>
</template>

<style scoped>
p { margin: 0 0 10px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
.spacer { flex: 1; }
.warn-text { color: var(--danger); }
</style>
