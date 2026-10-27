<script setup lang="ts">
import { computed } from 'vue'
import { attrName } from '@/engine/data'
import { roadTemplate } from '@/engine/road'
import { pendingTownEvent } from '@/engine/townEvents'
import { pendingDungeonEvent } from '@/engine/dungeonEvents'
import { pendingParasiteEvent } from '@/engine/parasiteEvents'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'

// 旅途上的事件（出發時就擲好放在格子上）、城鎮事件（走上設施時遇到）、地下城事件（陷阱、寶箱、採集、長休）或寄生物的發作：選一個應付的方式
const props = defineProps<{ town?: boolean; dungeon?: boolean; parasite?: boolean }>()
const game = useGame()
const pending = computed(() => {
  const s = game.state
  if (!s) return undefined
  if (props.town) return pendingTownEvent(s)
  if (props.dungeon) return pendingDungeonEvent(s)
  if (props.parasite) return pendingParasiteEvent(s)
  return s.roadEvent ? roadTemplate(s.roadEvent.template) : undefined
})
function answer(i: number) {
  if (props.town) game.answerTownEvent(i)
  else if (props.dungeon) game.answerDungeonEvent(i)
  else if (props.parasite) game.answerParasiteEvent(i)
  else game.answerRoadEvent(i)
}
</script>

<template>
  <section v-if="pending" class="panel road-event">
    <h3 class="title"><GameIcon :name="props.town ? 'home' : props.dungeon || props.parasite ? 'warning' : 'compass'" :size="16" />{{ pending.title }}</h3>
    <p class="small">{{ pending.text }}</p>
    <div class="row">
      <button v-for="(o, i) in pending.options ?? []" :key="i" class="small" :disabled="game.judging" @click="answer(i)">
        {{ o.label }}<template v-if="o.check">（{{ attrName(o.check.attr) }}・DC {{ o.check.dc }}）</template>
      </button>
    </div>
  </section>
</template>

<style scoped>
.road-event { display: grid; gap: 6px; border-color: var(--accent); }
.road-event h3, .road-event p { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.road-event p { line-height: 1.6; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
