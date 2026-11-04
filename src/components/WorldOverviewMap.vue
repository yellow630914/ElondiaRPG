<script setup lang="ts">
// 世界總覽圖：兩塊大陸與東海（assets/map/world-overview.webp），聚落依類型畫成幾何圖形，目前位置加一圈光。
import { computed } from 'vue'
import overviewUrl from '../../assets/map/world-overview.webp'
import overview from '../../assets/map/world-overview.json'
import { geography, locationById } from '@/engine/data'

const props = defineProps<{ here: string }>()

type Shape = 'capital' | 'city' | 'town' | 'port' | 'village' | 'fort'
const SHAPE: Record<string, Shape> = { capital: 'capital', city: 'city', town: 'town', port: 'port', village: 'village', fortress: 'fort', outpost: 'fort' }
const LEGEND: { shape: Shape; name: string }[] = [
  { shape: 'capital', name: '首都' }, { shape: 'city', name: '城市' }, { shape: 'town', name: '城鎮' },
  { shape: 'port', name: '港口' }, { shape: 'village', name: '村落' }, { shape: 'fort', name: '要塞、哨站' },
]
const places = overview.places as Record<string, number[]>
const labeled = new Set(overview.labeled)

const marks = computed(() => geography.locations
  .filter((l) => l.type !== 'dungeon' && places[l.id])
  .map((l) => {
    const [x = 0, y = 0] = places[l.id]!
    return { id: l.id, name: l.name, x, y, shape: SHAPE[l.type] ?? 'town', label: !labeled.has(l.id), region: geography.regions.find((r) => r.id === l.region)?.name ?? '' }
  }))
/** 目前的聚落；在地下城時標出路線相連的聚落 */
const hereMark = computed(() => {
  const loc = locationById(props.here)
  const id = places[loc.id] ? loc.id : geography.routes.map((r) => (r.a === loc.id ? r.b : r.b === loc.id ? r.a : '')).find((x) => places[x])
  return marks.value.find((m) => m.id === id)
})
</script>

<template>
  <figure class="overview">
    <div class="scroll">
    <svg :viewBox="`0 0 ${overview.width} ${overview.height}`" role="img" aria-label="世界總覽圖：埃隆迪亞大陸、東海與炎華之地">
      <image :href="overviewUrl" x="0" y="0" :width="overview.width" :height="overview.height" />
      <g v-if="hereMark" :transform="`translate(${hereMark.x} ${hereMark.y})`"><circle class="here-bg" r="22" /><circle class="here" r="22" /></g>
      <g v-for="m in marks" :key="m.id" :class="['mark', m.shape]" :transform="`translate(${m.x} ${m.y})`">
        <title>{{ m.name }}（{{ m.region }}）</title>
        <template v-if="m.shape === 'capital'">
          <circle r="13" class="ring" />
          <circle r="7" />
        </template>
        <circle v-else-if="m.shape === 'city'" r="9" />
        <rect v-else-if="m.shape === 'town' || m.shape === 'port'" x="-8" y="-8" width="16" height="16" />
        <polygon v-else-if="m.shape === 'village'" points="0,-11 10,7 -10,7" />
        <polygon v-else points="0,-11 10,0 0,11 -10,0" />
        <text v-if="m.label" x="16" y="7">{{ m.name }}</text>
      </g>
    </svg>
    </div>
    <figcaption class="legend small">
      <span v-for="l in LEGEND" :key="l.shape" class="item">
        <svg viewBox="-14 -14 28 28" width="16" height="16" :class="['mark', l.shape]" aria-hidden="true">
          <template v-if="l.shape === 'capital'"><circle r="12" class="ring" /><circle r="6" /></template>
          <circle v-else-if="l.shape === 'city'" r="9" />
          <rect v-else-if="l.shape === 'town' || l.shape === 'port'" x="-8" y="-8" width="16" height="16" />
          <polygon v-else-if="l.shape === 'village'" points="0,-11 10,7 -10,7" />
          <polygon v-else points="0,-11 10,0 0,11 -10,0" />
        </svg>{{ l.name }}
      </span>
      <span class="item"><svg viewBox="-14 -14 28 28" width="16" height="16" aria-hidden="true"><circle r="9" class="here-bg" /><circle r="9" class="here" /></svg>目前位置</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.overview { margin: 0; min-width: 0; max-width: 100%; }
.scroll { overflow-x: auto; max-width: 100%; border-radius: var(--radius); }
.scroll > svg { width: 100%; height: auto; display: block; }
/* 手機：地圖放大到看得清楚字，左右捲動 */
@media (max-width: 720px) { .scroll > svg { width: 900px; max-width: none; } }
.mark circle, .mark rect, .mark polygon { stroke: #fff; stroke-width: 2.5; }
.mark.capital circle, .mark.city circle { fill: #b3261e; }
.mark.capital .ring { fill: none; stroke-width: 3.5; }
.mark.town rect { fill: #c47a12; }
.mark.port rect { fill: #1f5fa8; }
.mark.village polygon { fill: #2e7d32; }
.mark.fort polygon { fill: #5d4037; }
.mark text { font-size: 20px; font-weight: 700; fill: #fff; stroke: #2b1d0e; stroke-width: 4px; paint-order: stroke; pointer-events: none; }
.here-bg { fill: none; stroke: #2b1d0e; stroke-width: 9; }
.here { fill: none; stroke: #ffc107; stroke-width: 5; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { stroke: #fff3c4; } }
@media (prefers-reduced-motion: reduce) { .here { animation: none; } }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; }
.legend .item { display: inline-flex; align-items: center; gap: 4px; }
</style>
