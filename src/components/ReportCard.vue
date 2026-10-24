<script setup lang="ts">
import { computed, ref } from 'vue'
import { locationById } from '@/engine/data'
import { formatTime } from '@/engine/state'
import type { Report } from '@/engine/types'
import { actorNames, describeChanges, describeCheck, describeEntry, formatTokens } from '@/narrator/describe'
import { visibleNarration } from '@/narrator/judge'
import { usageFeatureName, usageSourceLabel, useGame } from '@/stores/game'
import { inventedIn } from '@/engine/invention'
import { useSettings } from '@/stores/settings'
import { attrName } from '@/engine/data'
import GameIcon from './ui/GameIcon.vue'
import type { IconName } from './ui/iconPaths'

const props = defineProps<{ report: Report }>()
const game = useGame()
const settings = useSettings()

const KIND: Record<Report['kind'], { name: string; icon: IconName }> = {
  travel: { name: '旅行', icon: 'road' }, combat: { name: '戰鬥', icon: 'sword' }, action: { name: '行動', icon: 'd20' },
  event: { name: '事件', icon: 'sparkles' }, quest: { name: '委託', icon: 'scroll' }, rest: { name: '休息', icon: 'bed' },
  trade: { name: '交易', icon: 'coins' }, social: { name: '交流', icon: 'message' },
}
const DEGREE: Record<NonNullable<Report['check']>['degree'], string> = { critical: '大成功', success: '成功', partial: '部分成功', fail: '失敗', fumble: '大失敗' }

const entry = computed(() => game.narrations[props.report.report_id])
// 只存了判定的思考過程的空項目不算敘事
const narration = computed(() => (entry.value?.placeholder ? undefined : entry.value))
const thinking = computed(() => [
  ...(entry.value?.judgeThinking ? [{ label: '判定', text: entry.value.judgeThinking }] : []),
  ...(entry.value?.thinking ? [{ label: '敘事', text: entry.value.thinking }] : []),
])
// 關閉 AI 細節描述時不顯示敘事，改顯示戰報或事件簡述（已生成的敘事仍保留，重新開啟後會再出現）
// AI 判定的主動行動：AI 直接寫出的經過一律顯示
// 敘事依空行分段（段距比整行空白小）
const paragraphs = computed(() => {
  const list = visibleNarration(narration.value?.text ?? '').split(/\n[ \t\u3000]*\n+/).map((x) => x.replace(/^\n+|\n+$/g, '')).filter(Boolean)
  return list.length ? list : ['']
})
const showStory = computed(() => !!narration.value && (settings.aiNarration || !!narration.value.manual || props.report.check?.source === 'ai'))
const showBattleReport = computed(() => props.report.kind === 'combat' && !showStory.value && !!props.report.timeline?.length)
const names = computed(() => actorNames(props.report))
const changes = computed(() => describeChanges(props.report))
const check = computed(() => describeCheck(props.report))
const roll = computed(() => props.report.check)
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const tokens = computed(() => game.usage[props.report.report_id])
// 自創配方做出來的東西：可以改名（AI 取的名字不喜歡時）
const invented = computed(() => (game.state ? inventedIn(game.state, props.report) : undefined))
function renameInvented() {
  const from = invented.value
  if (!from) return
  const to = prompt('幫自創的物品取個名字（配方也跟著改）', from)
  if (to && to.trim() !== from) {
    const name = game.renameInvention(from, to)
    if (name) game.flash(`✏️ 改名為「${name}」`)
  }
}
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
  <article class="report" :class="report.kind">
    <header class="head">
      <span class="kind"><GameIcon :name="KIND[report.kind].icon" :size="14" />{{ KIND[report.kind].name }}</span>
      <strong class="where">{{ locationById(report.location.at).name }}<template v-if="report.location.to"> → {{ locationById(report.location.to).name }}</template></strong>
      <span class="when">{{ formatTime(report.time.start) }}</span>
      <details class="menu">
        <summary class="menu-btn" title="更多：重寫經過、複製提示詞、報告 JSON" aria-label="更多"><GameIcon name="more" :size="18" /></summary>
        <div class="menu-list">
          <template v-if="settings.ready('narration')">
            <button v-if="narration?.status !== 'streaming'" class="small ghost" title="用「敘事正文」的模型寫出這則日誌的經過" @click="game.narrate(report, { manual: !settings.aiNarration })">
              <GameIcon name="edit" :size="14" /> {{ showStory ? '重新寫出經過' : '寫出經過' }}
            </button>
          </template>
          <span v-else-if="settings.aiNarration" class="small muted">「敘事正文」的模型來源尚未設定，請到「設定」填寫</span>
          <button class="small ghost" @click="copyPrompt"><GameIcon name="copy" :size="14" /> {{ copied ? '已複製' : '複製提示詞' }}</button>
          <button class="small ghost" @click="showRaw = !showRaw"><GameIcon name="code" :size="14" /> {{ showRaw ? '隱藏' : '顯示' }}報告 JSON</button>
        </div>
      </details>
    </header>
    <p class="summary">{{ report.outcome.summary }}</p>
    <p v-if="invented" class="small"><button class="small" @click="renameInvented"><GameIcon name="edit" :size="14" /> 幫「{{ invented }}」改名</button></p>
    <div v-if="roll && check" class="check small" :title="check">
      <span class="d20">{{ roll.natural }}</span>
      <span class="muted">{{ roll.action }}</span>
      <span class="tag">{{ attrName(roll.attr) }} {{ signed(roll.modifier) }}</span>
      <span class="muted">＝</span><b>{{ roll.total }}</b>
      <span class="muted">對 DC {{ roll.dc }}<template v-if="roll.dc !== roll.base_dc">（參考 {{ roll.base_dc }}）</template></span>
      <span class="verdict" :class="roll.degree">{{ DEGREE[roll.degree] }}</span>
      <span v-if="roll.reference_degree" class="muted">（骰值參考：{{ DEGREE[roll.reference_degree] }}）</span>
      <span v-if="roll.source === 'ai'" class="tag">AI 判定</span>
    </div>
    <p v-if="report.check?.twist || report.check?.rationale" class="small reason">
      <template v-if="report.check?.twist"><span class="twist"><GameIcon name="sparkles" :size="13" /> 出乎預料：{{ report.check.twist }}</span><br v-if="report.check?.rationale" /></template>
      <span v-if="report.check?.rationale" class="muted">判定理由：{{ report.check.rationale }}</span>
    </p>
    <div v-if="narration?.status === 'streaming' && !showStory" class="small muted"><button class="small" @click="game.cancelNarration(report.report_id)">停止</button></div>

    <details v-if="thinking.length" class="thinking small">
      <summary>思考過程（{{ thinking.map((t) => t.label).join('、') }}）<span v-if="narration?.status === 'streaming' && !narration.text" class="muted">・思考中……</span></summary>
      <div v-for="t in thinking" :key="t.label" class="thought">
        <b v-if="thinking.length > 1">{{ t.label }}</b>
        <pre>{{ t.text }}</pre>
      </div>
    </details>

    <div v-if="showStory && narration" class="story story-paper">
      <div class="narration" data-no-convert>
        <p v-for="(para, i) in paragraphs" :key="i">{{ para }}<span v-if="narration.status === 'streaming' && i === paragraphs.length - 1" class="cursor">▌</span></p>
      </div>
      <p v-if="narration.status === 'error'" class="small err">{{ narration.error }}</p>
      <button v-if="narration.status === 'streaming'" class="small stop" @click="game.cancelNarration(report.report_id)">停止</button>
    </div>

    <div v-if="showBattleReport" class="battle-report">
      <h3 class="small">戰報</h3>
      <div class="small timeline">
        <div v-for="t in report.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      </div>
    </div>
    <details v-else-if="report.timeline?.length" class="steps">
      <summary class="small">經過（{{ report.timeline.length }} 筆）</summary>
      <div class="small timeline">
        <div v-for="t in report.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      </div>
    </details>
    <div v-if="changes.length" class="row small changes">
      <span v-for="c in changes" :key="c" class="tag">{{ c }}</span>
    </div>

    <pre v-if="showRaw" class="raw small">{{ JSON.stringify(report, null, 2) }}</pre>
    <!-- 這則日誌用掉的 token：平常只顯示總數，點開看輸入、輸出、快取與各次呼叫 -->
    <details v-if="tokens" class="small muted tokens" title="這則日誌的 AI 呼叫（判定、敘事）用掉的 token">
      <summary>{{ formatTokens(tokens.input + tokens.output) }} tokens<template v-if="tokens.calls > 1">（{{ tokens.calls }} 次呼叫）</template></summary>
      輸入 {{ formatTokens(tokens.input) }}<template v-if="tokens.cached">（快取 {{ formatTokens(tokens.cached) }}）</template>・輸出 {{ formatTokens(tokens.output) }}
      <template v-for="(p, i) in tokens.by ?? []" :key="i">
        <br /><span class="origin">{{ usageFeatureName(p.feature) }}・{{ usageSourceLabel(p) }}：輸入 {{ formatTokens(p.input) }}<template v-if="p.cached">（快取 {{ formatTokens(p.cached) }}）</template>・輸出 {{ formatTokens(p.output) }}<template v-if="p.calls > 1">（{{ p.calls }} 次）</template></span>
      </template>
    </details>
  </article>
</template>

<style scoped>
.report { position: relative; padding: 12px 14px 10px 18px; margin-bottom: 14px; background: #00000040; border: 1px solid #ffffff0d; border-radius: 3px; --kind: var(--accent); }
.report::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--kind); box-shadow: 0 0 8px var(--kind); opacity: 0.85; }
.report.travel { --kind: #8fb3a3; } .report.combat { --kind: #c8483a; } .report.social { --kind: #d79ac0; }
.report.trade { --kind: #c9a24a; } .report.rest { --kind: #7f9bd0; } .report.quest { --kind: #d6a64e; }
.report.event { --kind: #b48ad8; } .report.action { --kind: #e0b45a; }
.head { display: flex; align-items: center; gap: 8px; }
.kind { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-xs); letter-spacing: 0.1em; color: var(--kind); font-weight: 700; white-space: nowrap; }
.where { min-width: 0; }
.when { margin-left: auto; font-size: var(--fs-xs); color: var(--muted); white-space: nowrap; }
.summary { margin: 6px 0 8px; font-weight: 600; }
.report.trade .summary { font-weight: 400; color: var(--muted); font-size: var(--fs-sm); margin-bottom: 4px; }

.menu { position: relative; }
.menu > summary { list-style: none; }
.menu > summary::-webkit-details-marker { display: none; }
.menu-btn { display: grid; place-items: center; width: 26px; height: 26px; color: var(--muted); cursor: pointer; border-radius: 3px; }
.menu-btn:hover, .menu[open] .menu-btn { color: var(--accent); background: #ffffff0d; }
.menu-list {
  position: absolute; right: 0; top: 30px; z-index: 5; display: grid; gap: 2px; min-width: 170px; padding: 6px;
  background: var(--panel); border: 1px solid var(--gold-lo); border-radius: 3px; box-shadow: 0 8px 20px #000a;
}
.menu-list button { justify-content: flex-start; text-align: left; display: flex; align-items: center; gap: 6px; color: var(--text); }

.check { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
.d20 {
  display: inline-grid; place-items: center; width: 28px; height: 28px; font-weight: 900; font-size: 13px; color: #1a1008;
  background: var(--gold-hi); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.verdict { font-weight: 900; letter-spacing: 0.12em; padding: 0 4px; }
.verdict.critical { color: var(--gold-hi); text-shadow: 0 0 8px #f0d08388; }
.verdict.success { color: var(--good); }
.verdict.partial { color: #d8b45a; }
.verdict.fail { color: var(--danger); }
.verdict.fumble { color: #ff6a50; text-shadow: 0 0 8px #ff6a5066; }
.reason { margin: 0 0 8px; }
.twist { color: var(--accent-2); }

.story { margin: 8px 0; }
.story .err { color: var(--danger); }
.story .stop { margin-top: 6px; }
.thinking { margin: 6px 0; color: var(--muted); }
.thinking summary { cursor: pointer; }
.thought pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; line-height: 1.6; margin: 4px 0 8px; padding: 6px 10px; border-left: 2px dashed var(--border); max-height: 360px; overflow: auto; }
.cursor { animation: blink 1s steps(1) infinite; color: #7a2e12; }
@keyframes blink { 50% { opacity: 0; } }
.battle-report { border-left: 2px solid #c8483a66; padding: 6px 12px; margin: 8px 0; background: #0005; }
.battle-report h3 { margin: 0 0 2px; }
.battle-report .timeline { color: var(--text); }
.timeline { display: grid; gap: 2px; padding: 6px 0; color: var(--muted); }
.changes { margin: 8px 0 2px; gap: 5px; }
/* 變化的標籤可能帶著 AI 寫的原因：允許換行，不要撐破卡片 */
.changes .tag { white-space: normal; height: auto; }
.raw { max-height: 320px; overflow: auto; background: var(--bg); padding: 8px; border-radius: 3px; }
details.steps summary, details.thinking summary { cursor: pointer; color: var(--accent-2); }
.tokens { margin: 6px 0 0; text-align: right; }
.tokens summary { cursor: pointer; list-style-position: inside; color: var(--muted); }
.tokens .origin { opacity: .85; }
</style>
