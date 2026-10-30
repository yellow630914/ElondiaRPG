<script setup lang="ts">
import { computed } from 'vue'
import { damageTypeName, damageTypes } from '@/engine/data'

// 傷害倍率的加減（抗性、攻擊加成）：每列一種傷害屬性或群組
const model = defineModel<Partial<Record<string, number>> | undefined>()
const props = withDefaults(defineProps<{ label: string; max?: number }>(), { max: 2 })

const keys = [...damageTypes.types.map((t) => t.id), ...Object.keys(damageTypes.groups), 'all']
const name = (k: string) => (k === 'all' ? '全部' : damageTypeName(k))
const rows = computed(() => Object.entries(model.value ?? {}).filter((e): e is [string, number] => e[1] !== undefined))

function set(oldKey: string, key: string, value: number) {
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(model.value ?? {})) {
    if (k === oldKey) next[key] = value
    else if (k !== key && v !== undefined) next[k] = v
  }
  model.value = Object.keys(next).length ? next : undefined
}
function remove(key: string) {
  const next = { ...(model.value ?? {}) }
  delete next[key]
  model.value = Object.keys(next).length ? next : undefined
}
function add() {
  const free = keys.find((k) => !(k in (model.value ?? {})))
  if (free) model.value = { ...(model.value ?? {}), [free]: -0.25 }
}
</script>

<template>
  <div class="aff">
    <span class="small">{{ label }}：</span>
    <span v-for="[k, v] in rows" :key="k" class="row-item">
      <select :value="k" @change="set(k, ($event.target as HTMLSelectElement).value, v)">
        <option v-for="o in keys" :key="o" :value="o">{{ name(o) }}</option>
      </select>
      <input type="number" step="0.25" :min="-1" :max="props.max" :value="v" @change="set(k, k, Number(($event.target as HTMLInputElement).value))" />
      <span class="small muted">×{{ Math.max(0, Math.round((1 + v) * 100) / 100) }}</span>
      <button class="small" @click="remove(k)" title="移除">✕</button>
    </span>
    <button class="small" @click="add">＋</button>
  </div>
</template>

<style scoped>
.aff { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
.row-item { display: inline-flex; gap: 4px; align-items: center; border: 1px solid var(--border); border-radius: var(--radius); padding: 2px 4px; }
.row-item input { width: 84px; min-width: 84px; }
</style>
