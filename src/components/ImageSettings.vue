<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, DEFAULT_TAG_INSTRUCTIONS, IMAGE_SERVICES, imageServiceInfo } from '@/narrator/imageInfo'
import { useImageSettings } from '@/stores/image'
import { useSettings } from '@/stores/settings'

// 插圖生成的設定：生圖服務、形象插圖的提示詞、Danbooru 標籤轉換
const image = useImageSettings()
const settings = useSettings()
const info = computed(() => imageServiceInfo(image.service))
const cfg = computed(() => image.configs[image.service])
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
const tagSource = computed(() => settings.sourceFor('tags'))
const tagReady = computed(() => settings.sourceReady(tagSource.value.index))

function resetService() {
  if (confirm(`把 ${info.value.name} 的參數恢復預設？（API key 會保留）`)) image.resetService(image.service)
}
</script>

<template>
  <section class="panel">
    <h2>🎨 插圖生成</h2>
    <p class="small muted">
      用來生成角色的形象插圖（隊伍與人物卡上的「🎨 生成形象圖」）。API key 只存在這個瀏覽器，請求直接從瀏覽器送往你選擇的服務。
      圖片存在這個瀏覽器的 IndexedDB；匯出存檔時可以選擇附上。
    </p>
    <div class="form">
      <label>生圖服務
        <select v-model="image.service">
          <option v-for="s in IMAGE_SERVICES" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <p class="small muted">{{ info.note }}</p>
      <label>API key{{ info.keyOptional ? '（選填，有設驗證時才要）' : '' }}
        <input v-model="cfg.apiKey" type="password" autocomplete="off" />
      </label>
      <label>服務網址 <input v-model="cfg.baseURL" /></label>
      <label>{{ image.service === 'comfyui' ? 'Checkpoint 檔名（%model%）' : '模型' }} <input v-model="cfg.model" /></label>
      <div class="grid">
        <label>尺寸
          <select v-model="sizeKey">
            <option v-for="[w, h] in info.sizes" :key="`${w}x${h}`" :value="`${w}x${h}`">{{ w }} × {{ h }}</option>
            <option v-if="!info.sizes.some(([w, h]) => w === cfg.width && h === cfg.height)" :value="`${cfg.width}x${cfg.height}`">{{ cfg.width }} × {{ cfg.height }}（自訂）</option>
          </select>
        </label>
        <template v-if="image.service !== 'openai'">
          <label>寬 <input v-model.number="cfg.width" type="number" min="64" step="64" /></label>
          <label>高 <input v-model.number="cfg.height" type="number" min="64" step="64" /></label>
          <label>步數 <input v-model.number="cfg.steps" type="number" min="1" max="150" /></label>
          <label>CFG <input v-model.number="cfg.scale" type="number" min="0" max="30" step="0.5" /></label>
          <label>取樣器 <input v-model="cfg.sampler" /></label>
        </template>
      </div>
      <label v-if="image.service !== 'openai'">負面提示詞 <textarea v-model="cfg.negative" rows="2" /></label>
      <label v-if="image.service === 'comfyui'">工作流程（API 格式 JSON；代號：%prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %model%）
        <textarea v-model="cfg.workflow" rows="8" class="mono" spellcheck="false" />
      </label>
      <label>額外參數（JSON，選填；{{ image.service === 'novelai' ? '合併進 parameters' : '合併進請求' }}）
        <textarea v-model="cfg.extra" rows="2" class="mono" spellcheck="false" placeholder='{"quality": "high"}' />
      </label>
      <div class="row"><button class="small" @click="resetService">↩️ 這個服務的參數恢復預設</button></div>

      <label class="check"><input v-model="image.danbooru[image.service]" type="checkbox" /> 先轉成 Danbooru 標籤</label>
      <p class="small muted">
        勾選時，先把角色的描述交給大語言模型（「🔀 功能分配」的「插圖標籤轉換」，目前是「{{ tagSource.name }}」）轉成 Danbooru 標籤，
        再把標籤直接送給生圖服務，不再套用提示詞模板與畫風。NovelAI 與動漫風格的 Stable Diffusion 模型通常只看得懂標籤。
        <span v-if="image.danbooru[image.service] && !tagReady" class="warn-text">這個來源還沒設定好。</span>
      </p>

      <label>畫風（模板的 {style}） <input v-model="image.style" /></label>
      <div class="row"><button class="small" :disabled="image.style === DEFAULT_STYLE" @click="image.style = DEFAULT_STYLE">畫風恢復預設</button></div>
      <details>
        <summary class="small">形象插圖的提示詞模板</summary>
        <p class="small muted">代號：{name} {gender} {race} {role} {level} {appearance} {personality} {background} {gear} {style}。代號的值是空的那一行會整行拿掉。</p>
        <textarea v-model="image.template" rows="9" class="mono" spellcheck="false" />
        <div class="row"><button class="small" :disabled="image.template === DEFAULT_PORTRAIT_TEMPLATE" @click="image.template = DEFAULT_PORTRAIT_TEMPLATE">恢復預設</button></div>
      </details>
      <details>
        <summary class="small">Danbooru 標籤轉換的指示（交給大語言模型）</summary>
        <textarea v-model="image.tagInstructions" rows="9" class="mono" spellcheck="false" />
        <p class="small muted">沒有開啟成人向時，會另外加上「不要裸露、性暗示或血腥的標籤」。</p>
        <div class="row"><button class="small" :disabled="image.tagInstructions === DEFAULT_TAG_INSTRUCTIONS" @click="image.tagInstructions = DEFAULT_TAG_INSTRUCTIONS">恢復預設</button></div>
      </details>
      <p class="small" :class="image.ready() ? 'ok-text' : 'warn-text'">{{ image.ready() ? '🟢 可以生成插圖' : '⚪ 還沒設定好（需要網址與 API key）' }}</p>
    </div>
  </section>
</template>

<style scoped>
.form { display: grid; gap: 10px; max-width: 640px; }
.form label { display: grid; gap: 4px; }
.form label.check { display: flex; gap: 6px; align-items: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.form textarea, .form input:not([type='checkbox']) { width: 100%; }
.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
.row { display: flex; gap: 6px; }
.warn-text { color: var(--danger); }
.ok-text { color: var(--accent); }
details textarea { width: 100%; margin-top: 4px; }
</style>
