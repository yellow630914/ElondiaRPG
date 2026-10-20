<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, workRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { isBound, isFugitive } from '@/engine/party'
import { jobHere, workPay } from '@/engine/work'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'

// 在設施上工作換錢（data/rules/work.json）
const game = useGame()
const s = computed(() => game.state!)
const job = computed(() => jobHere(s.value))
const hours = ref(workRules.hours[1] ?? 4)
const text = ref('')
const use = ref('')
const blocked = computed(() => !!job.value?.official && isFugitive(s.value))
const share = computed(() => (isBound(s.value) ? s.value.party.find((m) => m.isPlayer)?.contract : undefined))

function work() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'work', target: String(hours.value), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <details v-if="job" class="work small">
    <summary>💼 工作：{{ job.name }}</summary>
    <p class="muted">{{ job.desc }} {{ attrName(job.attr) }}檢定，參考 DC {{ job.dc }}；每小時約 {{ formatMoney(job.rate_cc) }}，依表現增減。</p>
    <p v-if="share" class="muted">你被主人帶著：收入依印記歸主人一部分。</p>
    <p v-if="blocked" class="muted">這裡的人認出了你頸上的契約印記，不肯雇你。</p>
    <template v-else>
      <div class="row">
        <label v-for="h in workRules.hours" :key="h" class="check"><input v-model="hours" type="radio" :value="h" /> {{ h }} 小時（約 {{ formatMoney(workPay(job, h, 'success')) }}）</label>
      </div>
      <input v-model="text" placeholder="怎麼做（選填，會寫進日誌）：例如專心招呼熟客、偷偷打聽客人的消息" />
      <AbilityPicker v-model="use" />
      <button class="small" :disabled="game.judging || !!s.pendingAction" @click="work">開始工作</button>
    </template>
  </details>
</template>

<style scoped>
.work { margin-top: 8px; display: grid; gap: 4px; }
.work input:not([type]) { width: 100%; }
.check { display: inline-flex; gap: 4px; align-items: center; margin-right: 8px; }
</style>
