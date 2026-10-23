<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import DefeatEventPanel from '../DefeatEventPanel.vue'
import MasterEventPanel from '../MasterEventPanel.vue'
import StandoffPanel from '../StandoffPanel.vue'
import LevelUpPanel from './LevelUpPanel.vue'
import MarkingPanel from './MarkingPanel.vue'
import PerkOfferPanel from './PerkOfferPanel.vue'
import RoadEventPanel from './RoadEventPanel.vue'
import SuggestionPanel from './SuggestionPanel.vue'
import { activeEvents, eventDialogOpen, snoozed, type GameEvent } from './eventQueue'

// 事件視窗：需要回應的事件（見 eventQueue.ts）一件一件處理。有新的事件時自動打開；
// 擋住行動的事件排在前面，不能「稍後」；關掉視窗後畫面上方顯示待處理的件數，移動或休息被擋住時再打開
const emit = defineEmits<{ 'open-party': []; 'open-relations': [] }>()
const game = useGame()
const events = computed(() => activeEvents(game.state))
const current = computed(() => events.value[0])
const next = computed(() => events.value.slice(1))

// 出現新的事件就打開；升級選了一部分（剩下的能力或屬性點變少）不算新的事件，免得蓋住正在用的隊伍視窗
const seen = ref(new Set<string>())
const levelUpLeft = new Map<string, number>()
function isFresh(e: GameEvent): boolean {
  if (e.kind !== 'levelup') return !seen.value.has(e.id)
  const [, member, level, choices, points] = e.id.split(':')
  const key = `${member}:${level}`
  const left = Number(choices) + Number(points)
  const before = levelUpLeft.get(key)
  levelUpLeft.set(key, left)
  return before === undefined || left > before
}
watch(events, (list) => {
  const fresh = list.filter(isFresh)
  if (fresh.length) {
    seen.value = new Set([...seen.value, ...fresh.map((e) => e.id)])
    eventDialogOpen.value = true
  }
  if (!list.length) eventDialogOpen.value = false
}, { immediate: true })

// 被擋住（撞到「先回應主人的要求」之類）時再打開
watch(() => game.bump, () => {
  if (events.value.some((e) => e.blocking)) eventDialogOpen.value = true
})

function later() {
  const e = current.value
  if (!e || e.blocking) return
  snoozed.value = new Set([...snoozed.value, e.id])
}
function openParty() {
  eventDialogOpen.value = false
  emit('open-party')
}
</script>

<template>
  <AppDialog :open="eventDialogOpen && !!current" :title="events.length > 1 ? `需要你處理的事（還有 ${events.length - 1} 件）` : '需要你處理的事'" icon="bell" width="720px" @close="eventDialogOpen = false">
    <div v-if="current" class="event-center">
      <DefeatEventPanel v-if="current.kind === 'defeat'" />
      <StandoffPanel v-else-if="current.kind === 'standoff'" />
      <MarkingPanel v-else-if="current.kind === 'mark'" />
      <MasterEventPanel v-else-if="current.kind === 'master'" />
      <RoadEventPanel v-else-if="current.kind === 'road'" />
      <RoadEventPanel v-else-if="current.kind === 'town'" town />
      <SuggestionPanel v-else-if="current.kind === 'suggestion'" :id="current.ref!" />
      <LevelUpPanel v-else-if="current.kind === 'levelup'" :id="current.ref!" @open-party="openParty" />
      <PerkOfferPanel v-else-if="current.kind === 'perk'" :refid="current.ref!" />

      <div class="row foot">
        <span v-if="current.blocking" class="small muted">這件事要先處理，才能繼續移動或休息。可以先關掉視窗看看周圍，上方的 🔔 可以再打開。</span>
        <template v-else>
          <button class="small" @click="later">稍後再說</button>
          <button v-if="current.kind === 'suggestion'" class="small" @click="eventDialogOpen = false; emit('open-relations')">開啟人際關係</button>
        </template>
      </div>
      <p v-if="next.length" class="small muted">接下來：{{ next.map((e) => `${e.icon} ${e.title}`).join('・') }}</p>
    </div>
  </AppDialog>
</template>

<style scoped>
.event-center { display: grid; gap: 10px; }
.event-center p { margin: 0; }
.foot { gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
