<script setup lang="ts">
import { computed } from 'vue'
import { tagEffectText, townStates, townTags } from '@/engine/market'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'

// 這座聚落的行情：固定標籤與今天的動態狀態、效果（docs/TRADE.md 3.1、3.2 節）
const props = defineProps<{ location: string; name?: string }>()
const game = useGame()
const tags = computed(() => townTags(props.location))
const states = computed(() => (game.state ? townStates(game.state, props.location) : []))
const left = (end: number) => end - (game.state?.time.day ?? 0)
</script>

<template>
  <div v-if="tags.length || states.length" class="market small">
    <span class="lbl"><GameIcon name="trend" :size="13" /> {{ name ? `${name}的行情` : '這裡的行情' }}</span>
    <span v-for="t in tags" :key="t.id" class="tag" :title="t.def.desc">{{ t.def.name }}<small>：{{ tagEffectText(t.def) }}</small></span>
    <span v-for="x in states" :key="x.id" class="tag state" :title="x.def.desc"><GameIcon name="warning" :size="12" /> {{ x.def.name }}<small>：{{ tagEffectText(x.def) }}・還有 {{ left(x.end) }} 天</small></span>
  </div>
</template>

<style scoped>
.market { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.lbl { color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.tag { border: 1px solid var(--border); border-radius: var(--radius); padding: 1px 6px; background: var(--chip-bg); }
.tag small { color: var(--muted); }
.tag.state { border-color: var(--accent); border-style: dashed; }
.tag.state :deep(.game-icon) { color: var(--accent); }
</style>
