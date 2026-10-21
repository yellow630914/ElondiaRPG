<script setup lang="ts">
import { computed, ref } from 'vue'
import { enemies, locationById, stories } from '@/engine/data'
import { expireIntel, intelPlace } from '@/engine/intel'
import { canTurnIn, isMaterialQuest, layerName, questProgressText } from '@/engine/materialQuests'
import { formatMoney } from '@/engine/money'
import { formatTime } from '@/engine/state'
import { activeNodes, placeText } from '@/engine/story'
import { questTemplate } from '@/engine/town'
import type { Quest } from '@/engine/types'
import { useGame } from '@/stores/game'

// 冒險筆記：一般委託、特殊任務（目前的目標與經過）、情報
const game = useGame()
const s = computed(() => game.state!)
type Tab = 'quests' | 'stories' | 'intel'
const tab = ref<Tab>('quests')

// ---- 一般委託 ----
const AREA: Record<Quest['area'], string> = { town: '城內', outskirts: '近郊', dungeon: '冒險區域' }
const active = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'))
const finished = computed(() => s.value.quests.filter((q) => q.status === 'completed').slice(-20).reverse())
function where(q: Quest): string {
  if (q.area === 'dungeon') return `${locationById(q.target).name}${q.layer ? `・${layerName(q.layer)}` : ''}`
  if (q.area === 'outskirts') return `${locationById(q.target).name}近郊`
  return `${locationById(q.target).name}・${questTemplate(q)?.scene.split('{town}').join(locationById(q.target).name) ?? '城內'}`
}

function abandonQuest(q: Quest) {
  if (confirm(`放棄委託「${q.title}」？公會聲望 -1。`)) game.abandonQuest(q.id)
}

// ---- 特殊任務 ----
const myStories = computed(() => {
  void s.value.time.minute
  void s.value.flags
  const nodes = activeNodes(s.value)
  return Object.values(s.value.stories ?? {})
    .map((p) => ({ p, def: stories.find((d) => d.id === p.id), goals: nodes.filter((n) => n.def.id === p.id) }))
    .filter((x) => x.def)
    .sort((a, b) => Number(a.p.status !== 'active') - Number(b.p.status !== 'active'))
})
function abandon(id: string, title: string) {
  if (confirm(`放棄特殊任務「${title}」？放棄後不能再接。`)) game.abandonStory(id)
}

// ---- 情報 ----
const intel = computed(() => {
  void s.value.time.day
  expireIntel(s.value)
  return [...(s.value.intel ?? [])].sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || b.time.day - a.time.day)
})
const EVENT: Record<string, string> = { combat: '💀 盤踞的強敵', chest: '🎁 藏寶處', merchant: '🧳 流浪商人' }
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
      <button :class="{ active: tab === 'quests' }" @click="tab = 'quests'">📜 一般委託 <span v-if="counts.quests" class="tag">{{ counts.quests }}</span></button>
      <button :class="{ active: tab === 'stories' }" @click="tab = 'stories'">⭐ 特殊任務 <span v-if="counts.stories" class="tag">{{ counts.stories }}</span></button>
      <button :class="{ active: tab === 'intel' }" @click="tab = 'intel'">🕵️ 情報 <span v-if="counts.intel" class="tag">{{ counts.intel }}</span></button>
    </nav>

    <template v-if="tab === 'quests'">
      <p v-if="!active.length" class="muted">沒有進行中的委託。到冒險者公會接委託吧。</p>
      <div v-for="q in active" :key="q.id" class="card">
        <div class="row">
          <span class="tag">{{ q.rank }}</span><span class="tag">{{ AREA[q.area] }}</span><b class="grow">{{ q.title }}</b>
          <span v-if="canTurnIn(s, q)" class="tag ok">可以交付</span>
          <button class="small" @click="abandonQuest(q)">放棄</button>
        </div>
        <div class="small">進度：{{ questProgressText(s, q) }}・報酬 {{ formatMoney(q.reward_cc) }}{{ isMaterialQuest(q) && (q.max ?? q.goal) > q.goal ? '（可以多交，報酬依數量增加）' : '' }}</div>
        <div class="small muted">
          地點：{{ where(q) }}<template v-if="q.monster">・目標：{{ enemies[q.monster]?.name ?? q.monster }}</template>・交付：{{ locationById(q.giver).name }}的冒險者公會
          <span v-if="q.flags?.lead" class="tag">有線索 +5</span>
          <span v-if="q.flags?.suspicious" class="tag">消息走漏 -2</span>
        </div>
      </div>
      <details v-if="finished.length" class="history">
        <summary class="small">完成的委託（最近 {{ finished.length }} 件）</summary>
        <ul class="plain small muted">
          <li v-for="q in finished" :key="q.id">{{ q.rank }}・{{ q.title }}<template v-if="q.delivered && q.delivered > q.goal">（交了 {{ q.delivered }} 份）</template></li>
        </ul>
      </details>
    </template>

    <template v-else-if="tab === 'stories'">
      <p v-if="!myStories.length" class="muted">還沒有特殊任務。固定的人物、公會、旅途上的事件或情報商都可能帶來特別的委託。</p>
      <div v-for="{ p, def, goals } in myStories" :key="p.id" class="card" :class="p.status">
        <div class="row">
          <span v-if="def!.rank" class="tag">{{ def!.rank }}</span>
          <b class="grow">{{ def!.title }}</b>
          <span class="tag" :class="{ ok: p.status === 'completed' }">{{ p.status === 'active' ? '進行中' : p.status === 'completed' ? '✅ 完成' : '❌ 失敗' }}</span>
          <button v-if="p.status === 'active'" class="small" @click="abandon(p.id, def!.title)">放棄</button>
        </div>
        <p class="small">{{ def!.summary }}</p>
        <div v-if="p.status === 'active'" class="small">
          <b>目前的目標</b>
          <ul class="plain goals">
            <li v-for="g in goals" :key="g.ref">🎯 {{ g.node.title }} <span class="muted">（{{ placeText(g.node, s) }}）</span></li>
            <li v-if="!goals.length" class="muted">（現在沒有可以進行的目標）</li>
          </ul>
        </div>
        <details class="history" :open="p.status === 'active'">
          <summary class="small">經過（{{ p.log.length }}）</summary>
          <ul class="plain small log">
            <li v-for="(l, i) in [...p.log].reverse()" :key="i"><span class="muted">{{ formatTime(l.time) }}</span> {{ l.text }}</li>
          </ul>
        </details>
      </div>
    </template>

    <template v-else>
      <p v-if="!intel.length" class="muted">還沒有買過情報。情報商（🕵️）賣附近的事件點與特殊任務的消息。</p>
      <div v-for="it in intel" :key="it.id" class="card" :class="it.status">
        <div class="row">
          <b class="grow">{{ it.kind === 'story' ? '⭐ ' : '' }}{{ it.title }}</b>
          <span v-if="it.event" class="tag">{{ EVENT[it.event] }}</span>
          <span class="tag" :class="{ ok: it.status === 'active' }">{{ STATUS[it.status] }}</span>
        </div>
        <p v-if="it.text" class="small">{{ it.text }}</p>
        <div class="small muted">
          <template v-if="it.kind === 'point'">地點：{{ intelPlace(it) }}・第 {{ it.until }} 天前有效・</template>
          {{ formatTime(it.time) }}{{ it.source ? `在${locationById(it.from).name}解讀「${it.source}」得到` : `在${locationById(it.from).name}的情報商買到` }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notebook { display: grid; gap: 8px; }
.tabs { gap: 6px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grow { flex: 1; min-width: 120px; }
.card { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; display: grid; gap: 4px; }
.card p { margin: 0; line-height: 1.6; }
.card.completed, .card.failed, .card.done, .card.expired { opacity: 0.65; }
.tag.ok { border-color: var(--accent); color: var(--accent); }
.goals, .log { margin: 2px 0 0; display: grid; gap: 2px; }
.history summary { cursor: pointer; color: var(--accent-2); }
</style>
