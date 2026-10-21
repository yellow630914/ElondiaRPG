<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildWorkflow, checkWorkflow, COMFY_MODES, comfyServer, presetIssues, type ComfyLora } from '@/narrator/comfy'
import { useImageSettings } from '@/stores/image'

// ComfyUI 的設定組合：每個主模一組（Checkpoint、UNet 或自訂工作流程），
// 清單從 ComfyUI 讀（/object_info），也可以從自己的工作流程匯入
const image = useImageSettings()
const p = computed(() => image.preset())
const opts = computed(() => image.comfyOptions)
const issues = computed(() => presetIssues(p.value))
const modeInfo = computed(() => COMFY_MODES.find((m) => m.id === p.value.mode)!)

onMounted(() => {
  if (!image.comfyOptions && !image.comfyLoading) void image.loadComfyOptions()
})

const listSummary = computed(() => {
  const o = opts.value
  if (!o) return ''
  return `Checkpoint ${o.checkpoints.length}、UNet ${o.unets.length}、文字編碼器 ${o.clips.length}、VAE ${o.vaes.length}、LoRA ${o.loras.length}`
})

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

function addLora() {
  p.value.loras.push({ name: '', strength: 1, on: true })
}
function toggleClip(l: ComfyLora) {
  if (l.clip === undefined) l.clip = l.strength
  else delete l.clip
}

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

// ---- 從工作流程匯入 ----
const importText = ref('')
const importOpen = ref(false)
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
    const lines = [`已新增設定「${r.added.name}」：${r.added.mode === 'unet' ? 'UNet' : 'Checkpoint'} 模式，${r.added.loras.length} 個 LoRA${r.added.hires.on ? '，含高解析修復' : ''}。`]
    if (r.skipped.length) lines.push(`內建模式不包含這些節點：${r.skipped.join('、')}。需要它們的話，把這組改成「自訂工作流程」（已經放進工作流程欄位，記得把提示詞換成 %prompt%）。`)
    lines.push(...r.notes)
    importResult.value = { ok: true, lines }
    importText.value = ''
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
  <div class="comfy">
    <div class="row">
      <label class="grow">設定組合
        <select v-model="image.comfyActive">
          <option v-for="x in image.comfyPresets" :key="x.id" :value="x.id">{{ x.name }}</option>
        </select>
      </label>
      <button class="small" title="新增一組" @click="image.addPreset()">＋ 新增</button>
      <button class="small" title="複製這一組" @click="image.duplicatePreset()">⧉ 複製</button>
      <button class="small" :disabled="image.comfyPresets.length <= 1" @click="remove">🗑️</button>
    </div>
    <label>名稱 <input :value="p.name" maxlength="30" @change="rename" /></label>

    <div class="row small">
      <button class="small" :disabled="image.comfyLoading" @click="image.loadComfyOptions()">🔄 讀取 ComfyUI 清單</button>
      <span v-if="image.comfyLoading" class="muted">讀取中…</span>
      <span v-else-if="image.comfyError" class="warn-text">{{ image.comfyError }}</span>
      <span v-else-if="listSummary" class="muted">{{ listSummary }}</span>
    </div>

    <details class="import" :open="importOpen" @toggle="importOpen = ($event.target as HTMLDetailsElement).open">
      <summary class="small">📥 從工作流程匯入（ComfyUI 選單的「Export (API)」）</summary>
      <p class="small muted">讀出主模、文字編碼器、VAE、LoRA、取樣與高解析修復的設定，新增成一組。先讀取 ComfyUI 清單，LoRA 才對得到正確的檔名。</p>
      <textarea v-model="importText" rows="5" class="mono" spellcheck="false" placeholder="貼上 API 格式的工作流程 JSON" />
      <div class="row">
        <button class="small primary" :disabled="!importText.trim()" @click="doImport">匯入</button>
        <button class="small" @click="fileInput?.click()">📁 選檔案</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
      </div>
    </details>
    <ul v-if="importResult" class="small result" :class="importResult.ok ? 'ok' : 'bad'">
      <li v-for="(l, i) in importResult.lines" :key="i">{{ l }}</li>
    </ul>

    <fieldset>
      <legend>模式</legend>
      <div class="row">
        <label v-for="m in COMFY_MODES" :key="m.id" class="check"><input v-model="p.mode" type="radio" :value="m.id" /> {{ m.name }}</label>
      </div>
      <p class="small muted">{{ modeInfo.note }}</p>

      <template v-if="p.mode === 'checkpoint'">
        <label>Checkpoint <input v-model="p.checkpoint" list="comfy-ckpt" placeholder="例如 illustriousXL.safetensors" /></label>
        <label>VAE（選填，空白時用 Checkpoint 內建的） <input v-model="p.vae" list="comfy-vae" /></label>
      </template>

      <template v-else-if="p.mode === 'unet'">
        <div class="grid2">
          <label>UNet 模型 <input v-model="p.unet" list="comfy-unet" /></label>
          <label>權重精度 <input v-model="p.weightDtype" list="comfy-dtype" /></label>
        </div>
        <label>文字編碼器數量
          <select v-model.number="clipCount">
            <option :value="1">1 個（CLIPLoader）</option>
            <option :value="2">2 個（DualCLIPLoader，例如 Flux）</option>
            <option :value="3">3 個（TripleCLIPLoader，例如 SD3）</option>
          </select>
        </label>
        <label v-for="(_, i) in p.clips" :key="i">文字編碼器{{ p.clips.length > 1 ? ` ${i + 1}` : '' }}
          <input v-model="p.clips[i]" list="comfy-clip" />
        </label>
        <label v-if="clipCount < 3">文字編碼器的類型 <input v-model="p.clipType" list="comfy-cliptype" placeholder="依模型而定，例如 stable_diffusion、flux、qwen_image" /></label>
        <label>VAE <input v-model="p.vae" list="comfy-vae" /></label>
      </template>

      <template v-else>
        <label>工作流程（API 格式 JSON；代號：%prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %scheduler% %model%）
          <textarea v-model="p.workflow" rows="8" class="mono" spellcheck="false" />
        </label>
        <label>成品圖的節點編號（選填）
          <input v-model="p.outputNode" placeholder="空白時自動挑：存圖的節點優先，否則最後一個預覽" />
        </label>
        <p class="small muted">%prompt% 會換成「固定前綴標籤＋角色的提示詞」；%model% 是下面 Checkpoint／UNet 欄位填的檔名（工作流程沒用到可以不填）。</p>
      </template>
    </fieldset>

    <fieldset v-if="p.mode !== 'custom'">
      <legend>LoRA（依序套用）</legend>
      <div v-for="(l, i) in p.loras" :key="i" class="lora" :class="{ off: !l.on }">
        <input v-model="l.on" type="checkbox" title="使用這個 LoRA" />
        <input v-model="l.name" class="name" list="comfy-lora" placeholder="LoRA 檔名" />
        <label class="w">權重 <input v-model.number="l.strength" type="number" step="0.05" /></label>
        <label v-if="l.clip !== undefined" class="w">CLIP <input v-model.number="l.clip" type="number" step="0.05" /></label>
        <button class="small" :title="l.clip === undefined ? '分開設定 CLIP 權重' : 'CLIP 權重跟模型權重相同'" @click="toggleClip(l)">{{ l.clip === undefined ? '分開調 CLIP' : '合併' }}</button>
        <button class="small" title="移除" @click="p.loras.splice(i, 1)">✕</button>
      </div>
      <button class="small" @click="addLora">＋ 加 LoRA</button>
    </fieldset>

    <fieldset>
      <legend>取樣</legend>
      <div class="grid">
        <label>寬 <input v-model.number="p.width" type="number" min="64" step="8" /></label>
        <label>高 <input v-model.number="p.height" type="number" min="64" step="8" /></label>
        <label>步數 <input v-model.number="p.steps" type="number" min="1" max="200" /></label>
        <label>CFG <input v-model.number="p.cfg" type="number" min="0" max="30" step="0.5" /></label>
        <label>取樣器 <input v-model="p.sampler" list="comfy-sampler" /></label>
        <label>排程器 <input v-model="p.scheduler" list="comfy-scheduler" /></label>
      </div>
      <template v-if="p.mode !== 'custom'">
        <label class="check"><input v-model="p.hires.on" type="checkbox" /> 高解析修復（latent 放大後再採樣一次）</label>
        <div v-if="p.hires.on" class="grid">
          <label>倍率 <input v-model.number="p.hires.scale" type="number" min="1" max="4" step="0.25" /></label>
          <label>放大方式 <input v-model="p.hires.method" list="comfy-upscale" /></label>
          <label>步數 <input v-model.number="p.hires.steps" type="number" min="1" max="200" /></label>
          <label>CFG <input v-model.number="p.hires.cfg" type="number" min="0" max="30" step="0.5" /></label>
          <label>重繪強度 <input v-model.number="p.hires.denoise" type="number" min="0" max="1" step="0.05" /></label>
        </div>
      </template>
    </fieldset>

    <label>固定前綴標籤（品質、畫風、LoRA 觸發詞；接在角色的提示詞前面）
      <textarea v-model="p.prefix" rows="2" placeholder="masterpiece, best quality, very aesthetic" />
    </label>
    <label>負面提示詞 <textarea v-model="p.negative" rows="2" /></label>

    <div class="row small">
      <button class="small" :disabled="checking" @click="check">🧪 檢查設定</button>
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
  </div>
</template>

<style scoped>
.comfy { display: grid; gap: 10px; }
.comfy label { display: grid; gap: 4px; }
.comfy label.check { display: flex; gap: 6px; align-items: center; }
.comfy input:not([type='checkbox']):not([type='radio']), .comfy textarea, .comfy select { width: 100%; }
.grow { flex: 1; min-width: 180px; }
fieldset { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; }
legend { padding: 0 4px; color: var(--accent-2); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.grid2 { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; }
.lora { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.lora.off { opacity: 0.5; }
.lora .name { flex: 1; min-width: 160px; width: auto !important; }
.lora label.w { display: flex; gap: 4px; align-items: center; }
.lora label.w input { width: 70px !important; }
.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
.result { margin: 0; padding-left: 18px; }
.result.ok { color: var(--accent); }
.result.bad, .warn-text { color: var(--danger); }
.import textarea { margin: 4px 0; }
.import p { margin: 4px 0; }
</style>
