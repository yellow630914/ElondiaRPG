<script setup lang="ts">
defineProps<{ kind: 'hp' | 'mp'; value: number; max: number }>()
</script>

<template>
  <div class="stat small">
    <span class="label">{{ kind.toUpperCase() }} {{ value }}/{{ max }}</span>
    <div class="bar" :class="kind">
      <span :style="{ width: `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%` }" />
    </div>
  </div>
</template>

<style scoped>
.stat { display: grid; gap: 2px; }
.label { color: var(--muted); }
</style>
