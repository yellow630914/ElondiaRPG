<script setup lang="ts">
import { computed } from 'vue'
import { npcs as namedNpcs, type StoryCond } from '@/engine/data'

// 條件裡的好感：某位固定 NPC 的好感（親密度）至少多少（沒見過面算 0）
const cond = defineModel<StoryCond>({ required: true })
defineProps<{ label: string }>()
const rows = computed(() => Object.entries(cond.value.affinity ?? {}))
function set(oldId: string, id: string, min: number) {
  const next: Record<string, number> = {}
  for (const [k, v] of rows.value) next[k === oldId ? id : k] = k === oldId ? min : v
  cond.value = { ...cond.value, affinity: next }
}
function add() {
  const id = namedNpcs.find((n) => !(n.id in (cond.value.affinity ?? {})))?.id
  // 換掉整個物件（父層傳進來的可能是暫時的空物件）
  if (id) cond.value = { ...cond.value, affinity: { ...(cond.value.affinity ?? {}), [id]: 20 } }
}
function remove(id: string) {
  const { [id]: _drop, ...rest } = cond.value.affinity ?? {}
  const { affinity: _old, ...others } = cond.value
  cond.value = Object.keys(rest).length ? { ...others, affinity: rest } : others
}
</script>

<template>
  <div class="row small">
    {{ label }}
    <span v-for="[id, min] in rows" :key="id" class="row">
      <select :value="id" @change="set(id, ($event.target as HTMLSelectElement).value, min)">
        <option v-for="n in namedNpcs" :key="n.id" :value="n.id" :disabled="n.id !== id && n.id in (cond.affinity ?? {})">{{ n.name }}</option>
      </select>
      的好感 ≥ <input :value="min" type="number" min="-100" max="100" class="num" @change="set(id, id, Number(($event.target as HTMLInputElement).value) || 0)" />
      <button class="small" @click="remove(id)">移除</button>
    </span>
    <button class="small" @click="add">＋ 好感條件</button>
  </div>
</template>

<style scoped src="./editor.css"></style>
