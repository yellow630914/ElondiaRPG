<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEGREE_NAME, situationalTotal } from '@/engine/actions'
import { actionRules, ATTR_IDS, attrName, classEmoji, raceEmoji, type Degree } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { npcTitle } from '@/engine/npcs'
import { peopleHere } from '@/engine/population'
import { unmarkOffers } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import { useSettings } from '@/stores/settings'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { eventDialogOpen } from './events/eventQueue'

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const pending = computed(() => s.value.pendingAction)
const aiOn = computed(() => settings.judgesWithAi())

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
  // 長到上限之前不顯示捲軸
  el.style.overflowY = el.scrollHeight + 2 > 160 ? 'auto' : 'hidden'
}
function doFree() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'free', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  if (freeBox.value) freeBox.value.style.height = freeBox.value.style.overflowY = ''
  // 對象每次重選：不然下一個沒有對象的行動會被算在上一個人身上
  target.value = ''
}

// ---- 請法師拆誓約印記（紋樣留下來變成普通刺青）；奴隸契約在工具列的「契約」（ContractDialog） ----
const oathOffers = computed(() => unmarkOffers(s.value).filter((o) => o.place))
function unmark(target: string) {
  const u = parseUse(use.value)
  void game.perform({ kind: 'unmark', text: '', target, ...(u ? { use: u } : {}) })
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
    <template v-if="oathOffers.length">
      <ul class="plain small offers">
        <li v-for="o in oathOffers" :key="o.target">
          <strong>{{ o.name }}</strong>（{{ o.helper }}）・{{ attrName(o.attr) }} DC {{ o.dc }}・{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}
          <button class="small" :disabled="game.judging || s.money_cc < o.fee_cc" @click="unmark(o.target)">拆掉誓約</button>
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
.send textarea.free { margin: 6px 0 0; min-height: 36px; resize: none; overflow-y: hidden; }
.send button { margin-top: 6px; }
.dice { color: var(--accent); font-size: 1.2rem; }
.totals { gap: 12px; }
.totals .def { color: var(--accent); }
.outcomes { margin: 6px 0; display: grid; gap: 2px; }
.offers { display: grid; gap: 4px; margin: 6px 0; }
hr { border: none; border-top: 1px dashed var(--border); margin: 10px 0; }
</style>
