<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Character, TattooPlace } from '@/engine/types'
import { oathText, placeName, TATTOO_PLACES, tattooAt, tattooDesc, tattooKindName, tattooName } from '@/engine/tattoos'
import { bodyOf } from '@/engine/traits'
import Hint from '../ui/Hint.vue'
import BodyFigure from './BodyFigure.vue'
import { BODY_SHAPES } from './bodyShapes'

// 刺青的部位圖：正面與背面的人形，有刺青的部位打點；點部位看說明
const props = defineProps<{ member: Character }>()
const m = computed(() => props.member)

// 人形依身形換輪廓，部位的位置跟著換
const body = computed(() => bodyOf(m.value.race, m.value.gender))
const spotOf = (p: TattooPlace) => BODY_SHAPES[body.value].spots[p] ?? { x: 50, y: 100, side: 'front' as const }

const first = () => TATTOO_PLACES.find((p) => tattooAt(m.value, p)) ?? TATTOO_PLACES[0]!
const selected = ref<TattooPlace>(first())
watch(() => props.member.id, () => (selected.value = first()))
const current = computed(() => tattooAt(m.value, selected.value))
</script>

<template>
  <div class="tattoo">
    <div class="figs">
      <figure v-for="side in ['front', 'back'] as const" :key="side">
        <BodyFigure :body="body" :back="side === 'back'">
          <template v-for="p in TATTOO_PLACES" :key="p">
            <g v-if="spotOf(p).side === side" class="spot" :class="{ on: tattooAt(m, p), sel: selected === p, [tattooAt(m, p)?.kind ?? '']: true }" @click="selected = p">
              <circle :cx="spotOf(p).x" :cy="spotOf(p).y" r="6" />
              <title>{{ placeName(p) }}{{ tattooAt(m, p) ? `：${tattooName(tattooAt(m, p)!)}` : '' }}</title>
            </g>
          </template>
        </BodyFigure>
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
        <li
          v-for="p in TATTOO_PLACES" :key="p" :class="{ sel: selected === p }" role="button" tabindex="0"
          @click="selected = p" @keydown.enter.prevent="selected = p" @keydown.space.prevent="selected = p"
        >
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
@media (max-width: 700px) { .tattoo { grid-template-columns: minmax(0, 1fr); } }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; background: #3a2a1a; border: 3px solid #2a1a0e; box-shadow: inset 0 0 0 1px #c99a45, inset 0 0 30px #000; }
figure { margin: 0; text-align: center; }
figcaption { font-size: var(--fs-xs); color: #9a8768; letter-spacing: 0.2em; }
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
