<script setup lang="ts">
import { CELL_ICON, cellName, type CellKind } from '@/engine/grid'

// 小地圖的格子（聚落區塊、特殊地圖）：點一格選位置；paint 時改成按下與拖過（特殊地圖的畫筆）。
// kinds 是一排一排攤平的格子種類（沒有時當成牆）；選中的格子顯示 marker。
const props = withDefaults(defineProps<{
  kinds: readonly (string | undefined)[]
  width: number
  /** 每格的邊長（px） */
  size?: number
  picked?: number
  marker?: string
  /** 點不了的格子（變淡、不送出 pick） */
  isOff?: (i: number) => boolean
  /** 自訂格子上的圖示（沒有時用選中的 marker 或格子種類的圖示） */
  icon?: (i: number) => string | undefined
  titleOf?: (i: number) => string
  /** 畫筆：送出 down（按下）與 enter（按著拖過） */
  paint?: boolean
}>(), { size: 22, picked: -1, marker: '⭐', isOff: undefined, icon: undefined, titleOf: undefined, paint: false })
const emit = defineEmits<{ pick: [number]; down: [number]; enter: [number] }>()

const kindAt = (i: number) => (props.kinds[i] ?? 'wall') as CellKind
function label(i: number): string {
  return props.icon?.(i) || (i === props.picked ? props.marker : CELL_ICON[kindAt(i)] ?? '')
}
function click(i: number) {
  if (!props.paint && !props.isOff?.(i)) emit('pick', i)
}
</script>

<template>
  <div class="cells" :style="{ gridTemplateColumns: `repeat(${width}, ${size}px)`, '--cell': `${size}px` }">
    <button
      v-for="(k, i) in kinds" :key="i" type="button" class="cell" :class="[k, { picked: i === picked, off: isOff?.(i) }]"
      :title="titleOf?.(i) ?? cellName(kindAt(i))"
      @click="click(i)" @mousedown="paint && ($event.preventDefault(), emit('down', i))" @mouseenter="paint && emit('enter', i)"
    >{{ label(i) }}</button>
  </div>
</template>

<style scoped>
.cells { display: grid; gap: 1px; width: max-content; max-width: 100%; overflow: auto; user-select: none; }
.cell {
  width: var(--cell); height: var(--cell); padding: 0; font-size: calc(var(--cell) * 0.5); line-height: 1; border-radius: 2px;
  background: var(--panel-2); border: 1px solid var(--border);
}
.cell.wall { background: var(--border); }
.cell.water { background: #2a4a6a; }
.cell.off { cursor: default; opacity: 0.6; }
.cell.picked { outline: 2px solid var(--accent); opacity: 1; }
</style>
