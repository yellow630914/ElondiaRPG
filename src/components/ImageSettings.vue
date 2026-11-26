<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { presetIssues } from '@/narrator/comfy'
import { IMAGE_SERVICES, imageServiceInfo, type ImageServiceId } from '@/narrator/imageInfo'
import { SCENE_COUNT_NAME, SCENE_COUNTS, SCENE_MAX_MANUAL } from '@/narrator/sceneInfo'
import { useImageSettings } from '@/stores/image'
import { useSettings } from '@/stores/settings'
import ComfySettings from './ComfySettings.vue'
import ImagePromptSettings from './ImagePromptSettings.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 插圖生成的設定（docs/PORTRAITS.md 第 2 節）：
//   ① 用途與狀態：形象插圖、日誌插圖、成人場景各用哪個服務，現在能不能畫
//   ② 服務設定：每個服務一個分頁（ComfyUI 分成伺服器與設定組合）
//   ③ 提示詞：各服務的預處理、指示，不預處理時的畫風與模板
//   ④ 自動生成
const image = useImageSettings()
const settings = useSettings()

// ---- ① 用途與狀態 ----
const tagSource = computed(() => settings.sourceFor('tags'))
const tagReady = computed(() => settings.sourceReady(tagSource.value.index))

/** 一個服務現在的狀態：ok 可以畫；text 寫給玩家看 */
function status(id: ImageServiceId): { ok: boolean; text: string } {
  const info = imageServiceInfo(id)
  const c = image.configs[id]
  if (!c.baseURL) return { ok: false, text: '還沒填服務網址' }
  if (!c.apiKey && !info.keyOptional) return { ok: false, text: '還沒填 API key' }
  if (id === 'comfyui') {
    const issues = presetIssues(image.preset())
    if (issues.length) return { ok: false, text: '設定組合還沒選好模型' }
    if (image.comfyLoading) return { ok: true, text: '連線中…' }
    if (image.comfyError) return { ok: false, text: '連不到 ComfyUI' }
    if (image.comfyOptions) return { ok: true, text: '已連線' }
    return { ok: true, text: '已填好（還沒連線檢查）' }
  }
  return { ok: true, text: '已填好' }
}
const serviceName = (id: ImageServiceId) => (id === 'comfyui' ? `ComfyUI・${image.preset().name}` : imageServiceInfo(id).name)

const usages = computed(() => [
  { id: 'portrait', label: '形象插圖', service: image.service },
  { id: 'scene', label: '日誌插圖', service: image.sceneService(false) },
  { id: 'adult', label: '成人場景', service: image.sceneService(true) },
])
/** 日誌插圖要先用大語言模型整理分鏡；選了預處理的服務也要 */
const needsTags = computed(() => image.usedServices().some((s) => !!image.preprocessorFor(s)))

// ---- ② 服務設定 ----
const tab = ref<ImageServiceId>(image.service)
const info = computed(() => imageServiceInfo(tab.value))
const cfg = computed(() => image.configs[tab.value])
const sizeKey = computed({
  get: () => `${cfg.value.width}x${cfg.value.height}`,
  set: (v: string) => {
    const [w, h] = v.split('x').map(Number)
    if (w && h) {
      cfg.value.width = w
      cfg.value.height = h
    }
  },
})
function resetService() {
  if (confirm(`把 ${info.value.name} 的參數恢復預設？（API key 會保留）`)) image.resetService(tab.value)
}
const listSummary = computed(() => {
  const o = image.comfyOptions
  return o ? `Checkpoint ${o.checkpoints.length}、UNet ${o.unets.length}、文字編碼器 ${o.clips.length}、VAE ${o.vaes.length}、LoRA ${o.loras.length}` : ''
})
// 用到 ComfyUI 時自動連線一次（讀清單，順便知道連不連得到）
onMounted(() => {
  if (image.usedServices().includes('comfyui') && !image.comfyOptions && !image.comfyLoading) void image.loadComfyOptions()
})
watch(() => image.configs.comfyui.baseURL, () => { image.comfyOptions = null })
</script>

<template>
  <section class="panel image-settings">
    <h2 class="head">
      <GameIcon name="image" />插圖生成
      <Hint text="角色的形象插圖（隊伍與人物卡上的「生成形象圖」）與日誌插圖。API key 只存在這個瀏覽器，請求直接從瀏覽器送往你選擇的服務；圖片存在這個瀏覽器的 IndexedDB，匯出存檔時可以選擇附上。" />
    </h2>

    <!-- ① 用途與狀態 -->
    <div class="usage">
      <div v-for="u in usages" :key="u.id" class="use-row">
        <span class="use-label">{{ u.label }}</span>
        <select v-if="u.id === 'portrait'" v-model="image.service" :aria-label="`${u.label}用的服務`">
          <option v-for="s in IMAGE_SERVICES" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-else-if="u.id === 'scene'" v-model="image.sceneGeneralService" :aria-label="`${u.label}用的服務`">
          <option value="">和形象插圖一樣</option>
          <option v-for="s in IMAGE_SERVICES" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-else v-model="image.sceneAdultService" :aria-label="`${u.label}用的服務`">
          <option value="">和日誌插圖一樣</option>
          <option v-for="s in IMAGE_SERVICES.filter((x) => x.id !== 'openai')" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button class="small status" :class="status(u.service).ok ? 'ok' : 'bad'" :title="`${serviceName(u.service)}：${status(u.service).text}${u.service === 'comfyui' && presetIssues(image.preset()).length ? `（${presetIssues(image.preset()).join('、')}）` : ''}。按一下到設定`" @click="tab = u.service">
          <GameIcon :name="status(u.service).ok ? 'check' : 'alert'" :size="13" />{{ serviceName(u.service) }}：{{ status(u.service).text }}
        </button>
      </div>
      <p v-if="image.sceneService(true) === 'openai'" class="small warn-text">ChatGPT 不畫成人內容：日誌是成人場景時畫不出來，「成人場景」請指定 NovelAI 或 ComfyUI。</p>
      <p class="small" :class="tagReady ? 'muted' : 'warn-text'">
        整理日誌插圖的分鏡{{ needsTags ? '、生圖提示詞的預處理' : '' }}用「模型」頁功能分配的「插圖提示詞預處理」：{{ tagSource.name }}{{ tagReady ? '' : '（還沒設定好）' }}
      </p>
    </div>

    <!-- ② 服務設定 -->
    <details class="block" open>
      <summary><GameIcon name="settings" :size="15" />服務設定</summary>
      <nav class="tabs" role="tablist">
        <button v-for="s in IMAGE_SERVICES" :key="s.id" role="tab" :aria-selected="tab === s.id" :class="{ active: tab === s.id }" @click="tab = s.id">
          <GameIcon :name="status(s.id).ok ? 'check' : 'alert'" :size="12" :class="status(s.id).ok ? 'ok-text' : 'warn-text'" />{{ s.name }}
          <span v-if="image.usedServices().includes(s.id)" class="used" title="有用途用到這個服務">●</span>
        </button>
      </nav>
      <p class="small muted">{{ info.note }}</p>

      <template v-if="tab === 'comfyui'">
        <fieldset>
          <legend>伺服器</legend>
          <div class="grid2">
            <label>服務網址 <input v-model="cfg.baseURL" placeholder="http://127.0.0.1:8188" /></label>
            <label><span>API key（選填） <Hint text="ComfyUI 有設驗證時才要。" /></span><input v-model="cfg.apiKey" type="password" autocomplete="off" /></label>
          </div>
          <div class="row small">
            <button class="small" :disabled="image.comfyLoading" @click="image.loadComfyOptions()"><GameIcon name="refresh" :size="14" />連線並讀取清單</button>
            <span v-if="image.comfyLoading" class="muted">讀取中…</span>
            <span v-else-if="image.comfyError" class="warn-text">{{ image.comfyError }}</span>
            <span v-else-if="listSummary" class="ok-text">已連線・{{ listSummary }}</span>
            <span v-else class="muted">讀到的清單會出現在下面各欄位的選項裡</span>
          </div>
          <details>
            <summary class="small">進階</summary>
            <label><span>額外參數（JSON，選填） <Hint text="合併進送給 /prompt 的請求。" /></span>
              <textarea v-model="cfg.extra" rows="2" class="mono" spellcheck="false" placeholder="{}" />
            </label>
          </details>
        </fieldset>
        <ComfySettings />
      </template>

      <template v-else>
        <div class="grid2">
          <label>服務網址 <input v-model="cfg.baseURL" /></label>
          <label><span>API key<template v-if="info.keyOptional">（選填）</template></span><input v-model="cfg.apiKey" type="password" autocomplete="off" /></label>
        </div>
        <label>模型 <input v-model="cfg.model" :list="tab === 'novelai' ? 'nai-models' : undefined" /></label>
        <datalist id="nai-models">
          <option value="nai-diffusion-4-5-full" />
          <option value="nai-diffusion-4-5-curated" />
          <option value="nai-diffusion-5-full" />
          <option value="nai-diffusion-5-curated" />
        </datalist>
        <div class="grid">
          <label>尺寸
            <select v-model="sizeKey">
              <option v-for="[w, h] in info.sizes" :key="`${w}x${h}`" :value="`${w}x${h}`">{{ w }} × {{ h }}</option>
              <option v-if="!info.sizes.some(([w, h]) => w === cfg.width && h === cfg.height)" :value="`${cfg.width}x${cfg.height}`">{{ cfg.width }} × {{ cfg.height }}（自訂）</option>
            </select>
          </label>
          <template v-if="tab !== 'openai'">
            <label>寬 <input v-model.number="cfg.width" type="number" min="64" step="64" /></label>
            <label>高 <input v-model.number="cfg.height" type="number" min="64" step="64" /></label>
            <label>步數 <input v-model.number="cfg.steps" type="number" min="1" max="150" /></label>
            <label>CFG <input v-model.number="cfg.scale" type="number" min="0" max="30" step="0.5" /></label>
            <label>取樣器 <input v-model="cfg.sampler" /></label>
          </template>
        </div>
        <label v-if="tab === 'novelai'">負面提示詞 <textarea v-model="cfg.negative" rows="2" /></label>
        <details>
          <summary class="small">進階</summary>
          <label><span>額外參數（JSON，選填） <Hint :text="tab === 'novelai' ? '合併進 parameters。' : '合併進請求。'" /></span>
            <textarea v-model="cfg.extra" rows="2" class="mono" spellcheck="false" placeholder='{"quality": "high"}' />
          </label>
          <div class="row"><button class="small" @click="resetService"><GameIcon name="undo" :size="14" />這個服務的參數恢復預設</button></div>
        </details>
      </template>
    </details>

    <!-- ③ 提示詞 -->
    <details class="block" open>
      <summary><GameIcon name="wand" :size="15" />提示詞怎麼寫</summary>
      <ImagePromptSettings />
    </details>

    <!-- ④ 自動生成 -->
    <details class="block" open>
      <summary><GameIcon name="sparkles" :size="15" />自動生成</summary>
      <label class="check">
        <input v-model="image.portraitAuto" type="checkbox" /> 第一次和 NPC 產生關係時自動畫他的形象圖
        <Hint warn :width="320" text="人際關係裡第一次出現這個人時（認識、雇用、入隊、AI 判定認識了新的人，交易的店主、俘虜也算……）畫一張形象圖，每個人只畫這一次；已經有形象圖（內建的或畫過的）就不畫。一次認識好幾個人時一張一張排隊畫。每一張都要花錢（選了預處理時另外花 token）；生圖服務沒設定好時不畫。開啟之前就認識的人不會補畫（在人際關係或角色詳情手動按「生成形象圖」）。" />
      </label>
      <p v-if="image.portraitAuto && !status(image.service).ok" class="small warn-text">{{ imageServiceInfo(image.service).name }} 還沒設定好：不會自動畫。</p>
      <div class="grid2">
        <label>
          <span>日誌插圖 <Hint warn :width="320" text="每一張圖都要花錢：先用「插圖提示詞預處理」的模型整理分鏡（花 token），再送一次生圖（ChatGPT、NovelAI 依張數計費）。正文第一次寫完時畫；續寫之後替續寫的段落再畫一張（插在最後，原本的插圖照舊）。沒有正文的日誌不畫，重寫經過不會重畫，按 ♥ 記下性經歷之後也不會自動畫（變成成人場景時，要畫按日誌底下的插圖按鈕）。生圖服務或預處理的模型來源沒設定好時不會自動畫。" /></span>
          <select v-model="image.sceneAuto">
            <option value="off">不自動畫</option>
            <option value="adult">只畫成人場景</option>
            <option value="all">每一則（有正文的日誌）</option>
          </select>
        </label>
        <label>
          <span>一則畫幾張 <Hint warn :width="340" :text="`日誌底下的插圖按鈕與自動生成：交給 AI 挑出畫面差別最大的幾個時刻，每張插在那一刻所在的段落之後（整理分鏡只花一次 token，生圖是張數的幾倍：ChatGPT、NovelAI 依張數計費）。依長度：約每 400 字一張，最多 4 張。正文短、場面單純時 AI 會少畫幾張。另一個按鈕「手動分段插圖」可以自己選位置（最多 ${SCENE_MAX_MANUAL} 張），不看這個設定。`" /></span>
          <select v-model="image.sceneCount">
            <option v-for="c in SCENE_COUNTS" :key="c" :value="c">{{ SCENE_COUNT_NAME[c] }}</option>
          </select>
        </label>
      </div>
      <p v-if="image.sceneAuto !== 'off' && image.sceneService(true) === 'openai'" class="small warn-text">成人場景不會自動畫：「成人場景」要指定 NovelAI 或 ComfyUI。</p>
    </details>
  </section>
</template>

<style scoped>
.image-settings { display: grid; gap: 12px; max-width: 720px; }
.image-settings label { display: grid; gap: 4px; }
.image-settings label.check { display: flex; gap: 6px; align-items: center; }
.image-settings textarea, .image-settings input:not([type='checkbox']):not([type='radio']), .image-settings select { width: 100%; min-width: 0; }
.head { display: flex; align-items: center; gap: 6px; margin: 0; }
.head :deep(.game-icon) { color: var(--accent); }
.usage { display: grid; gap: 6px; border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; }
.use-row { display: grid; grid-template-columns: 5.5em minmax(0, 12em) minmax(0, 1fr); gap: 8px; align-items: center; }
.use-label { font-weight: 600; }
.status { justify-content: flex-start; text-align: left; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status.ok { color: var(--accent); }
.status.bad { color: var(--danger); }
.usage p { margin: 0; }
.block { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px 10px; display: grid; gap: 8px; }
.block > summary { cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 4px 0; }
.block > summary :deep(.game-icon) { color: var(--accent); }
.block[open] { gap: 10px; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
.tabs button { display: inline-flex; align-items: center; gap: 4px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.tabs .used { color: var(--accent); font-size: 0.6rem; }
fieldset { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; min-width: 0; }
legend { padding: 0 4px; color: var(--accent-2); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row button, .status { display: inline-flex; align-items: center; gap: 4px; }
.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
.warn-text { color: var(--danger); }
.ok-text { color: var(--accent); }
.small { font-size: 0.85rem; }
details > summary.small { cursor: pointer; }
@media (max-width: 560px) {
  .use-row { grid-template-columns: 5em minmax(0, 1fr); }
  .use-row .status { grid-column: 1 / -1; }
}
</style>
