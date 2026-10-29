<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import { formatTokens } from '@/narrator/describe'
import { ARCHIVE_USAGE, OTHER_USAGE, usageFeatureName, usageSourceLabel } from '@/stores/game'
import { formatTime } from '@/engine/state'
import ActionPanel from './ActionPanel.vue'
import PendingActionCard from './PendingActionCard.vue'
import ReportCard from './ReportCard.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import JudgeToggle from './JudgeToggle.vue'

// 冒險頁中間的日誌：舊的在上、新的在下，有新紀錄時捲到最下面。
// 最下面是等待判定的行動（判定完換成它的日誌），日誌底部是主動行動的輸入列。
const PAGE = 30
const game = useGame()
const settings = useSettings()
/** 開著 AI 細節描述，但「敘事正文」的模型來源還沒設定：提醒去設定 */
const needsSource = computed(() => settings.aiNarration && !settings.ready('narration'))
const emit = defineEmits<{ settings: [] }>()
const hideTrade = ref(false)
const shown = ref(PAGE)
const feed = ref<HTMLElement | null>(null)
// token 用量分三份：目前的日誌、已封存的日誌、不屬於任何日誌的呼叫（酒館候選人、商店清單、談判方式等）
const usageSplit = computed(() => {
  const sum = (keys: (k: string) => boolean) => Object.entries(game.usage).filter(([k]) => keys(k)).reduce((t, [, e]) => t + e.input + e.output, 0)
  return {
    log: sum((k) => k !== OTHER_USAGE && k !== ARCHIVE_USAGE),
    archive: sum((k) => k === ARCHIVE_USAGE),
    other: sum((k) => k === OTHER_USAGE),
  }
})
// 用量明細預設收起；展開與否記在這個瀏覽器（elondia.folds）
const FOLDS = 'elondia.folds'
function readFolds(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOLDS) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}
const usageOpen = ref(readFolds()['log.usage'] === false)
function onUsageToggle(e: Event) {
  usageOpen.value = (e.target as HTMLDetailsElement).open
  try {
    const folds = readFolds()
    if (usageOpen.value) folds['log.usage'] = false
    else delete folds['log.usage']
    localStorage.setItem(FOLDS, JSON.stringify(folds))
  } catch {
    // 記不住也沒關係
  }
}

// 封存的舊日誌（只留簡述與 AI 寫的經過）：載入完目前的日誌之後才能展開
const archive = computed(() => (game.state?.logArchive ?? []).filter((e) => !(hideTrade.value && e.kind === 'trade')))
const showArchive = ref(false)
const archiveShown = ref(PAGE)
const archived = computed(() => archive.value.slice(-archiveShown.value))

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
// 擲完骰、等待判定的行動出現在最下面
watch(() => !!game.state?.pendingAction || !!game.state?.pendingMark, (on) => { if (on) void toBottom(true) })
// 串流敘事時，若玩家正在看最新的內容就跟著捲動
watch(streamingText, () => toBottom())
onMounted(() => toBottom(true))
</script>

<template>
  <section class="panel log">
    <header class="row log-head">
      <h2><GameIcon name="book" :size="20" />冒險日誌</h2>
      <span class="spacer" />
      <JudgeToggle show="narration" />
      <label class="small"><input v-model="hideTrade" type="checkbox" /> 隱藏交易<span class="long">紀錄</span></label>
    </header>
    <p v-if="needsSource" class="ai-missing small row">
      <GameIcon name="warning" :size="15" />
      <span>已開啟「AI 細節描述」，但還沒設定 AI 的模型來源：日誌只會顯示戰報與簡述。</span>
      <button class="small" @click="emit('settings')">設定模型來源</button>
      <button class="small ghost" title="不用 AI，只看戰報與簡述" @click="settings.aiNarration = false">關閉 AI 細節描述</button>
    </p>
    <!-- token 用量：平常只顯示總數，點開看明細（展開與否記在這個瀏覽器） -->
    <details v-if="game.totalUsage.calls" class="small muted usage" :open="usageOpen" @toggle="onUsageToggle">
      <summary>本局共用 {{ formatTokens(game.totalUsage.input + game.totalUsage.output) }} tokens・{{ game.totalUsage.calls }} 次呼叫</summary>
      <p class="detail">
        輸入 {{ formatTokens(game.totalUsage.input) }}<template v-if="game.totalUsage.cached">，其中快取 {{ formatTokens(game.totalUsage.cached) }}</template>・輸出 {{ formatTokens(game.totalUsage.output) }}
        <br />其中 日誌 {{ formatTokens(usageSplit.log) }}<template v-if="usageSplit.archive">・已封存的日誌 {{ formatTokens(usageSplit.archive) }}</template><template v-if="usageSplit.other">・其他 <Hint text="酒館候選人、商店清單、談判方式等。" /> {{ formatTokens(usageSplit.other) }}</template>
      </p>
      <ul v-if="game.usageBySource.length" class="sources" title="依模型來源（服務與模型）分開的用量">
        <li v-for="(u, i) in game.usageBySource" :key="i">
          {{ usageSourceLabel(u) }}：{{ formatTokens(u.input + u.output) }} tokens
          （輸入 {{ formatTokens(u.input) }}<template v-if="u.cached">，快取 {{ formatTokens(u.cached) }}</template>・輸出 {{ formatTokens(u.output) }}・{{ u.calls }} 次<template v-if="u.features.length">・{{ u.features.map(usageFeatureName).join('、') }}</template>）
        </li>
      </ul>
    </details>
    <div ref="feed" class="feed">
      <button v-if="all.length > reports.length" class="small more" @click="shown += PAGE">載入更早的紀錄（還有 {{ all.length - reports.length }} 筆）</button>
      <template v-else-if="archive.length">
        <button v-if="!showArchive" class="small more" @click="showArchive = true">顯示封存的舊紀錄（{{ archive.length }} 筆，只留簡述與經過）</button>
        <template v-else>
          <button v-if="archive.length > archived.length" class="small more" @click="archiveShown += PAGE">載入更早的封存紀錄（還有 {{ archive.length - archived.length }} 筆）</button>
          <article v-for="e in archived" :key="e.id" class="archived small">
            <div class="muted">{{ formatTime(e.time) }}<template v-if="e.scene">・{{ e.scene }}</template><template v-if="e.tokens">・{{ formatTokens(e.tokens) }} tokens</template></div>
            <div>{{ e.summary }}</div>
            <details v-if="e.story"><summary class="muted">經過</summary><p class="story">{{ e.story }}</p></details>
          </article>
          <button class="small more" @click="showArchive = false">收起封存的紀錄</button>
        </template>
      </template>
      <p v-if="reports.length === 0" class="muted empty">還沒有任何紀錄。從地圖上走到酒館、公會或城門，開始你的冒險吧。</p>
      <ReportCard v-for="r in reports" :key="r.report_id" :report="r" />
      <PendingActionCard />
    </div>
    <ActionPanel />
  </section>
</template>

<style scoped>
.log { display: flex; flex-direction: column; padding-bottom: 6px; }
.usage summary { color: var(--muted); }
.log-head { gap: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.log-head h2 { margin: 0; display: flex; align-items: center; gap: 8px; }
.log-head h2 :deep(.game-icon) { color: var(--accent); }
.ai-missing { gap: 8px; margin: 8px 0 0; padding: 6px 10px; border: 1px solid var(--gold-lo, var(--border)); border-radius: 4px; background: #3a2a1033; color: var(--accent); flex-wrap: wrap; }
.ai-missing span { flex: 1; min-width: 12em; color: var(--text); }
.log-head label { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.usage { margin: 6px 0 0; }
.usage summary { cursor: pointer; }
.usage .detail { margin: 2px 0 0 18px; }
.sources { margin: 2px 0 0; padding-left: 36px; }
.spacer { flex: 1; }
.feed {
  overflow-y: auto;
  height: calc(100vh - 300px);
  min-height: 420px;
  padding: 10px 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.more { align-self: center; margin-bottom: 10px; }
.archived { display: grid; gap: 2px; padding: 6px 8px; margin-bottom: 6px; border-left: 2px solid var(--border); }
.archived .story { white-space: pre-wrap; margin: 4px 0 0; }
.empty { text-align: center; margin-top: 40px; }
/* 手機：標題、AI 開關、隱藏交易排成一排 */
@media (max-width: 720px) {
  .log-head { gap: 8px; flex-wrap: nowrap; padding-bottom: 6px; }
  .log-head h2 { font-size: var(--fs-md); white-space: nowrap; }
  .log-head label { white-space: nowrap; }
  .long { display: none; }
}
@media (max-width: 900px) {
  .feed { height: auto; max-height: 80vh; }
}
</style>
