<script setup lang="ts">
// 奴隸契約（工具列「契約」）：主角身上有契約印記時，契約的內容、主人的家、出門與出城的請求、談判、逃離；
// 逃亡或沒有主人時：回到主人身邊、投靠新主人、解除印記。送出之後關掉對話框，回到主畫面看判定與經過。
import { computed, ref } from 'vue'
import { attrName, classEmoji, raceEmoji, slaveryRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord, npcTitle } from '@/engine/npcs'
import { isHostile, peopleHere } from '@/engine/population'
import { isBound, isEnslaved, isFugitive } from '@/engine/party'
import {
  atSafeSpot, contractTerms, markSummary, masterAllows, masterNearby, masterRefusedToday, masterWhereabouts, seekMasterDc, unmarkOffers,
} from '@/engine/slavery'
import { currentArea } from '@/engine/grid'
import { atMasterHome, houseRefusedToday, leaveDc, masterHomeSummary, mayLeaveHouse, strictPoints } from '@/engine/masterHome'
import { contractOf } from '@/engine/tattoos'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const emit = defineEmits<{ close: [] }>()
const game = useGame()
const s = computed(() => game.state!)

function label(id: string, name: string): string {
  const rec = s.value.party.find((m) => m.id === id) ?? npcRecord(s.value, id)
  return rec ? `${raceEmoji(rec.race)}${name}${classEmoji(rec.class)}` : name
}

const bound = computed(() => isBound(s.value))
const fugitive = computed(() => isFugitive(s.value))
const enslaved = computed(() => isEnslaved(s.value))
const contract = computed(() => {
  const c = contractOf(s.value.party.find((m) => m.isPlayer))
  return c ? { ...c, def: contractTerms(c), summary: markSummary(c) } : null
})
const safe = computed(() => atSafeSpot(s.value))
// 在聚落裡、主人今天還沒同意出城：可以請求
const inTown = computed(() => currentArea(s.value).kind === 'settlement')
const permitted = computed(() => masterAllows(s.value))
const refused = computed(() => masterRefusedToday(s.value))
const text = ref('')
const use = ref('')
// 主人的家：離家期限、嚴加看管、出門要主人同意
const homeLine = computed(() => masterHomeSummary(s.value))
const strict = computed(() => strictPoints(s.value))
const atHome = computed(() => atMasterHome(s.value))
const mayLeave = computed(() => mayLeaveHouse(s.value))
const houseRefused = computed(() => houseRefusedToday(s.value))
// 逃亡或無主：找到主人、投靠新主人、解除印記
const whereabouts = computed(() => masterWhereabouts(s.value))
const nearMaster = computed(() => masterNearby(s.value))
const offers = computed(() => unmarkOffers(s.value).filter((o) => !o.place))
const seekTarget = ref('')
const seekTargets = computed(() => {
  if (!enslaved.value || bound.value) return []
  return peopleHere(s.value)
    .filter((p) => p.dist <= 1 && p.rec.id !== contract.value?.master && !p.rec.tags?.includes('slave') && !isHostile(s.value, p.rec))
    .map((p) => ({ id: p.rec.id, name: `${label(p.rec.id, p.rec.name)}・${npcTitle(p.rec)}・DC ${seekMasterDc(s.value, p.rec)}${p.kind === 'commoner' ? '・不戰鬥' : ''}` }))
})

function act(kind: 'negotiate' | 'escape' | 'master_permit' | 'master_leave' | 'master_return' | 'seek_master' | 'unmark', target?: string) {
  const u = parseUse(use.value)
  void game.perform({ kind, text: text.value, ...(target ? { target } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  emit('close')
}
</script>

<template>
  <p v-if="!contract" class="muted">你身上沒有契約印記。</p>
  <template v-else-if="bound">
    <p class="mark pre"><GameIcon name="lock" :size="14" /> {{ contract.summary }}</p>
    <p v-if="homeLine" class="small muted"><GameIcon name="building" :size="13" /> {{ homeLine }}<template v-if="strict">（嚴加看管 {{ strict }} 點：出門與出城的 DC +{{ strict }}）</template></p>
    <p v-if="atHome" class="small muted">
      {{ mayLeave ? `${contract.masterName}今天同意你出門。` : houseRefused ? `${contract.masterName}今天不准你出門。` : `要走出大門，先請求${contract.masterName}同意（${attrName(slaveryRules.master_home.leave.attr)}檢定，參考 DC ${leaveDc(s)}）。` }}
    </p>
    <p v-if="inTown" class="small muted">
      {{ permitted ? `${contract.masterName}今天同意你出城。` : refused ? `${contract.masterName}今天不准你離開這座城。` : `出城或旅行前要先請求${contract.masterName}同意（${attrName(slaveryRules.master_permit.attr)}檢定，印記越重越難）。` }}
    </p>
    <textarea v-model="text" rows="3" placeholder="描述你打算怎麼說服主人、用什麼理由請求出門或出城，或怎麼逃走" />
    <AbilityPicker v-model="use" />
    <div class="row actions">
      <button v-if="atHome && !mayLeave" :disabled="houseRefused || game.judging" @click="act('master_leave')">請求主人讓你出門</button>
      <button v-if="inTown && !permitted" :disabled="refused || game.judging" @click="act('master_permit')">請求主人同意出城</button>
      <button :disabled="!safe || game.judging" :title="safe ? '' : '要在旅店、安全房、神殿或主人的家才能談判'" @click="act('negotiate')">談判解除契約</button>
      <button class="danger" :disabled="game.judging" @click="act('escape')">逃離主人</button>
    </div>
    <p v-if="!safe" class="small muted">和主人談判要在安全的地方（旅店、安全房、神殿或主人的家）；逃離隨時都可以。</p>
  </template>
  <template v-else-if="enslaved">
    <p class="mark pre"><GameIcon name="lock" :size="14" /> {{ contract.summary }}</p>
    <p v-if="fugitive" class="small mark">
      你是逃亡奴隸：公會與神殿不接待你（解除印記除外），旅店加價{{ contract.def.functions.includes('tracking') ? `，每次休息都可能被${contract.masterName}找到` : '' }}。
    </p>
    <p v-else class="small muted">你沒有主人：印記還在，但沒有人牽著鏈子，行動不受限制。</p>
    <p v-if="whereabouts" class="small muted"><GameIcon name="compass" :size="13" /> {{ whereabouts }}</p>
    <textarea v-model="text" rows="3" placeholder="描述你的做法：怎麼向主人認錯或談條件、怎麼請人收下你，或怎麼撐過解除印記的痛" />
    <AbilityPicker v-model="use" />
    <div v-if="nearMaster" class="row actions">
      <button :disabled="game.judging" @click="act('master_return')">回到{{ contract.masterName }}身邊</button>
      <button :disabled="game.judging" @click="act('negotiate')">當面談判解除契約</button>
    </div>
    <div v-if="seekTargets.length" class="row actions">
      <select v-model="seekTarget">
        <option value="">投靠誰…</option>
        <option v-for="t in seekTargets" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <button :disabled="!seekTarget || game.judging" @click="act('seek_master', seekTarget)">投靠新主人（魅力）</button>
    </div>
    <ul v-if="offers.length" class="plain small offers">
      <li v-for="o in offers" :key="o.target">
        <strong>{{ o.name }}</strong><template v-if="o.helper">（{{ o.helper }}）</template>・{{ attrName(o.attr) }} DC {{ o.dc }}・{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}
        <button class="small" :disabled="game.judging || s.money_cc < o.fee_cc" @click="act('unmark', o.target)">解除印記</button>
        <br /><span class="muted">{{ o.desc }}</span>
      </li>
    </ul>
    <p v-else class="small muted">這裡沒有人能解除印記 <Hint text="要解除印記：到神殿（要有聲望，便宜）、王都與有黑市的城市的刻印師（很貴），或請身邊（或隊伍裡）的法師（契約解除，紋樣留下來變成普通刺青）。" /></p>
  </template>
</template>

<style scoped>
.mark { color: var(--accent-2); }
.pre { white-space: pre-line; }
textarea { width: 100%; margin: 8px 0 6px; }
.actions { gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.offers { display: grid; gap: 4px; margin: 8px 0; }
</style>
