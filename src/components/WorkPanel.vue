<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrOf } from '@/engine/character'
import { attrName, lewdRules, workRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { isBound, isFugitive } from '@/engine/party'
import { freeWorker, jobHere, wageFor, workers, workPay, workTarget } from '@/engine/work'
import { consentedToday, needsConsent, proposeDc, rankOf, trainingPreview } from '@/engine/brothelLife'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import FoldMenu from './ui/FoldMenu.vue'
import Hint from './ui/Hint.vue'
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
// 誰去做：主角自己、自己的奴隸（工錢歸主角），或自由的夥伴（工錢分一半；娼館要先答應）
const slaves = computed(() => workers(s.value))
const picked = ref('')
const worker = computed(() => slaves.value.find((m) => m.id === picked.value))
const brothel = computed(() => job.value?.cell === 'brothel')
const wage = computed(() => (job.value ? wageFor(s.value, job.value, worker.value) : 1))
const cut = computed(() => (worker.value && freeWorker(worker.value) ? lewdRules.brothel.propose.share : 1))
// 娼館：頭牌等級、還沒答應的夥伴、受訓
const who = computed(() => worker.value ?? s.value.party.find((m) => m.isPlayer)!)
const rank = computed(() => rankOf(s.value, who.value.id))
const toAsk = computed(() => (brothel.value ? s.value.party.filter((m) => needsConsent(m) && !m.status.includes('away') && !consentedToday(s.value, m.id)) : []))
const train = computed(() => (brothel.value ? trainingPreview(s.value, who.value) : undefined))

function work() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'work', target: workTarget(hours.value, worker.value?.id), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <FoldMenu v-if="job" id="place.work" class="work" icon="briefcase" label="工作" :detail="`${job.name}・每小時約 ${formatMoney(job.rate_cc)}`">
    <p class="muted small">{{ job.desc }} {{ attrName(job.attr) }}檢定，參考 DC {{ job.dc }}；每小時約 {{ formatMoney(job.rate_cc) }}，依表現增減。</p>
    <p v-if="share" class="muted small">你被主人帶著：收入依印記歸主人一部分。</p>
    <label v-if="slaves.length" class="who">誰去做
      <select v-model="picked">
        <option value="">你自己</option>
        <option v-for="m in slaves" :key="m.id" :value="m.id">{{ freeWorker(m) ? '請' : '派' }}{{ m.name }}去（{{ attrName(job.attr) }} {{ attrOf(m, job.attr) }}，{{ freeWorker(m) ? '工錢分你一半' : '工錢歸你' }}）</option>
      </select>
    </label>
    <p v-if="blocked && !worker" class="muted small">這裡的人認出了你身上的契約印記，不肯雇你。</p>
    <template v-else>
      <div class="row small">
        <label v-for="h in workRules.hours" :key="h" class="check"><input v-model="hours" type="radio" :value="h" /> {{ h }} 小時（約 {{ formatMoney(Math.round(workPay(job, h, 'success', wage) * cut)) }}）</label>
      </div>
      <input v-model="text" :placeholder="worker ? `交代${worker.name}怎麼做（選填，會寫進日誌）` : '怎麼做（選填，會寫進日誌）：例如專心招呼熟客、偷偷打聽客人的消息'" />
      <AbilityPicker v-model="use" />
      <button class="small go" :disabled="game.judging || !!s.pendingAction" @click="work">{{ worker ? `${freeWorker(worker) ? '請' : '派'}${worker.name}去工作` : '開始工作' }}</button>
    </template>
    <template v-if="brothel">
      <p class="small muted">
        {{ who.isPlayer ? '你' : who.name }}在這家娼館是「{{ rank.name }}」（{{ rank.points }}{{ rank.next ? ` / ${rank.next}` : '' }}）：時薪 ×{{ wage.toFixed(2) }}。
        <Hint text="成人向（docs/LEWD_STATS.md 第 10 節）。每座城的娼館各自累積：接客一次 +1、遇到打工事件 +2。等級越高時薪越高、受訓越便宜，也能遇到更好的客人、學到更稀有的技能。接客時可能遇到事件，淫亂越高越容易。" />
      </p>
      <div v-for="m in toAsk" :key="m.id" class="row small ask">
        <span>{{ m.name }}還沒答應去接客</span>
        <button class="small" :disabled="game.judging || !!s.pendingAction || !!s.pendingMasterEvent" @click="game.proposeWork(m.id)">提議（魅力 DC {{ proposeDc(s, m) }}）</button>
      </div>
      <div v-if="train" class="row small">
        <button class="small" :disabled="game.judging || !!s.pendingAction || !!s.pendingMasterEvent || s.money_cc < train.min" @click="game.startBrothelTraining(worker?.id)">🎓 {{ who.isPlayer ? '受訓' : `讓${who.name}受訓` }}</button>
        <span class="muted">{{ train.review ? `能學的都學過了，複習一次 ${formatMoney(train.min)}` : `還能學 ${train.count} 種技能，學費 ${formatMoney(train.min)}～${formatMoney(train.max)}（一定學會一種）` }}</span>
      </div>
    </template>
  </FoldMenu>
</template>

<style scoped>
.work p { margin: 0; }
.work input:not([type]) { width: 100%; }
.who { display: flex; gap: 6px; align-items: center; font-size: var(--fs-sm); }
.go { justify-self: start; }
.ask { gap: 6px; align-items: center; }
.check { display: inline-flex; gap: 4px; align-items: center; margin-right: 8px; }
</style>
