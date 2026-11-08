<script setup lang="ts">
import { computed } from 'vue'
import { tagEffectText, townStates, townTags } from '@/engine/market'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'
import { vMarquee } from '../marquee'

// 這座聚落的行情：固定標籤與今天的動態狀態、效果（docs/TRADE.md 3.1、3.2 節）
// marquee：放不下時捲動（預設）；交易畫面傳 false，放不下時截斷成「…」
// compact：交易畫面頂端用——不寫「XX的行情」，標籤上色（固定標籤綠、今天的狀態金色）
const props = withDefaults(defineProps<{ location: string; name?: string; marquee?: boolean; compact?: boolean }>(), { name: undefined, marquee: true, compact: false })
const game = useGame()
const tags = computed(() => townTags(props.location))
const states = computed(() => (game.state ? townStates(game.state, props.location) : []))
const left = (end: number) => end - (game.state?.time.day ?? 0)
</script>

<template>
  <div v-if="tags.length || states.length" class="market small" :class="{ compact }">
    <span v-if="!compact" class="lbl"><GameIcon name="trend" :size="13" /> {{ name ? `${name}的行情` : '這裡的行情' }}</span>
    <span v-for="t in tags" :key="t.id" class="tag" :title="t.def.desc"><span v-marquee="props.marquee" class="marquee"><span>{{ t.def.name }}<small>：{{ tagEffectText(t.def) }}</small></span></span></span>
    <span v-for="x in states" :key="x.id" class="tag state" :title="x.def.desc"><GameIcon name="warning" :size="12" /><span v-marquee="props.marquee" class="marquee"><span>{{ x.def.name }}<small>：{{ tagEffectText(x.def) }}・還有 {{ left(x.end) }} 天</small></span></span></span>
  </div>
</template>

<style scoped>
.market { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; min-width: 0; max-width: 100%; }
.lbl { color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
/* 放不下時不裁掉：標籤最寬到這一列，字用跑馬燈來回捲 */
.tag { border: 1px solid var(--border); border-radius: var(--radius); padding: 1px 6px; background: var(--chip-bg); display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0; box-sizing: border-box; }
.tag .marquee { flex: 0 1 auto; }
.tag small { color: var(--muted); }
.tag.state { border-color: var(--accent); border-style: dashed; }
.tag.state :deep(.game-icon) { color: var(--accent); }
/* 交易畫面頂端：彩色的標籤，和錢在同一列 */
.compact { display: contents; }
.compact .tag { border-color: color-mix(in srgb, var(--accent-2) 55%, transparent); background: color-mix(in srgb, var(--accent-2) 12%, var(--chip-bg)); color: var(--accent-2); }
.compact .tag small { color: inherit; opacity: 0.85; }
.compact .tag.state { border-color: var(--gold-lo, var(--accent)); background: color-mix(in srgb, var(--accent) 14%, var(--chip-bg)); color: var(--accent); }
</style>
