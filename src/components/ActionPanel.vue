<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { actionRules, attrName, classEmoji, raceEmoji } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { npcTitle } from '@/engine/npcs'
import { unmarkOffers } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import { useSettings } from '@/stores/settings'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { isMobile, OPEN_ACTION_EVENT } from './mobile/mobile'

// 冒險日誌底部的主動行動橫條。擲完骰等待判定的行動、要先面對的刻印顯示在日誌最下面（PendingActionCard），
// 那段時間這裡不能送出新的行動。
// 手機版平常收成一行「主動行動：想做什麼…」，點了才展開（docs/MOBILE_UI.md 1.3 節）。

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const aiOn = computed(() => settings.judgesWithAi())
/** 有行動等待判定、正在判定，或要先刻印 */
const busy = computed(() => !!s.value.pendingAction || !!s.value.pendingMark || game.judging)

// ---- 自由行動 ----
const text = ref('')
// 對象：隊友，以及「這裡的人」（身邊的人可以選；同一區較遠的人要先走近）。
// 最多 max_targets 人：第一位是主要對象（入隊、換主人只看他），其他是同行的對象
const targets = computed({ get: () => game.actionTargets, set: (v: string[]) => { game.actionTargets = v } })
const maxTargets = actionRules.kinds.free.max_targets ?? 1
const pick = ref('')
function addTarget() {
  if (pick.value && !targets.value.includes(pick.value) && targets.value.length < maxTargets) targets.value = [...targets.value, pick.value]
  pick.value = ''
}
const removeTarget = (id: string) => { targets.value = targets.value.filter((x) => x !== id) }
const makePrimary = (id: string) => { targets.value = [id, ...targets.value.filter((x) => x !== id)] }
const TARGETS_HINT = `最多 ${maxTargets} 人。第一位是主要對象：入隊、換主人、解除契約只看他；點其他人的名字可以改成主要對象。
參考 DC 取最難的那位，每多一人 +${actionRules.kinds.free.extra_target_dc ?? 0}。每個人都可能有親密度變化。`
function label(id: string, name: string): string {
  const rec = s.value.party.find((m) => m.id === id) ?? npcRecord(s.value, id)
  return rec ? `${raceEmoji(rec.race)}${name}${classEmoji(rec.class)}` : name
}
const partyTargets = computed(() => s.value.party.filter((m) => !m.isPlayer).map((m) => ({ id: m.id, name: label(m.id, m.name), note: '' })))
const people = computed(() => game.here.map((p) => ({
  id: p.rec.id, name: label(p.rec.id, p.rec.name), note: npcTitle(p.rec), near: p.dist <= 1, dist: p.dist,
})))
const nearTargets = computed(() => people.value.filter((p) => p.near))
const farTargets = computed(() => people.value.filter((p) => !p.near))
const nameOf = (id: string) => [...partyTargets.value, ...people.value].find((t) => t.id === id)?.name ?? id
// 移動之後，原本選的對象不在身邊了就移掉
watch([partyTargets, nearTargets], ([party, near]) => {
  const here = targets.value.filter((id) => [...party, ...near].some((t) => t.id === id))
  if (here.length !== targets.value.length) targets.value = here
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
// ---- 手機版：收起與展開 ----
const expanded = ref(false)
const folded = computed(() => isMobile.value && !expanded.value)
async function expand() {
  expanded.value = true
  await nextTick()
  freeBox.value?.focus()
}
const onOpenAction = () => { void expand() }
window.addEventListener(OPEN_ACTION_EVENT, onOpenAction)
onBeforeUnmount(() => window.removeEventListener(OPEN_ACTION_EVENT, onOpenAction))

function doFree() {
  const u = parseUse(use.value)
  const [first, ...rest] = targets.value
  void game.perform({ kind: 'free', text: text.value, ...(first ? { target: first } : {}), ...(rest.length ? { with: rest } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  if (freeBox.value) freeBox.value.style.height = freeBox.value.style.overflowY = ''
  // 對象每次重選：不然下一個沒有對象的行動會被算在上一個人身上
  targets.value = []
  // 手機版送出後收起（鍵盤跟著收起）
  if (isMobile.value) {
    freeBox.value?.blur()
    expanded.value = false
  }
}

// ---- 請法師拆誓約印記（紋樣留下來變成普通刺青）；奴隸契約在工具列的「契約」（ContractDialog） ----
const oathOffers = computed(() => unmarkOffers(s.value).filter((o) => o.place))
function unmark(target: string) {
  const u = parseUse(use.value)
  void game.perform({ kind: 'unmark', text: '', target, ...(u ? { use: u } : {}) })
  use.value = ''
}
</script>

<template>
  <section v-if="folded" class="action-bar folded">
    <button type="button" class="open" :disabled="busy" @click="expand">
      <GameIcon name="d20" :size="16" />
      <span>{{ busy ? '先在日誌裡完成等待判定的行動' : '主動行動：想做什麼…' }}</span>
      <span v-if="targets.length" class="who">對象 {{ targets.map(nameOf).join('、') }}</span>
    </button>
  </section>
  <section v-else class="action-bar">
    <ul v-if="oathOffers.length" class="plain small offers">
      <li v-for="o in oathOffers" :key="o.target">
        <strong>{{ o.name }}</strong>（{{ o.helper }}）・{{ attrName(o.attr) }} DC {{ o.dc }}・{{ o.fee_cc ? formatMoney(o.fee_cc) : '免費' }}
        <button class="small" :disabled="busy || s.money_cc < o.fee_cc" @click="unmark(o.target)">拆掉誓約</button>
        <span class="muted">{{ o.desc }}</span>
      </li>
    </ul>
    <div class="action-row">
      <h3>
        <GameIcon name="d20" :size="16" />主動行動
        <Hint :text="`用文字描述主角要做的事（交談、說服、威嚇、送禮、打聽消息……）。先擲骰，${aiOn ? '再把骰值與完整資料交給 AI，由 AI 決定成敗並寫出經過' : '依規則判定（骰值對參考 DC）'}。`" />
      </h3>
      <JudgeToggle />
      <button v-if="isMobile" type="button" class="ghost small fold" aria-label="收起主動行動" @click="expanded = false"><GameIcon name="down" :size="14" /></button>
      <select v-model="pick" class="target" title="對象" :disabled="targets.length >= maxTargets" @change="addTarget">
        <option value="">{{ !targets.length ? '（沒有特定對象）' : targets.length >= maxTargets ? `已選 ${maxTargets} 人` : '＋ 再加一位對象' }}</option>
        <optgroup v-if="partyTargets.length" label="隊伍">
          <option v-for="t in partyTargets" :key="t.id" :value="t.id" :disabled="targets.includes(t.id)">{{ t.name }}</option>
        </optgroup>
        <optgroup v-if="nearTargets.length" label="身邊的人">
          <option v-for="t in nearTargets" :key="t.id" :value="t.id" :disabled="targets.includes(t.id)">{{ t.name }}・{{ t.note }}</option>
        </optgroup>
        <optgroup v-if="farTargets.length" label="這一區（要先走近）">
          <option v-for="t in farTargets" :key="t.id" :value="t.id" disabled>{{ t.name }}・{{ t.note }}・{{ t.dist }} 格</option>
        </optgroup>
      </select>
      <AbilityPicker v-model="use" class="ability" />
      <div class="send">
        <textarea
          ref="freeBox" v-model="text" class="free" rows="1"
          :placeholder="busy ? '先在日誌裡完成等待判定的行動' : '例如：買一份甜點給莉娜，順便問她怕水的原因'"
          @input="grow"
        />
        <button class="primary" :disabled="!text.trim() || busy" @click="doFree">行動</button>
      </div>
    </div>
    <div v-if="targets.length" class="chips">
      <span v-for="(id, i) in targets" :key="id" class="chip" :class="{ main: i === 0 }">
        <span v-if="i === 0" class="main-tag">主要</span>
        <button class="name" type="button" :disabled="i === 0" :title="i === 0 ? '主要對象' : '改成主要對象'" @click="makePrimary(id)">{{ nameOf(id) }}</button>
        <button class="x" type="button" :aria-label="`移掉${nameOf(id)}`" @click="removeTarget(id)">×</button>
      </span>
      <Hint :text="TARGETS_HINT" :width="300" />
    </div>
  </section>
</template>

<style scoped>
/* 手機版收起時：一行像輸入框的按鈕 */
.folded .open {
  width: 100%; min-height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 12px; text-align: left;
  border: 1px solid var(--border); border-radius: 20px; background: var(--input-bg); box-shadow: none; color: var(--muted); font-size: var(--fs-sm);
}
.folded .open :deep(.game-icon) { color: var(--accent); flex: none; }
.folded .who { margin-left: auto; color: var(--accent); font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fold { margin-left: auto; }
/* 日誌底部的一條：標題、AI 開關、對象、能力、文字框與送出排成一排；放不下時文字框連同送出鈕換到下一行 */
.action-bar { border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }
.action-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.action-row h3 { margin: 0; display: flex; align-items: center; gap: 6px; font-size: var(--fs-md); white-space: nowrap; }
.action-row h3 :deep(.game-icon) { color: var(--accent); }
.action-row .target, .action-row .ability { flex: 0 1 140px; }
.send { flex: 1 1 300px; display: flex; gap: 6px; align-items: flex-end; }
.send textarea.free { flex: 1; margin: 0; min-height: 36px; resize: none; overflow-y: hidden; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 6px; }
.chip { display: inline-flex; align-items: center; gap: 2px; padding: 1px 2px 1px 6px; border: 1px solid var(--border); border-radius: 3px; font-size: var(--fs-sm); background: #0003; }
.chip.main { border-color: var(--accent); }
.chip .main-tag { font-size: var(--fs-xs); color: var(--accent); margin-right: 2px; }
.chip button { background: none; border: 0; padding: 0 3px; color: inherit; font: inherit; cursor: pointer; min-height: 0; }
.chip button.name:disabled { cursor: default; opacity: 1; }
.chip .x { color: var(--muted); }
.chip .x:hover { color: var(--danger); }
.offers { display: grid; gap: 4px; margin: 0 0 8px; }
</style>
