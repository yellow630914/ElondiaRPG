<script setup lang="ts">
// 奴隸契約（工具列「契約」）：主角身上有契約印記時，契約的內容、主人的家、出門與出城的請求、談判、逃離；
// 逃亡或沒有主人時：回到主人身邊、投靠新主人、解除印記。送出之後關掉對話框，回到主畫面看判定與經過。
import { computed, ref } from 'vue'
import { attrName, classEmoji, raceEmoji, slaveryRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord, npcTitle } from '@/engine/npcs'
import { isHostile } from '@/engine/population'
import { isBound, isEnslaved, isFugitive } from '@/engine/party'
import {
  atSafeSpot, contractTerms, masterAllows, masterNearby, masterRefusedToday, masterWhereabouts, seekMasterDc, unmarkOffers,
} from '@/engine/slavery'
import { atMasterHome, currentMasterHome, homeDeadline, householdOf, houseRefusedToday, leaveDc, mayLeaveHouse, strictPoints } from '@/engine/masterHome'
import { contractOf, placeName } from '@/engine/tattoos'
import { masterToolStatus, newMasterCandidates } from '@/engine/masterTool'
import { submissionDc } from '@/engine/companions'
import { locationById } from '@/engine/data'
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
  return c ? { ...c, def: contractTerms(c) } : null
})
const pct = (n: number) => `${Math.round(n * 100)}%`
/** 契約的條款，一列一項 */
const terms = computed(() => {
  const c = contract.value
  if (!c) return []
  const t = c.def
  // 順從（慾望指標）讓人更難離開主人
  const sub = submissionDc(s.value.party.find((m) => m.isPlayer)!)
  const subNote = sub ? `順從 +${sub}` : ''
  return [
    { k: '收益歸主人', v: pct(t.income_share), note: '工作、交易得到的錢' },
    { k: '談判解除', v: `DC ${t.negotiate_dc + sub}`, note: ['要在安全的地方', subNote].filter(Boolean).join('・') },
    { k: '逃離', v: `DC ${t.escape_dc + sub}`, note: subNote },
    { k: '出城', v: `DC ${t.exit_dc}`, note: '請求主人同意出城' },
    { k: '逃亡時被找到', v: pct(t.recapture_chance), note: '每次休息' },
    { k: '逃離反噬', v: `${pct(t.escape_hp_ratio)} 生命值`, note: '' },
    { k: '服從懲罰', v: `−${c.obedience}`, note: '對主人的檢定' },
    ...(t.spell_cap !== undefined ? [{ k: '魔力封印', v: `最多 ${t.spell_cap} 環`, note: '' }] : []),
  ]
})
// 主人的家：地點、家裡的人、離家期限
const home = computed(() => {
  if (!bound.value) return null
  const d = homeDeadline(s.value)
  const h = d?.home ?? currentMasterHome(s.value)
  if (!h) return null
  const people = householdOf(s.value, h).map((r) => `${r.occupation ?? ''}${r.name}`)
  const left = d ? Math.round((d.hoursLeft / 24) * 10) / 10 : 0
  const deadline = !d ? '' : d.atHome ? `在家裡；出門後允許離家約 ${d.days} 天` : left >= 0 ? `允許離家約 ${d.days} 天，還剩約 ${left} 天` : `已經超過期限約 ${-left} 天，主人隨時會要你回去`
  return { where: locationById(h.location).name, people, deadline, late: !!d && !d.atHome && left < 0 }
})
const safe = computed(() => atSafeSpot(s.value))
// 在聚落裡、主人今天還沒同意出城：可以請求
const inTown = computed(() => game.area.kind === 'settlement')
const permitted = computed(() => masterAllows(s.value))
const refused = computed(() => masterRefusedToday(s.value))
const text = ref('')
const use = ref('')
// 嚴加看管、出門要主人同意
const strict = computed(() => strictPoints(s.value))
const atHome = computed(() => atMasterHome(s.value))
const mayLeave = computed(() => mayLeaveHouse(s.value))
const houseRefused = computed(() => houseRefusedToday(s.value))
// 逃亡或無主：找到主人、投靠新主人、解除印記
const whereabouts = computed(() => masterWhereabouts(s.value))
const nearMaster = computed(() => masterNearby(s.value))
const offers = computed(() => unmarkOffers(s.value).filter((o) => !o.place))
const seekTarget = ref('')
// 主人是工具人：親密度夠高時直接解約、換主人（敘事上仍是主人的決定）
const tool = computed(() => (bound.value ? masterToolStatus(s.value) : null))
const transferTargets = computed(() => (tool.value?.ready ? newMasterCandidates(s.value) : []))
const transferTo = ref('')
function release() {
  void game.masterRelease()
  emit('close')
}
function transfer() {
  if (!transferTo.value) return
  void game.masterTransfer(transferTo.value)
  emit('close')
}
const seekTargets = computed(() => {
  if (!enslaved.value || bound.value) return []
  return game.here
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
  <template v-else>
    <div class="card">
      <div class="card-head">
        <GameIcon name="lock" :size="18" />
        <b class="name">{{ contract.def.name }}</b>
        <span class="tag">主人：{{ contract.masterName || '無主' }}</span>
        <span class="tag">{{ placeName(contract.def.place) }}</span>
      </div>
      <p class="mark-text">{{ contract.def.mark }}</p>
      <table class="kv terms">
        <tbody>
        <tr v-for="t in terms" :key="t.k"><th>{{ t.k }}</th><td class="v">{{ t.v }}</td><td class="note muted">{{ t.note }}</td></tr>
        </tbody>
      </table>
      <template v-if="contract.def.side_effects.length">
        <div class="sub">副作用</div>
        <ul class="effects">
          <li v-for="e in contract.def.side_effects" :key="e">{{ e }}</li>
        </ul>
      </template>
    </div>
    <template v-if="bound">
      <h4><GameIcon name="building" :size="14" /> {{ contract.masterName }}的家</h4>
      <table v-if="home" class="kv">
        <tbody>
        <tr><th>地點</th><td>{{ home.where }}</td></tr>
        <tr v-if="home.people.length"><th>家裡還有</th><td>{{ home.people.join('、') }}</td></tr>
        <tr v-if="home.deadline"><th>離家期限</th><td :class="{ warn: home.late }">{{ home.deadline }}</td></tr>
        <tr v-if="strict"><th>嚴加看管</th><td>{{ strict }} 點（出門與出城的 DC +{{ strict }}）</td></tr>
        </tbody>
      </table>
      <p v-else class="small muted">主人沒有自己的家，你跟著他走。</p>
      <h4><GameIcon name="door" :size="14" /> 今天的許可</h4>
      <table class="kv">
        <tbody>
        <tr v-if="atHome"><th>出門</th><td :class="{ ok: mayLeave, warn: houseRefused }">{{ mayLeave ? '同意了' : houseRefused ? '今天不准' : `要先請求（${attrName(slaveryRules.master_home.leave.attr)}檢定，參考 DC ${leaveDc(s)}）` }}</td></tr>
        <tr v-if="inTown"><th>出城、旅行</th><td :class="{ ok: permitted, warn: refused }">{{ permitted ? '同意了，今天可以自由進出這座城' : refused ? '今天不准離開這座城' : `要先請求（${attrName(slaveryRules.master_permit.attr)}檢定，印記越重越難）` }}</td></tr>
        <tr v-if="!atHome && !inTown"><th>行動</th><td>跟著主人；談判要在安全的地方，逃離隨時都可以</td></tr>
        </tbody>
      </table>
      <template v-if="tool">
        <h4><GameIcon name="heart" :size="14" /> 和主人的關係 <Hint :text="`親密度 ${tool.need} 以上時，可以直接請主人解約，或請主人把你轉讓給附近一位熟人（親密度 40 以上、不是奴隸）。不用擲骰、不用付錢；故事裡仍然是主人做的決定。`" /></h4>
        <p v-if="!tool.ready" class="small muted">親密度 {{ tool.affinity }}／{{ tool.need }}：還不夠親近，只能談判或逃走。</p>
        <div v-else class="row actions">
          <button :disabled="game.judging" @click="release">請主人解除契約</button>
          <select v-model="transferTo" :disabled="!transferTargets.length">
            <option value="">{{ transferTargets.length ? '請主人把你轉讓給…' : '附近沒有可以轉讓的熟人' }}</option>
            <option v-for="t in transferTargets" :key="t.id" :value="t.id">{{ label(t.id, t.name) }}・{{ npcTitle(t) }}</option>
          </select>
          <button :disabled="!transferTo || game.judging" @click="transfer">換主人</button>
        </div>
      </template>
      <h4><GameIcon name="d20" :size="14" /> 你的做法</h4>
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
      <p v-if="fugitive" class="small mark">
        你是逃亡奴隸：公會與神殿不接待你（解除印記除外），旅店加價{{ contract.def.functions.includes('tracking') ? `，每次休息都可能被${contract.masterName}找到` : '' }}。
      </p>
      <p v-else class="small muted">你沒有主人：印記還在，但沒有人牽著鏈子，行動不受限制。</p>
      <p v-if="whereabouts" class="small muted"><GameIcon name="compass" :size="13" /> {{ whereabouts }}</p>
      <h4><GameIcon name="d20" :size="14" /> 你的做法</h4>
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
      <template v-if="offers.length">
        <h4><GameIcon name="unlock" :size="14" /> 解除印記</h4>
        <table class="offers">
          <tbody>
          <tr v-for="o in offers" :key="o.target">
            <td><b>{{ o.name }}</b><template v-if="o.helper">（{{ o.helper }}）</template><div class="muted">{{ o.desc }}</div></td>
            <td class="num">{{ attrName(o.attr) }} DC {{ o.dc }}</td>
            <td class="num">{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}</td>
            <td class="num"><button class="small" :disabled="game.judging || s.money_cc < o.fee_cc" @click="act('unmark', o.target)">解除印記</button></td>
          </tr>
          </tbody>
        </table>
      </template>
      <p v-else class="small muted">這裡沒有人能解除印記 <Hint text="要解除印記：到神殿（要有聲望，便宜）、王都與有黑市的城市的刻印師（很貴），或請身邊（或隊伍裡）的法師（契約解除，紋樣留下來變成普通刺青）。" /></p>
    </template>
  </template>
</template>

<style scoped>
.card { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; display: grid; gap: 6px; background: #00000008; }
.card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-head :deep(.game-icon) { color: var(--accent-2); }
.card-head .name { font-size: 1.05rem; color: var(--accent-2); }
.mark-text { margin: 0; font-family: var(--font-story); line-height: 1.8; }
.sub { font-size: var(--fs-xs); color: var(--muted); margin-top: 2px; }
.effects { margin: 0; padding-left: 1.2em; font-size: var(--fs-sm); }
h4 { display: flex; align-items: center; gap: 6px; margin: 14px 0 4px; font-size: 0.95rem; }
h4 :deep(.game-icon) { color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.kv th { text-align: left; font-weight: 600; white-space: nowrap; width: 1%; padding: 5px 14px 5px 0; color: var(--muted); vertical-align: top; }
.kv td { padding: 5px 8px 5px 0; vertical-align: top; }
.kv tr + tr > * { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.terms .v { white-space: nowrap; font-weight: 700; width: 1%; padding-right: 16px; }
.terms .note { font-size: var(--fs-xs); }
.ok { color: var(--good); }
.warn { color: var(--danger); }
.mark { color: var(--accent-2); }
.offers td { padding: 6px 8px 6px 0; border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); vertical-align: top; }
.offers .num { white-space: nowrap; text-align: right; width: 1%; }
textarea { width: 100%; margin: 0 0 6px; }
.actions { gap: 6px; flex-wrap: wrap; margin-top: 8px; }
</style>
