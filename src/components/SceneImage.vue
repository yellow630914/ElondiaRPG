<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import { sceneKey, useScenes } from '@/stores/scenes'
import GameIcon from './ui/GameIcon.vue'

// 日誌插圖：掛在日誌下面。生成中顯示進度，生成後可以放大、重新生成、刪除。
const props = defineProps<{ report: Report }>()
const game = useGame()
const scenes = useScenes()
const key = computed(() => (game.state ? sceneKey(game.state, props.report.report_id) : ''))
const url = computed(() => scenes.urls[key.value])
const job = computed(() => scenes.jobs[key.value])
const plan = computed(() => scenes.plans[key.value])
const zoom = ref(false)
onMounted(() => {
  if (game.state) void scenes.scan(game.state.seed)
})

function again() {
  if (!game.state) return
  scenes.clearError(key.value)
  void scenes.generate(game.state, props.report)
}
function remove() {
  if (confirm('刪除這張插圖？')) void scenes.remove(key.value)
}
const STAGE = { plan: '整理分鏡中…', image: '生成插圖中…', error: '' }
const RATING = { general: '一般', suggestive: '暗示', explicit: '成人' }
</script>

<template>
  <div v-if="url || job" class="scene">
    <button v-if="url" class="pic" title="點一下放大" @click="zoom = true"><img :src="url" alt="日誌插圖" /></button>
    <div v-if="job && job.stage !== 'error'" class="small muted row">
      <GameIcon name="hourglass" :size="13" /> {{ STAGE[job.stage] }}
      <button class="small" @click="scenes.cancel(key)">取消</button>
    </div>
    <p v-else-if="job?.stage === 'error'" class="small err row">
      <GameIcon name="warning" :size="13" /> {{ job.error }}
      <button class="small ghost" @click="scenes.clearError(key)">知道了</button>
    </p>
    <div v-if="url && (!job || job.stage === 'error')" class="row small bar">
      <span v-if="plan" class="muted">{{ plan.characters.map((c) => c.name).join('、') || '沒有角色' }}・{{ RATING[plan.rating] }}</span>
      <span class="grow" />
      <button class="small ghost" title="重新整理分鏡、重畫一張" @click="again"><GameIcon name="refresh" :size="13" /> 重新生成</button>
      <button class="small ghost" title="刪除插圖" aria-label="刪除插圖" @click="remove"><GameIcon name="trash" :size="13" /></button>
    </div>
    <div v-if="zoom && url" class="zoom" @click="zoom = false"><img :src="url" alt="日誌插圖" /></div>
  </div>
</template>

<style scoped>
.scene { display: grid; gap: 4px; margin: 8px 0 2px; }
.pic { padding: 0; border: 1px solid var(--gold-lo); border-radius: 3px; overflow: hidden; cursor: zoom-in; background: #0006; max-width: 640px; }
.pic img { display: block; width: 100%; height: auto; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; }
.bar { max-width: 640px; }
.err { color: var(--danger); margin: 0; }
.zoom { position: fixed; inset: 0; z-index: 1000; background: #000c; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.zoom img { max-width: 94vw; max-height: 94vh; border-radius: var(--radius); }
</style>
