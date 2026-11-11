<script setup lang="ts">
import { computed, ref } from 'vue'
import { outfitCommission } from '@/engine/craft'
import { fusionCandidates, fusionHere } from '@/engine/fusion'
import { currentCell } from '@/engine/grid'
import { useGame } from '@/stores/game'
import BuildingMenu, { type MenuItem } from '../place/BuildingMenu.vue'
import FuseAltar from './FuseAltar.vue'
import OutfitAtelier from './OutfitAtelier.vue'

// 成人用品店的兩個專用入口：淫服・拘束具訂製（成人向服裝與拘束具的委託打造）、淫器合煉。一般的委託打造不在這裡（CraftPanel 會略過這家店）
const game = useGame()
const s = computed(() => game.state!)
const atelierHere = computed(() => currentCell(s.value).kind === outfitCommission().shop)
const fuseHere = computed(() => fusionHere(s.value))
const fused = computed(() => (fuseHere.value ? fusionCandidates(s.value).fused.length : 0))
const items = computed<MenuItem[]>(() => [
  ...(atelierHere.value ? [{ id: 'atelier', icon: 'shirt', label: '淫服・拘束具訂製', detail: '挑款式、選材料，再加一項慾望指標' } as MenuItem] : []),
  ...(fuseHere.value ? [{ id: 'fuse', icon: 'lock', label: '淫器合煉', detail: '把武器和拘束具合成淫器，也可以拆回來', ...(fused.value ? { badge: `${fused.value} 件` } : {}) } as MenuItem] : []),
])
const open = ref<'atelier' | 'fuse' | null>(null)
</script>

<template>
  <template v-if="items.length">
    <BuildingMenu :items="items" @pick="(id) => (open = id as 'atelier' | 'fuse')" />
    <OutfitAtelier v-if="atelierHere" :open="open === 'atelier'" @close="open = null" />
    <FuseAltar v-if="fuseHere" :open="open === 'fuse'" @close="open = null" />
  </template>
</template>
