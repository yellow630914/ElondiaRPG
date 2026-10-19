<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import { formatTokens } from '@/narrator/describe'
import { OTHER_USAGE } from '@/stores/game'
import ReportCard from './ReportCard.vue'

// 冒險頁中間的日誌：舊的在上、新的在下，有新紀錄時捲到最下面。
const PAGE = 30
const game = useGame()
const settings = useSettings()
const hideTrade = ref(true)
const shown = ref(PAGE)
const feed = ref<HTMLElement | null>(null)
const otherTitle = computed(() => {
  const o = game.usage[OTHER_USAGE]
  return o ? `其中 ${o.calls} 次不屬於任何日誌（酒館候選人、商店清單、談判方式等），共 ${formatTokens(o.input + o.output)} tokens` : ''
})

const all = computed(() => (game.state?.reports ?? []).filter((r: Report) => !(hideTrade.value && r.kind === 'trade')))
const reports = computed(() => all.value.slice(-shown.value))
const latest = computed(() => game.state?.reports.at(-1)?.report_id)
const streamingText = computed(() => (latest.value ? game.narrations[latest.value]?.text.length ?? 0 : 0))

function nearBottom(): boolean {
  const el = feed.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160
}

async function toBottom(force = false) {
  if (!force && !nearBottom()) return
  await nextTick()
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: force ? 'auto' : 'smooth' })
}

watch(latest, () => toBottom(true))
// 串流敘事時，若玩家正在看最新的內容就跟著捲動
watch(streamingText, () => toBottom())
onMounted(() => toBottom(true))
</script>

<template>
  <section class="panel log">
    <header class="row log-head">
      <h2>📖 冒險日誌</h2>
      <span class="spacer" />
      <label class="small"><input v-model="settings.aiNarration" type="checkbox" /> ✨ AI 細節描述</label>
      <label class="small"><input v-model="hideTrade" type="checkbox" /> 隱藏交易紀錄</label>
    </header>
    <p v-if="game.totalUsage.calls" class="small muted usage" :title="otherTitle">
      🔢 本局共用 {{ formatTokens(game.totalUsage.input + game.totalUsage.output) }} tokens
      （輸入 {{ formatTokens(game.totalUsage.input) }}・輸出 {{ formatTokens(game.totalUsage.output) }}・{{ game.totalUsage.calls }} 次呼叫）
    </p>
    <div ref="feed" class="feed">
      <button v-if="all.length > reports.length" class="small more" @click="shown += PAGE">⬆️ 載入更早的紀錄（還有 {{ all.length - reports.length }} 筆）</button>
      <p v-if="reports.length === 0" class="muted empty">還沒有任何紀錄。從地圖上走到酒館、公會或城門，開始你的冒險吧。</p>
      <ReportCard v-for="r in reports" :key="r.report_id" :report="r" />
    </div>
  </section>
</template>

<style scoped>
.log { display: flex; flex-direction: column; padding-bottom: 6px; }
.log-head { gap: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.log-head h2 { margin: 0; }
.usage { margin: 6px 0 0; }
.spacer { flex: 1; }
.feed {
  overflow-y: auto;
  height: calc(100vh - 170px);
  min-height: 420px;
  padding: 10px 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.feed :deep(.panel) { background: var(--panel-2); }
.more { align-self: center; margin-bottom: 10px; }
.empty { text-align: center; margin-top: 40px; }
@media (max-width: 900px) {
  .feed { height: auto; max-height: 80vh; }
}
</style>
