<script setup lang="ts">
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const game = useGame()
</script>

<template>
  <section class="panel intent-panel">
    <div class="head">
      <GameIcon name="edit" :size="14" /><span>行動備註</span>
      <Hint text="選填。下一次委託或旅行時交給 AI，作為玩家的意圖。" />
    </div>
    <input v-model="game.intent" class="small" placeholder="例如：優先保護隊友、想打聽關於魔族的消息" aria-label="行動備註" />
  </section>
</template>

<style scoped>
.intent-panel { display: grid; gap: 6px; padding: 10px 14px; }
.head { display: flex; align-items: center; gap: 6px; font-size: var(--fs-sm); color: var(--muted); }
.head :deep(.game-icon) { color: var(--accent); }
input { width: 100%; }
</style>
