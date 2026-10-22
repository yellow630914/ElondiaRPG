<script setup lang="ts">
import { computed } from 'vue'
import { locationById } from '@/engine/data'
import { formatTime } from '@/engine/state'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { usePrompts } from '@/stores/prompts'

// 首頁：繼續（有進行中的遊戲時）、開新遊戲、讀取存檔、世界管理、提示詞管理
const emit = defineEmits<{ new: []; load: []; worlds: []; prompts: []; settings: [] }>()
const game = useGame()
const content = useContent()
const prompts = usePrompts()
const cur = computed(() => game.resumeMeta)
const place = (id: string) => {
  try {
    return locationById(id).name
  } catch {
    return id
  }
}
</script>

<template>
  <section class="home">
    <header class="title">
      <h1>⚔️ 埃隆迪亞大陸</h1>
      <p class="muted">文字冒險 RPG：擲骰與規則決定結果，AI 寫出經過。</p>
    </header>

    <div class="menu">
      <button v-if="cur" class="primary big continue" @click="game.continueGame()">
        <span>▶ 繼續</span>
        <span class="small detail">{{ cur.pcName }} Lv.{{ cur.level }}・{{ place(cur.location) }}・{{ formatTime(cur.time) }}<template v-if="cur.world">・🌍 {{ cur.world }}</template></span>
      </button>
      <button class="big" @click="emit('new')">🆕 開新遊戲</button>
      <button class="big" @click="emit('load')">📂 讀取存檔</button>
      <button class="big" @click="emit('worlds')">
        <span>🌍 世界管理</span>
        <span class="small detail">目前：{{ content.activeName }}（共 {{ content.worlds.length + 1 }} 個）</span>
      </button>
      <button class="big" @click="emit('prompts')">
        <span>🧩 提示詞管理</span>
        <span class="small detail">目前：{{ prompts.activeName }}（共 {{ prompts.sets.length }} 組）</span>
      </button>
      <button class="big" @click="emit('settings')">⚙️ 設定</button>
    </div>

    <p v-if="cur" class="small muted">進行中的遊戲會一直自動保存。開新遊戲或讀取存檔會蓋掉它（蓋掉前會先備份到自動存檔欄位）。</p>
  </section>
</template>

<style scoped>
.home { max-width: 520px; margin: 40px auto; display: grid; gap: 16px; text-align: center; }
.title h1 { margin: 0; font-size: 2rem; }
.title p { margin: 4px 0 0; }
.menu { display: grid; gap: 10px; }
.big { display: grid; gap: 2px; padding: 12px 16px; font-size: 1.05rem; }
.detail { opacity: 0.8; font-size: 0.8rem; }
</style>
