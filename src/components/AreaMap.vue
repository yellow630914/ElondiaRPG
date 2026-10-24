<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { cellAt, CELL_ICON, CELL_NAME, cellName, currentArea, isRevealed, position, sight, type Cell } from '@/engine/grid'
import { isCustomShopId, itemDef, landmarkDef, locationById } from '@/engine/data'
import { cropStatus } from '@/engine/garden'
import { homeById } from '@/engine/homes'
import { isHostile, peopleHere, type PresentNpc } from '@/engine/population'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import type { IconName } from './ui/iconPaths'
import { CELL_GAME_ICON } from './ui/cellIcons'
import { tileUrl, type TileKind } from './ui/tiles'

const game = useGame()
const area = computed(() => currentArea(game.state!))
const pos = computed(() => position(game.state!))

const ICON = CELL_ICON

const EVENT_ICON = { special: '⭐', master: '⛓️', advanced: '✨' }

function icon(cell: Cell): string {
  // 房子：家具、樓梯、門；城裡買下的房子
  // 苗圃上的作物：成熟 🌾、還在長 🌿
  if (cell.crop && game.state) return cropStatus(game.state, cell)?.ready ? '🌾' : '🌿'
  if (cell.furniture) return itemDef(cell.furniture)?.furniture?.icon ?? '🪑'
  if (cell.dir) return { up: '⬆️', down: '⬇️', out: '🚪' }[cell.dir]
  if (cell.home) return game.state && homeById(game.state, cell.home)?.master ? '🏚️' : '🏠'
  if (cell.done && ['encounter', 'elite', 'boss', 'resource', 'trap', 'chest'].includes(cell.kind)) return ''
  if (cell.kind === 'trap') return ''
  if (cell.kind === 'resource' && cell.item && /礦|錢/.test(cell.item)) return '💎'
  // 旅途的事件：依種類顯示（出發時就擲好了）
  if (cell.kind === 'event' && !cell.done) return (EVENT_ICON as Record<string, string>)[cell.event?.tier ?? ''] ?? '❔'
  if (cell.kind === 'event' || cell.kind === 'road') return ''
  // 特殊任務的任務點是 ⭐，委託地點是 ❗
  if (cell.kind === 'quest' && cell.storyNode) return '⭐'
  if (cell.kind === 'quest' && !game.state?.quests.some((q) => q.id === cell.questId && q.status === 'accepted')) return ''
  return ICON[cell.kind] ?? ''
}

/** 用介面圖示畫的格子（其餘的家具、作物等內容自訂的圖示照舊用 emoji） */
const EVENT_GAME_ICON: Record<string, IconName> = { special: 'star', master: 'lock', advanced: 'sparkles' }
function gameIcon(cell: Cell): IconName | undefined {
  const e = icon(cell)
  if (!e || cell.crop || cell.furniture) return undefined
  if (cell.dir) return ({ up: 'arrowUp', down: 'arrowDown', out: 'door' } as const)[cell.dir]
  if (cell.home) return 'home'
  if (cell.kind === 'quest' && cell.storyNode) return 'star'
  if (cell.kind === 'event') return EVENT_GAME_ICON[cell.event?.tier ?? ''] ?? 'question'
  if (cell.kind === 'resource' && e === '💎') return 'gem'
  return e === ICON[cell.kind] ? CELL_GAME_ICON[cell.kind] : undefined
}
const DANGER = new Set(['encounter', 'elite', 'boss'])

// 建築物的屋頂顏色
const ROOF: Record<string, TileKind> = {
  inn: 'roof_blue', guild: 'roof_gold', tavern: 'roof_red', shop: 'roof_brown', temple: 'roof_gold', brothel: 'roof_purple',
  smithy: 'roof_brown', tailor: 'roof_green', jeweler: 'roof_purple', magic: 'roof_purple', informant: 'roof_brown',
  tattoo: 'roof_green', carver: 'roof_red', manor: 'roof_brown', waypoint: 'roof_red', arrive: 'roof_red',
}
function isBuilding(cell: Cell): boolean {
  return !!ROOF[cell.kind] || isCustomShopId(cell.kind) || !!landmarkDef(cell.kind)
}
/** 格子的底圖：牆、水、建築、依區域種類的地面 */
function tile(cell: Cell, seen: boolean, x: number, y: number): string {
  const kind = area.value.kind
  let t: TileKind
  if (!seen) t = 'void'
  else if (cell.kind === 'water') t = 'water'
  else if (cell.kind === 'wall') t = kind === 'dungeon' ? 'wall_dungeon' : kind === 'wild' || kind === 'road' ? 'forest' : 'wall_town'
  else if (cell.home && kind !== 'home') t = 'roof_blue'
  else if (isBuilding(cell)) t = ROOF[cell.kind] ?? (landmarkDef(cell.kind) ? 'roof_purple' : 'roof_brown')
  else if (cell.kind === 'yard' || cell.kind === 'lot' || cell.crop) t = 'grass'
  else t = kind === 'dungeon' ? 'stone' : kind === 'wild' ? 'grass' : kind === 'road' || kind === 'side' ? 'dirt' : kind === 'home' ? 'wood' : 'cobble'
  return `url(${tileUrl(t, x, y)})`
}

function label(cell: Cell): string {
  if (cell.crop && game.state) {
    const c = cropStatus(game.state, cell)
    return `${cell.furniture}：種著${cell.crop.seed}${c?.ready ? '，可以收成了' : `，還要 ${c?.hoursLeft ?? 0} 小時`}`
  }
  if (cell.furniture) return `家具：${cell.furniture}`
  if (cell.dir) return { up: '往樓上', down: '往樓下', out: '出門' }[cell.dir]
  if (cell.home) {
    const h = game.state ? homeById(game.state, cell.home) : undefined
    return h?.master ? `主人的家：${h.name}` : `你的房子：${h?.name ?? ''}`
  }
  if (cell.kind === 'lot') return '待售的房子'
  if (cell.kind === 'manor') return '民宅（大門緊閉，不能進入）'
  if (cell.kind === 'trap' && !cell.done) return '道路'
  if (cell.kind === 'trap') return '已觸發的陷阱'
  if (cell.kind === 'quest' && cell.storyNode) return '特殊任務的任務點'
  if (cell.town) return `${cell.kind === 'arrive' ? '目的地' : cell.kind === 'waypoint' ? '途經' : '出發'}：${locationById(cell.town).name}`
  if (cell.kind === 'event') return cell.done ? '走過的路' : ({ special: '特殊事件', master: '主人的事件', advanced: '高階事件' } as Record<string, string>)[cell.event?.tier ?? ''] ?? '事件'
  if (cell.kind === 'road') return cell.road?.paid ? '走過的路' : '路'
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
      // 沒看過的相鄰格也能點：摸黑往前走，走不過去就跳「那邊走不過去」
      return { x, y, cell, seen, here, who, canStep: adjacent && (!seen || !blocked) }
    }),
  ),
)

// 撞牆或規則不讓走：主角那一格晃一下，地圖角落淡淡提示（浮在地圖上，不推動版面；字多的停留久一點）
const bumping = ref(false)
let bumpTimer: ReturnType<typeof setTimeout> | undefined
watch(() => game.bump, () => {
  bumping.value = false
  clearTimeout(bumpTimer)
  requestAnimationFrame(() => {
    bumping.value = true
    bumpTimer = setTimeout(() => (bumping.value = false), Math.max(900, game.bumpText.length * 110))
  })
})
onBeforeUnmount(() => clearTimeout(bumpTimer))

// 一片漆黑時（視野 0）地圖右上角常駐提示：走路揭不開迷霧，提醒先點火把或等天亮
const dark = computed(() => sight(game.state!, area.value) <= 0)

function step(x: number, y: number) {
  // 和方向鍵同一條路：走不過去時只晃一下、跳提示
  game.move(x - pos.value.x, y - pos.value.y)
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  // 開著對話框時方向鍵留給對話框（捲動、選項），不移動隊伍
  if (target?.closest?.('dialog') || document.querySelector('dialog[open]')) return
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
    <Transition name="bump-tip">
      <span v-if="bumping" class="bump-tip small">{{ game.bumpText || '那邊走不過去' }}</span>
      <span v-else-if="dark" class="bump-tip small">一片漆黑：走路不會揭開地圖，先點火把或等天亮</span>
    </Transition>
    <div class="map" :style="{ '--w': area.width }">
      <template v-for="row in rows" :key="row[0]!.y">
        <button
          v-for="c in row"
          :key="`${c.x},${c.y}`"
          class="cell"
          :class="[c.seen ? c.cell.kind : 'fog', { here: c.here, step: c.canStep, done: c.cell.done, bump: c.here && bumping }]"
          :disabled="!c.canStep"
          :title="c.seen ? label(c.cell) + (c.who.length ? `\n人：${peopleTitle(c.who)}` : '') : '未探索'"
          :style="{ backgroundImage: tile(c.cell, c.seen, c.x, c.y) }"
          @click="step(c.x, c.y)"
        >
          <span v-if="c.here" class="me"><GameIcon name="user" /></span>
          <template v-else-if="c.seen">
            <GameIcon v-if="gameIcon(c.cell)" class="glyph" :class="{ danger: DANGER.has(c.cell.kind) }" :name="gameIcon(c.cell)!" />
            <span v-else class="emoji">{{ icon(c.cell) }}</span>
          </template>
          <span v-if="c.who.length" class="npc" :class="{ hostile: c.who.some((p) => isHostile(game.state!, p.rec)) }"><GameIcon name="user" :size="9" />{{ c.who.length > 1 ? c.who.length : '' }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 格子依面板寬度縮放：地圖再寬也不會超出面板（最大 40px） */
.map-wrap { container-type: inline-size; margin-top: 8px; position: relative; }
.bump-tip {
  position: absolute; top: 4px; right: 4px; z-index: 2; pointer-events: none;
  max-width: calc(100% - 8px); padding: 1px 8px; border-radius: 10px; background: rgba(20, 17, 13, 0.9); color: var(--muted); border: 1px solid var(--border);
}
.bump-tip-enter-active, .bump-tip-leave-active { transition: opacity 0.25s; }
.bump-tip-enter-from, .bump-tip-leave-to { opacity: 0; }
.cell.bump { animation: bump 0.3s ease; }
@keyframes bump {
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(1px); }
}
.map {
  --cell: min(40px, calc(100cqw / var(--w)));
  display: grid; gap: 0; grid-template-columns: repeat(var(--w), var(--cell)); width: max-content; max-width: 100%;
  border: 1px solid #000; box-shadow: 0 0 0 1px var(--gold-lo), 0 0 0 4px #0008; background: #000;
}
.cell {
  position: relative; width: var(--cell); height: var(--cell); padding: 0; border: none; border-radius: 0; min-width: 0;
  display: flex; align-items: center; justify-content: center;
  background-color: #0b0907; background-size: cover; image-rendering: pixelated; cursor: default;
}
.cell:disabled { opacity: 1; cursor: default; }
.cell.done { filter: saturate(0.6); }
.cell.step { cursor: pointer; }
.cell.step::after { content: ''; position: absolute; inset: 0; background: #f0d08322; box-shadow: inset 0 0 0 1px #f0d08366; pointer-events: none; }
.cell.step:hover::after { background: #f0d08344; }
.cell.here { box-shadow: inset 0 0 0 2px var(--gold-hi), 0 0 10px #f0d08388; z-index: 1; }
.glyph { width: calc(var(--cell) * 0.55); height: calc(var(--cell) * 0.55); color: var(--gold-hi); filter: drop-shadow(0 1px 0 #000) drop-shadow(0 0 2px #000); }
.glyph.danger { color: #ff8a70; }
.emoji { font-size: calc(var(--cell) * 0.5); filter: drop-shadow(0 1px 1px #000); }
.me { display: grid; place-items: center; width: calc(var(--cell) * 0.7); height: calc(var(--cell) * 0.7); border-radius: 50%; background: radial-gradient(circle, #f0d083, #b8862a); color: #2a1a08; box-shadow: 0 0 8px #f0d083; }
.me :deep(.game-icon) { width: 70%; height: 70%; }
.npc {
  position: absolute; right: 1px; top: 1px; display: inline-flex; align-items: center; gap: 1px; height: 12px; padding: 0 2px; border-radius: 2px;
  background: var(--accent-2); color: #10201a; font: 700 9px/12px system-ui, sans-serif; box-shadow: 0 0 0 1px #000;
}
.npc.hostile { background: var(--danger); color: #fff; }
</style>
