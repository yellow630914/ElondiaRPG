<script setup lang="ts">
import { useSettings } from '@/stores/settings'

// 主動行動要交給 AI 判定還是依規則判定：直接在行動旁邊切換（同「設定」裡的「AI 判定主動行動」）。
const settings = useSettings()
</script>

<template>
  <span class="judge-toggle small">
    <label v-if="settings.ready('judge')" :title="settings.aiJudge ? '擲骰後交給 AI 判定並寫出經過' : '依規則判定（預設屬性與參考 DC）'">
      <input v-model="settings.aiJudge" type="checkbox" /> 🤖 AI 判定
    </label>
    <span v-else class="muted" title="在右上角的「設定」選擇 AI 服務後，主動行動可以交給 AI 判定">📏 規則判定（未設定 AI）</span>
  </span>
</template>

<style scoped>
.judge-toggle { white-space: nowrap; }
</style>
