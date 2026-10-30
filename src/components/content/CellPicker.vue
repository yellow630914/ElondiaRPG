<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { geography, locationById } from '@/engine/data'
import { blockKeys, settlementArea, type CellKind } from '@/engine/grid'
import type { CellRef } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import CellGrid from './CellGrid.vue'

// 在聚落的小地圖上選一格（擺商店用）：只能選空地（道路），或這家店自己現在佔的格子；walls 時改成選牆或水（特殊地圖的通道）
const props = defineProps<{ modelValue: CellRef | null; location?: string; lockLocation?: boolean; marker: string; self?: string; walls?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [CellRef | null] }>()
const content = useContent()

const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const loc = ref(props.modelValue ? props.modelValue.area.split('/')[0]! : props.location ?? settlements[0]!.id)
const blockKey = ref(props.modelValue?.area ?? blockKeys(loc.value)[0]!)
watch(loc, (v) => {
  if (!blockKey.value.startsWith(`${v}/`)) blockKey.value = blockKeys(v)[0]!
})
const blocks = computed(() => blockKeys(loc.value).map((k) => ({ key: k, name: settlementArea(k)?.name ?? k })))
const area = computed(() => {
  void content.version
  // 選通道的牆時看原本的區塊（不疊上已經打開的通道）
  return settlementArea(blockKey.value, !props.walls)
})
const picked = computed(() => (props.modelValue && area.value && props.modelValue.area === blockKey.value ? props.modelValue.y * area.value.width + props.modelValue.x : -1))
const pickable = (kind: CellKind) => (props.walls ? kind === 'wall' || kind === 'water' : kind === 'floor' || (!!props.self && kind === props.self))
function pick(i: number) {
  const a = area.value
  if (!a || !pickable(a.cells[i]!.kind)) return
  emit('update:modelValue', { area: a.key, x: i % a.width, y: Math.floor(i / a.width) })
}
</script>

<template>
  <div class="picker">
    <div class="row small">
      <label v-if="!lockLocation">聚落
        <select v-model="loc"><option v-for="l in settlements" :key="l.id" :value="l.id">{{ l.name }}</option></select>
      </label>
      <span v-else>{{ locationById(loc).name }}</span>
      <label>區塊
        <select v-model="blockKey"><option v-for="b in blocks" :key="b.key" :value="b.key">{{ b.name }}</option></select>
      </label>
      <span class="muted">{{ walls ? '點一格牆或水（通道的入口）' : '點一格空地（道路）' }}</span>
    </div>
    <CellGrid v-if="area" :kinds="area.cells.map((c) => c.kind)" :width="area.width" :picked="picked" :marker="marker" :is-off="(i) => !pickable(area!.cells[i]!.kind)" @pick="pick" />
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.picker { display: grid; gap: 6px; }
</style>
