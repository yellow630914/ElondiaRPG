<script setup lang="ts">
import { computed, ref } from 'vue'
import { locationById } from '@/engine/data'
import { formatTime } from '@/engine/state'
import type { Report } from '@/engine/types'
import { actorNames, describeChanges, describeCheck, describeEntry, formatTokens } from '@/narrator/describe'
import { visibleNarration } from '@/narrator/judge'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

const props = defineProps<{ report: Report }>()
const game = useGame()
const settings = useSettings()

const KIND_NAME: Record<Report['kind'], string> = {
  travel: '🧳 旅行', combat: '⚔️ 戰鬥', action: '🎲 行動', event: '✨ 事件', quest: '📜 委託', rest: '🛏️ 休息', trade: '🪙 交易', social: '💬 交流',
}

const narration = computed(() => game.narrations[props.report.report_id])
// 關閉 AI 細節描述時不顯示敘事，改顯示戰報或事件簡述（已生成的敘事仍保留，重新開啟後會再出現）
// AI 判定的主動行動：AI 直接寫出的經過一律顯示
const showStory = computed(() => (settings.aiNarration || props.report.check?.source === 'ai') && !!narration.value)
const showBattleReport = computed(() => props.report.kind === 'combat' && !showStory.value && !!props.report.timeline?.length)
const names = computed(() => actorNames(props.report))
const changes = computed(() => describeChanges(props.report))
const check = computed(() => describeCheck(props.report))
const tokens = computed(() => game.usage[props.report.report_id])
const showRaw = ref(false)
const copied = ref(false)

async function copyPrompt() {
  const p = await game.promptFor(props.report)
  await navigator.clipboard.writeText(`${p.system}\n\n---\n\n${p.user}`)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <article class="panel">
    <header class="row" style="justify-content: space-between">
      <div class="row">
        <span class="tag">{{ KIND_NAME[report.kind] }}</span>
        <strong>{{ locationById(report.location.at).name }}<template v-if="report.location.to"> → {{ locationById(report.location.to).name }}</template></strong>
      </div>
      <span class="small muted">{{ formatTime(report.time.start) }}</span>
    </header>
    <p>{{ report.outcome.summary }}</p>
    <p v-if="check" class="small check">🎲 {{ check }}<template v-if="report.check?.twist"><br /><span>✨ 出乎預料：{{ report.check.twist }}</span></template><template v-if="report.check?.rationale"><br /><span class="muted">判定理由：{{ report.check.rationale }}</span></template></p>

    <div v-if="showStory && narration" class="story">
      <div class="narration">{{ visibleNarration(narration.text) }}<span v-if="narration.status === 'streaming'" class="cursor">▌</span></div>
      <p v-if="narration.status === 'error'" class="small" style="color: var(--danger)">{{ narration.error }}</p>
    </div>

    <div v-if="showBattleReport" class="battle-report">
      <h3 class="small">戰報</h3>
      <div class="small timeline">
        <div v-for="t in report.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      </div>
    </div>
    <details v-else-if="report.timeline?.length">
      <summary class="small">經過（{{ report.timeline.length }} 筆）</summary>
      <div class="small timeline">
        <div v-for="t in report.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      </div>
    </details>
    <div v-if="changes.length" class="row small changes">
      <span v-for="c in changes" :key="c" class="tag">{{ c }}</span>
    </div>

    <div class="row actions">
      <template v-if="settings.aiNarration">
        <button
          v-if="narration?.status !== 'streaming'"
          class="small"
          :disabled="!settings.ready()"
          @click="game.narrate(report)"
        >{{ narration ? '重新生成敘事' : '生成敘事' }}</button>
        <button v-else class="small" @click="game.cancelNarration(report.report_id)">停止</button>
        <span v-if="!settings.ready()" class="small muted">AI 服務尚未設定，請到「設定」填寫</span>
      </template>
      <button class="small" @click="copyPrompt">{{ copied ? '已複製' : '複製提示詞' }}</button>
      <button class="small" @click="showRaw = !showRaw">{{ showRaw ? '隱藏' : '顯示' }}報告 JSON</button>
    </div>
    <pre v-if="showRaw" class="raw small">{{ JSON.stringify(report, null, 2) }}</pre>
    <p v-if="tokens" class="small muted tokens" title="這則日誌的 AI 呼叫（判定、敘事）用掉的 token">
      🔢 輸入 {{ formatTokens(tokens.input) }}・輸出 {{ formatTokens(tokens.output) }} tokens<template v-if="tokens.calls > 1">（{{ tokens.calls }} 次呼叫）</template>
    </p>
  </article>
</template>

<style scoped>
.story { border-left: 3px solid var(--accent); padding: 4px 12px; margin: 8px 0; background: #0002; }
.cursor { animation: blink 1s steps(1) infinite; color: var(--accent); }
@keyframes blink { 50% { opacity: 0; } }
.battle-report { border-left: 3px solid var(--accent-2); padding: 4px 12px; margin: 8px 0; background: #0002; }
.battle-report .timeline { color: var(--text); }
.timeline { display: grid; gap: 2px; padding: 6px 0; color: var(--muted); }
.changes { margin: 6px 0; }
.actions { margin-top: 6px; }
.raw { max-height: 320px; overflow: auto; background: var(--bg); padding: 8px; border-radius: 6px; }
details summary { cursor: pointer; color: var(--accent-2); }
.check { color: var(--accent-2); margin: 0 0 8px; }
.tokens { margin: 6px 0 0; text-align: right; }
</style>
