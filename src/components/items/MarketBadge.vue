<script setup lang="ts">
import { computed } from 'vue'
import { marketMult, pctText, tradeCategoryName } from '@/engine/market'
import { shopPlace } from '@/engine/trade'
import { useGame } from '@/stores/game'

// 這件商品在這裡的行情（城鎮標籤與動態狀態的類別倍率）：▼ 便宜、▲ 貴；滑過去看是哪些標籤（docs/TRADE.md 3.1 節）
const props = defineProps<{ name: string }>()
const game = useGame()
const m = computed(() => marketMult(game.state!, shopPlace(game.state!).id, props.name))
const title = computed(() => `${tradeCategoryName(m.value.category)}：${m.value.parts.map((p) => `${p.label} ${pctText(p.x)}${p.daysLeft ? `（狀態，還有 ${p.daysLeft} 天）` : ''}`).join('、')}（買入、賣出都照這個）`)
</script>

<template>
  <span v-if="m.parts.length && m.x !== 1" class="mk" :class="m.x < 1 ? 'down' : 'up'" :title="title">{{ m.x < 1 ? '▼' : '▲' }}{{ pctText(m.x) }}</span>
</template>

<style scoped>
.mk { font-size: 0.78rem; font-weight: 600; white-space: nowrap; border-radius: 3px; padding: 0 4px; border: 1px solid currentColor; }
.down { color: var(--good); }
.up { color: var(--danger); }
</style>
