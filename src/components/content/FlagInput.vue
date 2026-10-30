<script setup lang="ts">
import { ref } from 'vue'
import { cleanFlag } from '@/engine/storyFlags'

// 劇情旗標的清單：一個一個加入，有自動完成（內容頁籤裡用過的旗標：世界頁的 cv-known-flags，只算一次）
const model = defineModel<string[] | undefined>()
defineProps<{ placeholder?: string }>()
const text = ref('')

function add() {
  const f = cleanFlag(text.value)
  if (!f) return
  const list = model.value ?? []
  if (!list.includes(f)) model.value = [...list, f]
  text.value = ''
}
function remove(f: string) {
  const list = (model.value ?? []).filter((x) => x !== f)
  model.value = list.length ? list : undefined
}
</script>

<template>
  <span class="flag-input">
    <span v-for="f in model ?? []" :key="f" class="tag chip">🚩 {{ f }} <button class="x" @click="remove(f)" title="移除">✕</button></span>
    <input v-model="text" list="cv-known-flags" :placeholder="placeholder ?? '旗標名稱'" class="flag-text" @keydown.enter.prevent="add" @change="add" />
  </span>
</template>

<style scoped>
.flag-input { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chip { display: inline-flex; gap: 4px; align-items: center; }
.x { padding: 0 4px; line-height: 1.2; }
.flag-text { width: 140px; }
</style>
