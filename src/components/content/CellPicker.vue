<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { geography, locationById } from '@/engine/data'
import { blockKeys, CELL_ICON, cellName, settlementArea, type CellKind } from '@/engine/grid'
import type { CellRef } from '@/engine/shopMods'
import { useContent } from '@/stores/content'

// 在聚落的小地圖上選一格（擺商店用）：只能選空地（道路），或這家店自己現在佔的格子
const props = defineProps<{ modelValue: CellRef | null; location?: string; lockLocation?: boolean; marker: string; self?: string }>()
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
  return settlementArea(blockKey.value)
})
const picked = computed(() => (props.modelValue && area.value && props.modelValue.area === blockKey.value ? props.modelValue.y * area.value.width + props.modelValue.x : -1))
const pickable = (kind: CellKind) => kind === 'floor' || (!!props.self && kind === props.self)
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
      <span class="muted">點一格空地（道路）</span>
    </div>
    <div v-if="area" class="cells" :style="{ gridTemplateColumns: `repeat(${area.width}, 22px)` }">
      <button
        v-for="(c, i) in area.cells" :key="i" class="cell" :class="[c.kind, { picked: i === picked, off: !pickable(c.kind) }]"
        :title="cellName(c.kind)" @click="pick(i)"
      >{{ i === picked ? marker : CELL_ICON[c.kind] ?? '' }}</button>
    </div>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.picker { display: grid; gap: 6px; }
.cells { display: grid; gap: 1px; width: max-content; max-width: 100%; overflow: auto; }
.cell { width: 22px; height: 22px; padding: 0; font-size: 12px; line-height: 1; border-radius: 2px; background: var(--panel-2); border: 1px solid var(--border); }
.cell.off { cursor: default; opacity: 0.75; }
.cell.wall { background: var(--border); }
.cell.water { background: #2a4a6a; }
.cell.picked { outline: 2px solid var(--accent); opacity: 1; }
</style>
