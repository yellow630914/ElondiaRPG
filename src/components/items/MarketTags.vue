<script setup lang="ts">
import { computed } from 'vue'
import { tagEffectText, townTags } from '@/engine/market'
import GameIcon from '../ui/GameIcon.vue'

// 這座聚落的固定標籤與效果（docs/TRADE.md 3.1 節）
const props = defineProps<{ location: string; name?: string }>()
const tags = computed(() => townTags(props.location))
</script>

<template>
  <div v-if="tags.length" class="market small">
    <span class="lbl"><GameIcon name="trend" :size="13" /> {{ name ? `${name}的行情` : '這裡的行情' }}</span>
    <span v-for="t in tags" :key="t.id" class="tag" :title="t.def.desc">{{ t.def.name }}<small>：{{ tagEffectText(t.def) }}</small></span>
  </div>
</template>

<style scoped>
.market { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.lbl { color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.tag { border: 1px solid var(--border); border-radius: var(--radius); padding: 1px 6px; background: var(--chip-bg); }
.tag small { color: var(--muted); }
</style>
