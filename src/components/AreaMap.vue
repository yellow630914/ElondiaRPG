<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { cellAt, CELL_ICON, CELL_NAME, cellName, currentArea, isRevealed, position, type Cell } from '@/engine/grid'
import { isHostile, peopleHere, type PresentNpc } from '@/engine/population'
import { useGame } from '@/stores/game'

const game = useGame()
const area = computed(() => currentArea(game.state!))
const pos = computed(() => position(game.state!))

const ICON = CELL_ICON

function icon(cell: Cell): string {
  if (cell.done && ['encounter', 'elite', 'boss', 'resource', 'trap', 'chest'].includes(cell.kind)) return ''
  if (cell.kind === 'trap') return ''
  if (cell.kind === 'resource' && cell.item && /礦|錢/.test(cell.item)) return '💎'
  if (cell.kind === 'quest' && !game.state?.quests.some((q) => q.id === cell.questId && q.status === 'accepted')) return ''
  return ICON[cell.kind] ?? ''
}

function label(cell: Cell): string {
  if (cell.kind === 'trap' && !cell.done) return '道路'
  if (cell.kind === 'trap') return '已觸發的陷阱'
  return cellName(cell.kind) + (cell.done ? '（已清除）' : '') + (cell.item && !cell.done ? `：${cell.item}` : '')
}

// 地圖上的人：每格標出人數，敵對的人用紅色
const people = computed(() => {
  const map = new Map<string, PresentNpc[]>()
  for (const p of peopleHere(game.state!)) {
    const k = `${p.x},${p.y}`
    map.set(k, [...(map.get(k) ?? []), p])
  }
  return map
})

function peopleTitle(list: PresentNpc[]): string {
  return list.map((p) => p.rec.name).join('、')
}

const rows = computed(() =>
  Array.from({ length: area.value.height }, (_, y) =>
    Array.from({ length: area.value.width }, (_, x) => {
      const cell = cellAt(area.value, x, y)!
      const seen = isRevealed(area.value, x, y)
      const here = pos.value.x === x && pos.value.y === y
      const adjacent = Math.abs(pos.value.x - x) + Math.abs(pos.value.y - y) === 1
      const blocked = cell.kind === 'wall' || cell.kind === 'water'
      const who = seen ? people.value.get(`${x},${y}`) ?? [] : []
      return { x, y, cell, seen, here, who, canStep: adjacent && seen && !blocked }
    }),
  ),
)

function step(x: number, y: number) {
  game.moveTo(x, y)
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const dir = KEYS[e.key]
  if (!dir || game.state?.combat) return
  e.preventDefault()
  game.move(dir[0], dir[1])
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="map-wrap">
    <div class="map" :style="{ '--w': area.width }">
      <template v-for="row in rows" :key="row[0]!.y">
        <button
          v-for="c in row"
          :key="`${c.x},${c.y}`"
          class="cell"
          :class="[c.seen ? c.cell.kind : 'fog', { here: c.here, step: c.canStep, done: c.cell.done }]"
          :disabled="!c.canStep"
          :title="c.seen ? label(c.cell) + (c.who.length ? `\n👤 ${peopleTitle(c.who)}` : '') : '未探索'"
          @click="step(c.x, c.y)"
        >
          <span v-if="c.here">🧭</span>
          <span v-else-if="c.seen">{{ icon(c.cell) }}</span>
          <span v-if="c.who.length" class="npc" :class="{ hostile: c.who.some((p) => isHostile(game.state!, p.rec)), many: c.who.length > 1 }">{{ c.who.length > 1 ? c.who.length : '' }}</span>
        </button>
      </template>
    </div>
    <p class="small muted hint">點擊相鄰的格子移動，或使用方向鍵 / WASD。</p>
  </div>
</template>

<style scoped>
/* 格子依面板寬度縮放：地圖再寬也不會超出面板（最大 40px） */
.map-wrap { container-type: inline-size; margin-top: 8px; }
.map {
  --cell: min(40px, calc((100cqw - (var(--w) - 1) * 2px) / var(--w)));
  display: grid; gap: 2px; grid-template-columns: repeat(var(--w), var(--cell)); width: max-content; max-width: 100%;
}
.cell {
  width: var(--cell); height: var(--cell); padding: 0; border-radius: 4px; min-width: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--cell) * 0.5); background: #3a3329; border: 1px solid transparent; cursor: default;
}
.cell:disabled { opacity: 1; cursor: default; }
.cell.wall { background: #15120f; }
.cell.water { background: #1f3346; }
.cell.fog { background: #0c0b09; }
.cell.inn, .cell.guild, .cell.tavern, .cell.shop, .cell.temple { background: #4a3b26; }
.cell.gate, .cell.exit, .cell.link, .cell.stairs_down, .cell.stairs_up { background: #2f4036; }
.cell.encounter:not(.done), .cell.elite:not(.done), .cell.boss:not(.done) { background: #4b2723; }
.cell.safe { background: #4d3a1d; }
.cell.quest { background: #4b4320; }
.cell.step { border-color: var(--accent); cursor: pointer; }
.cell.step:hover { background-color: #5a4a33; }
.cell.here { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent) inset; }
.hint { margin: 6px 0 0; }
.cell { position: relative; }
.npc {
  position: absolute; right: 1px; top: 1px; min-width: 9px; height: 9px; border-radius: 5px;
  background: var(--accent-2); font-size: 8px; line-height: 9px; color: #1b1814; font-weight: 700; padding: 0 1px;
}
.npc.many { min-width: 12px; height: 12px; line-height: 12px; border-radius: 6px; font-size: 9px; }
.npc.hostile { background: var(--danger); }
</style>
