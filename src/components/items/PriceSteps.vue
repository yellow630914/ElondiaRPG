<script setup lang="ts">
import { formatMoney } from '@/engine/money'
import type { PriceBreakdown } from '@/engine/trade'

// 價格拆解（docs/TRADE.md 3.3 節）：基本價 × 店家加成 × 聚落物價 × 標籤、狀態 × 折扣、聲望、身分 ＝ 價格
defineProps<{ b: PriceBreakdown; sell?: boolean }>()
</script>

<template>
  <div class="steps small">
    <span class="muted">{{ sell ? '收購價' : '價格' }}怎麼算：</span>
    <template v-for="(s, i) in b.steps" :key="i">
      <span v-if="i" class="op">×</span>
      <span class="step" :class="`k-${s.kind}`">{{ s.label }} <b>{{ s.text }}</b></span>
    </template>
    <span class="op">＝</span><strong>{{ formatMoney(b.total) }}</strong>
    <span v-if="b.category" class="muted">（{{ b.category }}）</span>
    <span class="muted note">每一步四捨五入，合起來可能差一點</span>
  </div>
</template>

<style scoped>
.steps { display: flex; flex-wrap: wrap; gap: 2px 4px; align-items: baseline; }
.op { color: var(--muted); }
.step { white-space: nowrap; }
.step b { font-weight: 600; }
.step.k-tag b { color: var(--accent-2); }
.step.k-state b { color: var(--accent); }
.step.k-cap b, .step.k-clamp b, .step.k-glut b { color: var(--danger); }
.note { flex-basis: 100%; font-size: 0.75rem; }
</style>
