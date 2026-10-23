<script setup lang="ts">
import { computed, ref } from 'vue'
import { locationById } from '@/engine/data'
import { formatTime } from '@/engine/state'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { usePrompts } from '@/stores/prompts'
import GameIcon from './ui/GameIcon.vue'
import CreditsDialog from './home/CreditsDialog.vue'

// 首頁：繼續（有進行中的遊戲時）、開新遊戲、讀取存檔、世界管理、提示詞管理
const emit = defineEmits<{ new: []; load: []; worlds: []; prompts: []; settings: [] }>()
const game = useGame()
const content = useContent()
const prompts = usePrompts()
const cur = computed(() => game.resumeMeta)
const showCredits = ref(false)
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
      <GameIcon name="sword" :size="64" class="crest" />
      <h1>埃隆迪亞大陸</h1>
      <p>擲骰與規則決定結果，AI 寫出經過。</p>
    </header>

    <div class="menu panel">
      <button v-if="cur" class="primary big" @click="game.continueGame()">
        <GameIcon name="right" :size="22" />
        <span>繼續冒險<span class="detail">{{ cur.pcName }} Lv.{{ cur.level }}・{{ place(cur.location) }}・{{ formatTime(cur.time) }}<template v-if="cur.world">・{{ cur.world }}</template></span></span>
      </button>
      <button class="big" @click="emit('new')"><GameIcon name="plus" :size="22" /><span>開新遊戲</span></button>
      <button class="big" @click="emit('load')"><GameIcon name="saves" :size="22" /><span>讀取存檔</span></button>
      <button class="big" @click="emit('worlds')">
        <GameIcon name="world" :size="22" />
        <span>世界管理<span class="detail">目前：{{ content.activeName }}（共 {{ content.worlds.length + 1 }} 個）</span></span>
      </button>
      <button class="big" @click="emit('prompts')">
        <GameIcon name="script" :size="22" />
        <span>提示詞管理<span class="detail">目前：{{ prompts.activeName }}（共 {{ prompts.sets.length }} 組）</span></span>
      </button>
      <button class="big" @click="emit('settings')"><GameIcon name="settings" :size="22" /><span>設定</span></button>
    </div>

    <p v-if="cur" class="small muted">進行中的遊戲會一直自動保存。開新遊戲或讀取存檔會蓋掉它（蓋掉前會先備份到自動存檔欄位）。</p>
    <button class="link credits" @click="showCredits = true"><GameIcon name="info" :size="14" /> 素材授權與致謝</button>
    <CreditsDialog :open="showCredits" @close="showCredits = false" />
  </section>
</template>

<style scoped>
.home { max-width: 540px; margin: 48px auto; display: grid; gap: 16px; text-align: center; }
.crest { color: var(--accent); filter: drop-shadow(0 0 14px #c99a4588); }
.title h1 {
  margin: 8px 0 4px; font-size: 2.5rem; font-weight: 900; letter-spacing: 0.3em; padding-left: 0.3em;
  background: linear-gradient(180deg, #fff1c6, #e2b45a 55%, #a87528); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 #000) drop-shadow(0 0 18px #c99a4555);
}
.title p { margin: 0; color: var(--muted); font-family: var(--font-story); }
.menu { display: grid; gap: 8px; padding: 20px 24px; text-align: left; }
.big { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: center; padding: 11px 14px; font-size: 1.05rem; text-align: left; }
.big > span { display: grid; }
.detail { font-size: var(--fs-xs); opacity: 0.8; }
.credits { justify-self: center; display: inline-flex; gap: 4px; align-items: center; }
</style>
