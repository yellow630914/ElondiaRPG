<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Character, TattooPlace } from '@/engine/types'
import { oathText, placeName, TATTOO_PLACES, tattooAt, tattooDesc, tattooKindName, tattooName } from '@/engine/tattoos'
import Hint from '../ui/Hint.vue'

// 刺青的部位圖：正面與背面的人形，有刺青的部位打點；點部位看說明
const props = defineProps<{ member: Character }>()
const m = computed(() => props.member)

// 各部位在人形上的位置（viewBox 100×220）與在哪一面
const SPOT: Record<string, { x: number; y: number; side: 'front' | 'back' }> = {
  neck: { x: 50, y: 40, side: 'front' }, chest: { x: 50, y: 58, side: 'front' }, belly: { x: 50, y: 88, side: 'front' },
  left_arm: { x: 80, y: 74, side: 'front' }, right_arm: { x: 20, y: 74, side: 'front' },
  left_thigh: { x: 59, y: 140, side: 'front' }, right_thigh: { x: 41, y: 140, side: 'front' },
  left_calf: { x: 60, y: 185, side: 'front' }, right_calf: { x: 40, y: 185, side: 'front' },
  back: { x: 50, y: 66, side: 'back' }, hips: { x: 50, y: 112, side: 'back' },
}
const spotOf = (p: TattooPlace) => SPOT[p] ?? { x: 50, y: 100, side: 'front' as const }

const first = () => TATTOO_PLACES.find((p) => tattooAt(m.value, p)) ?? TATTOO_PLACES[0]!
const selected = ref<TattooPlace>(first())
watch(() => props.member.id, () => (selected.value = first()))
const current = computed(() => tattooAt(m.value, selected.value))
</script>

<template>
  <div class="tattoo">
    <div class="figs">
      <figure v-for="side in ['front', 'back'] as const" :key="side">
        <svg viewBox="0 0 100 220" aria-hidden="true">
          <path class="body" d="M38 38 Q50 44 62 38 L80 48 Q84 52 84 60 L88 110 L80 112 L74 66 L70 100 L72 130 L66 210 L54 210 L51 140 L49 140 L46 210 L34 210 L28 130 L30 100 L26 66 L20 112 L12 110 L16 60 Q16 52 20 48 Z" />
          <circle class="body" cx="50" cy="22" r="14" />
          <template v-for="p in TATTOO_PLACES" :key="p">
            <g v-if="spotOf(p).side === side" class="spot" :class="{ on: tattooAt(m, p), sel: selected === p, [tattooAt(m, p)?.kind ?? '']: true }" @click="selected = p">
              <circle :cx="spotOf(p).x" :cy="spotOf(p).y" r="6" />
              <title>{{ placeName(p) }}{{ tattooAt(m, p) ? `：${tattooName(tattooAt(m, p)!)}` : '' }}</title>
            </g>
          </template>
        </svg>
        <figcaption>{{ side === 'front' ? '正面' : '背面' }}</figcaption>
      </figure>
    </div>

    <div class="info">
      <h4>{{ placeName(selected) }}</h4>
      <template v-if="current">
        <div class="row"><span class="tag" :class="current.kind">{{ tattooKindName(current.kind) }}</span><b>{{ tattooName(current) }}</b></div>
        <p v-if="current.kind === 'oath' && current.attrs" class="oath small">{{ oathText(current.attrs) }}</p>
        <p class="small">{{ tattooDesc(current) }}<span v-if="current.by" class="muted">（{{ current.by }}刺的）</span></p>
      </template>
      <p v-else class="muted small">這個部位沒有刺青。</p>

      <ul class="plain list small">
        <li v-for="p in TATTOO_PLACES" :key="p" :class="{ sel: selected === p }" @click="selected = p">
          <span class="muted place">{{ placeName(p) }}</span>
          <span v-if="tattooAt(m, p)">{{ tattooName(tattooAt(m, p)!) }}</span>
          <span v-else class="muted">—</span>
        </li>
      </ul>
      <p v-if="m.isPlayer" class="small muted note">
        刺青店與刻印師 <Hint text="刺青店刺普通刺青、刻印師刻誓約印記；洗刺青到刺青店、刻印師或神殿。奴隸印記要解除契約才能去掉。" />
      </p>
    </div>
  </div>
</template>

<style scoped>
.tattoo { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px; align-items: start; }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; background: #3a2a1a; border: 3px solid #2a1a0e; box-shadow: inset 0 0 0 1px #c99a45, inset 0 0 30px #000; }
figure { margin: 0; text-align: center; }
figcaption { font-size: var(--fs-xs); color: #9a8768; letter-spacing: 0.2em; }
svg { width: 100%; }
.body { fill: #c99a4522; stroke: #c99a4588; stroke-width: 1.2; }
.spot { cursor: pointer; }
.spot circle { fill: #0000; stroke: #9a876866; stroke-width: 1; stroke-dasharray: 2 2; }
.spot:hover circle { stroke: #f0d083; }
.spot.on circle { fill: #c99a45; stroke: #f0d083; stroke-dasharray: none; }
.spot.on.slave circle { fill: #d8604e; stroke: #ff9a80; }
.spot.on.oath circle { fill: #8ab6ef; stroke: #c8e0ff; }
.spot.sel circle { stroke: #fff; stroke-width: 2; stroke-dasharray: none; }
.info h4 { margin: 0 0 6px; font-size: var(--fs-lg); color: var(--title); }
.tag.slave { color: var(--danger); border-color: var(--danger); }
.tag.oath { color: var(--accent); border-color: var(--accent); }
.oath { color: var(--accent); margin: 4px 0; }
.list { margin-top: 12px; columns: 2; column-gap: 20px; }
.list li { display: flex; gap: 8px; padding: 3px 4px; cursor: pointer; border-bottom: 1px dotted var(--border); break-inside: avoid; }
.list li.sel { background: #7a5a2a1a; }
.place { min-width: 4.5em; }
.note { margin-top: 10px; display: flex; align-items: center; gap: 4px; }
</style>
