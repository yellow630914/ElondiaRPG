<script setup lang="ts">
import { computed, ref } from 'vue'
import mapUrl from '../../assets/map/elondia-map.webp'
import eastMapUrl from '../../assets/map/yanhua-map.webp'
import { geography, locationById } from '@/engine/data'
import { DUNGEON_LAYERS } from '@/engine/grid'
import { layerRank } from '@/engine/materialQuests'
import { charmLevel, charmName } from '@/engine/charm'
import { useGame } from '@/stores/game'
import AppDialog from './AppDialog.vue'
import AreaMap from './AreaMap.vue'
import ExpeditionBar from './ExpeditionBar.vue'
import TownTagChips from './TownTagChips.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import WorldOverviewMap from './WorldOverviewMap.vue'

const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const area = computed(() => game.area)
const layerName = computed(() => (area.value.kind === 'dungeon' && area.value.layer !== undefined ? DUNGEON_LAYERS[area.value.layer]?.name : undefined))
/** 建議階級：看目前這一層的怪物（地下城沒有整座的階級） */
const layerRankHere = computed(() => {
  const a = area.value
  if (a.kind !== 'dungeon') return undefined
  const id = DUNGEON_LAYERS[a.layer ?? 0]?.id
  return id ? layerRank(a.location, id) : undefined
})
const showWorldMap = ref(false)
/** 世界地圖的三張圖：世界總覽（兩塊大陸與東海，標出聚落）、埃隆迪亞大陸（西大陸的細節）、炎華之地（東大陸的細節） */
const mapTab = ref<'overview' | 'continent' | 'east'>('overview')
function openWorldMap() {
  // 在東大陸時直接看東大陸的圖；在東海群島看總覽；回到西大陸時從東大陸的圖換回上次看的西大陸或總覽
  const r = here.value.region
  mapTab.value = r.startsWith('yanhua') ? 'east' : r === 'east_sea' ? 'overview' : mapTab.value === 'east' ? 'overview' : mapTab.value
  showWorldMap.value = true
}
</script>

<template>
  <section class="panel">
    <div class="row head" style="justify-content: space-between; align-items: flex-start">
      <div>
        <h2 class="title"><GameIcon name="pin" :size="20" />{{ area.name }}</h2>
        <p class="muted small" style="margin: 0">
          {{ here.name }}・{{ geography.regions.find((r) => r.id === here.region)?.name }}
          <span v-if="layerName">・{{ layerName }}</span>
          <span v-if="layerRankHere" class="tag">建議 {{ layerRankHere }} 級</span>
          <span v-if="here.type !== 'dungeon'" class="tag" title="魅氣濃度（1～4）：曝露名聲累積的速度、近郊的怪物發情的機率、城裡的風氣">魅氣・{{ charmName(charmLevel(here.id)) }}</span>
          <TownTagChips v-if="here.type !== 'dungeon'" :location="here.id" />
        </p>
      </div>
      <div class="row tools">
        <Hint text="點擊相鄰的格子移動，或使用方向鍵 / WASD。走到建築上就能使用它的功能。" />
        <button class="small" aria-label="世界地圖" @click="openWorldMap"><GameIcon name="map" :size="14" /><span class="wm"> 世界地圖</span></button>
      </div>
    </div>
    <ExpeditionBar />
    <AreaMap />
  </section>

  <AppDialog :open="showWorldMap" title="世界地圖" icon="map" width="1100px" @close="showWorldMap = false">
    <nav class="map-tabs" role="tablist">
      <button role="tab" :aria-selected="mapTab === 'overview'" :class="{ on: mapTab === 'overview' }" @click="mapTab = 'overview'">世界總覽</button>
      <button role="tab" :aria-selected="mapTab === 'continent'" :class="{ on: mapTab === 'continent' }" @click="mapTab = 'continent'">埃隆迪亞大陸</button>
      <button role="tab" :aria-selected="mapTab === 'east'" :class="{ on: mapTab === 'east' }" @click="mapTab = 'east'">炎華之地</button>
    </nav>
    <WorldOverviewMap v-if="mapTab === 'overview'" :here="here.id" />
    <img v-else-if="mapTab === 'continent'" :src="mapUrl" alt="埃隆迪亞大陸地圖" class="world-map" />
    <img v-else :src="eastMapUrl" alt="炎華之地（東大陸）地圖：炎華南域與炎華北原（媞丹）" class="world-map" />
    <p class="small muted">目前位置：{{ here.name }}（{{ geography.regions.find((r) => r.id === here.region)?.name }}）</p>
  </AppDialog>
</template>

<style scoped>
.world-map { width: 100%; border-radius: var(--radius); }
.map-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.map-tabs button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.title { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.title :deep(.game-icon) { color: var(--accent); }
.tools { gap: 6px; flex-wrap: nowrap; flex: none; }
.tools button { white-space: nowrap; }
/* 標題與工具同一排：地名列加了行情標籤，太長時標籤在左邊換行，不把工具擠到下一排 */
.head { flex-wrap: nowrap; }
.head > div:first-child { min-width: 0; }
/* 手機：世界地圖只剩圖示 */
@media (max-width: 720px) {
  .wm { display: none; }
}
</style>
