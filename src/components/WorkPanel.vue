<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrOf } from '@/engine/character'
import { attrName, workRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { isBound, isFugitive } from '@/engine/party'
import { jobHere, workers, workPay, workTarget } from '@/engine/work'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import { contractOf } from '@/engine/tattoos'

// 在設施上工作換錢（data/rules/work.json）
const game = useGame()
const s = computed(() => game.state!)
const job = computed(() => jobHere(s.value))
const hours = ref(workRules.hours[1] ?? 4)
const text = ref('')
const use = ref('')
const blocked = computed(() => !!job.value?.official && isFugitive(s.value))
const share = computed(() => (isBound(s.value) ? contractOf(s.value.party.find((m) => m.isPlayer)) : undefined))
// 誰去做：主角自己，或派自己的奴隸（由奴隸擲檢定，工錢歸主角）
const slaves = computed(() => workers(s.value))
const picked = ref('')
const worker = computed(() => slaves.value.find((m) => m.id === picked.value))

function work() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'work', target: workTarget(hours.value, worker.value?.id), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <details v-if="job" class="work small">
    <summary><GameIcon name="briefcase" :size="13" /> 工作：{{ job.name }}</summary>
    <p class="muted">{{ job.desc }} {{ attrName(job.attr) }}檢定，參考 DC {{ job.dc }}；每小時約 {{ formatMoney(job.rate_cc) }}，依表現增減。</p>
    <p v-if="share" class="muted">你被主人帶著：收入依印記歸主人一部分。</p>
    <label v-if="slaves.length" class="who">誰去做
      <select v-model="picked">
        <option value="">你自己</option>
        <option v-for="m in slaves" :key="m.id" :value="m.id">派{{ m.name }}去（{{ attrName(job.attr) }} {{ attrOf(m, job.attr) }}，工錢歸你）</option>
      </select>
    </label>
    <p v-if="blocked && !worker" class="muted">這裡的人認出了你身上的契約印記，不肯雇你。</p>
    <template v-else>
      <div class="row">
        <label v-for="h in workRules.hours" :key="h" class="check"><input v-model="hours" type="radio" :value="h" /> {{ h }} 小時（約 {{ formatMoney(workPay(job, h, 'success')) }}）</label>
      </div>
      <input v-model="text" :placeholder="worker ? `交代${worker.name}怎麼做（選填，會寫進日誌）` : '怎麼做（選填，會寫進日誌）：例如專心招呼熟客、偷偷打聽客人的消息'" />
      <AbilityPicker v-model="use" />
      <button class="small" :disabled="game.judging || !!s.pendingAction" @click="work">{{ worker ? `派${worker.name}去工作` : '開始工作' }}</button>
    </template>
  </details>
</template>

<style scoped>
.work summary { cursor: pointer; color: var(--accent-2); }
.work { margin-top: 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.work input:not([type]) { width: 100%; }
.who { display: flex; gap: 6px; align-items: center; }
.check { display: inline-flex; gap: 4px; align-items: center; margin-right: 8px; }
</style>
