<script setup lang="ts">
import { computed, ref } from 'vue'
import mapUrl from '../../assets/map/elondia-map.webp'
import { geography, locationById } from '@/engine/data'
import { currentArea, DUNGEON_LAYERS } from '@/engine/grid'
import { layerRank } from '@/engine/materialQuests'
import { charmLevel, charmName } from '@/engine/charm'
import { useGame } from '@/stores/game'
import AppDialog from './AppDialog.vue'
import AreaMap from './AreaMap.vue'
import ExpeditionBar from './ExpeditionBar.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const area = computed(() => currentArea(s.value))
const layerName = computed(() => (area.value.kind === 'dungeon' && area.value.layer !== undefined ? DUNGEON_LAYERS[area.value.layer]?.name : undefined))
/** 建議階級：看目前這一層的怪物（地下城沒有整座的階級） */
const layerRankHere = computed(() => {
  const a = area.value
  if (a.kind !== 'dungeon') return undefined
  const id = DUNGEON_LAYERS[a.layer ?? 0]?.id
  return id ? layerRank(a.location, id) : undefined
})
const showWorldMap = ref(false)
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between; align-items: flex-start">
      <div>
        <h2 class="title"><GameIcon name="pin" :size="20" />{{ area.name }}</h2>
        <p class="muted small" style="margin: 0">
          {{ here.name }}・{{ geography.regions.find((r) => r.id === here.region)?.name }}
          <span v-if="layerName">・{{ layerName }}</span>
          <span v-if="layerRankHere" class="tag">建議 {{ layerRankHere }} 級</span>
          <span v-if="here.type !== 'dungeon'" class="tag" title="魅氣濃度（1～4）：曝露名聲累積的速度、近郊的怪物發情的機率、城裡的風氣">魅氣・{{ charmName(charmLevel(here.id)) }}</span>
        </p>
      </div>
      <div class="row tools">
        <Hint text="點擊相鄰的格子移動，或使用方向鍵 / WASD。走到建築上就能使用它的功能。" />
        <button class="small" @click="showWorldMap = true"><GameIcon name="map" :size="14" /> 世界地圖</button>
      </div>
    </div>
    <ExpeditionBar />
    <AreaMap />
  </section>

  <AppDialog :open="showWorldMap" title="埃隆迪亞大陸" icon="map" width="1100px" @close="showWorldMap = false">
    <img :src="mapUrl" alt="埃隆迪亞大陸地圖" class="world-map" />
    <p class="small muted">目前位置：{{ here.name }}（{{ geography.regions.find((r) => r.id === here.region)?.name }}）</p>
  </AppDialog>
</template>

<style scoped>
.world-map { width: 100%; border-radius: var(--radius); }
.title { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.title :deep(.game-icon) { color: var(--accent); }
.tools { gap: 6px; flex-wrap: nowrap; }
</style>
