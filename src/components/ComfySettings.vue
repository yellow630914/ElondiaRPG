<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  applyMossProfile, buildWorkflow, checkWorkflow, COMFY_MODES, comfyServer, MOSS_PROFILES, presetIssues, promptPrefix,
  type ComfyLora, type ComfyMode, type MossProfile,
} from '@/narrator/comfy'
import { useImageSettings } from '@/stores/image'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// ComfyUI 的設定組合（docs/PORTRAITS.md 第 5 節）：每個主模一組。工具列切換、新增、複製、匯入、刪除；
// 內容分成「模型、LoRA、尺寸與取樣、提示詞」四個分頁，底下是檢查。伺服器（網址、清單）在 ImageSettings。
const image = useImageSettings()
const p = computed(() => image.preset())
const opts = computed(() => image.comfyOptions)
const issues = computed(() => presetIssues(p.value))
const modeInfo = computed(() => COMFY_MODES.find((m) => m.id === p.value.mode)!)

type Tab = 'model' | 'lora' | 'sampling' | 'prompt'
const tab = ref<Tab>('model')
const TABS: { id: Tab; label: string }[] = [
  { id: 'model', label: '模型' }, { id: 'lora', label: 'LoRA' }, { id: 'sampling', label: '尺寸與取樣' }, { id: 'prompt', label: '提示詞' },
]
const custom = computed(() => p.value.mode === 'custom')
const moss = computed(() => p.value.mode === 'moss')

// ---- 工具列 ----
function rename(e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (v) p.value.name = v
}
function remove() {
  if (!confirm(`刪除設定「${p.value.name}」？`)) return
  try {
    image.removePreset()
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  }
}
function addPreset(mode: ComfyMode) {
  image.addPreset(mode)
  if (mode === 'moss') useMossLayout()
  tab.value = 'model'
  adding.value = false
}
/** 換成 MOSS 時，ComfyUI 的提示詞寫法還不是版面的話改成「MOSS 版面」 */
function useMossLayout() {
  if (image.preprocessorFor('comfyui')?.output !== 'layout') image.preprocess.comfyui = 'moss'
}
const adding = ref(false)

// ---- 模型 ----
/** 文字編碼器的數量：1 → CLIPLoader、2 → DualCLIPLoader、3 → TripleCLIPLoader */
const clipCount = computed({
  get: () => Math.max(1, p.value.clips.length),
  set: (n: number) => {
    const c = [...p.value.clips]
    while (c.length < n) c.push('')
    p.value.clips = c.slice(0, n)
  },
})
const clipTypes = computed(() => (clipCount.value === 2 ? opts.value?.dualClipTypes : opts.value?.clipTypes) ?? [])
function setMode(m: ComfyMode) {
  p.value.mode = m
  // MOSS 只用一個文字編碼器，類型是 moss_image
  if (m === 'moss') {
    p.value.clips = [p.value.clips[0] ?? '']
    if (!p.value.clipType) p.value.clipType = 'moss_image'
    useMossLayout()
  }
}

// ---- LoRA ----
function addLora() {
  p.value.loras.push({ name: '', strength: 1, on: true })
}
function toggleClip(l: ComfyLora) {
  if (l.clip === undefined) l.clip = l.strength
  else delete l.clip
}
const prefixPreview = computed(() => promptPrefix(p.value))

// ---- 尺寸與取樣 ----
const SIZES: [number, number, string][] = [
  [1024, 1024, '1:1'], [832, 1216, '2:3'], [1216, 832, '3:2'], [1024, 1536, '2:3 大'], [1536, 1024, '3:2 大'], [768, 1344, '9:16'], [1344, 768, '16:9'],
]
function profile(id: MossProfile) {
  applyMossProfile(p.value, id)
}

// ---- 匯入 ----
const importOpen = ref(false)
const importText = ref('')
const importResult = ref<{ ok: boolean; lines: string[] } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) importText.value = await f.text()
}
function doImport() {
  try {
    const r = image.importPreset(importText.value)
    const mode = COMFY_MODES.find((m) => m.id === r.added.mode)?.name ?? r.added.mode
    const lines = [`已新增設定「${r.added.name}」：${mode} 模式，${r.added.loras.length} 個 LoRA${r.added.hires.on ? '，含高解析修復' : ''}。`]
    if (r.skipped.length) lines.push(`內建模式不包含這些節點：${r.skipped.join('、')}。需要它們的話，把這組改成「自訂工作流程」（已經放進工作流程欄位，記得把提示詞換成 %prompt%）。`)
    lines.push(...r.notes)
    // 匯入 MOSS 時和新增 MOSS 組合一樣，ComfyUI 的提示詞寫法換成「MOSS 版面」
    if (r.added.mode === 'moss') {
      const before = image.preprocessorFor('comfyui')?.output === 'layout'
      useMossLayout()
      lines.push(before ? 'ComfyUI 的提示詞寫法已經是版面的寫法。' : 'ComfyUI 的提示詞寫法換成了「MOSS 版面」（在「提示詞怎麼寫」可以改）。')
    }
    importResult.value = { ok: true, lines }
    importText.value = ''
    importOpen.value = false
    tab.value = 'model'
  } catch (e) {
    importResult.value = { ok: false, lines: [e instanceof Error ? e.message : String(e)] }
  }
}

// ---- 檢查 ----
const checking = ref(false)
const checkResult = ref<{ ok: boolean; lines: string[] } | null>(null)
async function check() {
  checking.value = true
  checkResult.value = null
  try {
    if (issues.value.length) throw new Error(issues.value.join('、'))
    const wf = buildWorkflow(p.value, { prompt: '1girl', seed: 1 })
    const problems = await checkWorkflow(comfyServer(image.configs.comfyui), wf, p.value.mode !== 'custom')
    checkResult.value = problems.length ? { ok: false, lines: problems } : { ok: true, lines: ['節點與檔案都找到了，可以生成'] }
  } catch (e) {
    checkResult.value = { ok: false, lines: [e instanceof Error ? e.message : String(e)] }
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <fieldset class="comfy">
    <legend>設定組合 <Hint text="每個主模存成一組：切換組合就一次換掉模型、LoRA、取樣參數與提示詞（例如 Illustrious 的 LoRA 不能用在 MOSS 上）。" /></legend>

    <!-- 工具列 -->
    <div class="toolbar">
      <select v-model="image.comfyActive" aria-label="設定組合" class="pick">
        <option v-for="x in image.comfyPresets" :key="x.id" :value="x.id">{{ x.name }}</option>
      </select>
      <input :value="p.name" maxlength="30" aria-label="這組的名稱" title="這組的名稱" class="name" @change="rename" />
      <button class="small" title="新增一組" aria-label="新增一組" @click="adding = !adding"><GameIcon name="plus" :size="14" /><span class="lbl">新增</span></button>
      <button class="small" title="複製這一組" aria-label="複製這一組" @click="image.duplicatePreset()"><GameIcon name="copy" :size="14" /><span class="lbl">複製</span></button>
      <button class="small" title="從工作流程匯入" aria-label="從工作流程匯入" @click="importOpen = !importOpen"><GameIcon name="download" :size="14" /><span class="lbl">匯入</span></button>
      <button class="small" title="刪除這一組" aria-label="刪除這一組" :disabled="image.comfyPresets.length <= 1" @click="remove"><GameIcon name="trash" :size="14" /></button>
    </div>
    <div v-if="adding" class="row small">
      新增哪一種：
      <button v-for="m in COMFY_MODES" :key="m.id" class="small" @click="addPreset(m.id)">{{ m.name }}</button>
    </div>
    <div v-if="importOpen" class="import">
      <p class="small muted">貼上（或選檔案）ComfyUI 選單「Export (API)」匯出的工作流程：讀出主模、文字編碼器、VAE、LoRA、取樣與高解析修復，新增成一組（MOSS 工作流程讀成 MOSS 模式）。先連線讀取清單，LoRA 才對得到正確的檔名。</p>
      <textarea v-model="importText" rows="5" class="mono" spellcheck="false" placeholder="貼上 API 格式的工作流程 JSON" />
      <div class="row">
        <button class="small primary" :disabled="!importText.trim()" @click="doImport">匯入</button>
        <button class="small" @click="fileInput?.click()"><GameIcon name="folder" :size="14" />選檔案</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
      </div>
    </div>
    <ul v-if="importResult" class="small result" :class="importResult.ok ? 'ok' : 'bad'">
      <li v-for="(l, i) in importResult.lines" :key="i">{{ l }}</li>
    </ul>

    <!-- 分頁 -->
    <nav class="tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" :class="{ active: tab === t.id }" @click="tab = t.id">
        {{ t.label }}<span v-if="t.id === 'lora' && p.loras.length" class="count">{{ p.loras.filter((l) => l.on).length }}</span>
      </button>
    </nav>

    <!-- 模型 -->
    <div v-show="tab === 'model'" class="pane">
      <div class="modes">
        <label v-for="m in COMFY_MODES" :key="m.id" class="check"><input type="radio" :checked="p.mode === m.id" :value="m.id" @change="setMode(m.id)" /> {{ m.name }}</label>
      </div>
      <p class="small muted">{{ modeInfo.note }}</p>

      <template v-if="p.mode === 'checkpoint'">
        <label>Checkpoint <input v-model="p.checkpoint" list="comfy-ckpt" placeholder="例如 illustriousXL.safetensors" /></label>
        <label><span>VAE（選填） <Hint text="空白時用 Checkpoint 內建的 VAE。" /></span><input v-model="p.vae" list="comfy-vae" /></label>
      </template>

      <template v-else-if="p.mode === 'unet' || moss">
        <div class="grid2">
          <label>UNet 模型 <input v-model="p.unet" list="comfy-unet" :placeholder="moss ? '例如 moss_image_base_int8_convrot.safetensors' : ''" /></label>
          <label>權重精度 <input v-model="p.weightDtype" list="comfy-dtype" /></label>
        </div>
        <label v-if="!moss">文字編碼器數量
          <select v-model.number="clipCount">
            <option :value="1">1 個（CLIPLoader）</option>
            <option :value="2">2 個（DualCLIPLoader，例如 Flux）</option>
            <option :value="3">3 個（TripleCLIPLoader，例如 SD3）</option>
          </select>
        </label>
        <div class="grid2">
          <label v-for="(_, i) in p.clips" :key="i">文字編碼器{{ p.clips.length > 1 ? ` ${i + 1}` : '' }}
            <input v-model="p.clips[i]" list="comfy-clip" :placeholder="moss ? '例如 qwen3.5_9b_int8_convrot.safetensors' : ''" />
          </label>
          <label v-if="clipCount < 3">文字編碼器的類型 <input v-model="p.clipType" list="comfy-cliptype" :placeholder="moss ? 'moss_image' : '依模型而定，例如 stable_diffusion、flux、qwen_image'" /></label>
        </div>
        <label>VAE <input v-model="p.vae" list="comfy-vae" :placeholder="moss ? '例如 flux2-vae.safetensors' : ''" /></label>
      </template>

      <template v-else>
        <label><span>工作流程 <Hint text="API 格式的 JSON。可以用的代號：%prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %scheduler% %model%；以圖生圖另外有 %image% %mask% %denoise%。" /></span>
          <textarea v-model="p.workflow" rows="8" class="mono" spellcheck="false" />
        </label>
        <div class="grid2">
          <label>成品圖的節點編號（選填） <input v-model="p.outputNode" placeholder="空白時自動挑" /></label>
          <label><span>%model% 的檔名（選填） <Hint text="工作流程用到 %model% 時換成這裡的檔名。" /></span><input v-model="p.checkpoint" list="comfy-ckpt" /></label>
        </div>
        <p class="small muted">%prompt% 會換成「固定前綴（含 LoRA 觸發詞）＋產生的提示詞」。</p>
      </template>
    </div>

    <!-- LoRA -->
    <div v-show="tab === 'lora'" class="pane">
      <p v-if="custom" class="small muted">自訂工作流程的 LoRA 寫在工作流程裡；這裡的觸發詞仍然會接在 %prompt% 的前面。</p>
      <p v-else class="small muted">依序套用；權重可以是負的（例如光影滑桿）。{{ moss ? 'MOSS 的 LoRA 只接模型，文字編碼器不動。' : '' }}觸發詞會接在固定前綴後面。</p>
      <div v-for="(l, i) in p.loras" :key="i" class="lora" :class="{ off: !l.on }">
        <div class="lora-head">
          <input v-model="l.on" type="checkbox" title="使用這個 LoRA" aria-label="使用這個 LoRA" />
          <input v-model="l.name" class="lname" list="comfy-lora" placeholder="LoRA 檔名" />
          <label class="w">權重 <input v-model.number="l.strength" type="number" step="0.05" /></label>
          <label v-if="l.clip !== undefined && !moss" class="w">CLIP <input v-model.number="l.clip" type="number" step="0.05" /></label>
          <button v-if="!moss && !custom" class="small" :title="l.clip === undefined ? '分開設定 CLIP 權重' : 'CLIP 權重跟模型權重相同'" @click="toggleClip(l)">{{ l.clip === undefined ? '分開調 CLIP' : '合併' }}</button>
          <button class="small" title="移除" aria-label="移除" @click="p.loras.splice(i, 1)"><GameIcon name="close" :size="14" /></button>
        </div>
        <input v-model="l.trigger" class="trigger" placeholder="觸發詞（選填），例如 @sky02v1moss" />
      </div>
      <button class="small" @click="addLora"><GameIcon name="plus" :size="14" />加 LoRA</button>
    </div>

    <!-- 尺寸與取樣 -->
    <div v-show="tab === 'sampling'" class="pane">
      <div class="row small sizes">
        尺寸
        <button v-for="[w, h, n] in SIZES" :key="`${w}x${h}`" class="small" :class="{ active: p.width === w && p.height === h }" @click="p.width = w; p.height = h">{{ n }} {{ w }}×{{ h }}</button>
      </div>
      <div class="grid">
        <label>寬 <input v-model.number="p.width" type="number" min="64" step="8" /></label>
        <label>高 <input v-model.number="p.height" type="number" min="64" step="8" /></label>
      </div>
      <p class="small muted">日誌插圖用橫的（長邊當寬）。{{ moss ? 'MOSS 建議 1～2 百萬像素、寬高都是 32 的倍數。' : '' }}</p>
      <div v-if="moss" class="row small">
        套用參數：
        <button v-for="(pr, id) in MOSS_PROFILES" :key="id" class="small" @click="profile(id)">{{ pr.name }}</button>
        <Hint text="一般：30 步、CFG 4、euler / simple、shift 5。8 步蒸餾 LoRA（DMD2 之類，權重 1）：12 步、CFG 1.5、euler / beta、不加 shift。" />
      </div>
      <div class="grid">
        <label>步數 <input v-model.number="p.steps" type="number" min="1" max="200" /></label>
        <label>CFG <input v-model.number="p.cfg" type="number" min="0" max="30" step="0.5" /></label>
        <label>取樣器 <input v-model="p.sampler" list="comfy-sampler" /></label>
        <label>排程器 <input v-model="p.scheduler" list="comfy-scheduler" /></label>
        <label v-if="moss"><span>shift <Hint text="ModelSamplingAuraFlow；0 是不加（用 8 步蒸餾 LoRA 時通常不加）。" /></span><input v-model.number="p.shift" type="number" min="0" max="20" step="0.5" /></label>
      </div>
      <template v-if="moss">
        <label class="check"><input v-model="p.slg.on" type="checkbox" /> Skip Layer Guidance <Hint text="SkipLayerGuidanceDiTSimple：ComfyUI 的 MOSS 範本預設第 22 層、0～0.5。" /></label>
        <div v-if="p.slg.on" class="grid">
          <label>層 <input v-model="p.slg.layers" placeholder="22" /></label>
          <label>開始 <input v-model.number="p.slg.start" type="number" min="0" max="1" step="0.05" /></label>
          <label>結束 <input v-model.number="p.slg.end" type="number" min="0" max="1" step="0.05" /></label>
        </div>
      </template>
      <template v-if="!custom">
        <label class="check"><input v-model="p.hires.on" type="checkbox" /> 高解析修復 <Hint :text="moss ? 'latent 放大後再採樣一次（雙採）：MOSS 常用 2 倍、重繪 0.65；第一遍約 1 百萬像素時人物更大、細節更多。版面的座標照放大後的畫布重算。' : 'latent 放大後再採樣一次。'" /></label>
        <div v-if="p.hires.on" class="grid">
          <label>倍率 <input v-model.number="p.hires.scale" type="number" min="1" max="4" step="0.25" /></label>
          <label>放大方式 <input v-model="p.hires.method" list="comfy-upscale" /></label>
          <label>步數 <input v-model.number="p.hires.steps" type="number" min="1" max="200" /></label>
          <label>CFG <input v-model.number="p.hires.cfg" type="number" min="0" max="30" step="0.5" /></label>
          <label>重繪強度 <input v-model.number="p.hires.denoise" type="number" min="0" max="1" step="0.05" /></label>
        </div>
      </template>
    </div>

    <!-- 提示詞 -->
    <div v-show="tab === 'prompt'" class="pane">
      <label><span>固定前綴 <Hint text="品質詞、畫風、畫師；接在產生的提示詞前面（MOSS 接在整張圖的描述前面）。LoRA 的觸發詞會自動接在後面。" /></span>
        <textarea v-model="p.prefix" rows="2" placeholder="masterpiece, best quality, very aesthetic" />
      </label>
      <p v-if="prefixPreview !== p.prefix.trim()" class="small muted">實際送出：{{ prefixPreview || '（空的）' }}</p>
      <label><span>負面提示詞 <Hint :text="moss ? 'MOSS 版面的預處理會另外寫出這張圖專屬的負面標籤，接在這裡的後面。' : '每張圖都用。'" /></span>
        <textarea v-model="p.negative" rows="3" />
      </label>
    </div>

    <!-- 檢查 -->
    <div class="row small footer">
      <button class="small" :disabled="checking" @click="check"><GameIcon name="check" :size="14" />檢查這一組</button>
      <span v-if="checking" class="muted">檢查中…</span>
      <span v-else-if="issues.length" class="warn-text">還沒設定好：{{ issues.join('、') }}</span>
    </div>
    <ul v-if="checkResult" class="small result" :class="checkResult.ok ? 'ok' : 'bad'">
      <li v-for="(l, i) in checkResult.lines" :key="i">{{ l }}</li>
    </ul>

    <datalist id="comfy-ckpt"><option v-for="x in opts?.checkpoints ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-unet"><option v-for="x in opts?.unets ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-dtype"><option v-for="x in opts?.weightDtypes ?? ['default']" :key="x" :value="x" /></datalist>
    <datalist id="comfy-clip"><option v-for="x in opts?.clips ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-cliptype"><option v-for="x in clipTypes" :key="x" :value="x" /></datalist>
    <datalist id="comfy-vae"><option v-for="x in opts?.vaes ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-lora"><option v-for="x in opts?.loras ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-sampler"><option v-for="x in opts?.samplers ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-scheduler"><option v-for="x in opts?.schedulers ?? []" :key="x" :value="x" /></datalist>
    <datalist id="comfy-upscale"><option v-for="x in opts?.upscaleMethods ?? []" :key="x" :value="x" /></datalist>
  </fieldset>
</template>

<style scoped>
.comfy { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; min-width: 0; }
.comfy legend { padding: 0 4px; color: var(--accent-2); }
.comfy label { display: grid; gap: 4px; }
.comfy label.check { display: flex; gap: 6px; align-items: center; }
.comfy input:not([type='checkbox']):not([type='radio']), .comfy textarea, .comfy select { width: 100%; min-width: 0; }
.toolbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.toolbar .pick { flex: 2 1 10em; width: auto !important; }
.toolbar .name { flex: 1 1 8em; width: auto !important; }
.toolbar button, .row button, .tabs button { display: inline-flex; align-items: center; gap: 4px; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
.tabs button.active, .sizes button.active { border-color: var(--accent); color: var(--accent); }
.tabs .count { font-size: 0.75rem; opacity: 0.8; }
.pane { display: grid; gap: 8px; min-width: 0; }
.modes { display: flex; gap: 4px 12px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.lora { display: grid; gap: 4px; padding: 6px 0; border-bottom: 1px dashed var(--border); }
.lora.off { opacity: 0.5; }
.lora-head { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.lora .lname { flex: 1 1 12em; width: auto !important; }
.lora label.w { display: flex; gap: 4px; align-items: center; }
.lora label.w input { width: 70px !important; }
.import { display: grid; gap: 6px; }
.import p { margin: 0; }
.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
.result { margin: 0; padding-left: 18px; }
.result.ok { color: var(--accent); }
.result.bad, .warn-text { color: var(--danger); }
.footer { border-top: 1px solid var(--border); padding-top: 8px; }
.small { font-size: 0.85rem; }
p { margin: 0; }
@media (max-width: 560px) {
  .toolbar .lbl { display: none; }
}
</style>
