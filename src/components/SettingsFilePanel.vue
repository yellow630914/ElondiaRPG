<script setup lang="ts">
import { computed, ref } from 'vue'
import { download, dateStamp } from './download'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import {
  applySettingsFile, buildSettingsFile, hasKeys, parseSettingsFile, SETTINGS_PARTS,
  type SettingsFile, type SettingsPartId,
} from '@/stores/settingsFile'

// 設定的匯出與匯入（設定頁的「存檔」）：換電腦時帶著走

const withKeys = ref(false)
const pending = ref<SettingsFile | null>(null)
const picked = ref<SettingsPartId[]>([])
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function exportFile() {
  if (withKeys.value && !confirm('檔案裡會有你的 API 金鑰（明文）。不要把這個檔案傳給別人或放到公開的地方。要繼續嗎？')) return
  const file = buildSettingsFile(withKeys.value)
  if (!Object.keys(file.parts).length) {
    error.value = '這台電腦還沒有改過任何設定（都是預設值），沒有東西可以匯出。'
    return
  }
  error.value = ''
  download(`elondia-settings-${dateStamp()}${withKeys.value ? '-keys' : ''}.json`, JSON.stringify(file, null, 2))
}

async function chooseFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  error.value = ''
  try {
    const file = parseSettingsFile(await f.text())
    pending.value = file
    picked.value = SETTINGS_PARTS.filter((p) => file.parts[p.id] !== undefined).map((p) => p.id)
  } catch (err) {
    pending.value = null
    error.value = err instanceof Error ? err.message : String(err)
  }
}

const available = computed(() => SETTINGS_PARTS.filter((p) => pending.value?.parts[p.id] !== undefined))
const fileHasKeys = computed(() => !!pending.value && pending.value.keys && hasKeys(pending.value.parts))
const exportedAt = computed(() => {
  const t = pending.value?.exported ? new Date(pending.value.exported) : null
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleString() : ''
})

function applyFile() {
  if (!pending.value || !picked.value.length) return
  const names = SETTINGS_PARTS.filter((p) => picked.value.includes(p.id)).map((p) => p.name).join('、')
  if (!confirm(`用檔案裡的設定取代這台電腦上的「${names}」？取代後頁面會重新整理（進行中的遊戲已經自動保存）。`)) return
  applySettingsFile(pending.value, picked.value)
  location.reload()
}
</script>

<template>
  <section class="panel">
    <h2 class="head"><GameIcon name="saves" :size="20" />設定的匯出與匯入
      <Hint text="把這台電腦上的設定存成一個檔案，在另一台電腦（例如公司、家裡）匯入後接著用：AI 來源與遊戲設定、生圖設定、提示詞組、角色預設。存檔不在這裡，用右上角的「存讀檔」匯出；世界的自訂內容用「世界管理」匯出。" />
    </h2>
    <div class="row">
      <button @click="exportFile"><GameIcon name="download" :size="15" /> 匯出設定</button>
      <label class="check"><input v-model="withKeys" type="checkbox" /> 包含 API 金鑰
        <Hint text="預設不帶金鑰：匯入到另一台電腦時，金鑰沿用那台電腦原本的（沒有就要重新填）。勾選時金鑰會以明文寫在檔案裡，只在自己的電腦之間搬。" /></label>
    </div>
    <div class="row">
      <button @click="fileInput?.click()"><GameIcon name="upload" :size="15" /> 匯入設定…</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="chooseFile" />
    </div>
    <p v-if="error" class="small danger-text">{{ error }}</p>
    <div v-if="pending" class="import">
      <p class="small">這個檔案{{ pending.app ? `來自 v${pending.app}` : '' }}{{ exportedAt ? `，${exportedAt} 匯出` : '' }}；{{ fileHasKeys ? '有帶 API 金鑰' : '沒有帶 API 金鑰（沿用這台電腦原本的金鑰）' }}。勾選要取代的部分：</p>
      <label v-for="p in available" :key="p.id" class="check">
        <input v-model="picked" type="checkbox" :value="p.id" /> {{ p.name }} <span class="small muted">{{ p.desc }}</span>
      </label>
      <div class="row">
        <button class="primary" :disabled="!picked.length" @click="applyFile">取代並重新整理</button>
        <button @click="pending = null">取消</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 6px; }
.head :deep(.game-icon) { color: var(--accent); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 6px 0; }
.check { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.import { display: grid; gap: 6px; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }
.danger-text { color: var(--danger); }
</style>
