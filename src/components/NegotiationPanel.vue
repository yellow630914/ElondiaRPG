<script setup lang="ts">
import { computed, reactive } from 'vue'
import { DEGREE_NAME } from '@/engine/checks'
import { formatMoney } from '@/engine/money'
import { openNegotiationsHere, optionText } from '@/engine/negotiation'
import { npcRecord } from '@/engine/npcs'
import type { Degree } from '@/engine/data'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import { useSettings } from '@/stores/settings'
import NameTag from './NameTag.vue'

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const list = computed(() => openNegotiationsHere(s.value))
const text = reactive<Record<string, string>>({})
const use = reactive<Record<string, string>>({})
const DEGREES = Object.keys(DEGREE_NAME) as Degree[]
const aiOn = computed(() => settings.aiJudge && settings.ready())

function free(id: string) {
  void game.negotiateFreely(id, text[id] ?? '', parseUse(use[id] ?? ''))
  text[id] = ''
  use[id] = ''
}
</script>

<template>
  <section v-for="n in list" :key="n.id" class="panel nego">
    <div class="row" style="justify-content: space-between">
      <h3>🤝 {{ n.title }}</h3>
      <button class="small" @click="game.abandonNegotiation(n.id)">放棄</button>
    </div>
    <p class="small">對象：<NameTag :id="n.counterpart" />・{{ npcRecord(s, n.counterpart)?.personality }}</p>
    <p class="small">{{ n.goal }}<span class="muted">（還可以談 {{ n.attempts }} 次）</span></p>
    <ul class="plain small results">
      <li v-for="d in DEGREES" :key="d"><span class="tag">{{ DEGREE_NAME[d] }}</span> {{ n.outcomes[d].text }}</li>
    </ul>

    <h4 class="small">選擇談判方式（依規則檢定）<span v-if="n.ai" class="muted">・AI 依對象設計</span></h4>
    <div class="options">
      <button
        v-for="o in n.options"
        :key="o.id"
        class="small option"
        :disabled="(o.cost_cc ?? 0) > s.money_cc || game.judging"
        @click="game.chooseOption(n.id, o.id)"
      >
        <strong>{{ o.label }}</strong>
        <span class="muted">{{ optionText(o) }}</span>
      </button>
    </div>

    <h4 class="small">或自己描述做法（主動行動，{{ aiOn ? 'AI 看骰值判定' : '依規則判定' }}，參考 DC {{ n.base_dc }}）</h4>
    <textarea v-model="text[n.id]" rows="2" placeholder="例如：提起上次幫他找回貨物的事，請他通融" />
    <AbilityPicker v-model="use[n.id]" />
    <button class="small" :disabled="!(text[n.id] ?? '').trim() || game.judging" @click="free(n.id)">談判</button>
    <p v-if="n.options.some((o) => o.cost_cc)" class="small muted">有代價的方式會先付出金錢（{{ formatMoney(Math.min(...n.options.filter((o) => o.cost_cc).map((o) => o.cost_cc!))) }} 起），無論成敗。</p>
  </section>
</template>

<style scoped>
.nego { border-color: var(--accent-2); }
.results { display: grid; gap: 2px; margin: 4px 0; }
.options { display: grid; gap: 4px; }
.option { display: grid; text-align: left; }
h4 { margin: 8px 0 4px; color: var(--accent-2); }
textarea { width: 100%; }
</style>
