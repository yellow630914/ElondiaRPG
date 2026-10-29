<script setup lang="ts">
import { computed } from 'vue'
import { locationById } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { roadProgress, roadTemplate } from '@/engine/road'
import { MODE_NAME } from '@/engine/travel'
import { useGame } from '@/stores/game'
import { eventDialogOpen } from './events/eventQueue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { isMobile } from './mobile/mobile'

// 旅途：單行道一格一天往前走；事件出發時就擲好放在格子上（事件、戰鬥）
const game = useGame()
const s = computed(() => game.state!)
const progress = computed(() => {
  void s.value.time.hour
  return roadProgress(s.value)
})
const cell = computed(() => game.cell)
const area = computed(() => game.area)
const atEnd = computed(() => position.value >= area.value.width - 1)
const position = computed(() => s.value.position?.x ?? 0)
const pending = computed(() => (s.value.roadEvent ? roadTemplate(s.value.roadEvent.template) : undefined))
const busy = computed(() => !!s.value.roadEvent || !!s.value.combat || !!s.value.pendingMasterEvent || !!s.value.standoff || !!s.value.pendingAction || game.judging)
const legs = computed(() => [...new Set((s.value.road?.modes ?? []).map((m) => MODE_NAME[m as keyof typeof MODE_NAME]))].join('、'))
</script>

<template>
  <section v-if="progress" class="panel road-panel">
    <h3 class="title"><GameIcon name="compass" :size="16" />前往{{ locationById(progress.to).name }}的旅途<Hint text="旅途是單行道，一格一天。地圖上的圖示：問號是事件、劍是戰鬥、星星是特殊事件、鎖是主人的事件、房子是途經的地點、靶心是目的地。" /></h3>
    <p class="small">
      第 {{ progress.day }} 天（全程約 {{ progress.days }} 天）・{{ legs }}
      <template v-if="cell.town">・{{ cell.kind === 'waypoint' ? '途經' : '從' }}{{ locationById(cell.town).name }}{{ cell.kind === 'waypoint' ? '' : '出發' }}</template>
    </p>
    <p class="small muted">
      到目前為止：{{ progress.money < 0 ? `食宿與船資 ${formatMoney(-progress.money)}` : '沒有花費' }}。抵達時一起結算。
    </p>
    <ul v-if="progress.recent.length > 1" class="plain small muted recent">
      <li v-for="(t, i) in progress.recent.slice(1)" :key="i">・{{ t }}</li>
    </ul>

    <div v-if="pending" class="event">
      <b>{{ pending.title }}</b>
      <button class="small primary" @click="eventDialogOpen = true"><GameIcon name="bell" :size="14" /> 決定怎麼應付</button>
    </div>

    <p v-else-if="area.kind !== 'road'" class="small">目前在{{ area.name }}：從出口離開就回到旅途。</p>
    <!-- 手機版：往前走的按鈕在畫面下方的情境按鈕（MobileGame） -->
    <div v-else-if="!isMobile" class="row">
      <button class="primary" :disabled="busy || atEnd" @click="game.move(1, 0)">往前走一天 <GameIcon name="arrowRight" :size="14" /></button>
      <button :disabled="busy || atEnd" title="遇到事件、戰鬥或抵達時停下" @click="game.walkRoad()">一路走下去 <GameIcon name="play" :size="14" /></button>
    </div>
  </section>
</template>

<style scoped>
.road-panel { display: grid; gap: 6px; }
.road-panel h3, .road-panel p { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.row button { display: inline-flex; align-items: center; gap: 4px; }
.event { border: 1px dashed var(--accent); border-radius: var(--radius); padding: 6px 8px; display: grid; gap: 4px; }
.event p { margin: 0; line-height: 1.6; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
.recent { margin: 0; }
</style>
