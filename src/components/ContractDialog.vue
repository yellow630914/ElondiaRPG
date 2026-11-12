<script setup lang="ts">
// 奴隸契約（工具列「契約」）：主角身上有契約印記時，契約的內容、主人的家、出門與出城的請求、談判、逃離；
// 逃亡或沒有主人時：回到主人身邊、投靠新主人、解除印記。送出之後關掉對話框，回到主畫面看判定與經過。
import { computed, ref } from 'vue'
import { attrName, classEmoji, MASTER_ASK_GROUPS, raceEmoji, slaveryRules, tagDef, type MasterAskGroup } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord, npcTitle } from '@/engine/npcs'
import { isHostile } from '@/engine/population'
import { isBound, isEnslaved, isFugitive } from '@/engine/party'
import {
  askableEvents, askMasterBlocked, atSafeSpot, contractTerms, masterAllows, masterNearby, masterRefusedToday, masterWhereabouts, seekMasterDc, unmarkOffers,
} from '@/engine/slavery'
import {
  allowedDays, atMasterHome, currentMasterHome, extendRefusedToday, homeDeadline, householdOf, houseRefusedToday, leaveDc, mayExtend, mayLeaveHouse, permitWindow, strictPoints,
} from '@/engine/masterHome'
import { contractOf, placeName } from '@/engine/tattoos'
import { masterToolStatus, newMasterCandidates } from '@/engine/masterTool'
import { submissionDc } from '@/engine/companions'
import { locationById } from '@/engine/data'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import BondStylePicker from './BondStylePicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import type { IconName } from './ui/iconPaths'

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
// 契約細節（條款與副作用）預設摺起來；摘要列出最重要的幾個數字
const detailsOpen = ref(false)
const summary = computed(() => terms.value.filter((t) => ['收益歸主人', '談判解除', '逃離', '服從懲罰'].includes(t.k)).map((t) => ({ k: t.k.replace('歸主人', '').replace('解除', ''), v: t.v })))
// 主人的家：地點、家裡的人、離家期限
const home = computed(() => {
  if (!bound.value) return null
  const d = homeDeadline(s.value)
  const h = d?.home ?? currentMasterHome(s.value)
  if (!h) return null
  const people = householdOf(s.value, h).map((r) => `${r.occupation ?? ''}${r.name}`)
  const left = d ? Math.round((d.hoursLeft / 24) * 10) / 10 : 0
  return { where: locationById(h.location).name, people, days: d?.days ?? 0, left, atHome: !!d?.atHome, late: !!d && !d.atHome && left < 0 }
})
// 主人：名字、身分標籤、親密度（工具人的門檻）
const master = computed(() => {
  const c = contract.value
  if (!c?.master) return null
  const rec = npcRecord(s.value, c.master)
  const tags = (rec?.tags ?? []).map((t) => tagDef(t)?.name).filter((x): x is string => !!x).slice(0, 3)
  const affinity = s.value.relationships?.[c.master]?.affinity ?? 0
  return { name: c.masterName, initial: (c.masterName || '？').slice(0, 1), tags, affinity }
})
/** 親密度在 -100～100 的條上的位置（%） */
const affPos = (n: number) => `${Math.max(0, Math.min(100, (n + 100) / 2))}%`
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
const extendRefused = computed(() => extendRefusedToday(s.value))
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

// 主人的許可：一格一項（出門、出城、期限、看管），狀態 ok／ask／no／na。出門、出城共用一個期限，回家、回城不會重新算
type PermitAct = 'master_leave' | 'master_permit' | 'master_extend'
interface Permit { id: string; icon: IconName; label: string; hint: string; state: 'ok' | 'ask' | 'no' | 'na'; status: string; meter?: number; act?: PermitAct; btn?: string }
const window_ = computed(() => (bound.value ? permitWindow(s.value) : undefined))
const daysText = (hours: number) => `${Math.round((hours / 24) * 10) / 10} 天`
const leftText = computed(() => (window_.value && window_.value.hoursLeft > 0 ? `還剩 ${daysText(window_.value.hoursLeft)}` : '同意了'))
const extendable = computed(() => mayExtend(s.value))
const permits = computed<Permit[]>(() => {
  const out: Permit[] = []
  const leaveAttr = attrName(slaveryRules.master_home.leave.attr)
  const days = allowedDays(s.value)
  out.push(atHome.value
    ? { id: 'leave', icon: 'door', label: '出門', hint: `在主人的家裡時，出門要先請主人同意（${leaveAttr}檢定，參考 DC ${leaveDc(s.value)}）。同意之後 ${days} 天內可以自由出入（部分成功只有一半），回家不會重新算。`, state: mayLeave.value ? 'ok' : houseRefused.value ? 'no' : 'ask', status: mayLeave.value ? leftText.value : houseRefused.value ? '今天不准' : '要先請求', ...(mayLeave.value || houseRefused.value ? {} : { act: 'master_leave' as const }) }
    : { id: 'leave', icon: 'door', label: '出門', hint: '在主人的家裡時，出門要先請主人同意。', state: 'na', status: '不在家裡' })
  const exitDc = contract.value?.def.exit_dc
  out.push(inTown.value
    ? { id: 'exit', icon: 'road', label: '出城', hint: `要離開城市（近郊、旅行），要先請主人同意：${attrName(slaveryRules.master_permit.attr)}檢定${exitDc ? `，參考 DC ${exitDc}` : ''}，印記越重越難。同意之後 ${days} 天內可以自由出入任何城市（部分成功只有一半），回城不會重新算；也順帶延長出門的期限。`, state: permitted.value ? 'ok' : refused.value ? 'no' : 'ask', status: permitted.value ? leftText.value : refused.value ? '今天不准' : '要先請求', ...(permitted.value || refused.value ? {} : { act: 'master_permit' as const }) }
    : { id: 'exit', icon: 'road', label: '出城', hint: '在城裡時，離開城市要先請主人同意。現在跟著主人走：談判要在安全的地方，逃離隨時都可以。', state: 'na', status: '不在城裡' })
  const h = home.value
  const w = window_.value
  const hint = `${h ? `${contract.value?.masterName}的家在${h.where}；` : ''}主人准的出門、出城共用這個期限（允許離家約 ${days} 天）。剩不到 1/4 時可以申請延長（檢定照出城）${h ? '；人在外面逾期，主人隨時會要你回去' : ''}。`
  const ext = extendable.value ? { act: 'master_extend' as const, btn: '延長' } : {}
  if (!w) out.push({ id: 'home', icon: 'hourglass', label: '期限', hint, state: 'na', status: h?.atHome ? '在家裡' : '還沒有許可' })
  else if (w.hoursLeft <= 0) out.push(h && !h.atHome
    ? { id: 'home', icon: 'hourglass', label: '期限', hint, state: 'no', status: `逾期 ${daysText(-w.hoursLeft)}`, meter: 0, ...ext }
    : { id: 'home', icon: 'hourglass', label: '期限', hint, state: 'na', status: '已到期', meter: 0 })
  else out.push({ id: 'home', icon: 'hourglass', label: '期限', hint, state: extendable.value || extendRefused.value ? 'no' : 'ok', status: `還剩 ${daysText(w.hoursLeft)}${extendRefused.value ? '・今天不准延長' : ''}`, meter: w.hours ? w.hoursLeft / w.hours : 1, ...ext })
  out.push({ id: 'strict', icon: 'eye', label: '看管', hint: '嚴加看管的點數會讓出門、出城與延長的 DC 提高；犯錯、逃跑被抓回來會增加。', state: strict.value ? 'no' : 'ok', status: strict.value ? `嚴加看管 +${strict.value}` : '寬鬆' })
  return out
})

// 找主人做點什麼（每天一次；slavery.ts 的 askableEvents）
const askBlock = computed(() => askMasterBlocked(s.value))
const askList = computed(() => (bound.value ? askableEvents(s.value) : []))
const askGroup = ref<MasterAskGroup | ''>('')
const askShown = computed(() => askList.value.filter((o) => !askGroup.value || o.group === askGroup.value).sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked)))
const GROUP_ICON: Record<MasterAskGroup, IconName> = { serve: 'tools', close: 'heart', discipline: 'link' }
function ask(id: string) {
  void game.askMaster(id)
  emit('close')
}

function act(kind: 'negotiate' | 'escape' | PermitAct | 'master_return' | 'seek_master' | 'unmark', target?: string) {
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
        <span class="tag">{{ placeName(contract.def.place) }}</span>
        <span v-if="!bound" class="tag">主人：{{ contract.masterName || '無主' }}</span>
      </div>
      <p class="mark-text">{{ contract.def.mark }}</p>
      <details class="fold" :open="detailsOpen" @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open">
        <summary>
          <b>契約細節</b>
          <span v-for="x in summary" :key="x.k" class="chip">{{ x.k }} <b>{{ x.v }}</b></span>
        </summary>
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
      </details>
    </div>
    <template v-if="bound">
      <h4><GameIcon name="heart" :size="14" /> 主人與今天的許可</h4>
      <div class="card">
        <div v-if="master" class="master">
          <div class="avatar" aria-hidden="true">{{ master.initial }}</div>
          <div class="who">
            <div class="mname">{{ master.name }}<span v-for="t in master.tags" :key="t" class="tag">{{ t }}</span></div>
            <div class="aff">
              <div class="bar" role="img" :aria-label="`親密度 ${master.affinity}`">
                <span v-if="tool" class="tick" :style="{ left: affPos(tool.need) }" />
                <span class="pin" :style="{ left: affPos(master.affinity) }" />
              </div>
              <div class="legend small">
                <span class="muted">−100</span>
                <span>親密度 <b>{{ master.affinity }}</b>
                  <Hint v-if="tool" :text="`親密度 ${tool.need} 以上時，可以直接請主人解約，或請主人把你轉讓給附近一位熟人（親密度 40 以上、不是奴隸）。不用擲骰、不用付錢；故事裡仍然是主人做的決定。對主人的檢定受契約的服從懲罰 −${contract.obedience}。`" />
                </span>
                <span class="muted">100</span>
              </div>
              <div v-if="tool" class="small need" :class="{ ok: tool.ready }">{{ tool.ready ? '夠親近了：可以請主人解約或轉讓' : `${tool.need} 以上可以請主人解約` }}</div>
            </div>
          </div>
        </div>
        <div class="permits">
          <div v-for="p in permits" :key="p.id" class="permit" :class="p.state">
            <GameIcon :name="p.icon" :size="24" />
            <span class="lbl">{{ p.label }} <Hint :text="p.hint" /></span>
            <span class="st">{{ p.status }}</span>
            <span v-if="p.meter !== undefined" class="meter"><i :style="{ width: `${Math.max(0, Math.min(1, p.meter)) * 100}%` }" /></span>
            <button v-if="p.act" class="small primary" :disabled="game.judging" @click="act(p.act)">{{ p.btn ?? '請求' }}</button>
          </div>
        </div>
        <div v-if="home" class="home-line small muted">
          <GameIcon name="home" :size="14" />{{ contract.masterName }}的家・{{ home.where }}<template v-if="home.people.length">・家裡還有 {{ home.people.length }} 人 <Hint :text="home.people.join('、')" /></template>
        </div>
        <details v-if="permits.some((p) => p.act)" class="how small">
          <summary>附上說服主人的做法（選填）</summary>
          <textarea v-model="text" rows="2" placeholder="描述你打算用什麼理由請求出門、出城或延長" />
          <AbilityPicker v-model="use" />
        </details>
        <div v-if="tool?.ready" class="row actions">
          <button :disabled="game.judging" @click="release">請主人解除契約</button>
          <select v-model="transferTo" :disabled="!transferTargets.length">
            <option value="">{{ transferTargets.length ? '請主人把你轉讓給…' : '附近沒有可以轉讓的熟人' }}</option>
            <option v-for="t in transferTargets" :key="t.id" :value="t.id">{{ label(t.id, t.name) }}・{{ npcTitle(t) }}</option>
          </select>
          <button :disabled="!transferTo || game.judging" @click="transfer">換主人</button>
        </div>
      </div>

      <BondStylePicker v-if="contract.master" :npc="contract.master" :name="contract.masterName" @done="emit('close')" />

      <h4>
        <GameIcon name="link" :size="14" /> 找主人做點什麼
        <Hint text="主動去找主人，觸發一件主奴事件：和走路時主人突然提出的事一樣，從三個選項挑一個或自己描述怎麼回應。每天最多主動找一次；主人的身分決定有哪些事可以找，親密度不夠或不在主人家裡的會寫原因。" />
        <span class="ask-state small" :class="{ muted: !askBlock }">{{ askBlock ?? '今天還可以找 1 次' }}</span>
      </h4>
      <template v-if="askList.length">
        <div class="groups" role="tablist">
          <button role="tab" class="small" :class="{ on: !askGroup }" @click="askGroup = ''">全部</button>
          <button v-for="(n, g) in MASTER_ASK_GROUPS" :key="g" role="tab" class="small" :class="{ on: askGroup === g }" @click="askGroup = g">{{ n }}</button>
        </div>
        <div class="asks">
          <button
            v-for="o in askShown" :key="o.id" class="ask" :class="{ locked: !!o.blocked }"
            :disabled="!!o.blocked || !!askBlock || game.judging" :title="o.blocked ?? askBlock ?? ''" @click="ask(o.id)"
          >
            <span class="t"><GameIcon :name="o.blocked ? 'lock' : GROUP_ICON[o.group]" :size="14" />{{ o.name }}</span>
            <span class="d muted">{{ o.desc }}</span>
            <span v-if="o.blocked" class="why">{{ o.blocked }}</span>
            <span v-else class="meta"><span class="chip">{{ MASTER_ASK_GROUPS[o.group] }}</span><span v-if="o.adult" class="chip adult">成人向</span></span>
          </button>
        </div>
      </template>
      <p v-else class="small muted">主人現在沒有可以主動找他做的事。</p>

      <details class="box">
        <summary>
          <GameIcon name="unlock" :size="14" /> 談判解除、逃離
          <span class="muted small">談判 DC {{ contract.def.negotiate_dc }}{{ safe ? '' : '（要在安全的地方）' }}・逃離 DC {{ contract.def.escape_dc }}</span>
        </summary>
        <textarea v-model="text" rows="3" placeholder="描述你打算怎麼說服主人解除契約，或怎麼逃走" />
        <AbilityPicker v-model="use" />
        <div class="row actions">
          <button :disabled="!safe || game.judging" :title="safe ? '' : '要在旅店、安全房、神殿或主人的家才能談判'" @click="act('negotiate')">談判解除契約</button>
          <button class="danger" :disabled="game.judging" @click="act('escape')">逃離主人</button>
        </div>
        <p v-if="!safe" class="small muted">和主人談判要在安全的地方（旅店、安全房、神殿或主人的家）；逃離隨時都可以。</p>
      </details>
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
textarea { width: 100%; margin: 6px 0; }
/* 契約細節：摺起來時摘要列出最重要的數字 */
.fold { border-top: 1px dashed color-mix(in srgb, currentColor 20%, transparent); padding-top: 6px; }
.fold summary { cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: var(--fs-sm); }
.fold summary { list-style: none; }
.fold summary::-webkit-details-marker { display: none; }
.fold summary::before { content: '▸'; color: var(--accent); }
.fold[open] summary::before { content: '▾'; }
.fold[open] summary .chip { display: none; }
.chip { font-size: var(--fs-xs); padding: 1px 6px; border-radius: 3px; background: color-mix(in srgb, currentColor 8%, transparent); white-space: nowrap; }
.chip.adult { color: var(--danger); }
/* 主人：頭像、標籤、親密度條 */
.master { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.avatar { width: 48px; height: 48px; border-radius: 4px; display: grid; place-items: center; font-size: 1.4rem; font-weight: 800; background: #3b2a1a; color: #f0d083; border: 2px solid var(--accent); }
.mname { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 800; }
.aff .bar { position: relative; height: 10px; margin-top: 6px; border-radius: 5px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: linear-gradient(90deg, color-mix(in srgb, var(--danger) 35%, transparent) 0 50%, color-mix(in srgb, var(--good) 30%, transparent) 50% 100%); }
.aff .pin { position: absolute; top: -3px; width: 4px; height: 14px; margin-left: -2px; border-radius: 2px; background: currentColor; }
.aff .tick { position: absolute; top: -4px; width: 2px; height: 16px; margin-left: -1px; background: var(--accent-2); }
.aff .legend { display: flex; justify-content: space-between; align-items: center; margin-top: 3px; }
.aff .legend > span { display: inline-flex; align-items: center; gap: 4px; }
.need { color: var(--accent-2); }
/* 今天的許可：一格一項 */
.permits { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.permit { display: grid; justify-items: center; align-content: start; gap: 3px; padding: 7px 4px 6px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 4px; text-align: center; }
.permit .lbl { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; font-size: var(--fs-sm); }
.permit .st { font-size: var(--fs-xs); padding: 0 6px; border-radius: 3px; }
.permit.ok { border-color: color-mix(in srgb, var(--good) 55%, transparent); } .permit.ok > :deep(.game-icon) { color: var(--good); } .permit.ok .st { color: var(--good); background: color-mix(in srgb, var(--good) 14%, transparent); }
.permit.no { border-color: color-mix(in srgb, var(--danger) 55%, transparent); } .permit.no > :deep(.game-icon) { color: var(--danger); } .permit.no .st { color: var(--danger); background: color-mix(in srgb, var(--danger) 14%, transparent); }
.permit.ask { border-color: color-mix(in srgb, var(--accent) 60%, transparent); } .permit.ask > :deep(.game-icon) { color: var(--accent); } .permit.ask .st { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.permit.na { opacity: 0.5; }
.permit .meter { width: 80%; height: 4px; border-radius: 2px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
.permit .meter i { display: block; height: 100%; background: var(--good); }
.home-line { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.how { margin-top: 6px; }
.how summary, .box summary { cursor: pointer; }
/* 找主人做點什麼 */
.ask-state { margin-left: auto; font-weight: 400; color: var(--danger); }
.ask-state.muted { color: var(--muted); }
.groups { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.groups button { border-radius: 12px; }
.groups button.on { background: var(--accent-2); color: #fff; border-color: var(--accent-2); }
.asks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.ask { display: grid; gap: 2px; text-align: left; white-space: normal; padding: 7px 9px; height: auto; }
.ask .t { display: flex; align-items: center; gap: 6px; font-weight: 800; }
.ask .t :deep(.game-icon) { color: var(--accent-2); }
.ask .d { font-size: var(--fs-xs); line-height: 1.5; }
.ask .meta { display: flex; gap: 4px; flex-wrap: wrap; }
.ask .why { font-size: var(--fs-xs); color: var(--danger); }
.ask.locked { opacity: 0.55; }
.box { margin-top: 12px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: var(--radius); padding: 6px 10px; }
.box summary { display: flex; align-items: center; gap: 4px 6px; flex-wrap: wrap; font-weight: 700; }
.box summary .muted { font-weight: 400; }
@media (max-width: 560px) {
  .permits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .asks { grid-template-columns: minmax(0, 1fr); }
}
.actions { gap: 6px; flex-wrap: wrap; margin-top: 8px; }
</style>
