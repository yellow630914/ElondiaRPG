<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/stores/game'
import { useScenes } from '@/stores/scenes'
import GameIcon from './ui/GameIcon.vue'

// 一張日誌插圖：插在正文的段落之間（分段插圖），或放在正文最後（以前的整則插圖、正文改過對不上的）。
// 可以放大、重畫這一張（分鏡照舊、換一個種子）、刪除。stale：正文重寫過，這張是舊的經過畫的
const props = defineProps<{ imageKey: string; stale?: boolean }>()
const game = useGame()
const scenes = useScenes()
const url = computed(() => scenes.urls[props.imageKey])
const job = computed(() => scenes.jobs[props.imageKey])
const plan = computed(() => scenes.plans[props.imageKey])
/** 這則日誌正在整理分鏡或畫插圖：先不能重畫或刪除單張（整則的工作會換掉這些圖） */
const logBusy = computed(() => {
  const j = scenes.jobs[props.imageKey.split('#')[0]!]
  return !!j && j.stage !== 'error'
})
const zoom = ref(false)

function redraw() {
  if (!game.state) return
  scenes.clearError(props.imageKey)
  void scenes.redraw(game.state, props.imageKey)
}
function remove() {
  if (confirm('刪除這張插圖？')) void scenes.remove(props.imageKey)
}
const RATING = { general: '一般', suggestive: '暗示', explicit: '成人' }
</script>

<template>
  <div v-if="url" class="scene">
    <p v-if="stale" class="small muted stale"><GameIcon name="warning" :size="13" /> 這張是舊的經過畫的（正文重寫過，對不上原本的段落）</p>
    <button class="pic" :class="{ dim: job && job.stage !== 'error' }" title="點一下放大" @click="zoom = true"><img :src="url" alt="日誌插圖" /></button>
    <div v-if="job && job.stage !== 'error'" class="small muted row">
      <GameIcon name="hourglass" :size="13" /> 重畫這張中…
      <button class="small" @click="scenes.cancel(imageKey)">取消</button>
    </div>
    <p v-else-if="job?.stage === 'error'" class="small err row">
      <GameIcon name="warning" :size="13" /> {{ job.error }}
      <button class="small ghost" @click="scenes.clearError(imageKey)">知道了</button>
    </p>
    <div v-if="!job || job.stage === 'error'" class="row small scene-actions">
      <span v-if="plan" class="muted">{{ plan.characters.map((c) => c.name).join('、') || '沒有角色' }}・{{ RATING[plan.rating] }}</span>
      <span class="grow" />
      <button class="small ghost" :disabled="logBusy" :title="logBusy ? '這則日誌的插圖正在生成，完成後才能重畫' : '分鏡照舊，換一個種子重畫這一張'" @click="redraw"><GameIcon name="refresh" :size="13" /> 重畫這張</button>
      <button class="small ghost" :disabled="logBusy" :title="logBusy ? '這則日誌的插圖正在生成，完成後才能刪除' : '刪除這張插圖'" aria-label="刪除插圖" @click="remove"><GameIcon name="trash" :size="13" /></button>
    </div>
    <div v-if="zoom" class="zoom" @click="zoom = false"><img :src="url" alt="日誌插圖" /></div>
  </div>
</template>

<style scoped>
.scene { display: grid; gap: 4px; margin: 8px 0 10px; }
.pic { padding: 0; border: 1px solid var(--gold-lo); border-radius: 3px; overflow: hidden; cursor: zoom-in; background: #0006; max-width: 640px; }
.pic.dim { opacity: 0.6; }
.pic img { display: block; width: 100%; height: auto; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; }
.scene-actions { max-width: 640px; }
.stale { margin: 0; display: flex; gap: 4px; align-items: center; }
.err { color: var(--danger); margin: 0; }
.zoom { position: fixed; inset: 0; z-index: 1000; background: #000c; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.zoom img { max-width: 94vw; max-height: 94vh; border-radius: var(--radius); }
</style>
