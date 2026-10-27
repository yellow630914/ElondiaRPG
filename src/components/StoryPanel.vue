<script setup lang="ts">
import ContentTagChips from './ContentTagChips.vue'
import { computed } from 'vue'
import { formatMoney } from '@/engine/money'
import { nodesHere, storyMaxCost, storyOffersHere, storyWearLocks } from '@/engine/story'
import { useGame } from '@/stores/game'
import StoryNodeCard from './StoryNodeCard.vue'
import GameIcon from './ui/GameIcon.vue'

// 特殊任務：這裡可以接的任務（公會、身邊的固定 NPC），以及這裡的任務點
const game = useGame()
const s = computed(() => game.state!)
const offers = computed(() => {
  void s.value.time.minute
  void s.value.position
  return storyOffersHere(s.value)
})
const nodes = computed(() => {
  void s.value.time.minute
  void s.value.position
  void s.value.flags
  return nodesHere(s.value)
})
const busy = computed(() => game.judging || !!s.value.pendingAction || !!s.value.combat)
</script>

<template>
  <section v-if="offers.length || nodes.length" class="panel story-panel">
    <h3 class="title"><GameIcon name="star" :size="16" />特殊任務</h3>
    <div v-for="d in offers" :key="d.id" class="card">
      <div><span v-if="d.rank" class="tag">{{ d.rank }}</span> <b>{{ d.title }}</b> <ContentTagChips :tags="d.tags" /></div>
      <p class="small">{{ d.start.text ?? d.summary }}</p>
      <p v-if="d.start.text" class="small muted">{{ d.summary }}</p>
      <p v-if="storyMaxCost(d)" class="small muted">途中有要付錢的地方（一次最多 {{ formatMoney(storyMaxCost(d)) }}），錢不夠時那一步不能選</p>
      <p v-if="storyWearLocks(s, d)" class="small warn">{{ storyWearLocks(s, d) }}</p>
      <button class="small primary" :disabled="busy" @click="game.startStory(d.id)">接下任務</button>
    </div>
    <StoryNodeCard v-for="n in nodes" :key="n.ref" :n="n" />
  </section>
</template>

<style scoped>
.story-panel { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
.story-panel h3 { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.card { border: 1px dashed var(--accent); border-radius: var(--radius); padding: 6px 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.card p { margin: 0; line-height: 1.6; }
.warn { color: var(--danger); }
</style>
