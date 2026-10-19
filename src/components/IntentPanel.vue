<script setup lang="ts">
import { useGame } from '@/stores/game'

const game = useGame()
</script>

<template>
  <section class="panel">
    <label class="intent small">
      <span>📝 行動備註（選填，下一次委託或旅行時交給 AI 作為玩家意圖）</span>
      <input v-model="game.intent" placeholder="例如：優先保護隊友、想打聽關於魔族的消息" />
    </label>
  </section>
</template>

<style scoped>
.intent { display: grid; gap: 4px; }
</style>
