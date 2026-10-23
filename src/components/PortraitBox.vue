<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { portraitSubject } from '@/narrator/imageInfo'
import { useGame } from '@/stores/game'
import { useImageSettings } from '@/stores/image'
import { portraitKey, usePortraits } from '@/stores/portraits'
import GameIcon from './ui/GameIcon.vue'

// 角色的形象插圖：顯示、生成（插圖設定的服務）、上傳、刪除；點圖片放大
const props = withDefaults(defineProps<{ id: string; size?: 'large' | 'small' }>(), { size: 'large' })
const game = useGame()
const image = useImageSettings()
const portraits = usePortraits()
const s = computed(() => game.state!)
const key = computed(() => portraitKey(s.value, props.id))
const url = computed(() => portraits.urls[key.value])
const record = computed(() => portraits.records[key.value])
const job = computed(() => portraits.jobs[key.value])
const canDescribe = computed(() => !!portraitSubject(s.value, props.id))
const zoom = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => void portraits.load(key.value))
watch(key, (k) => void portraits.load(k))

const preview = computed(() => {
  if (!canDescribe.value) return ''
  try {
    return portraits.describe(s.value, props.id)
  } catch {
    return ''
  }
})

function generate() {
  portraits.clearError(key.value)
  void portraits.generate(s.value, props.id)
}
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  try {
    await portraits.upload(key.value, f)
  } catch (err) {
    game.error = err instanceof Error ? err.message : String(err)
  }
}
function remove() {
  if (confirm('刪除這張形象圖？')) void portraits.remove(key.value)
}
const STAGE = { tags: '預處理提示詞中…', image: '生成圖片中…', error: '' }
</script>

<template>
  <div class="portrait" :class="size">
    <div class="top">
      <button v-if="url" class="frame" title="點一下放大" @click="zoom = true"><img :src="url" alt="形象圖" /></button>
      <div v-else class="frame empty"><GameIcon :name="job && job.stage !== 'error' ? 'hourglass' : 'image'" :size="28" /></div>
      <div class="side">
        <div v-if="job && job.stage !== 'error'" class="small">
          {{ STAGE[job.stage] }}
          <button class="small" @click="portraits.cancel(key)">取消</button>
        </div>
        <p v-else-if="job?.stage === 'error'" class="small warn-text"><GameIcon name="warning" :size="13" /> {{ job.error }}</p>
        <div v-if="!job || job.stage === 'error'" class="row">
          <button v-if="canDescribe" class="small" :title="image.ready() ? '' : '先到「設定 → 插圖生成」設定生圖服務'" @click="generate">
            <GameIcon name="image" :size="13" /> {{ url ? '重新生成' : '生成形象圖' }}
          </button>
          <button class="small" title="上傳自己的圖片" @click="fileInput?.click()"><GameIcon name="upload" :size="13" /> 上傳</button>
          <button v-if="url" class="small" title="刪除形象圖" aria-label="刪除形象圖" @click="remove"><GameIcon name="trash" :size="13" /></button>
          <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        </div>
      </div>
    </div>
    <details v-if="size === 'large' && (record?.prompt || job?.tags || preview)" class="small prompt">
      <summary>提示詞</summary>
      <template v-if="job?.tags"><b>預處理後：</b><pre>{{ job.tags }}</pre></template>
      <template v-if="record?.prompt">
        <b>{{ record.semantic ? '上次送出的提示詞（預處理後）' : '上次送出的提示詞' }}：</b><pre>{{ record.prompt }}</pre>
        <template v-if="record.semantic"><b>預處理前的描述：</b><pre>{{ record.semantic }}</pre></template>
      </template>
      <template v-else-if="preview"><b>會送出的描述{{ image.preprocessorFor() ? `（會先預處理：${image.preprocessorFor()!.name}）` : '' }}：</b><pre>{{ preview }}</pre></template>
    </details>
    <div v-if="zoom && url" class="zoom" @click="zoom = false"><img :src="url" alt="形象圖" /></div>
  </div>
</template>

<style scoped>
.frame.empty { color: var(--muted); }
button :deep(.game-icon) { vertical-align: -0.2em; }
.portrait { display: grid; gap: 6px; }
.top { display: flex; gap: 10px; align-items: flex-start; }
.small .top { gap: 6px; }
.frame { padding: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--panel-2); flex: none; cursor: zoom-in; }
.large .frame { width: 120px; height: 160px; }
.small .frame { width: 64px; height: 84px; }
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.frame.empty { display: flex; align-items: center; justify-content: center; font-size: 1.6rem; cursor: default; color: var(--muted); }
.side { display: grid; gap: 4px; min-width: 0; flex: 1; }
.row { display: flex; flex-wrap: wrap; gap: 4px; }
.warn-text { color: var(--danger); margin: 0; }
.prompt pre { white-space: pre-wrap; word-break: break-word; margin: 2px 0 6px; font-size: 0.8rem; background: var(--panel-2); padding: 4px 6px; border-radius: 4px; }
.prompt summary { cursor: pointer; color: var(--accent-2); }
.zoom { position: fixed; inset: 0; z-index: 1000; background: #000c; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.zoom img { max-width: 92vw; max-height: 92vh; border-radius: var(--radius); }
</style>
