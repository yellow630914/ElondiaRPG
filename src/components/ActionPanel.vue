<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEGREE_NAME, situationalTotal } from '@/engine/actions'
import { actionRules, ATTR_IDS, attrName, classEmoji, contractDef, raceEmoji, slaveryRules, type Degree } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { npcTitle } from '@/engine/npcs'
import { isHostile, peopleHere } from '@/engine/population'
import { isBound, isEnslaved, isFugitive } from '@/engine/party'
import {
  atSafeSpot, contractTerms, markSummary, masterAllows, masterNearby, masterRefusedToday, masterWhereabouts, seekMasterDc, unmarkOffers,
} from '@/engine/slavery'
import { currentArea } from '@/engine/grid'
import { atMasterHome, houseRefusedToday, leaveDc, masterHomeSummary, mayLeaveHouse, strictPoints } from '@/engine/masterHome'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import { useSettings } from '@/stores/settings'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { eventDialogOpen } from './events/eventQueue'
import { contractOf } from '@/engine/tattoos'

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const pending = computed(() => s.value.pendingAction)
const aiOn = computed(() => settings.aiJudge && settings.ready('judge'))

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

// ---- 等待判定的行動 ----
const DEGREES = Object.keys(DEGREE_NAME) as Degree[]
const totals = computed(() => {
  const p = pending.value
  if (!p) return []
  const sit = situationalTotal(p)
  return ATTR_IDS.map((a) => ({ attr: a, total: p.natural + p.modifiers[a] + sit, isDefault: a === p.attr }))
})

// ---- 自由行動 ----
const text = ref('')
// 對象：隊友，以及「這裡的人」（身邊的人可以選；同一區較遠的人要先走近）
const target = computed({ get: () => game.actionTarget, set: (v: string) => { game.actionTarget = v } })
function label(id: string, name: string): string {
  const rec = s.value.party.find((m) => m.id === id) ?? npcRecord(s.value, id)
  return rec ? `${raceEmoji(rec.race)}${name}${classEmoji(rec.class)}` : name
}
const partyTargets = computed(() => s.value.party.filter((m) => !m.isPlayer).map((m) => ({ id: m.id, name: label(m.id, m.name), note: '' })))
const people = computed(() => peopleHere(s.value).map((p) => ({
  id: p.rec.id, name: label(p.rec.id, p.rec.name), note: npcTitle(p.rec), near: p.dist <= 1, dist: p.dist,
})))
const nearTargets = computed(() => people.value.filter((p) => p.near))
const farTargets = computed(() => people.value.filter((p) => !p.near))
// 移動之後，原本選的對象不在身邊了就清掉
watch([partyTargets, nearTargets], ([party, near]) => {
  if (target.value && ![...party, ...near].some((t) => t.id === target.value)) target.value = ''
}, { immediate: true })

const use = ref('')
const freeBox = ref<HTMLTextAreaElement | null>(null)
/** 文字框隨內容長高（最多約 6 行） */
function grow(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`
}
function doFree() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'free', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  if (freeBox.value) freeBox.value.style.height = ''
  // 對象每次重選：不然下一個沒有對象的行動會被算在上一個人身上
  target.value = ''
}

// ---- 奴隸身分 ----
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
const freedomText = ref('')
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
// 請法師拆誓約印記（紋樣留下來變成普通刺青）
const oathOffers = computed(() => unmarkOffers(s.value).filter((o) => o.place))
const seekTarget = ref('')
const seekTargets = computed(() => {
  if (!enslaved.value || bound.value) return []
  return peopleHere(s.value)
    .filter((p) => p.dist <= 1 && p.rec.id !== contract.value?.master && !p.rec.tags?.includes('slave') && !isHostile(s.value, p.rec))
    .map((p) => ({ id: p.rec.id, name: `${label(p.rec.id, p.rec.name)}・${npcTitle(p.rec)}・DC ${seekMasterDc(s.value, p.rec)}${p.kind === 'commoner' ? '・不戰鬥' : ''}` }))
})
function doFreedom(kind: 'negotiate' | 'escape' | 'master_permit' | 'master_leave' | 'master_return' | 'seek_master' | 'unmark', target?: string) {
  const u = parseUse(use.value)
  void game.perform({ kind, text: freedomText.value, ...(target ? { target } : {}), ...(u ? { use: u } : {}) })
  freedomText.value = ''
  use.value = ''
}

// ---- 刻印 ----
const pendingMark = computed(() => s.value.pendingMark)
</script>

<template>
  <section v-if="pending" class="panel pending">
    <h3><GameIcon name="d20" :size="16" /> {{ actionRules.kinds[pending.kind].name }}<template v-if="pending.targetName">（{{ pending.targetName }}）</template></h3>
    <p v-if="pending.text" class="small">「{{ pending.text }}」</p>
    <p v-if="pending.offer_cc !== undefined" class="small">出價：{{ formatMoney(pending.offer_cc) }}</p>
    <p v-if="pending.item" class="small">禮物：{{ pending.item }}</p>
    <p class="small">
      自然骰 <strong class="dice">{{ pending.natural }}</strong>・參考 DC {{ pending.base_dc }}
      <span class="muted">（骰值是給 AI 的參考；AI 會依角色、關係與情勢決定結果，可能出乎預料）</span>
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
  </section>

  <section v-else-if="pendingMark" class="panel pending">
    <h3><GameIcon name="fire" :size="16" /> 刻下契約印記</h3>
    <p class="small">要先面對刻印，才能做別的事。</p>
    <button class="small primary" @click="eventDialogOpen = true"><GameIcon name="bell" :size="14" /> 開啟事件視窗</button>
  </section>

  <section v-else class="panel action-panel">
    <div class="row head">
      <h3><GameIcon name="d20" :size="16" />主動行動</h3>
      <JudgeToggle />
      <Hint :text="`用文字描述主角要做的事（交談、說服、威嚇、送禮、打聽消息……）。先擲骰，${aiOn ? '再把骰值與完整資料交給 AI，由 AI 決定成敗並寫出經過' : '依規則判定（骰值對參考 DC）'}。`" />
    </div>
    <template v-if="contract && bound">
      <p class="small mark pre"><GameIcon name="lock" :size="13" /> {{ contract.summary }}</p>
      <p v-if="homeLine" class="small muted"><GameIcon name="building" :size="13" /> {{ homeLine }}<template v-if="strict">（嚴加看管 {{ strict }} 點：出門與出城的 DC +{{ strict }}）</template></p>
      <p v-if="atHome" class="small muted">
        {{ mayLeave ? `${contract.masterName}今天同意你出門。` : houseRefused ? `${contract.masterName}今天不准你出門。` : `要走出大門，先請求${contract.masterName}同意（${attrName(slaveryRules.master_home.leave.attr)}檢定，參考 DC ${leaveDc(s)}）。` }}
      </p>
      <p v-if="inTown" class="small muted">
        {{ permitted ? `${contract.masterName}今天同意你出城。` : refused ? `${contract.masterName}今天不准你離開這座城。` : `出城或旅行前要先請求${contract.masterName}同意（${attrName(slaveryRules.master_permit.attr)}檢定，印記越重越難）。` }}
      </p>
      <textarea v-model="freedomText" rows="2" placeholder="描述你打算怎麼說服主人、用什麼理由請求出城，或怎麼逃走" />
      <AbilityPicker v-model="use" />
      <div class="row">
        <button v-if="atHome && !mayLeave" class="small" :disabled="houseRefused || game.judging" @click="doFreedom('master_leave')">請求主人讓你出門</button>
        <button v-if="inTown && !permitted" class="small" :disabled="refused || game.judging" @click="doFreedom('master_permit')">請求主人同意出城</button>
        <button class="small" :disabled="!safe || game.judging" :title="safe ? '' : '要在旅店、安全房、神殿或主人的家才能談判'" @click="doFreedom('negotiate')">談判解除契約</button>
        <button class="small danger" :disabled="game.judging" @click="doFreedom('escape')">逃離主人</button>
      </div>
      <p v-if="!safe" class="small muted">和主人談判要在安全的地方（旅店、安全房、神殿或主人的家）；逃離隨時都可以。</p>
      <hr />
    </template>
    <template v-else-if="contract && enslaved">
      <p class="small mark pre"><GameIcon name="lock" :size="13" /> {{ contract.summary }}</p>
      <p v-if="fugitive" class="small mark">
        你是逃亡奴隸：公會與神殿不接待你（解除印記除外），旅店加價{{ contract.def.functions.includes('tracking') ? `，每次休息都可能被${contract.masterName}找到` : '' }}。
      </p>
      <p v-else class="small muted">你沒有主人：印記還在，但沒有人牽著鏈子，行動不受限制。</p>
      <p v-if="whereabouts" class="small muted"><GameIcon name="compass" :size="13" /> {{ whereabouts }}</p>
      <textarea v-model="freedomText" rows="2" placeholder="描述你的做法：怎麼向主人認錯或談條件、怎麼請人收下你，或怎麼撐過解除印記的痛" />
      <AbilityPicker v-model="use" />
      <div v-if="nearMaster" class="row">
        <button class="small" :disabled="game.judging" @click="doFreedom('master_return')">回到{{ contract.masterName }}身邊</button>
        <button class="small" :disabled="game.judging" @click="doFreedom('negotiate')">當面談判解除契約</button>
      </div>
      <div v-if="seekTargets.length" class="row">
        <select v-model="seekTarget" class="small">
          <option value="">投靠誰…</option>
          <option v-for="t in seekTargets" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button class="small" :disabled="!seekTarget || game.judging" @click="doFreedom('seek_master', seekTarget)">投靠新主人（魅力）</button>
      </div>
      <ul v-if="offers.length" class="plain small offers">
        <li v-for="o in offers" :key="o.target">
          <strong>{{ o.name }}</strong><template v-if="o.helper">（{{ o.helper }}）</template>・{{ attrName(o.attr) }} DC {{ o.dc }}・{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}
          <button class="small" :disabled="game.judging || s.money_cc < o.fee_cc" @click="doFreedom('unmark', o.target)">解除印記</button>
          <br /><span class="muted">{{ o.desc }}</span>
        </li>
      </ul>
      <p v-else class="small muted">這裡沒有人能解除印記 <Hint text="要解除印記：到神殿（要有聲望，便宜）、王都與有黑市的城市的刻印師（很貴），或請身邊（或隊伍裡）的法師（契約解除，紋樣留下來變成普通刺青）。" /></p>
      <hr />
    </template>
    <template v-if="oathOffers.length">
      <ul class="plain small offers">
        <li v-for="o in oathOffers" :key="o.target">
          <strong>{{ o.name }}</strong>（{{ o.helper }}）・{{ attrName(o.attr) }} DC {{ o.dc }}・{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}
          <button class="small" :disabled="game.judging || s.money_cc < o.fee_cc" @click="doFreedom('unmark', o.target)">拆掉誓約</button>
          <br /><span class="muted">{{ o.desc }}</span>
        </li>
      </ul>
      <hr />
    </template>
    <div class="pick">
      <select v-model="target" title="對象">
        <option value="">（沒有特定對象）</option>
        <optgroup v-if="partyTargets.length" label="隊伍">
          <option v-for="t in partyTargets" :key="t.id" :value="t.id">{{ t.name }}</option>
        </optgroup>
        <optgroup v-if="nearTargets.length" label="身邊的人">
          <option v-for="t in nearTargets" :key="t.id" :value="t.id">{{ t.name }}・{{ t.note }}</option>
        </optgroup>
        <optgroup v-if="farTargets.length" label="這一區（要先走近）">
          <option v-for="t in farTargets" :key="t.id" :value="t.id" disabled>{{ t.name }}・{{ t.note }}・{{ t.dist }} 格</option>
        </optgroup>
      </select>
      <AbilityPicker v-model="use" />
    </div>
    <div class="send">
      <textarea ref="freeBox" v-model="text" class="free" rows="1" placeholder="例如：買一份甜點給莉娜，順便問她怕水的原因" @input="grow" />
      <button class="primary" :disabled="!text.trim() || game.judging" @click="doFree">行動</button>
    </div>
  </section>
</template>

<style scoped>
.pending { border-color: var(--accent); }
.action-panel { padding: 12px 14px; }
.head { gap: 8px; margin-bottom: 8px; }
.head h3 { margin: 0; display: flex; align-items: center; gap: 6px; flex: 1; }
.head h3 :deep(.game-icon) { color: var(--accent); }
.pick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.send { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: stretch; }
.send textarea.free { margin: 6px 0 0; min-height: 36px; resize: none; overflow-y: auto; }
.send button { margin-top: 6px; }
.dice { color: var(--accent); font-size: 1.2rem; }
.totals { gap: 12px; }
.totals .def { color: var(--accent); }
.outcomes { margin: 6px 0; display: grid; gap: 2px; }
textarea { width: 100%; margin: 6px 0; }
.mark { color: var(--accent-2); }
.pre { white-space: pre-line; }
.offers { display: grid; gap: 4px; margin: 6px 0; }
hr { border: none; border-top: 1px dashed var(--border); margin: 10px 0; }
</style>
