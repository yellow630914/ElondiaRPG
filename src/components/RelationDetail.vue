<script setup lang="ts">
// 人際關係的人物詳情（二級視窗）：左半邊是形象圖，右半邊是好感、所在、按鈕（勾選放在按鈕下面），
// 下面分成「概況」「共同記憶」「近況與性經歷」三個分頁。人際關係視窗的左邊列表點一個人時打開。
import { computed, reactive, ref, watch } from 'vue'
import { affinityStage } from '@/engine/character'
import { genderName, GENDER_IDS, locationName, raceName } from '@/engine/data'
import { formatTime } from '@/engine/state'
import { nameOf as npcName, type Memory } from '@/engine/social'
import { npcRecord, npcTitle } from '@/engine/npcs'
import { canPromote } from '@/engine/promoteNpc'
import { canLive, isFollowed, livingNpcs, newsOf, newsText } from '@/engine/npcLife'
import { genderSwapBlock } from '@/engine/genderSwap'
import { encounterText, sexRecordItems, sexRecordOf } from '@/engine/sexRecord'
import { useGame } from '@/stores/game'
import { useContent, VANILLA_NAME } from '@/stores/content'
import { useSettings } from '@/stores/settings'
import AppDialog from './AppDialog.vue'
import NameTag from './NameTag.vue'
import PortraitBox from './PortraitBox.vue'
import GameIcon from './ui/GameIcon.vue'

const props = defineProps<{ id: string | null; where: string }>()
const emit = defineEmits<{ close: [] }>()

const game = useGame()
const settings = useSettings()
const content = useContent()
const s = computed(() => game.state!)
const r = computed(() => (props.id ? s.value.relationships?.[props.id] : undefined))
const rec = computed(() => (props.id ? npcRecord(s.value, props.id) : undefined))
const member = computed(() => (props.id ? s.value.party.find((m) => m.id === props.id) : undefined))
const pcName = computed(() => s.value.party.find((m) => m.isPlayer)?.name ?? '主角')
const nameOf = (id: string) => npcName(s.value, id)

/** 名字旁邊的一行：職業或身分、等級、性別、種族 */
const identity = computed(() => {
  const m = member.value
  const x = rec.value
  const parts = [
    m ? `Lv.${m.level}` : x ? `${npcTitle(x)}${x.kind === 'adventurer' || x.level ? ` Lv.${x.level}` : ''}` : '',
    gender.value ? genderName(gender.value) : '',
    m?.race ? raceName(m.race) : x?.race ? raceName(x.race) : '',
  ]
  return parts.filter(Boolean).join('・')
})
const gender = computed(() => rec.value?.gender ?? '')
const swapped = computed(() => !!(props.id && s.value.npcs?.[props.id]?.genderSwap))

type Tab = 'info' | 'memories' | 'life'
const tab = ref<Tab>('info')
watch(() => props.id, () => {
  tab.value = 'info'
  editing.value = false
  swapping.value = false
  memLimit.value = 30
})

// ---- 按鈕與勾選 ----
const inParty = computed(() => !!props.id && s.value.party.some((m) => m.id === props.id))
const followable = computed(() => !!rec.value && !rec.value.dead && canLive(rec.value))
const followed = computed(() => !!props.id && isFollowed(s.value, props.id))
const living = computed(() => {
  void s.value.time.day
  void s.value.npcLife
  return !!props.id && livingNpcs(s.value).some((x) => x.id === props.id)
})
const pairable = computed(() => !!props.id && !!s.value.npcLife?.pairs?.includes(props.id))
const news = computed(() => (props.id ? [...newsOf(s.value, props.id)].reverse() : []))
const unpolished = computed(() => news.value.slice(0, 3).some((n) => !n.story))
// 有成人向私生活的近況交給「性經歷記錄」的來源寫
const newsFeature = computed(() => (news.value.some((n) => !n.story && n.adult) ? 'sexlog' : 'life'))
const promotable = computed(() => {
  void content.version
  return !!props.id && canPromote(s.value, props.id)
})
function promote() {
  if (!props.id || !r.value) return
  if (!confirm(`把「${r.value.name}」存成目前世界的固定 NPC？之後可以在內容頁籤的「固定 NPC」編輯。`)) return
  game.promoteNpc(props.id)
  if (!game.error) game.flash(`已把「${r.value.name}」存成固定 NPC`)
}
const moreOpen = ref(false)

// 歡愉的惡作劇：改隨機 NPC 的性別（固定 NPC 不開放，見 engine/genderSwap.ts）
const swappable = computed(() => !!props.id && !genderSwapBlock(s.value, props.id))
const swapping = ref(false)
const swapTo = ref('')
function startSwap() {
  moreOpen.value = false
  swapping.value = true
  swapTo.value = GENDER_IDS.find((g) => g !== gender.value) ?? ''
}
function doSwap() {
  if (!props.id || !r.value || !swapTo.value) return
  if (!confirm(`歡愉的惡作劇：把「${r.value.name}」變成${genderName(swapTo.value)}？\n外貌會照新的性別重新寫一份（之後可以再編輯），預設的內衣跟著換，身上其他的衣服不會換；目前的形象圖會退成舊版。以前的日誌與記憶不會改，交給 AI 時會說明性別改過了。`)) return
  game.swapNpcGender(props.id, swapTo.value)
  swapping.value = false
}

// ---- 編輯關係 ----
const editing = ref(false)
const draft = reactive({ appearance: '', toPlayer: '', aliases: '', others: [] as { id: string; text: string }[] })
const others = computed(() => Object.values(s.value.relationships ?? {}).filter((x) => x.id !== props.id))
function startEdit() {
  if (!r.value) return
  tab.value = 'info'
  editing.value = true
  draft.appearance = r.value.appearance
  draft.toPlayer = r.value.toPlayer
  draft.aliases = (r.value.aliases ?? []).join('、')
  draft.others = Object.entries(r.value.toOthers).map(([id, text]) => ({ id, text }))
}
function saveEdit() {
  if (!props.id) return
  game.editRelationship(props.id, {
    appearance: draft.appearance.trim(),
    toPlayer: draft.toPlayer.trim(),
    aliases: draft.aliases.split(/[、,，]/).map((x) => x.trim()),
    toOthers: Object.fromEntries(draft.others.map((o) => [o.id, o.text.trim()])),
  })
  editing.value = false
}

// ---- AI 提議的關係更新（這個人的） ----
const suggestions = computed(() => (s.value.suggestions ?? []).filter((x) => x.npc === props.id))
const suggestionDraft = reactive<Record<string, string>>({})

// ---- 共同記憶（只列有這個人的，新的在前） ----
const memLimit = ref(30)
const memories = computed(() => (s.value.memories ?? []).filter((m) => props.id && m.participants.includes(props.id)).slice().reverse())
const STARS = { 1: '★', 2: '★★', 3: '★★★' } as const
const editingMemory = ref<string | null>(null)
const memoryDraft = ref('')
function editSummary(m: Memory) {
  editingMemory.value = m.id
  memoryDraft.value = m.summary
}
function saveSummary(id: string) {
  game.editMemory(id, { summary: memoryDraft.value.trim() })
  editingMemory.value = null
}

const pct = (v: number) => `${(v + 100) / 2}%`
const showLife = computed(() => settings.sexRecords || news.value.length > 0)
</script>

<template>
  <AppDialog :open="!!id && !!r" :title="r?.name ?? ''" icon="heart" width="1040px" @close="emit('close')">
    <div v-if="id && r" class="detail">
      <!-- 左半邊：形象圖 -->
      <div class="pic">
        <PortraitBox :id="id" size="fill" />
      </div>

      <!-- 右半邊 -->
      <div class="info">
        <div class="name-line">
          <NameTag :id="id" />
          <span class="small muted">{{ identity }}</span>
          <span v-if="swapped" class="small muted">（歡愉的惡作劇改過性別）</span>
        </div>
        <div class="stage-line">
          <span>{{ affinityStage(r.affinity) }} <b>{{ r.affinity }}</b></span>
          <div class="affinity"><span :style="{ left: pct(r.affinity) }" /></div>
        </div>
        <div class="small muted facts">
          <span><GameIcon name="pin" :size="12" /> {{ where }}</span>
          <span v-if="r.firstMet">初次見面：{{ formatTime(r.firstMet.time) }}・{{ locationName(r.firstMet.location) }}</span>
        </div>

        <!-- 按鈕一排；勾選另外一排放在下面 -->
        <div class="acts">
          <button class="small" :class="{ primary: editing }" @click="editing ? (editing = false) : startEdit()"><GameIcon name="edit" :size="13" /> {{ editing ? '取消編輯' : '編輯' }}</button>
          <button
            v-if="settings.npcLife && followable" class="small" :class="{ primary: followed }"
            :title="followed ? '取消關注（親密度夠高、留在家裡或離隊的夥伴照樣會自己成長）' : '關注：不在你身邊時也會自己成長（升級、換裝、受傷休養），每隔幾天有一則近況'"
            @click="game.setFollowed(id, !followed)"
          ><GameIcon name="star" :size="13" /> {{ followed ? '已關注' : '關注' }}</button>
          <button v-if="settings.npcLife && unpolished && settings.ready(newsFeature)" class="small" title="請 AI 依他的性格與和你的記憶，把近況寫成一段" @click="game.polishNews([id])"><GameIcon name="feather" :size="13" /> 近況寫成一段</button>
          <div v-if="promotable || (swappable && !swapping)" class="more">
            <button class="small" :class="{ on: moreOpen }" aria-label="更多" title="存成固定 NPC、歡愉的惡作劇" @click="moreOpen = !moreOpen"><GameIcon name="more" :size="15" /> 更多</button>
            <div v-if="moreOpen" class="menu" @click="moreOpen = false">
              <button
                v-if="promotable" class="small ghost"
                :title="(content.readOnly ? `${VANILLA_NAME}不能直接修改：會自動建立自己的世界，這場遊戲也改用它。` : '') + '把這個人目前的樣子（能力值、技能、特質、裝備、出沒的地方）存進目前的世界，之後可以在內容頁籤編輯；親密度與記憶延續'"
                @click="promote"
              ><GameIcon name="bookmark" :size="13" /> 存成固定 NPC</button>
              <button v-if="swappable && !swapping" class="small ghost" title="歡愉的惡作劇：改變這個人的性別（只有隨機產生的人可以；固定 NPC 的劇情照原本的性別寫）" @click.stop="startSwap">🎭 歡愉的惡作劇</button>
            </div>
          </div>
        </div>
        <div v-if="settings.npcLife && (living || (settings.npcPairs && !inParty))" class="checks small">
          <label
            v-if="settings.npcPairs && !inParty" class="check"
            title="成人向：這個人的私生活會不會和別人發生關係——一夜情、替人性侍奉、娼妓接客，以及和其他認識的 NPC（兩個人都打開、住在同一座城才會）。預設關閉，關著時只會自慰。和你的親密度到設定的門檻以上的人也只會自慰（設定 → 遊戲規則 → NPC）"
          ><input type="checkbox" :checked="pairable" @change="game.setNpcPairs(id, ($event.target as HTMLInputElement).checked)" /> 可以和別人發生關係（成人向）</label>
          <span v-if="living && !followed" class="muted">不用關注也會自己成長</span>
        </div>
        <div v-if="swapping" class="row small swap">
          把{{ r.name }}變成
          <select v-model="swapTo">
            <option v-for="g in GENDER_IDS" :key="g" :value="g" :disabled="g === gender">{{ genderName(g) }}</option>
          </select>
          <button class="small primary" :disabled="!swapTo" @click="doSwap">施展</button>
          <button class="small ghost" @click="swapping = false">取消</button>
        </div>

        <nav class="tabs">
          <button :class="{ on: tab === 'info' }" @click="tab = 'info'">概況</button>
          <button :class="{ on: tab === 'memories' }" @click="tab = 'memories'; editing = false">共同記憶 <span class="muted">{{ memories.length }}</span></button>
          <button v-if="showLife" :class="{ on: tab === 'life' }" @click="tab = 'life'; editing = false">近況與性經歷</button>
        </nav>

        <!-- 概況 -->
        <template v-if="tab === 'info'">
          <div v-for="sg in suggestions" :key="sg.id" class="suggestion small">
            <div class="muted">AI 提議更新「與{{ pcName }}的關係」（目前：{{ r.toPlayer || '—' }}）</div>
            <textarea v-model="suggestionDraft[sg.id]" rows="2" :placeholder="sg.text" />
            <div class="row">
              <button class="small primary" @click="game.acceptSuggestion(sg.id, suggestionDraft[sg.id] || sg.text)">採用</button>
              <button class="small" @click="game.rejectSuggestion(sg.id)">不採用</button>
            </div>
          </div>
          <dl v-if="!editing" class="small">
            <dt>外貌</dt><dd>{{ r.appearance || '—' }}</dd>
            <dt>與{{ pcName }}</dt><dd>{{ r.toPlayer || '—' }}</dd>
            <template v-if="Object.keys(r.toOthers).length">
              <dt>與他人</dt>
              <dd><div v-for="(text, oid) in r.toOthers" :key="oid">{{ nameOf(String(oid)) }}：{{ text }}</div></dd>
            </template>
            <template v-if="r.aliases?.length"><dt>別名</dt><dd>{{ r.aliases.join('、') }}</dd></template>
          </dl>
          <form v-else class="edit small" @submit.prevent="saveEdit">
            <label>外貌<textarea v-model="draft.appearance" rows="3" /></label>
            <label>與{{ pcName }}的關係<textarea v-model="draft.toPlayer" rows="2" /></label>
            <label>別名（以頓號分隔）<input v-model="draft.aliases" /></label>
            <div>與他人的關係</div>
            <div v-for="(o, i) in draft.others" :key="i" class="row">
              <select v-model="o.id">
                <option v-for="other in others" :key="other.id" :value="other.id">{{ other.name }}</option>
                <option v-if="!others.some((x) => x.id === o.id)" :value="o.id">{{ nameOf(o.id) }}</option>
              </select>
              <input v-model="o.text" style="flex: 1" />
              <button type="button" class="small" @click="draft.others.splice(i, 1)">刪除</button>
            </div>
            <button v-if="others.length" type="button" class="small" @click="draft.others.push({ id: others[0]!.id, text: '' })">＋ 新增關係</button>
            <div class="row">
              <button class="small primary" type="submit">儲存</button>
              <button class="small" type="button" @click="editing = false">取消</button>
            </div>
          </form>
        </template>

        <!-- 共同記憶 -->
        <template v-else-if="tab === 'memories'">
          <p v-if="!memories.length" class="small muted">還沒有和{{ r.name }}一起的記憶。</p>
          <ul class="plain mems">
            <li v-for="m in memories.slice(0, memLimit)" :key="m.id" class="mem">
              <div class="row small meta">
                <span>{{ formatTime(m.time) }}</span>
                <span>{{ m.scene ?? locationName(m.location) }}</span>
                <span v-if="m.merged" class="tag">合併 {{ m.merged }} 筆</span>
                <span class="spacer" />
                <button class="small star" :title="'重要程度：' + ['', '日常', '重要', '難忘'][m.importance]" @click="game.editMemory(m.id, { importance: ((m.importance % 3) + 1) as Memory['importance'] })">{{ STARS[m.importance] }}</button>
                <button class="small" :class="{ pinned: m.pinned }" :title="m.pinned ? '取消釘選' : '釘選：交給 AI 時一定找得到'" @click="game.editMemory(m.id, { pinned: !m.pinned })"><GameIcon name="bookmark" :size="12" /></button>
              </div>
              <div v-if="editingMemory !== m.id" class="summary small" title="點一下編輯" @click="editSummary(m)">{{ m.summary }}</div>
              <div v-else class="row">
                <textarea v-model="memoryDraft" rows="2" style="flex: 1" />
                <button class="small primary" @click="saveSummary(m.id)">儲存</button>
                <button class="small" @click="editingMemory = null">取消</button>
              </div>
            </li>
          </ul>
          <button v-if="memories.length > memLimit" class="small more-mem" @click="memLimit += 30">顯示更早的 30 筆（還有 {{ memories.length - memLimit }} 筆）</button>
        </template>

        <!-- 近況與性經歷 -->
        <template v-else>
          <template v-if="news.length">
            <h4>近況</h4>
            <div v-for="n in news.slice(0, 10)" :key="`${n.day}-${n.text}`" class="small news">第 {{ n.day }} 天：{{ newsText(n) }}</div>
          </template>
          <template v-if="settings.sexRecords">
            <h4>性經歷</h4>
            <dl class="small">
              <template v-for="x in sexRecordItems(s, id)" :key="x.label"><dt>{{ x.label }}</dt><dd>{{ x.value }}</dd></template>
            </dl>
            <div v-for="e in sexRecordOf(s, id).recent" :key="`${e.day}-${e.report}`" class="small news">{{ encounterText(e) }}</div>
          </template>
        </template>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
/* 左半邊是形象圖，右半邊是資料；窄的時候（手機）上下排 */
.detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 760px) { .detail { grid-template-columns: minmax(0, 1fr); } .pic { max-width: 220px; justify-self: center; width: 100%; } }
.info { display: grid; gap: 8px; min-width: 0; align-content: start; }
.name-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: var(--fs-lg); }
.stage-line { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.stage-line b { font-variant-numeric: tabular-nums; }
.affinity { position: relative; height: 7px; border-radius: 4px; background: linear-gradient(90deg, var(--danger), #5a4a33 50%, var(--good)); }
.affinity span { position: absolute; top: -3px; width: 4px; height: 13px; margin-left: -2px; background: var(--text); border-radius: 2px; }
.facts { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.facts :deep(.game-icon) { vertical-align: -0.15em; }
.acts { display: flex; gap: 6px; align-items: center; }
.acts button, .menu button { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.more { position: relative; margin-left: auto; }
.more > button.on { border-color: var(--accent); color: var(--accent); }
.menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 5; display: grid; gap: 2px; padding: 4px; min-width: 180px; background: linear-gradient(180deg, #f4e7c6, #e6d2a4); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 6px 18px #0005; }
.menu button { justify-content: flex-start; width: 100%; }
.checks { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.check { display: inline-flex; align-items: center; gap: 4px; }
.swap { gap: 6px; align-items: center; }
.tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); margin-top: 4px; }
.tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 5px 12px; }
.tabs button.on { border-bottom-color: var(--accent); color: var(--accent); font-weight: bold; }
dl { display: grid; grid-template-columns: 5em minmax(0, 1fr); gap: 4px 10px; margin: 0; }
dt { color: var(--muted); }
dd { margin: 0; }
h4 { margin: 4px 0 2px; font-size: var(--fs-sm, 0.9rem); color: var(--accent); }
.news { margin-bottom: 2px; }
.edit { display: grid; gap: 6px; }
.edit label { display: grid; gap: 2px; }
.edit textarea { width: 100%; }
.suggestion { display: grid; gap: 4px; padding: 6px 8px; border: 1px dashed var(--accent); border-radius: var(--radius); }
.suggestion textarea { width: 100%; }
.mems { display: grid; gap: 0; }
.mem { display: grid; gap: 2px; padding: 5px 0; border-bottom: 1px solid var(--border); }
.meta { gap: 8px; color: var(--muted); }
.spacer { flex: 1; }
.star { color: var(--accent); }
.pinned { border-color: var(--accent); color: var(--accent); }
.summary { cursor: text; }
.summary:hover { color: var(--accent); }
.more-mem { justify-self: center; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
</style>
