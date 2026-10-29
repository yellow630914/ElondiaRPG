<script setup lang="ts">
import { computed } from 'vue'
import { DEGREE_NAME, situationalTotal } from '@/engine/actions'
import { actionRules, ATTR_IDS, attrName, type Degree } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { eventDialogOpen } from './events/eventQueue'

// 日誌最下面的「等待判定」卡片：擲完骰、還沒判定的行動（AI 判定中或失敗待重試），以及要先面對的刻印。
// 判定完成後行動消失，同一個位置換成這次行動的日誌。
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const pending = computed(() => s.value.pendingAction)
const pendingMark = computed(() => s.value.pendingMark)

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const DEGREES = Object.keys(DEGREE_NAME) as Degree[]
const totals = computed(() => {
  const p = pending.value
  if (!p) return []
  const sit = situationalTotal(p)
  return ATTR_IDS.map((a) => ({ attr: a, total: p.natural + p.modifiers[a] + sit, isDefault: a === p.attr }))
})
</script>

<template>
  <article v-if="pending" class="pending-card" :class="{ judging: game.judging }">
    <h3>
      <GameIcon name="d20" :size="16" /> {{ actionRules.kinds[pending.kind].name }}<template v-if="pending.targetName">（{{ pending.targetName }}）</template>
      <span class="state">{{ game.judging ? 'AI 判定中…' : '等待判定' }}</span>
    </h3>
    <p v-if="pending.text" class="small">「{{ pending.text }}」</p>
    <p v-if="pending.offer_cc !== undefined" class="small">出價：{{ formatMoney(pending.offer_cc) }}</p>
    <p v-if="pending.item" class="small">禮物：{{ pending.item }}</p>
    <p class="small">
      自然骰 <strong class="dice">{{ pending.natural }}</strong>・參考 DC {{ pending.base_dc }}
      <Hint text="骰值是給 AI 的參考；AI 會依角色、關係與情勢決定結果，可能出乎預料。" />
    </p>
    <p v-if="pending.situational.length" class="small muted">
      情境修正：<span v-for="x in pending.situational" :key="x.label">{{ x.label }} {{ signed(x.value) }} </span>
    </p>
    <div class="row small totals">
      <span v-for="t in totals" :key="t.attr" :class="{ def: t.isDefault }">{{ attrName(t.attr) }} {{ t.total }}</span>
    </div>
    <ul v-if="Object.keys(pending.outcomes).length" class="plain small outcomes">
      <template v-for="d in DEGREES" :key="d">
        <li v-if="pending.outcomes[d]"><span class="tag">{{ DEGREE_NAME[d] }}</span> {{ pending.outcomes[d] }}</li>
      </template>
    </ul>
    <div class="row">
      <button class="primary" :disabled="game.judging || !settings.ready('judge')" @click="game.judge(true)">
        {{ game.judging ? 'AI 判定中…' : 'AI 判定' }}
      </button>
      <button :disabled="game.judging" @click="game.judge(false)">依規則判定（{{ attrName(pending.attr) }}）</button>
    </div>
    <p v-if="!settings.ready('judge')" class="small muted">「主動行動判定」的模型來源尚未設定，只能依規則判定。</p>
  </article>

  <article v-else-if="pendingMark" class="pending-card">
    <h3><GameIcon name="fire" :size="16" /> 刻下契約印記</h3>
    <p class="small">要先面對刻印，才能做別的事。</p>
    <button class="small primary" @click="eventDialogOpen = true"><GameIcon name="bell" :size="14" /> 開啟事件視窗</button>
  </article>
</template>

<style scoped>
/* 和日誌卡片（ReportCard）同樣的外框，左邊的色條用金色虛線表示「還沒有結果」 */
.pending-card {
  position: relative; padding: 12px 14px 12px 18px; margin-bottom: 14px; background: #00000040;
  border: 1px dashed var(--accent); border-radius: 3px; animation: card-in 0.3s steps(5, end);
}
.pending-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.pending-card.judging::before { animation: blink 1.2s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
@keyframes card-in { from { opacity: 0; transform: translateY(6px); } }
h3 { margin: 0 0 6px; display: flex; align-items: center; gap: 6px; }
h3 :deep(.game-icon) { color: var(--accent); }
.state { margin-left: auto; font-size: var(--fs-xs); font-weight: 400; color: var(--accent); letter-spacing: 0.08em; }
p { margin: 4px 0; }
.dice { color: var(--accent); font-size: 1.2rem; }
.totals { gap: 12px; margin: 4px 0; }
.totals .def { color: var(--accent); }
.outcomes { margin: 6px 0; display: grid; gap: 2px; }
.row { margin-top: 6px; }
</style>
