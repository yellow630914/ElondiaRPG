<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEGREE_NAME, situationalTotal } from '@/engine/actions'
import { actionRules, ATTR_IDS, attrName, classEmoji, contractDef, raceEmoji, type Degree } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord, presentHere } from '@/engine/npcs'
import { isBound, isFugitive } from '@/engine/party'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import JudgeToggle from './JudgeToggle.vue'

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const pending = computed(() => s.value.pendingAction)
const aiOn = computed(() => settings.aiJudge && settings.ready())

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
const target = ref('')
// 對象：隊友，以及現在就在身邊的認識的人（同一個聚落、站在他平常待的設施上）
function label(id: string, name: string): string {
  const rec = s.value.party.find((m) => m.id === id) ?? npcRecord(s.value, id)
  return rec ? `${raceEmoji(rec.race)}${name}${classEmoji(rec.class)}` : name
}
const targets = computed(() => {
  const inParty = s.value.party.filter((m) => !m.isPlayer).map((m) => ({ id: m.id, name: label(m.id, m.name), note: '隊伍' }))
  const here = Object.values(s.value.relationships ?? {})
    .filter((r) => !inParty.some((p) => p.id === r.id) && presentHere(s.value, r.id))
    .map((r) => ({ id: r.id, name: label(r.id, r.name), note: '在這裡' }))
  return [...inParty, ...here]
})
// 換了地點，原本選的對象不在了就清掉
watch(targets, (list) => {
  if (target.value && !list.some((t) => t.id === target.value)) target.value = ''
})

function doFree() {
  void game.perform({ kind: 'free', text: text.value, ...(target.value ? { target: target.value } : {}) })
  text.value = ''
}

// ---- 奴隸身分 ----
const bound = computed(() => isBound(s.value))
const fugitive = computed(() => isFugitive(s.value))
const contract = computed(() => {
  const c = s.value.party.find((m) => m.isPlayer)?.contract
  return c ? { ...c, def: contractDef(c.kind) } : null
})
const freedomText = ref('')
function doFreedom(kind: 'negotiate' | 'escape') {
  void game.perform({ kind, text: freedomText.value })
  freedomText.value = ''
}
</script>

<template>
  <section v-if="pending" class="panel pending">
    <h3>🎲 {{ actionRules.kinds[pending.kind].name }}<template v-if="pending.targetName">（{{ pending.targetName }}）</template></h3>
    <p v-if="pending.text" class="small">「{{ pending.text }}」</p>
    <p v-if="pending.offer_cc !== undefined" class="small">出價：{{ formatMoney(pending.offer_cc) }}</p>
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
      <button class="primary" :disabled="game.judging || !settings.ready()" @click="game.judge(true)">
        {{ game.judging ? 'AI 判定中…' : 'AI 判定' }}
      </button>
      <button :disabled="game.judging" @click="game.judge(false)">依規則判定（{{ attrName(pending.attr) }}）</button>
    </div>
    <p v-if="!settings.ready()" class="small muted">尚未設定 AI 服務，只能依規則判定。</p>
  </section>

  <section v-else class="panel">
    <div class="row head">
      <h3>🎲 主動行動</h3>
      <JudgeToggle />
    </div>
    <template v-if="contract && bound">
      <p class="small mark">
        頸上的{{ contract.def.name }}：{{ contract.def.mark }}<br />
        <span class="muted">主人 {{ contract.masterName }}・服從懲罰 -{{ contract.obedience }}・{{ contract.def.side_effects.join('；') }}</span>
      </p>
      <textarea v-model="freedomText" rows="2" placeholder="描述你打算怎麼說服主人，或怎麼逃走" />
      <div class="row">
        <button class="small" @click="doFreedom('negotiate')">談判解除契約</button>
        <button class="small danger" @click="doFreedom('escape')">逃離主人</button>
      </div>
      <hr />
    </template>
    <p v-else-if="contract && fugitive" class="small mark">
      你是逃亡奴隸：頸上的{{ contract.def.name }}仍在。公會與神殿不接待你，旅店加價，每次休息都可能被{{ contract.masterName }}找到。
    </p>
    <p class="small muted">
      用文字描述主角要做的事（交談、說服、威嚇、送禮、打聽消息……）。先擲骰，{{ aiOn ? '再把骰值與完整資料交給 AI，由 AI 決定成敗並寫出經過' : '依規則判定（骰值對參考 DC）' }}。
    </p>
    <div class="row">
      <select v-model="target">
        <option value="">（沒有特定對象）</option>
        <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.name }}・{{ t.note }}</option>
      </select>
    </div>
    <textarea v-model="text" rows="2" placeholder="例如：買一份甜點給莉娜，順便問她怕水的原因" />
    <button class="small primary" :disabled="!text.trim() || game.judging" @click="doFree">行動</button>
  </section>
</template>

<style scoped>
.pending { border-color: var(--accent); }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.dice { color: var(--accent); font-size: 1.2rem; }
.totals { gap: 12px; }
.totals .def { color: var(--accent); }
.outcomes { margin: 6px 0; display: grid; gap: 2px; }
textarea { width: 100%; margin: 6px 0; }
.mark { color: var(--accent-2); }
hr { border: none; border-top: 1px dashed var(--border); margin: 10px 0; }
</style>
