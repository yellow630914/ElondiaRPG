<script setup lang="ts">
import ContentTagChips from './ContentTagChips.vue'
import { deadlineText, hoursLeft, storyDeadline } from '@/engine/deadlines'
import { computed, reactive, ref, watch } from 'vue'
import { enemies, locationById, stories } from '@/engine/data'
import { expireIntel, intelPlace, KEEP_OLD_POINTS } from '@/engine/intel'
import { canTurnIn, isMaterialQuest, layerName, questProgressText } from '@/engine/materialQuests'
import { formatMoney } from '@/engine/money'
import { examsFirst } from '@/engine/guild'
import { formatTime } from '@/engine/state'
import { activeNodes, nodesWaitingForDays, placeText, storyHints, storyPauseReason } from '@/engine/story'
import { questScene, questTemplate } from '@/engine/town'
import type { Intel, Quest } from '@/engine/types'
import { useGame } from '@/stores/game'
import BestiaryPanel from './BestiaryPanel.vue'
import FoldMenu from './ui/FoldMenu.vue'
import GameIcon from './ui/GameIcon.vue'

// 冒險筆記：一般委託、特殊任務（目前的目標與經過）、情報（買到的與打聽到的傳聞）、怪物圖鑑
const game = useGame()
const s = computed(() => game.state!)
type Tab = 'quests' | 'stories' | 'intel' | 'bestiary'
const tab = ref<Tab>('quests')

// ---- 每一頁的篩選：上次選的狀態記在這個瀏覽器；搜尋不記 ----
type QuestView = 'active' | 'completed'
type StoryView = 'active' | 'completed' | 'failed'
type IntelView = 'active' | 'rumor' | 'old'
interface Views { quests: QuestView; stories: StoryView; intel: IntelView }
const VIEW_KEY = 'elondia.notebookViews'
function readViews(): Views {
  let v: Partial<Views> = {}
  try {
    v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<Views>
  } catch {
    // 讀不到就用預設
  }
  return {
    quests: v.quests === 'completed' ? 'completed' : 'active',
    stories: v.stories === 'completed' || v.stories === 'failed' ? v.stories : 'active',
    intel: v.intel === 'rumor' || v.intel === 'old' ? v.intel : 'active',
  }
}
const views = reactive(readViews())
watch(views, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v))
  } catch {
    // 記不住也沒關係
  }
})
const search = reactive({ quests: '', stories: '', intel: '' })
/** 搜尋字有沒有出現在這些文字裡（沒輸入時都算） */
function matches(query: string, ...texts: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  return !q || texts.some((t) => t?.toLowerCase().includes(q))
}

// ---- 一般委託 ----
const AREA: Record<Quest['area'], string> = { town: '城內', outskirts: '近郊', dungeon: '冒險區域' }
const active = computed(() => examsFirst(s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready')))
const finished = computed(() => s.value.quests.filter((q) => q.status === 'completed').reverse())
const questViews = computed(() => [
  { id: 'active' as const, label: '進行中', n: active.value.length },
  { id: 'completed' as const, label: '完成', n: finished.value.length },
])
const questMatch = (q: Quest) => matches(search.quests, q.title, q.rank, where(q), q.monster ? enemies[q.monster]?.name : undefined)
const shownActive = computed(() => active.value.filter(questMatch))
const shownFinished = computed(() => finished.value.filter(questMatch))
function where(q: Quest): string {
  if (q.area === 'dungeon') return `${locationById(q.target).name}${q.layer ? `・${layerName(q.layer)}` : ''}`
  if (q.area === 'outskirts') return `${locationById(q.target).name}近郊`
  return questTemplate(q) ? questScene(q) : `${locationById(q.target).name}・城內`
}

function abandonQuest(q: Quest) {
  if (confirm(`放棄委託「${q.title}」？公會聲望 -1。`)) game.abandonQuest(q.id)
}

// ---- 特殊任務 ----
const myStories = computed(() => {
  void s.value.time.minute
  void s.value.flags
  const nodes = activeNodes(s.value)
  // 只差「幾天之後」的任務點：寫出第幾天以後再來
  const later = nodesWaitingForDays(s.value)
  return Object.values(s.value.stories ?? {})
    .map((p) => ({ p, def: stories.find((d) => d.id === p.id), goals: nodes.filter((n) => n.def.id === p.id), later: later.filter((n) => n.def.id === p.id) }))
    .filter((x) => x.def)
})
const storyViews = computed(() => (['active', 'completed', 'failed'] as const).map((id) => ({
  id, label: { active: '進行中', completed: '完成', failed: '失敗' }[id], n: myStories.value.filter((x) => x.p.status === id).length,
})))
const shownStories = computed(() => myStories.value.filter((x) => x.p.status === views.stories && matches(search.stories, x.def!.title, x.def!.summary, x.def!.rank)))
function abandon(id: string, title: string) {
  if (confirm(`放棄特殊任務「${title}」？放棄後不能再接。`)) game.abandonStory(id)
}

// ---- 情報 ----
const intel = computed(() => {
  void s.value.time.day
  expireIntel(s.value)
  return [...(s.value.intel ?? [])].sort((a, b) => b.time.day - a.time.day || (b.time.hour ?? 0) - (a.time.hour ?? 0))
})
/** 有效（還能去的事件點、特殊任務的消息）、傳聞、已完成或過期 */
const intelGroup = (it: Intel): IntelView => it.kind === 'rumor' ? 'rumor' : it.status === 'active' ? 'active' : 'old'
const intelViews = computed(() => (['active', 'rumor', 'old'] as const).map((id) => ({
  id, label: { active: '有效', rumor: '傳聞', old: '已完成・過期' }[id], n: intel.value.filter((it) => intelGroup(it) === id).length,
})))
const shownIntel = computed(() => intel.value.filter((it) => intelGroup(it) === views.intel &&
  matches(search.intel, it.title, it.text, it.npc, intelPlace(it), it.location ? locationById(it.location).name : undefined, it.monster ? enemies[it.monster]?.name : undefined)))
const EVENT: Record<string, string> = { combat: '💀 盤踞的強敵', chest: '🎁 藏寶處', merchant: '🧳 流浪商人', relic: '⚰️ 冒險者的遺物', event: '🔎 線索事件' }
const STATUS: Record<string, string> = { active: '有效', done: '已完成', expired: '已過期' }

const counts = computed(() => ({
  quests: active.value.length,
  stories: myStories.value.filter((x) => x.p.status === 'active').length,
  intel: intel.value.filter((i) => i.status === 'active' && i.kind === 'point').length,
}))
</script>

<template>
  <div class="notebook">
    <nav class="row tabs">
      <button :class="{ active: tab === 'quests' }" @click="tab = 'quests'"><GameIcon name="scroll" :size="15" />一般委託 <span v-if="counts.quests" class="tag">{{ counts.quests }}</span></button>
      <button :class="{ active: tab === 'stories' }" @click="tab = 'stories'"><GameIcon name="star" :size="15" />特殊任務 <span v-if="counts.stories" class="tag">{{ counts.stories }}</span></button>
      <button :class="{ active: tab === 'intel' }" @click="tab = 'intel'"><GameIcon name="eye" :size="15" />情報 <span v-if="counts.intel" class="tag">{{ counts.intel }}</span></button>
      <button :class="{ active: tab === 'bestiary' }" @click="tab = 'bestiary'"><GameIcon name="skull" :size="15" />圖鑑</button>
    </nav>

    <template v-if="tab === 'quests'">
      <div class="row filters">
        <button v-for="o in questViews" :key="o.id" class="small" :class="{ active: views.quests === o.id }" @click="views.quests = o.id">{{ o.label }} {{ o.n }}</button>
        <input v-model="search.quests" class="grow" type="search" placeholder="搜尋名稱、等級、地點或目標" />
      </div>
      <template v-if="views.quests === 'active'">
        <p v-if="!active.length" class="muted">沒有進行中的委託。到冒險者公會接委託吧。</p>
        <p v-else-if="!shownActive.length" class="muted small">沒有符合的委託。</p>
        <div v-for="q in shownActive" :key="q.id" class="card">
          <div class="row">
            <span class="tag">{{ q.rank }}</span><span class="tag">{{ AREA[q.area] }}</span><b class="grow">{{ q.title }}</b>
            <span v-if="canTurnIn(s, q)" class="tag ok">可以交付</span>
            <span v-else-if="q.deadline" class="tag" :class="{ warn: hoursLeft(s, q.deadline) < 24 }" :title="`期限：第 ${q.deadline.day} 天 ${q.deadline.hour ?? 0} 時`"><GameIcon name="hourglass" :size="12" />{{ deadlineText(s, q.deadline) }}</span>
            <button class="small" @click="abandonQuest(q)">放棄</button>
          </div>
          <div class="small">進度：{{ questProgressText(s, q) }}・報酬 {{ formatMoney(q.reward_cc) }}{{ isMaterialQuest(q) && (q.max ?? q.goal) > q.goal ? '（可以多交，報酬依數量增加）' : '' }}</div>
          <div class="small muted">
            地點：{{ where(q) }}<template v-if="q.monster">・目標：{{ enemies[q.monster]?.name ?? q.monster }}</template>・交付：{{ locationById(q.giver).name }}的冒險者公會
            <span v-if="q.flags?.lead" class="tag">有線索 +5</span>
          </div>
        </div>
      </template>
      <template v-else>
        <p v-if="!finished.length" class="muted">還沒有完成的委託。</p>
        <p v-else-if="!shownFinished.length" class="muted small">沒有符合的委託。</p>
        <ul class="plain small finished">
          <li v-for="q in shownFinished" :key="q.id"><span class="tag">{{ q.rank }}</span> {{ q.title }}<template v-if="q.delivered && q.delivered > q.goal">（交了 {{ q.delivered }} 份）</template> <span class="muted">・{{ where(q) }}</span></li>
        </ul>
      </template>
    </template>

    <template v-else-if="tab === 'stories'">
      <div v-if="myStories.length" class="row filters">
        <button v-for="o in storyViews" :key="o.id" class="small" :class="{ active: views.stories === o.id }" @click="views.stories = o.id">{{ o.label }} {{ o.n }}</button>
        <input v-model="search.stories" class="grow" type="search" placeholder="搜尋任務名稱或簡介" />
      </div>
      <p v-if="!myStories.length" class="muted">還沒有特殊任務。固定的人物、公會、旅途上的事件或情報商都可能帶來特別的委託。</p>
      <p v-else-if="!shownStories.length" class="muted small">{{ search.stories.trim() ? '沒有符合的任務。' : `沒有${storyViews.find((o) => o.id === views.stories)!.label}的特殊任務。` }}</p>
      <div v-for="{ p, def, goals, later } in shownStories" :key="p.id" class="card" :class="p.status">
        <div class="row">
          <span v-if="def!.rank" class="tag">{{ def!.rank }}</span>
          <b class="grow">{{ def!.title }} <ContentTagChips :tags="def!.tags" /></b>
          <span v-if="p.status === 'active' && storyDeadline(s, p.id)" class="tag" :class="{ warn: hoursLeft(s, storyDeadline(s, p.id)!) < 24 }"><GameIcon name="hourglass" :size="12" />{{ deadlineText(s, storyDeadline(s, p.id)) }}</span>
          <span class="tag" :class="{ ok: p.status === 'completed' }">{{ p.status === 'active' ? '進行中' : p.status === 'completed' ? '完成' : '失敗' }}</span>
          <button v-if="p.status === 'active'" class="small" @click="abandon(p.id, def!.title)">放棄</button>
        </div>
        <p class="small">{{ def!.summary }}</p>
        <div v-if="p.status === 'active'" class="small">
          <b>目前的目標</b>
          <ul class="plain goals">
            <li v-for="g in goals" :key="g.ref"><GameIcon name="target" :size="12" /> {{ g.node.title }} <span class="muted">（{{ placeText(g.node, s) }}）</span></li>
            <li v-for="g in later" :key="g.ref" class="muted"><GameIcon name="hourglass" :size="12" /> {{ g.node.title }}（{{ placeText(g.node, s) }}・{{ formatTime(g.from) }} 以後）</li>
            <li v-for="(h, i) in storyHints(s, def!)" :key="`h${i}`"><GameIcon name="compass" :size="12" /> {{ h }}</li>
            <li v-if="storyPauseReason(s, def!) === 'tags'" class="muted">（設定的內容篩選關掉了這個任務的標籤，任務暫停中；重新開啟後接著進行）</li>
            <li v-else-if="storyPauseReason(s, def!) === 'body'" class="muted">（這個任務只給陰柔、中性體型的主角，任務暫停中；打開設定「陽剛體型也能遇到『只給陰柔、中性』的成人內容」或改回體型後接著進行）</li>
            <li v-else-if="!goals.length && !later.length && !storyHints(s, def!).length" class="muted">（現在沒有可以進行的目標）</li>
          </ul>
        </div>
        <FoldMenu class="history" icon="notes" label="經過" :detail="p.log.length ? `最近：${p.log.at(-1)!.text.slice(0, 24)}${p.log.at(-1)!.text.length > 24 ? '…' : ''}` : ''" :badge="p.log.length" :open="p.status === 'active'">
          <ul class="plain small log">
            <li v-for="(l, i) in [...p.log].reverse()" :key="i"><span class="muted">{{ formatTime(l.time) }}</span> {{ l.text }}</li>
          </ul>
        </FoldMenu>
      </div>
    </template>

    <BestiaryPanel v-else-if="tab === 'bestiary'" />

    <template v-else>
      <div v-if="intel.length" class="row filters">
        <button v-for="o in intelViews" :key="o.id" class="small" :class="{ active: views.intel === o.id }" @click="views.intel = o.id">{{ o.label }} {{ o.n }}</button>
        <input v-model="search.intel" class="grow" type="search" placeholder="搜尋標題、內容、地點或怪物" />
      </div>
      <p v-if="!intel.length" class="muted">還沒有情報。情報商賣附近的事件點與特殊任務的消息；向人打聽到的傳聞也記在這裡。</p>
      <p v-else-if="!shownIntel.length" class="muted small">{{ search.intel.trim() ? '沒有符合的情報。' : `沒有${intelViews.find((o) => o.id === views.intel)!.label}的情報。` }}</p>
      <p v-if="views.intel === 'old' && shownIntel.length" class="muted small">完成、過期的事件點只留最近 {{ KEEP_OLD_POINTS }} 筆。</p>
      <div v-for="it in shownIntel" :key="it.id" class="card" :class="it.status">
        <div class="row">
          <b class="grow"><GameIcon v-if="it.kind === 'story'" name="star" :size="13" /><GameIcon v-else-if="it.kind === 'rumor'" name="message" :size="13" /> {{ it.title }}</b>
          <span v-if="it.event" class="tag">{{ EVENT[it.event] }}</span>
          <span v-if="it.kind === 'rumor'" class="tag">傳聞</span>
          <span v-else class="tag" :class="{ ok: it.status === 'active' }">{{ STATUS[it.status] }}</span>
        </div>
        <p v-if="it.text" class="small">{{ it.text }}</p>
        <div class="small muted">
          <template v-if="it.kind === 'point'">地點：{{ intelPlace(it) }}・第 {{ it.until }} 天前有效・</template>
          <template v-else-if="it.location">地點：{{ locationById(it.location).name }}・</template>
          <template v-if="it.monster && enemies[it.monster]">怪物：{{ enemies[it.monster]!.name }}・</template>
          {{ formatTime(it.time) }}{{ it.npc ? `在${locationById(it.from).name}聽${it.npc}說的` : it.source === '自己遇到' ? `在${locationById(it.location ?? it.from).name}${it.layer ? '' : '附近'}自己遇到的` : it.source ? `在${locationById(it.from).name}解讀「${it.source}」得到` : `在${locationById(it.from).name}的情報商買到` }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notebook { display: grid; gap: 8px; }
.tabs { gap: 6px; }
.tabs button { display: inline-flex; align-items: center; gap: 6px; }
.tabs button.active, .filters button.active { border-color: var(--accent); color: var(--accent); }
.filters { gap: 6px; }
.filters button.active { background: color-mix(in srgb, var(--accent) 14%, transparent); font-weight: 600; }
.filters input { min-width: 140px; }
.finished { display: grid; gap: 4px; margin: 0; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grow { flex: 1; min-width: 120px; }
.card { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; display: grid; gap: 4px; }
.card p { margin: 0; line-height: 1.6; }
.card.completed, .card.failed, .card.done, .card.expired { opacity: 0.65; }
.tag.ok { border-color: var(--accent); color: var(--accent); }
.tag.warn { border-color: var(--danger); color: var(--danger); }
.goals :deep(.game-icon) { color: var(--accent); }
.goals, .log { margin: 2px 0 0; display: grid; gap: 2px; }
</style>
