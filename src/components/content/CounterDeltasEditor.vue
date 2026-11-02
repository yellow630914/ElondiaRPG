<script setup lang="ts">
import { computed } from 'vue'
import { storyCounters } from '@/engine/data'
import { useContent } from '@/stores/content'

// 結果裡的劇情計數器加減：{ 計數器 id: 增減 }
const model = defineModel<Record<string, number> | undefined>()
const content = useContent()
const counterIds = computed(() => {
  void content.version
  return Object.keys(storyCounters)
})
const rows = computed(() => Object.entries(model.value ?? {}))
function put(next: Record<string, number>) {
  model.value = Object.keys(next).length ? next : undefined
}
function setRow(oldId: string, id: string, delta: number) {
  const next: Record<string, number> = {}
  for (const [k, v] of rows.value) next[k === oldId ? id : k] = k === oldId ? delta : v
  put(next)
}
function add() {
  const id = counterIds.value.find((k) => !(k in (model.value ?? {})))
  if (id) put({ ...(model.value ?? {}), [id]: 1 })
}
function remove(id: string) {
  const { [id]: _drop, ...rest } = model.value ?? {}
  put(rest)
}
</script>

<template>
  <div class="row small">
    劇情計數器
    <span v-for="[id, d] in rows" :key="id" class="row">
      <select :value="id" @change="setRow(id, ($event.target as HTMLSelectElement).value, d)">
        <option v-for="k in counterIds" :key="k" :value="k" :disabled="k !== id && k in (model ?? {})">{{ storyCounters[k]?.name ?? k }}</option>
        <option v-if="!counterIds.includes(id)" :value="id">{{ id }}（不存在）</option>
      </select>
      <input :value="d" type="number" min="-100" max="100" class="num" @change="setRow(id, id, Math.round(Number(($event.target as HTMLInputElement).value)) || 0)" />
      <button class="small" @click="remove(id)" title="移除">✕</button>
    </span>
    <button v-if="counterIds.length" class="small" @click="add">＋ 加減計數器</button>
  </div>
</template>

<style scoped src="./editor.css"></style>
