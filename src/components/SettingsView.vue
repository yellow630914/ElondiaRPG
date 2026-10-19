<script setup lang="ts">
import { computed, ref } from 'vue'
import { providerInfo, PROVIDERS } from '@/narrator/providerInfo'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

const settings = useSettings()
const game = useGame()
const info = computed(() => providerInfo(settings.provider))
const cfg = computed(() => settings.configs[settings.provider])
const models = ref<string[]>([])
const loading = ref(false)
const message = ref('')
const showKey = ref(false)

async function loadModels() {
  loading.value = true
  message.value = ''
  try {
    const { listModels } = await import('@/narrator/providers')
    models.value = await listModels(settings.provider, cfg.value)
    message.value = `連線成功，共 ${models.value.length} 個模型。`
  } catch (e) {
    models.value = []
    message.value = `連線失敗：${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

function onMaxTokens(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  cfg.value.maxTokens = v > 0 ? v : undefined
}

function doReset() {
  if (confirm('確定要刪除目前的存檔？此動作無法復原。')) game.reset()
}
</script>

<template>
  <section class="panel">
    <h2>🤖 AI 服務</h2>
    <p class="small muted">
      API key 只會存在這個瀏覽器的 localStorage，請求直接從瀏覽器送往你選擇的服務。請勿在共用電腦上保存 key。
    </p>

    <div class="form">
      <label>
        服務
        <select v-model="settings.provider" @change="models = []; message = ''">
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

      <label>
        模型
        <span class="row">
          <input v-model="cfg.model" list="model-list" placeholder="輸入或載入模型清單" style="flex: 1" />
          <button class="small" :disabled="loading || (!cfg.apiKey && !info.keyOptional)" @click="loadModels">
            {{ loading ? '載入中…' : '載入模型清單' }}
          </button>
        </span>
        <datalist id="model-list">
          <option v-for="m in [...new Set([...info.modelHints, ...models])]" :key="m" :value="m" />
        </datalist>
      </label>
      <p v-if="message" class="small">{{ message }}</p>

      <label>
        最大輸出 tokens（選填，留空用服務預設值）
        <input type="number" min="0" :value="cfg.maxTokens ?? ''" style="width: 140px" @input="onMaxTokens" />
      </label>
    </div>
    <p class="small" :style="{ color: settings.ready() ? 'var(--good)' : 'var(--muted)' }">
      {{ settings.ready() ? '✓ 已可生成敘事' : '尚未完成設定' }}
    </p>
  </section>

  <section class="panel">
    <h2>✨ 敘事與判定</h2>
    <div class="form">
      <label class="check"><input v-model="settings.aiNarration" type="checkbox" /> AI 細節描述</label>
      <p class="small muted">
        開啟：每次行動、事件或戰鬥結束後，自動請 AI 寫出詳細經過（需先設定 AI 服務）。<br />
        關閉：不呼叫 AI，戰鬥直接顯示戰報，其他事件顯示簡述。
      </p>
      <label class="check"><input v-model="settings.aiJudge" type="checkbox" /> AI 判定主動行動</label>
      <p class="small muted">
        開啟：主動行動（談判、雇傭、殺價、邀請、逃離……）先擲骰，再把骰值與完整資料交給 AI，由 AI 決定成敗（可能出乎預料）並直接寫出經過；酒館候選人、商店的交易清單與談判方式也由 AI 設計。<br />
        關閉：依規則判定（預設屬性與參考 DC）。
      </p>
      <label>
        輸出語言
        <select v-model="settings.language">
          <option value="zh-Hant">繁體中文</option>
          <option value="zh-Hans">简体中文</option>
        </select>
      </label>
      <label>
        世界書注入字數上限
        <input v-model.number="settings.loreBudget" type="number" min="2000" step="1000" style="width: 140px" />
      </label>
      <label class="check">
        <input v-model="settings.adult" type="checkbox" /> 注入成人向世界書條目（敘事傾向、情色喜劇法則等）
      </label>
      <p v-if="settings.adult" class="small muted">請確認你使用的 AI 服務的使用政策允許此類內容；不允許時模型可能拒絕生成。</p>
    </div>
  </section>

  <section class="panel">
    <h2>🎮 遊戲規則</h2>
    <div class="form">
      <label>
        升級時能力三選一的重抽次數（每組）
        <input v-model.number="settings.abilityRerolls" type="number" min="0" max="99" style="width: 100px" />
      </label>
      <p class="small muted">0 表示不能重抽。只影響之後的重抽，已經用掉的次數照算。</p>
    </div>
  </section>

  <section v-if="game.state" class="panel">
    <h2>💾 存檔</h2>
    <p class="small muted">目前的進度會自動存在瀏覽器中。存檔欄位、快速存檔、匯出與匯入檔案在右上角的「💾 存讀檔」。</p>
    <div class="row">
      <button class="danger" @click="doReset">放棄目前的進度並回到開始畫面</button>
    </div>
    <p class="small muted">存檔欄位裡的存檔不會被刪除。</p>
  </section>
</template>

<style scoped>
.form { display: grid; gap: 12px; max-width: 560px; }
.form label { display: grid; gap: 4px; }
.form label.check { display: flex; gap: 6px; align-items: center; }
</style>
