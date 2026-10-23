<script setup lang="ts">
import { computed } from 'vue'
import { attrName } from '@/engine/data'
import { roadTemplate } from '@/engine/road'
import { pendingTownEvent } from '@/engine/townEvents'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'

// 旅途上的事件（出發時就擲好放在格子上）或城鎮事件（走上設施時遇到）：選一個應付的方式
const props = defineProps<{ town?: boolean }>()
const game = useGame()
const pending = computed(() => {
  const s = game.state
  if (!s) return undefined
  if (props.town) return pendingTownEvent(s)
  return s.roadEvent ? roadTemplate(s.roadEvent.template) : undefined
})
function answer(i: number) {
  if (props.town) game.answerTownEvent(i)
  else game.answerRoadEvent(i)
}
</script>

<template>
  <section v-if="pending" class="panel road-event">
    <h3 class="title"><GameIcon :name="props.town ? 'home' : 'compass'" :size="16" />{{ pending.title }}</h3>
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
