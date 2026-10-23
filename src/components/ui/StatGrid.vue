<script setup lang="ts">
// key-value 表格：左邊欄位名稱、中間數值、右邊補充（例如「行動點｜4｜每回合 +2」）
export interface StatItem {
  label: string
  value: string | number
  note?: string
  hint?: string
}
withDefaults(defineProps<{ items: StatItem[]; columns?: number }>(), { columns: 1 })
</script>

<template>
  <div class="stat-grid" :style="{ '--cols': columns }">
    <div v-for="it in items" :key="it.label" class="kv" :title="it.hint">
      <span class="label">{{ it.label }}</span>
      <span class="v">{{ it.value }}</span>
      <span v-if="it.note" class="note">{{ it.note }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-grid { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 0 24px; }
.kv { display: grid; grid-template-columns: 6.5em minmax(0, 1fr) auto; gap: 8px; align-items: baseline; padding: 5px 0; border-bottom: 1px dotted var(--border); }
.v { font-weight: 700; font-variant-numeric: tabular-nums; }
.note { font-size: var(--fs-sm); color: var(--muted); text-align: right; }
</style>
