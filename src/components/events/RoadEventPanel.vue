<script setup lang="ts">
import { computed } from 'vue'
import { attrName } from '@/engine/data'
import { roadTemplate } from '@/engine/road'
import { useGame } from '@/stores/game'

// 旅途上的事件：出發時就擲好放在格子上，走到時要選一個應付的方式
const game = useGame()
const pending = computed(() => (game.state?.roadEvent ? roadTemplate(game.state.roadEvent.template) : undefined))
</script>

<template>
  <section v-if="pending" class="panel road-event">
    <h3>🧭 {{ pending.title }}</h3>
    <p class="small">{{ pending.text }}</p>
    <div class="row">
      <button v-for="(o, i) in pending.options ?? []" :key="i" class="small" :disabled="game.judging" @click="game.answerRoadEvent(i)">
        {{ o.label }}<template v-if="o.check">（{{ attrName(o.check.attr) }}・DC {{ o.check.dc }}）</template>
      </button>
    </div>
  </section>
</template>

<style scoped>
.road-event { display: grid; gap: 6px; border-color: var(--accent); }
.road-event h3, .road-event p { margin: 0; }
.road-event p { line-height: 1.6; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
