<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CACHE_MARKS, guessCacheMark, guessReasoningFormat, parseExtraBody, providerInfo, PROVIDERS, REASONING_FORMATS, REASONING_LEVELS, type ProviderId, type ReasoningLevel,
} from '@/narrator/providerInfo'
import { AI_FEATURES, useSettings } from '@/stores/settings'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 一個模型來源的設定：服務、key、模型、最大輸出 tokens
const props = defineProps<{ index: number }>()
const settings = useSettings()
const source = computed(() => settings.sources[props.index]!)
const info = computed(() => providerInfo(source.value.provider))
const cfg = computed(() => source.value.configs[source.value.provider])
const used = computed(() => AI_FEATURES.filter((f) => settings.routes[f.id] === props.index).map((f) => f.name))

// 載入的模型清單依服務分開保存，切換服務再切回來不必重新載入
const loaded = ref<Partial<Record<ProviderId, string[]>>>({})
const models = computed(() => loaded.value[source.value.provider] ?? [])
const hints = computed(() => info.value.modelHints.filter((m) => !models.value.includes(m)))
const known = computed(() => [...hints.value, ...models.value])
const loading = ref(false)
const message = ref('')
const showKey = ref(false)

async function loadModels() {
  loading.value = true
  message.value = ''
  try {
    const { listModels } = await import('@/narrator/providers')
    const provider = source.value.provider
    loaded.value[provider] = await listModels(provider, cfg.value)
    message.value = `連線成功，共 ${loaded.value[provider]!.length} 個模型，可以從下拉選單選擇。`
  } catch (e) {
    message.value = `連線失敗：${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

function pickModel(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v) cfg.value.model = v
}

function onMaxTokens(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  cfg.value.maxTokens = v > 0 ? v : undefined
}

// ---- 思考（推理） ----
const reasoning = computed({
  get: () => cfg.value.reasoning ?? '',
  set: (v: string) => {
    if (v) cfg.value.reasoning = v as ReasoningLevel
    else delete cfg.value.reasoning
  },
})
const showThinking = computed({
  get: () => cfg.value.showThinking !== false,
  set: (v: boolean) => {
    if (v) delete cfg.value.showThinking
    else cfg.value.showThinking = false
  },
})
const guessed = computed(() => REASONING_FORMATS.find((f) => f.id === guessReasoningFormat(cfg.value.baseURL))?.name ?? '')
// 快取標記：自動時依模型判斷
const cacheGuess = computed(() => (guessCacheMark(cfg.value) ? '標記（這個模型要手動標記才會快取）' : '不標記（這個模型會自動快取，或不支援）'))
const extraError = computed(() => {
  try {
    parseExtraBody(cfg.value.extraBody)
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
})
const REASONING_NOTE: Record<ProviderId, string> = {
  anthropic: 'Claude 5 系列與 4.6 之後的模型用自適應思考（強度是 effort）；舊模型用思考預算。Opus 5.5 不能關閉思考。',
  openai: 'reasoning_effort（推理模型才有效；關閉對應 minimal）。OpenAI 不回傳思考內容。',
  gemini: 'thinkingBudget（Gemini 3 用 thinkingLevel）；部分 Pro 模型不能關閉思考。',
  openai_compatible: '各家的參數不同，依下方的「參數格式」送出；服務要求的其他參數可以寫在「自訂請求參數」。',
}

function copyFrom(e: Event) {
  const from = Number((e.target as HTMLSelectElement).value)
  ;(e.target as HTMLSelectElement).value = ''
  if (Number.isInteger(from) && confirm(`用「${settings.sources[from]!.name}」的設定（服務、key、模型）覆蓋「${source.value.name}」？`)) {
    settings.copySource(from, props.index)
  }
}
</script>

<template>
  <div class="form">
    <div class="row">
      <label class="grow">
        名稱
        <input v-model="source.name" maxlength="20" />
      </label>
      <label>
        複製其他來源
        <select @change="copyFrom">
          <option value="">選擇…</option>
          <template v-for="(s, i) in settings.sources" :key="i">
            <option v-if="i !== index" :value="i">{{ s.name }}</option>
          </template>
        </select>
      </label>
    </div>

    <label>
      服務
      <select v-model="source.provider" @change="message = ''">
        <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>

    <label v-if="info.needsBaseURL">
      Base URL
      <input v-model="cfg.baseURL" placeholder="https://.../v1" />
      <span class="row">
        <button v-for="p in info.presets" :key="p.name" class="small" @click="cfg.baseURL = p.baseURL">{{ p.name }}</button>
      </span>
    </label>

    <label>
      API key{{ info.keyOptional ? '（選填）' : '' }}
      <span class="row">
        <input v-model="cfg.apiKey" :type="showKey ? 'text' : 'password'" :placeholder="info.keyHint" autocomplete="off" style="flex: 1" />
        <button class="small" @click="showKey = !showKey">{{ showKey ? '隱藏' : '顯示' }}</button>
      </span>
    </label>

    <div class="field">
      <span>模型</span>
      <span class="row">
        <select :value="known.includes(cfg.model) ? cfg.model : ''" style="flex: 1; min-width: 0" @change="pickModel">
          <option value="" disabled>{{ cfg.model ? `自訂：${cfg.model}` : '選擇模型' }}</option>
          <optgroup v-if="hints.length" label="常用">
            <option v-for="m in hints" :key="m" :value="m">{{ m }}</option>
          </optgroup>
          <optgroup v-if="models.length" :label="`服務提供的模型（${models.length}）`">
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
          </optgroup>
        </select>
        <button class="small" :disabled="loading || (!cfg.apiKey && !info.keyOptional)" @click="loadModels">
          {{ loading ? '載入中…' : '載入模型清單' }}
        </button>
      </span>
      <input v-model.trim="cfg.model" placeholder="或直接輸入模型名稱" aria-label="模型名稱" />
    </div>
    <p v-if="message" class="small">{{ message }}</p>

    <label>
      <span class="lab">最大輸出 tokens（選填） <Hint text="留空用服務的預設值。" /></span>
      <input type="number" min="0" :value="cfg.maxTokens ?? ''" style="width: 140px" @input="onMaxTokens" />
    </label>

    <fieldset class="reasoning">
      <legend>思考（reasoning）</legend>
      <label>
        思考強度
        <select v-model="reasoning">
          <option v-for="r in REASONING_LEVELS" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <p class="small muted">{{ REASONING_NOTE[source.provider] }}</p>
      <label v-if="source.provider === 'openai_compatible'">
        參數格式
        <select v-model="cfg.reasoningFormat">
          <option v-for="f in REASONING_FORMATS" :key="f.id" :value="f.id === 'auto' ? undefined : f.id">{{ f.name }}</option>
        </select>
        <span v-if="!cfg.reasoningFormat || cfg.reasoningFormat === 'auto'" class="small muted">目前判斷為：{{ guessed }}</span>
      </label>
      <label class="check"><input v-model="showThinking" type="checkbox" /> 在日誌顯示思考過程 <Hint text="摺疊顯示；服務有回傳思考過程時才有。" /></label>
      <label v-if="source.provider === 'openai_compatible'">
        <span class="lab">自訂請求參數（JSON，選填） <Hint text='會直接加進請求，例如 {"thinking": {"type": "enabled"}}。' /></span>
        <textarea v-model="cfg.extraBody" rows="2" spellcheck="false" placeholder='{"reasoning": {"enabled": true}}' />
        <span v-if="extraError" class="small" style="color: var(--danger)">{{ extraError }}</span>
      </label>
      <label v-if="source.provider === 'openai_compatible'">
        <span class="lab">提示詞快取標記
          <Hint :width="320" text="有些服務要在請求裡標出快取斷點（cache_control）才會快取，例如 OpenRouter 上的 Gemini 與 Claude、阿里雲百煉的通義千問；DeepSeek、OpenAI 會自動快取。標在不太變動的 system 部分；Gemini 要 system 超過約 4096 tokens 才會寫入快取，判定請求的 system 較短，通常只有敘事請求用得到。命中時日誌的用量會顯示「快取」。" />
        </span>
        <select v-model="cfg.cacheMark">
          <option v-for="c in CACHE_MARKS" :key="c.id" :value="c.id === 'auto' ? undefined : c.id">{{ c.name }}</option>
        </select>
        <span v-if="!cfg.cacheMark || cfg.cacheMark === 'auto'" class="small muted">目前判斷為：{{ cacheGuess }}</span>
      </label>
    </fieldset>

    <p class="small status" :style="{ color: settings.sourceReady(index) ? 'var(--good)' : 'var(--muted)' }">
      <GameIcon v-if="settings.sourceReady(index)" name="check" :size="14" />{{ settings.sourceReady(index) ? '設定完成' : '尚未完成設定' }}・{{ used.length ? `用於：${used.join('、')}` : '目前沒有功能使用這個來源' }}
    </p>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 12px; max-width: 560px; }
.form label, .form .field { display: grid; gap: 4px; }
.grow { flex: 1; }
.reasoning { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; }
.reasoning legend { color: var(--accent); padding: 0 4px; }
.reasoning textarea { width: 100%; font-family: monospace; }
.lab, .status { display: flex; align-items: center; gap: 4px; }
label.check { display: inline-flex !important; gap: 6px; align-items: center; }
</style>
