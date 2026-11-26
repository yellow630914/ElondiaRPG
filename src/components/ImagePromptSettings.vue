<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, IMAGE_SERVICES, imageServiceInfo, type ImageServiceId } from '@/narrator/imageInfo'
import { useImageSettings } from '@/stores/image'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 生圖提示詞怎麼寫（docs/PORTRAITS.md 第 3 節）：用到的服務各自選預處理指示；
// 看、改指示；有服務不預處理時才顯示畫風與提示詞模板（預處理的結果直接送出，不套模板）
const image = useImageSettings()
const used = computed(() => image.usedServices())
const name = (id: ImageServiceId) => imageServiceInfo(id).name

/** 正在看的指示：預設是第一個用到的服務選的 */
const viewing = ref('')
const all = computed(() => image.allPreprocessors())
watch(used, () => {
  if (!all.value.some((p) => p.id === viewing.value)) viewing.value = used.value.map((s) => image.preprocess[s]).find(Boolean) ?? ''
}, { immediate: true })
const pre = computed(() => all.value.find((p) => p.id === viewing.value))
const custom = computed(() => image.preprocessors.find((p) => p.id === viewing.value))
const anyPlain = computed(() => used.value.some((s) => !image.preprocessorFor(s)))

/** MOSS 模式配上不是版面的寫法（或反過來）時提醒 */
function mismatch(id: ImageServiceId): string {
  const layout = image.preprocessorFor(id)?.output === 'layout'
  const moss = id === 'comfyui' && image.preset().mode === 'moss'
  if (moss && !layout) return '設定組合是 MOSS-Image：建議用「MOSS 版面」，人和手、道具的位置才排得準'
  if (layout && !moss) return '「MOSS 版面」寫出來的是版面 JSON，只適合 ComfyUI 的 MOSS-Image 設定組合'
  return ''
}

function copy() {
  if (!pre.value) return
  viewing.value = image.addPreprocessor(pre.value).id
}
function add() {
  viewing.value = image.addPreprocessor().id
}
function removePreprocessor() {
  const p = custom.value
  if (!p) return
  const users = IMAGE_SERVICES.filter((s) => image.preprocess[s.id] === p.id).map((s) => s.name)
  if (confirm(`刪除預處理指示「${p.name}」？${users.length ? `（${users.join('、')} 會改成不預處理）` : ''}`)) {
    image.removePreprocessor(p.id)
    viewing.value = ''
  }
}
const OUTPUT_NAME = { tags: '整理成標籤', text: '原樣送出', layout: 'MOSS 版面（程式換算座標）' } as const
</script>

<template>
  <div class="prompt-settings">
    <p class="small muted">
      生圖前先把描述交給大語言模型，照選的指示改寫成生圖服務看得懂的寫法（Danbooru 標籤、英文描述、MOSS 版面……），結果直接送出。
      NovelAI 與動漫風格的 Stable Diffusion 模型通常只看得懂 Danbooru 標籤。
    </p>
    <div v-for="s in used" :key="s" class="svc">
      <label>{{ name(s) }} 用的寫法
        <select v-model="image.preprocess[s]" @change="viewing = image.preprocess[s] || viewing">
          <option value="">不預處理（套用下面的提示詞模板）</option>
          <optgroup label="內建">
            <option v-for="p in all.filter((x) => x.builtin)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </optgroup>
          <optgroup v-if="image.preprocessors.length" label="自訂">
            <option v-for="p in image.preprocessors" :key="p.id" :value="p.id">{{ p.name }}</option>
          </optgroup>
        </select>
      </label>
      <p v-if="mismatch(s)" class="small warn-text">{{ mismatch(s) }}</p>
    </div>

    <fieldset>
      <legend>預處理指示</legend>
      <div class="row">
        <select v-model="viewing" aria-label="要看的指示" class="grow">
          <option value="" disabled>選一份指示</option>
          <option v-for="p in all" :key="p.id" :value="p.id">{{ p.name }}{{ p.builtin ? '（內建）' : '' }}</option>
        </select>
        <button v-if="pre" class="small" title="複製成自訂的再改" @click="copy"><GameIcon name="copy" :size="14" />複製</button>
        <button class="small" title="新增一份空白的指示" @click="add"><GameIcon name="plus" :size="14" />新增</button>
        <button v-if="custom" class="small" title="刪除這份指示" aria-label="刪除這份指示" @click="removePreprocessor"><GameIcon name="trash" :size="14" /></button>
      </div>
      <template v-if="custom">
        <label>名稱 <input v-model="custom.name" maxlength="30" /></label>
        <label>回覆的整理方式
          <select v-model="custom.output">
            <option value="tags">整理成標籤（拿掉說明、換行改逗號、去掉重複）</option>
            <option value="text">原樣送出（只拿掉程式碼框）</option>
            <option value="layout">MOSS 版面（讀成每個框佔畫面的百分比，送出前換算座標）</option>
          </select>
        </label>
        <label><span>指示 <Hint text="當作 system 交給大語言模型。" /></span>
          <textarea v-model="custom.instructions" rows="10" class="mono" spellcheck="false" />
        </label>
      </template>
      <template v-else-if="pre">
        <p class="small muted">內建，不能修改（「複製」成自訂的再改）。回覆的整理方式：{{ OUTPUT_NAME[pre.output] }}</p>
        <textarea :value="pre.instructions" rows="10" class="mono" readonly />
      </template>
    </fieldset>

    <fieldset v-if="anyPlain">
      <legend>不預處理時的寫法</legend>
      <p class="small muted">{{ used.filter((s) => !image.preprocessorFor(s)).map(name).join('、') }}不預處理：形象插圖照下面的模板組出提示詞，日誌插圖接上畫風。</p>
      <label><span>畫風 <Hint text="填進提示詞模板的 {style}；日誌插圖接在最後。" /></span><input v-model="image.style" /></label>
      <div class="row"><button class="small" :disabled="image.style === DEFAULT_STYLE" @click="image.style = DEFAULT_STYLE">畫風恢復預設</button></div>
      <details>
        <summary class="small">形象插圖的提示詞模板</summary>
        <p class="small muted">代號：{name} {gender} {race} {role} {level} {appearance} {personality} {background} {gear} {tattoos} {composition} {style}。{composition} 依刺青與裝備的部位自動選 upper body、cowboy shot 或 full body；模板沒有這個代號時，寫死的 upper body 也會跟著換。代號的值是空的那一行會整行拿掉。</p>
        <textarea v-model="image.template" rows="9" class="mono" spellcheck="false" />
        <div class="row"><button class="small" :disabled="image.template === DEFAULT_PORTRAIT_TEMPLATE" @click="image.template = DEFAULT_PORTRAIT_TEMPLATE">恢復預設</button></div>
      </details>
    </fieldset>
    <label v-else><span>日誌插圖的畫風 <Hint text="畫風、畫師與畫質詞照原樣接在日誌插圖的描述最後（不經過 AI）。" /></span><input v-model="image.style" /></label>
  </div>
</template>

<style scoped>
.prompt-settings { display: grid; gap: 10px; }
.prompt-settings label { display: grid; gap: 4px; }
.prompt-settings textarea, .prompt-settings input, .prompt-settings select { width: 100%; min-width: 0; }
.prompt-settings p { margin: 0; }
.svc { display: grid; gap: 4px; }
fieldset { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; min-width: 0; }
legend { padding: 0 4px; color: var(--accent-2); }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row button { display: inline-flex; align-items: center; gap: 4px; }
.grow { flex: 1; min-width: 160px; width: auto !important; }
.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
.warn-text { color: var(--danger); }
.small { font-size: 0.85rem; }
details > summary { cursor: pointer; }
</style>
