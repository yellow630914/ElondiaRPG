<script setup lang="ts">
import { ref } from 'vue'

// 名稱的清單（物品名稱、裝備底材）：一個一個加入，有自動完成；options 是 [值, 顯示的說明]
const model = defineModel<string[] | undefined>()
const props = defineProps<{ options: [string, string][]; placeholder?: string }>()
const text = ref('')
const listId = `names-${Math.random().toString(36).slice(2, 8)}`
const label = (v: string) => props.options.find(([x]) => x === v)?.[1] ?? v

function add() {
  const v = text.value.trim()
  if (!v) return
  const list = model.value ?? []
  if (!list.includes(v)) model.value = [...list, v]
  text.value = ''
}
function remove(v: string) {
  const list = (model.value ?? []).filter((x) => x !== v)
  model.value = list.length ? list : undefined
}
</script>

<template>
  <span class="name-input">
    <span v-for="v in model ?? []" :key="v" class="tag chip">{{ label(v) }} <button class="x" @click="remove(v)">×</button></span>
    <input v-model="text" :list="listId" :placeholder="placeholder ?? '名稱'" class="name-text" @keydown.enter.prevent="add" @change="add" />
    <datalist :id="listId"><option v-for="[v, l] in options" :key="v" :value="v">{{ l }}</option></datalist>
  </span>
</template>

<style scoped>
.name-input { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chip { display: inline-flex; gap: 4px; align-items: center; }
.x { padding: 0 4px; line-height: 1.2; }
.name-text { width: 180px; }
</style>
