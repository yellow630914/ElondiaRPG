<script setup lang="ts">
import { computed, ref } from 'vue'
import mapUrl from '../../assets/map/elondia-map.webp'
import { geography, locationById } from '@/engine/data'
import { currentArea, DUNGEON_LAYERS } from '@/engine/grid'
import { useGame } from '@/stores/game'
import AppDialog from './AppDialog.vue'
import AreaMap from './AreaMap.vue'

const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const area = computed(() => currentArea(s.value))
const layerName = computed(() => (area.value.kind === 'dungeon' && area.value.layer !== undefined ? DUNGEON_LAYERS[area.value.layer]?.name : undefined))
const showWorldMap = ref(false)
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between; align-items: flex-start">
      <div>
        <h2>📍 {{ area.name }}</h2>
        <p class="muted small" style="margin: 0">
          {{ here.name }}・{{ geography.regions.find((r) => r.id === here.region)?.name }}
          <span v-if="layerName">・{{ layerName }}</span>
          <span v-if="here.rank" class="tag">建議 {{ here.rank }} 級</span>
        </p>
      </div>
      <button class="small" @click="showWorldMap = true">🗺️ 世界地圖</button>
    </div>
    <AreaMap />
  </section>

  <AppDialog :open="showWorldMap" title="埃隆迪亞大陸" icon="🗺️" width="1100px" @close="showWorldMap = false">
    <img :src="mapUrl" alt="埃隆迪亞大陸地圖" class="world-map" />
    <p class="small muted">目前位置：{{ here.name }}（{{ geography.regions.find((r) => r.id === here.region)?.name }}）</p>
  </AppDialog>
</template>

<style scoped>
.world-map { width: 100%; border-radius: var(--radius); }
</style>
