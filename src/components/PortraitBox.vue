<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { portraitSubject } from '@/narrator/imageInfo'
import { useGame } from '@/stores/game'
import { useImageSettings } from '@/stores/image'
import { portraitKey, TWEAKS, usePortraits } from '@/stores/portraits'
import GameIcon from './ui/GameIcon.vue'

// 角色的形象插圖（一般模式）：顯示、生成（插圖設定的服務）、✨ 微調（以這張為底重畫）、翻看舊版、上傳、刪除；點圖片放大。
// 想看或改提示詞、調強度、塗遮罩時按「進階」打開工作台（PortraitStudio）。large 時按鈕排在圖片下面
const PortraitStudio = defineAsyncComponent(() => import('./PortraitStudio.vue'))
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
const large = computed(() => props.size === 'large')
const zoom = ref(false)
const studio = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function loadAll(k: string) {
  await portraits.load(k)
  if (large.value) await portraits.loadVersions(k).catch(() => undefined)
}
onMounted(() => void loadAll(key.value))
watch(key, (k) => void loadAll(k))


// ---- 各版：‹ 2 / 5 › 換目前的形象圖 ----
const versions = computed(() => portraits.versions[key.value] ?? [])
const index = computed(() => versions.value.findIndex((v) => v.time === record.value?.time))
async function step(d: number) {
  const v = versions.value[index.value + d]
  if (v) await portraits.useVersion(key.value, v.vkey).catch((e) => (game.error = String(e instanceof Error ? e.message : e)))
}

// ---- 微調 ----
const tweakOpen = ref(false)
const tweakPick = ref('variation')
const tweakText = ref('')
async function tweak() {
  portraits.clearError(key.value)
  try {
    await portraits.tweak(s.value, props.id, tweakPick.value, tweakText.value)
    if (!portraits.jobs[key.value]) {
      tweakOpen.value = false
      tweakText.value = ''
    }
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}

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
  if (confirm('刪除這張形象圖？（生成過的其他版還留在「進階」裡）')) void portraits.remove(key.value)
}
const STAGE = { tags: '預處理提示詞中…', image: '生成圖片中…', error: '' }
const name = computed(() => portraitSubject(s.value, props.id)?.name ?? '')
</script>

<template>
  <div class="portrait" :class="size">
    <div class="top">
      <div class="left">
        <button v-if="url" class="frame" title="點一下放大" @click="zoom = true"><img :src="url" alt="形象圖" /></button>
        <div v-else class="frame empty"><GameIcon :name="job && job.stage !== 'error' ? 'hourglass' : 'image'" :size="28" /></div>
        <div v-if="large && versions.length > 1 && index >= 0" class="nav small" title="生成過的各版：換成目前的形象圖">
          <button class="ghost small" :disabled="index <= 0 || !!job" aria-label="上一版" @click="step(-1)"><GameIcon name="right" :size="12" class="flip" /></button>
          <span>{{ index + 1 }} / {{ versions.length }}</span>
          <button class="ghost small" :disabled="index >= versions.length - 1 || !!job" aria-label="下一版" @click="step(1)"><GameIcon name="right" :size="12" /></button>
        </div>
      </div>
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
          <button v-if="large && url && canDescribe" class="small" :class="{ on: tweakOpen }" title="以這張為底重畫：換表情、小幅變化，或寫一句想改什麼" @click="tweakOpen = !tweakOpen">
            <GameIcon name="wand" :size="13" /> 微調
          </button>
          <button class="small" title="上傳自己的圖片" @click="fileInput?.click()"><GameIcon name="upload" :size="13" /> 上傳</button>
          <button v-if="url" class="small" title="刪除形象圖" aria-label="刪除形象圖" @click="remove"><GameIcon name="trash" :size="13" /></button>
          <button v-if="large && canDescribe" class="small ghost" title="進階：自己改描述或提示詞重送、調以圖生圖的強度、塗遮罩局部重繪" @click="studio = true">
            <GameIcon name="sliders" :size="13" /> 進階
          </button>
          <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        </div>

        <div v-if="tweakOpen && large && url && (!job || job.stage === 'error')" class="tweak">
          <div class="chips">
            <button v-for="(t, k) in TWEAKS" :key="k" class="small chip" :class="{ on: tweakPick === k && !tweakText.trim() }" @click="tweakPick = String(k); tweakText = ''">{{ t.label }}</button>
          </div>
          <input v-model="tweakText" class="small" placeholder="或寫一句想改什麼，例如：換成穿著斗篷、拿著法杖" @keyup.enter="tweak" />
          <div class="row">
            <button class="small primary" :disabled="!image.ready()" @click="tweak"><GameIcon name="wand" :size="13" /> 微調這張</button>
            <span class="small muted">以這張為底重畫，構圖不變；不滿意可以翻回上一版</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="zoom && url" class="zoom" @click="zoom = false"><img :src="url" alt="形象圖" /></div>
    <PortraitStudio v-if="studio" :id="id" :name="name" @close="studio = false" />
  </div>
</template>

<style scoped>
.frame.empty { color: var(--muted); }
button :deep(.game-icon) { vertical-align: -0.2em; }
.portrait { display: grid; gap: 6px; }
.top { display: flex; gap: 10px; align-items: flex-start; }
/* 大的：圖片在上、按鈕與微調在下，整欄固定寬度，不擠右邊的設定 */
.large { width: 260px; }
.large .top { flex-direction: column; align-items: stretch; gap: 6px; }
.large .left { justify-items: stretch; }
.small .top { gap: 6px; }
.left { display: grid; gap: 2px; justify-items: center; flex: none; }
.frame { padding: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--panel-2); flex: none; cursor: zoom-in; }
.large .frame { width: 100%; height: auto; aspect-ratio: 3 / 4; }
.large .nav { justify-content: center; }
.small .frame { width: 64px; height: 84px; }
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.frame.empty { display: flex; align-items: center; justify-content: center; font-size: 1.6rem; cursor: default; color: var(--muted); }
.nav { display: flex; align-items: center; gap: 2px; color: var(--muted); }
.nav button { padding: 0 4px; }
.flip { transform: scaleX(-1); }
.side { display: grid; gap: 4px; min-width: 0; flex: 1; align-content: start; }
.row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
button.on { border-color: var(--accent); color: var(--accent); }
.tweak { display: grid; gap: 6px; padding: 8px; border: 1px dashed var(--border); border-radius: var(--radius); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip.on { background: var(--primary-bg); color: var(--primary-text); border-color: var(--primary-border); }
.tweak input { width: 100%; }
.warn-text { color: var(--danger); margin: 0; }
.prompt pre { white-space: pre-wrap; word-break: break-word; margin: 2px 0 6px; font-size: 0.8rem; background: var(--panel-2); padding: 4px 6px; border-radius: 4px; }
.prompt summary { cursor: pointer; color: var(--accent-2); }
.zoom { position: fixed; inset: 0; z-index: 1000; background: #000c; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.zoom img { max-width: 92vw; max-height: 92vh; border-radius: var(--radius); }
</style>
