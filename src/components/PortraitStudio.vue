<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { imageServiceInfo } from '@/narrator/imageInfo'
import { canvasBlob } from '@/narrator/imageUtils'
import { useGame } from '@/stores/game'
import { useImageSettings } from '@/stores/image'
import { portraitKey, usePortraits, type PortraitVersion } from '@/stores/portraits'
import AppDialog from './AppDialog.vue'
import GameIcon from './ui/GameIcon.vue'

// 形象圖的進階工作台：一般模式（PortraitBox）不夠用時才打開。
// - 提示詞：改預處理前的描述（重新預處理）或直接改送出的提示詞重送；負面提示詞、種子
// - 以圖生圖：選底圖（某一版或上傳）、重繪強度、整張重繪或塗遮罩局部重繪
// 生成的圖都是新的一版，不會換掉目前的形象圖；按「設為形象圖」才換。見 docs/PORTRAITS.md 第 6 節
const props = defineProps<{ id: string; name: string }>()
const emit = defineEmits<{ close: [] }>()
const game = useGame()
const image = useImageSettings()
const portraits = usePortraits()
const s = computed(() => game.state!)
const key = computed(() => portraitKey(s.value, props.id))
const job = computed(() => portraits.jobs[key.value])
const busy = computed(() => !!job.value && job.value.stage !== 'error')
const service = computed(() => image.service)
const openai = computed(() => service.value === 'openai')
const pre = computed(() => image.preprocessorFor())

const versions = computed(() => portraits.versions[key.value] ?? [])
const currentTime = computed(() => portraits.records[key.value]?.time)
const selected = ref('')
const sel = computed<PortraitVersion | undefined>(() => versions.value.find((v) => v.vkey === selected.value))
const tab = ref<'prompt' | 'img2img'>('prompt')

// ---- 提示詞 ----
const semantic = ref('')
const remember = ref(false)
const prompt = ref('')
const negative = ref('')
const seedMode = ref<'random' | 'same' | 'fixed'>('random')
const seedValue = ref('')

function fillFrom(v: PortraitVersion | undefined) {
  semantic.value = v?.semantic ?? (v?.prompt && !pre.value ? v.prompt : '') ?? ''
  if (!semantic.value) semantic.value = safeDescribe()
  prompt.value = v?.prompt ?? ''
  negative.value = v?.negative ?? image.negativeFor()
  if (seedMode.value === 'same' && v?.seed === undefined) seedMode.value = 'random'
}
function safeDescribe(): string {
  try {
    return portraits.describe(s.value, props.id)
  } catch {
    return ''
  }
}

onMounted(async () => {
  await portraits.load(key.value)
  const list = await portraits.loadVersions(key.value).catch(() => [])
  selected.value = list.find((v) => v.time === currentTime.value)?.vkey ?? list.at(-1)?.vkey ?? ''
  remember.value = !!portraits.descs[key.value]
  fillFrom(sel.value)
  baseVkey.value = selected.value
})
watch(selected, () => {
  if (!busy.value) fillFrom(sel.value)
})

function seed(): number | undefined {
  if (seedMode.value === 'same') return sel.value?.seed
  if (seedMode.value === 'fixed') {
    const n = Number(seedValue.value)
    return Number.isFinite(n) && seedValue.value.trim() ? Math.max(0, Math.floor(n)) : undefined
  }
  return undefined
}

async function rememberIfAsked() {
  if (remember.value) await portraits.setDescription(key.value, semantic.value)
  else if (portraits.descs[key.value]) await portraits.setDescription(key.value, null)
}

async function done(vkey: string | undefined) {
  if (vkey) {
    selected.value = vkey
    await nextTick()
    fillFrom(sel.value)
  }
}

async function onlyPreprocess() {
  portraits.clearError(key.value)
  const out = await portraits.preprocessOnly(key.value, semantic.value)
  if (out) prompt.value = out
}
async function fromSemantic() {
  portraits.clearError(key.value)
  await rememberIfAsked()
  await done(await portraits.studioGenerate(key.value, { semantic: semantic.value, negative: negative.value, ...(seedOf()) }))
}
async function fromPrompt() {
  portraits.clearError(key.value)
  await done(await portraits.studioGenerate(key.value, { prompt: prompt.value, negative: negative.value, ...(seedOf()) }))
}
const seedOf = () => { const n = seed(); return n === undefined ? {} : { seed: n } }
function resetDescription() {
  try {
    semantic.value = portraits.baseDescription(s.value, props.id)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}

// ---- 以圖生圖 ----
const baseVkey = ref('')
const baseFile = ref<File | null>(null)
const baseFileUrl = ref('')
const baseKind = ref<'version' | 'file'>('version')
const maskMode = ref(false)
const strength = ref(0.55)
const fileInput = ref<HTMLInputElement | null>(null)
function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (baseFileUrl.value) URL.revokeObjectURL(baseFileUrl.value)
  baseFile.value = f
  baseFileUrl.value = URL.createObjectURL(f)
  baseKind.value = 'file'
}
const baseUrl = computed(() => (baseKind.value === 'file' ? baseFileUrl.value : portraits.versionUrls[baseVkey.value] ?? ''))
/** 左邊大圖：以圖生圖分頁顯示底圖，其他時候顯示選的那一版 */
const shownUrl = computed(() => (tab.value === 'img2img' ? baseUrl.value : portraits.versionUrls[selected.value] ?? ''))

// 遮罩：在底圖上塗白色（要重畫的地方）
const maskEl = ref<HTMLCanvasElement | null>(null)
const brush = ref(36)
const erasing = ref(false)
const painted = ref(false)
let drawing = false
function maskCtx() {
  return maskEl.value?.getContext('2d') ?? null
}
function paint(e: PointerEvent) {
  const el = maskEl.value
  const ctx = maskCtx()
  if (!el || !ctx || !drawing) return
  const r = el.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * el.width
  const y = ((e.clientY - r.top) / r.height) * el.height
  ctx.globalCompositeOperation = erasing.value ? 'destination-out' : 'source-over'
  ctx.fillStyle = '#e0302a'
  ctx.beginPath()
  ctx.arc(x, y, (brush.value / 2) * (el.width / r.width), 0, Math.PI * 2)
  ctx.fill()
  if (!erasing.value) painted.value = true
}
function down(e: PointerEvent) {
  drawing = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  paint(e)
}
function up() {
  drawing = false
}
function clearMask() {
  const el = maskEl.value
  maskCtx()?.clearRect(0, 0, el?.width ?? 0, el?.height ?? 0)
  painted.value = false
}
/** 遮罩匯出成白色（重畫）、黑色（保留）的 PNG */
async function maskBlob(): Promise<Blob | undefined> {
  const el = maskEl.value
  if (!el || !painted.value) return undefined
  // 塗過的地方換成白色，再疊到黑底上
  const white = document.createElement('canvas')
  white.width = el.width
  white.height = el.height
  const w = white.getContext('2d')!
  w.drawImage(el, 0, 0)
  w.globalCompositeOperation = 'source-in'
  w.fillStyle = '#fff'
  w.fillRect(0, 0, white.width, white.height)
  const out = document.createElement('canvas')
  out.width = el.width
  out.height = el.height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(white, 0, 0)
  return canvasBlob(out)
}
watch([baseUrl, maskMode], () => clearMask())

async function img2img() {
  portraits.clearError(key.value)
  if (maskMode.value && !painted.value) {
    game.error = '先在左邊的圖上塗出要重畫的地方'
    return
  }
  const mask = maskMode.value ? await maskBlob() : undefined
  const base = baseKind.value === 'file' && baseFile.value
    ? { file: baseFile.value, strength: strength.value, ...(mask ? { mask } : {}) }
    : { vkey: baseVkey.value, strength: strength.value, ...(mask ? { mask } : {}) }
  await done(await portraits.studioGenerate(key.value, { prompt: prompt.value, negative: negative.value, ...(seedOf()), base }))
}

// ---- 各版 ----
function pick(vkey: string) {
  selected.value = vkey
  if (tab.value === 'img2img' && baseKind.value === 'version') baseVkey.value = vkey
}
async function makeCurrent() {
  if (sel.value) await portraits.useVersion(key.value, sel.value.vkey)
}
async function removeSelected() {
  if (!sel.value || !confirm('刪除這一版？')) return
  try {
    const i = versions.value.findIndex((v) => v.vkey === selected.value)
    await portraits.removeVersion(key.value, selected.value)
    selected.value = versions.value[Math.max(0, i - 1)]?.vkey ?? ''
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
const FROM = { generate: '生成', tweak: '微調', studio: '進階', upload: '上傳' }
const when = (t: number) => new Date(t).toLocaleString()
const STAGE = { tags: '預處理提示詞中…', image: '生成圖片中…', error: '' }
const support = computed(() => ({
  comfyui: '內建模式把底圖編碼成 latent 再重畫，局部重繪加遮罩（都是 ComfyUI 內建節點）；自訂工作流程要有 %image%、%mask%、%denoise% 代號。',
  novelai: '以圖生圖（img2img）；局部重繪用 infill，會改用模型的 -inpainting 版本。',
  openai: 'ChatGPT 是照「文字指示」改圖（/images/edits）：沒有重繪強度，遮罩只是參考範圍。提示詞寫成指示，例如「把表情改成微笑，其他不變」。',
}[service.value]))
</script>

<template>
  <AppDialog :open="true" :title="`${name} 的形象圖`" icon="image" width="1120px" @close="emit('close')">
    <template #head><span class="tag">{{ imageServiceInfo(service).name }}<template v-if="pre"> · {{ pre.name }}</template></span></template>
    <div class="studio">
      <div class="left">
        <div class="art">
          <img v-if="shownUrl" :src="shownUrl" alt="" />
          <div v-else class="empty muted"><GameIcon name="image" :size="40" /></div>
          <canvas
            v-show="tab === 'img2img' && maskMode && shownUrl" ref="maskEl" class="mask" width="512" height="768"
            @pointerdown="down" @pointermove="paint" @pointerup="up" @pointerleave="up"
          />
          <span v-if="tab === 'img2img'" class="badge tag">底圖{{ maskMode ? '・塗遮罩' : '' }}</span>
          <span v-else-if="sel" class="badge tag">v{{ versions.indexOf(sel) + 1 }}{{ sel.time === currentTime ? '・★ 形象圖' : '' }}</span>
        </div>
        <div v-if="tab === 'img2img' && maskMode" class="row small brushbar">
          <span class="seg"><button :class="{ on: !erasing }" @click="erasing = false">塗遮罩</button><button :class="{ on: erasing }" @click="erasing = true">擦掉</button></span>
          <span>筆刷</span><input v-model.number="brush" type="range" min="8" max="90" />
          <button class="small" @click="clearMask">清除</button>
        </div>
        <div class="strip">
          <button
            v-for="(v, i) in versions" :key="v.vkey" class="thumb" :class="{ on: v.vkey === selected }" :title="`v${i + 1}・${FROM[v.from ?? 'generate']}${v.note ? `：${v.note}` : ''}`"
            @click="pick(v.vkey)"
          >
            <img :src="portraits.versionUrls[v.vkey]" alt="" /><span class="n">v{{ i + 1 }}</span><span v-if="v.time === currentTime" class="star">★</span>
          </button>
        </div>
        <p v-if="sel" class="meta small muted">
          v{{ versions.indexOf(sel) + 1 }}・{{ FROM[sel.from ?? 'generate'] }}{{ sel.note ? `（${sel.note}）` : '' }}・{{ sel.service ?? '' }}{{ sel.seed !== undefined ? `・種子 ${sel.seed}` : '' }}<br />{{ when(sel.time) }}
        </p>
        <div class="row">
          <button class="small primary" :disabled="!sel || sel.time === currentTime" @click="makeCurrent">★ 設為形象圖</button>
          <a v-if="sel" class="small dl" :href="portraits.versionUrls[sel.vkey]" :download="`${name}-v${versions.indexOf(sel) + 1}.png`"><GameIcon name="download" :size="13" /> 下載</a>
          <button class="small danger" :disabled="!sel || sel.time === currentTime" @click="removeSelected">刪除這版</button>
        </div>
      </div>

      <div class="right">
        <div class="tabs">
          <button :class="{ on: tab === 'prompt' }" @click="tab = 'prompt'"><GameIcon name="edit" :size="14" /> 提示詞</button>
          <button :class="{ on: tab === 'img2img' }" :disabled="!versions.length && !baseFile" @click="tab = 'img2img'; baseVkey = baseVkey || selected"><GameIcon name="wand" :size="14" /> 以圖生圖</button>
        </div>
        <div v-if="job" class="status small" :class="{ err: job.stage === 'error' }">
          <template v-if="job.stage === 'error'"><GameIcon name="warning" :size="13" /> {{ job.error }} <button class="small ghost" @click="portraits.clearError(key)">知道了</button></template>
          <template v-else>{{ STAGE[job.stage] }} <button class="small" @click="portraits.cancel(key)">取消</button></template>
        </div>

        <template v-if="tab === 'prompt'">
          <section class="step">
            <h4><span class="n">1</span>預處理前的描述<span class="r muted small">依「形象插圖提示詞模板」＋角色資料組成</span></h4>
            <textarea v-model="semantic" rows="7" />
            <div class="row small">
              <label><input v-model="remember" type="checkbox" /> 記住為這個角色的描述（之後「重新生成」也用這段）</label>
              <span class="grow" />
              <button class="small" @click="resetDescription"><GameIcon name="undo" :size="13" /> 依角色資料重組</button>
            </div>
            <div class="row">
              <button v-if="pre" class="small" :disabled="busy || !semantic.trim()" @click="onlyPreprocess">只預處理（不生圖）</button>
              <button class="small primary" :disabled="busy || !semantic.trim() || !image.ready()" @click="fromSemantic">{{ pre ? '預處理並生圖' : '用描述生圖' }} ▶</button>
              <span class="small muted">→ 新的一版{{ pre ? '；下面的提示詞會換成新的' : '' }}</span>
            </div>
          </section>
          <div class="flow small">{{ pre ? `⬇ 預處理：${pre.name}（「插圖提示詞預處理」的模型來源）` : '⬇ 這個服務不預處理：描述直接送出' }}</div>
          <section class="step">
            <h4><span class="n">2</span>送出的提示詞<span class="r muted small">直接改這裡就不會再經過預處理</span></h4>
            <textarea v-model="prompt" rows="4" :placeholder="pre ? '按「只預處理」或選一版生成過的，這裡會出現送出的提示詞' : '直接寫要送出的提示詞'" />
            <details v-if="!openai" class="small" open>
              <summary>負面提示詞（這次）</summary>
              <textarea v-model="negative" rows="2" />
            </details>
            <div v-if="!openai" class="row small">
              <span>種子</span>
              <span class="seg">
                <button :class="{ on: seedMode === 'random' }" @click="seedMode = 'random'">隨機</button>
                <button :class="{ on: seedMode === 'same' }" :disabled="sel?.seed === undefined" @click="seedMode = 'same'">沿用這版</button>
                <button :class="{ on: seedMode === 'fixed' }" @click="seedMode = 'fixed'">指定</button>
              </span>
              <input v-if="seedMode === 'fixed'" v-model="seedValue" class="seed" inputmode="numeric" placeholder="種子" />
              <span v-else-if="seedMode === 'same'" class="muted">{{ sel?.seed }}</span>
              <span class="muted">（固定種子只改幾個詞＝同一張圖的微調）</span>
            </div>
            <div class="row end">
              <button class="small primary" :disabled="busy || !prompt.trim() || !image.ready()" @click="fromPrompt">直接用這段生圖 ▶</button>
            </div>
          </section>
          <p class="note small muted">生成的圖都是新的一版，不會換掉目前的形象圖；按「★ 設為形象圖」才換。每個角色保留最近 8 版（形象圖那版不會被擠掉）。</p>
        </template>

        <template v-else>
          <section class="step">
            <h4><span class="n">1</span>底圖</h4>
            <div class="row small">
              <label><input v-model="baseKind" type="radio" value="version" /> 版本
                <select v-model="baseVkey" :disabled="baseKind !== 'version'">
                  <option v-for="(v, i) in versions" :key="v.vkey" :value="v.vkey">v{{ i + 1 }}{{ v.time === currentTime ? '（★ 形象圖）' : '' }}</option>
                </select>
              </label>
              <label><input v-model="baseKind" type="radio" value="file" :disabled="!baseFile" /> 上傳的圖片</label>
              <button class="small" @click="fileInput?.click()"><GameIcon name="upload" :size="13" /> 選檔案…</button>
              <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
            </div>
            <p class="small muted">底圖會縮放、裁切成目前的出圖尺寸（{{ image.sizeFor().width }} × {{ image.sizeFor().height }}）。</p>
          </section>
          <section class="step">
            <h4><span class="n">2</span>怎麼改</h4>
            <div class="row small">
              <span>模式</span>
              <span class="seg"><button :class="{ on: !maskMode }" @click="maskMode = false">整張重繪</button><button :class="{ on: maskMode }" @click="maskMode = true">局部重繪（塗遮罩）</button></span>
            </div>
            <div v-if="!openai" class="row small">
              <span>重繪強度</span><input v-model.number="strength" type="range" min="0.1" max="0.95" step="0.05" class="range" /><b>{{ strength.toFixed(2) }}</b>
              <span class="muted">0.2 調色調・0.5 改表情姿勢・0.8 幾乎重畫</span>
            </div>
            <div class="small">{{ openai ? '想怎麼改（寫成指示）' : '提示詞' }}</div>
            <textarea v-model="prompt" rows="3" :placeholder="openai ? '例如：把表情改成微笑，衣服換成藍色斗篷，其他不變' : '預設帶入這一版送出的提示詞，改成這次想要的樣子'" />
            <div v-if="!openai" class="row small">
              <span>種子</span>
              <span class="seg">
                <button :class="{ on: seedMode === 'random' }" @click="seedMode = 'random'">隨機</button>
                <button :class="{ on: seedMode === 'same' }" :disabled="sel?.seed === undefined" @click="seedMode = 'same'">沿用這版</button>
              </span>
            </div>
            <div class="row end">
              <button class="small primary" :disabled="busy || !prompt.trim() || !baseUrl || !image.ready()" @click="img2img">以圖生圖 ▶</button>
            </div>
          </section>
          <p class="note small muted">{{ support }}</p>
        </template>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.studio { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 18px; }
.left { display: grid; gap: 8px; align-content: start; }
.art { position: relative; width: 320px; aspect-ratio: 2 / 3; border: 1px solid #8a6a3a; background: #2a1e14; overflow: hidden; }
.art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.art .empty { display: grid; place-items: center; height: 100%; }
.art .mask { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.5; cursor: crosshair; touch-action: none; }
.badge { position: absolute; left: 6px; top: 6px; background: #000a; color: #f0d083; }
.strip { display: flex; gap: 5px; flex-wrap: wrap; }
.thumb { position: relative; width: 52px; height: 72px; padding: 0; overflow: hidden; border: 1px solid #8a6a3a; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb.on { outline: 2px solid var(--accent); outline-offset: 1px; }
.thumb .n { position: absolute; left: 2px; bottom: 0; font-size: 11px; color: #fff; text-shadow: 0 1px 2px #000; }
.thumb .star { position: absolute; right: 3px; top: 0; color: #f0d083; text-shadow: 0 1px 2px #000; }
.meta { margin: 0; line-height: 1.5; }
.dl { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; border: 1px solid var(--btn-border); border-radius: 3px; padding: 2px 9px; color: var(--btn-text); background: var(--btn-bg); }
.right { display: grid; gap: 8px; align-content: start; min-width: 0; }
.tabs { display: flex; gap: 2px; border-bottom: 1px solid #b8955a; }
.tabs button { border-radius: 3px 3px 0 0; border-bottom: none; background: none; color: var(--muted); display: inline-flex; gap: 4px; align-items: center; }
.tabs button.on { background: #f4e7c6; color: var(--ink); border-color: #b8955a; font-weight: 700; }
.status { padding: 4px 8px; border: 1px solid var(--border); border-radius: 3px; }
.status.err { color: var(--danger); border-color: var(--danger); }
.step { border: 1px solid #c4a671; background: #f6ead0aa; border-radius: 4px; padding: 10px 12px; display: grid; gap: 6px; }
.step h4 { margin: 0; display: flex; align-items: center; gap: 8px; color: #5b3a1e; }
.step h4 .n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #7a4a1e; color: #f4e7c6; font-size: 12px; }
.step h4 .r { margin-left: auto; font-weight: 400; }
textarea { width: 100%; font-size: 0.82rem; line-height: 1.45; font-family: ui-monospace, Consolas, monospace; resize: vertical; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row.end { justify-content: flex-end; }
.grow { flex: 1; }
.flow { display: flex; align-items: center; gap: 8px; color: #6b5038; }
.flow::before, .flow::after { content: ''; flex: 1; height: 1px; background: #c4a671; }
.seg { display: inline-flex; border: 1px solid #b8955a; border-radius: 3px; overflow: hidden; }
.seg button { border: none; border-radius: 0; background: none; color: #6b5038; padding: 2px 10px; font-size: var(--fs-sm); }
.seg button + button { border-left: 1px solid #b8955a; }
.seg button.on { background: #7a4a1e; color: #f4e7c6; }
.seed { width: 120px; }
.range { width: 200px; }
.brushbar input[type='range'] { width: 90px; }
.note { margin: 0; }
@media (max-width: 860px) {
  .studio { grid-template-columns: 1fr; }
  .art { width: 100%; max-width: 320px; }
}
</style>
