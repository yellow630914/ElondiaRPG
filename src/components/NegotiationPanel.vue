<script setup lang="ts">
import { computed, reactive } from 'vue'
import { attrName, type Degree } from '@/engine/data'
import { DEGREE_NAME } from '@/engine/checks'
import { formatMoney } from '@/engine/money'
import { openNegotiationsHere } from '@/engine/negotiation'
import { npcRecord } from '@/engine/npcs'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import AppDialog from './AppDialog.vue'
import { useSettings } from '@/stores/settings'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 進行中的談判：地點面板只留一列（繼續、放棄），內容在對話框裡；剛開始的談判自動打開對話框
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const list = computed(() => openNegotiationsHere(s.value))
const text = reactive<Record<string, string>>({})
const use = reactive<Record<string, string>>({})
const DEGREES = Object.keys(DEGREE_NAME) as Degree[]
const aiOn = computed(() => settings.aiJudge && settings.ready('negotiation'))

// 對話框顯示哪一場：開始或繼續談判時由 store 設定；談判結束（不在清單裡）就自動關掉
const shown = computed({ get: () => game.negotiationFocus, set: (v: string | null) => { game.negotiationFocus = v } })
const cur = computed(() => list.value.find((n) => n.id === shown.value))

function free(id: string) {
  void game.negotiateFreely(id, text[id] ?? '', parseUse(use[id] ?? ''))
  text[id] = ''
  use[id] = ''
}
</script>

<template>
  <section v-for="n in list" :key="n.id" class="panel nego">
    <div class="row nego-bar">
      <h3 class="title"><GameIcon name="hand" :size="16" />{{ n.title }}</h3>
      <span class="small muted grow">和 <NameTag :id="n.counterpart" />・還可以談 {{ n.attempts }} 次</span>
      <button class="small primary" @click="shown = n.id">繼續談判</button>
      <button class="small" @click="game.abandonNegotiation(n.id)">放棄</button>
    </div>
  </section>

  <AppDialog :open="!!cur" :title="cur?.title ?? '談判'" icon="hand" width="720px" stay @close="shown = null">
    <div v-if="cur" class="nego-body">
      <table class="kv">
        <tr><th>對象</th><td><NameTag :id="cur.counterpart" /><div class="muted">{{ npcRecord(s, cur.counterpart)?.personality }}</div></td></tr>
        <tr><th>目標</th><td>{{ cur.goal }}</td></tr>
        <tr><th>次數</th><td>還可以談 {{ cur.attempts }} 次<span class="muted">（部分成功時可以再談）</span></td></tr>
      </table>

      <h4>結果</h4>
      <table class="tbl results">
        <tr v-for="d in DEGREES" :key="d"><th><span class="tag">{{ DEGREE_NAME[d] }}</span></th><td>{{ cur.outcomes[d].text }}</td></tr>
      </table>

      <h4>選擇談判方式<span class="muted">（依規則檢定{{ cur.ai ? '・AI 依對象設計' : '' }}）</span><Hint v-if="cur.options.some((o) => o.cost_cc)" :text="`有代價的方式會先付出金錢（${formatMoney(Math.min(...cur.options.filter((o) => o.cost_cc).map((o) => o.cost_cc!)))} 起），無論成敗。`" /></h4>
      <table class="tbl options">
        <thead><tr><th>方式</th><th>檢定</th><th>代價</th><th></th></tr></thead>
        <tbody>
          <tr v-for="o in cur.options" :key="o.id">
            <td>{{ o.label }}</td>
            <td class="nowrap">{{ attrName(o.attr) }} DC {{ o.dc }}</td>
            <td class="nowrap">{{ o.cost_cc ? formatMoney(o.cost_cc) : '－' }}</td>
            <td class="act"><button class="small" :disabled="(o.cost_cc ?? 0) > s.money_cc || game.judging" @click="game.chooseOption(cur.id, o.id)">談判</button></td>
          </tr>
        </tbody>
      </table>

      <h4>或自己描述做法<span class="muted">（參考 DC {{ cur.base_dc }}）</span><Hint :text="`算主動行動，${aiOn ? 'AI 看骰值判定' : '依規則判定'}。`" /></h4>
      <textarea v-model="text[cur.id]" rows="2" placeholder="例如：提起上次幫他找回貨物的事，請他通融" />
      <div class="row free">
        <AbilityPicker v-model="use[cur.id]" class="grow" />
        <button class="small" :disabled="!(text[cur.id] ?? '').trim() || game.judging" @click="free(cur.id)">談判</button>
      </div>
      <div class="row end">
        <button class="small" @click="game.abandonNegotiation(cur.id); shown = null">放棄這場談判</button>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.nego { border-color: var(--accent-2); flex-shrink: 0; }
.nego-bar { gap: 8px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; min-width: 0; }
.title { display: flex; align-items: center; gap: 6px; margin: 0; }
.title :deep(.game-icon) { color: var(--accent); }
.nego-body { display: grid; gap: 8px; }
h4 { margin: 6px 0 0; color: var(--accent-2); display: flex; align-items: center; gap: 4px; }
table { width: 100%; border-collapse: collapse; }
.kv th { text-align: left; font-weight: 600; white-space: nowrap; width: 1%; padding: 5px 14px 5px 0; color: var(--muted); vertical-align: top; }
.kv td { padding: 5px 0; vertical-align: top; }
.kv tr + tr > * { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.tbl th, .tbl td { padding: 5px 8px; text-align: left; vertical-align: middle; border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.tbl thead th { font-weight: 600; color: var(--muted); }
.results th { width: 1%; white-space: nowrap; font-weight: 400; }
.nowrap { white-space: nowrap; }
.act { width: 1%; text-align: right; white-space: nowrap; }
textarea { width: 100%; }
.free { gap: 8px; align-items: center; }
.end { justify-content: flex-end; }
</style>
