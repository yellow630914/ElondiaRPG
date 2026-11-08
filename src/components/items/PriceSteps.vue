<script setup lang="ts">
import { pctText } from '@/engine/market'
import { formatMoney } from '@/engine/money'
import type { PriceBreakdown, PriceStep } from '@/engine/trade'
import Hint from '../ui/Hint.vue'

// 價格拆解（docs/TRADE.md 3.3 節）：基本價，後面每一項加減做成小標籤（▲ 變貴、▼ 變便宜；收購價反過來，▲ 是收得比較多），
// 標籤只寫漲跌，滑過或點一下（focus）才浮出是哪一項；最後是價格
const props = defineProps<{ b: PriceBreakdown; sell?: boolean }>()

const rest = () => props.b.steps.filter((s) => s.kind !== 'base' && s.x !== 1)
const base = () => props.b.steps.find((s) => s.kind === 'base')
/** 這一項對玩家是好是壞：買入時變便宜好、收購時收得多好 */
function tone(s: PriceStep): string {
  if (s.kind === 'cap') return 'bad'
  if (s.x === undefined || s.x === 1) return ''
  return (s.x < 1) !== !!props.sell ? 'good' : 'bad'
}
const value = (s: PriceStep) => (s.x === undefined ? s.text : `${s.x < 1 ? '▼' : '▲'}${s.text.startsWith('×') ? pctText(s.x) : s.text}`)
</script>

<template>
  <div class="steps small">
    <span v-if="base()" class="muted">{{ base()!.label }} {{ base()!.text }}</span>
    <span v-for="(s, i) in rest()" :key="i" class="chip" :class="tone(s)" tabindex="0" :title="`${s.label}：${s.text}`">
      <span class="lbl">{{ s.label }}</span>{{ value(s) }}
    </span>
    <span class="op">＝</span><strong>{{ formatMoney(b.total) }}</strong>
    <Hint :text="`${sell ? '收購價' : '價格'} = 基本價，乘上每一個標籤（滑過或點一下標籤看是哪一項）${b.category ? `；這件算「${b.category}」類` : ''}。每一步四捨五入，合起來可能差一點。`" />
  </div>
</template>

<style scoped>
.steps { display: flex; flex-wrap: wrap; gap: 3px 5px; align-items: center; }
.op { color: var(--muted); }
/* 和行情的標籤同一種樣子：只寫漲跌，滑過或 focus 才浮出是哪一項 */
.chip { font-size: 0.78rem; font-weight: 600; white-space: nowrap; border-radius: 3px; padding: 0 4px; border: 1px solid currentColor; color: var(--muted); cursor: default; outline: none; }
.chip.good { color: var(--good); }
.chip.bad { color: var(--danger); }
.chip .lbl { display: none; font-weight: 400; margin-right: 4px; }
.chip:hover .lbl, .chip:focus .lbl, .chip:focus-visible .lbl { display: inline; }
.chip:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 30%, transparent); }
</style>
