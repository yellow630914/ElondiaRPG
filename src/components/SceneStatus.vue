<script setup lang="ts">
import { computed } from 'vue'
import { useScenes } from '@/stores/scenes'
import GameIcon from './ui/GameIcon.vue'

// 一則日誌的插圖工作：整理分鏡中、生成第幾張、出錯的訊息（放在正文的最後）
const props = defineProps<{ sceneKey: string }>()
const scenes = useScenes()
const job = computed(() => scenes.jobs[props.sceneKey])
const label = computed(() => {
  const j = job.value
  if (!j || j.stage === 'error') return ''
  if (j.stage === 'plan') return '整理分鏡中…'
  return j.total && j.total > 1 ? `生成插圖中（${Math.min((j.done ?? 0) + 1, j.total)}／${j.total}）…` : '生成插圖中…'
})
</script>

<template>
  <div v-if="job" class="status small">
    <div v-if="job.stage !== 'error'" class="muted row">
      <GameIcon name="hourglass" :size="13" /> {{ label }}
      <button class="small" @click="scenes.cancel(sceneKey)">取消</button>
    </div>
    <p v-else class="err row">
      <GameIcon name="warning" :size="13" /> {{ job.error }}
      <button class="small ghost" @click="scenes.clearError(sceneKey)">知道了</button>
    </p>
  </div>
</template>

<style scoped>
.status { margin: 6px 0 2px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.err { color: var(--danger); margin: 0; }
</style>
