<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { geography, locationById } from '@/engine/data'
import { canTravelHere, CELL_NAME, cellName, currentArea, currentCell, DUNGEON_LAYERS, questRunnableHere } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { marketsHere } from '@/engine/companions'
import { canNegotiate } from '@/engine/negotiation'
import { canAcceptRank, guildQuests, questTemplate, templeCost } from '@/engine/town'
import { MODE_NAME } from '@/engine/travel'
import type { Quest } from '@/engine/types'
import { reachable, type Path } from '@/engine/world'
import { useGame } from '@/stores/game'
import BrothelPanel from './BrothelPanel.vue'
import GuardStatus from './GuardStatus.vue'
import MarketPanel from './MarketPanel.vue'
import NegotiationPanel from './NegotiationPanel.vue'
import ShopPanel from './ShopPanel.vue'
import TavernPanel from './TavernPanel.vue'
import WorkPanel from './WorkPanel.vue'

const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const area = computed(() => currentArea(s.value))
const cell = computed(() => currentCell(s.value))
const intent = computed({ get: () => game.intent, set: (v: string) => (game.intent = v) })

const AREA_NAME: Record<Quest['area'], string> = { town: '城內', outskirts: '近郊', dungeon: '冒險區域' }

// ---- 公會委託（走進公會時才產生） ----
const quests = ref<Quest[]>([])
watch(
  () => [cell.value.kind, area.value.key] as const,
  ([kind]) => {
    if (kind === 'guild') quests.value = game.visitGuild()
  },
  { immediate: true },
)
function refreshQuests() {
  quests.value = guildQuests(s.value)
}

const activeQuests = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'))
const runnableHere = computed(() =>
  activeQuests.value.filter((q) => q.status === 'accepted' && q.area !== 'dungeon' && questRunnableHere(s.value, { ...q, spot: questTemplate(q)?.spot })),
)

function questWhere(q: Quest): string {
  if (q.status === 'ready') return `完成！回到${locationById(q.giver).name}的冒險者公會交付`
  if (q.area === 'dungeon') return `目標：${locationById(q.target).name}`
  if (q.area === 'outskirts') return `地點：${locationById(q.target).name}近郊（地圖上的 ❗）`
  const spot = questTemplate(q)?.spot ?? 'guild'
  return `地點：${locationById(q.target).name}的${(spot in CELL_NAME ? cellName(spot as keyof typeof CELL_NAME) : spot)}`
}

function runQuest(id: string) {
  game.doTownQuest(id, intent.value || undefined)
  intent.value = ''
}

// ---- 市場 ----
const publicMarket = computed(() => marketsHere(s.value).some((m) => m.kind === 'public'))
const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0)

// ---- 旅行 ----
const destinations = computed(() => {
  const list = reachable(s.value.location)
  return geography.regions
    .map((r) => ({ region: r, items: list.filter((d) => locationById(d.id).region === r.id) }))
    .filter((g) => g.items.length > 0)
})

function daysText(days: [number, number]) {
  return days[0] === days[1] ? `${days[0]} 天` : `${days[0]}～${days[1]} 天`
}

function routeText(path: Path) {
  const modes = [...new Set(path.legs.map((l) => MODE_NAME[l.mode]))].join('/')
  const via = path.legs.slice(0, -1).map((l) => locationById(l.to).name)
  return via.length ? `${modes}・經${via.join('、')}` : modes
}

function go(id: string) {
  game.travel(id, intent.value || undefined)
  intent.value = ''
}

const CELL_ICON: Partial<Record<string, string>> = {
  inn: '🛏️', guild: '🏛️', tavern: '🍺', shop: '🛒', temple: '⛪', gate: '🚪', exit: '🚪', safe: '🔥',
  stairs_down: '⬇️', stairs_up: '⬆️', quest: '❗', floor: '🧭', link: '➡️', brothel: '🏮',
}
</script>

<template>
    <div class="place">
      <!-- 目前所在格子 -->
      <section class="panel">
        <h3>{{ CELL_ICON[cell.kind] ?? '📍' }} {{ cell.kind === 'wall' ? '道路' : cellName(cell.kind) }}</h3>

        <template v-if="cell.kind === 'inn'">
          <p class="muted small">可以在這裡長休（見下方「休息」）。</p>
        </template>

        <template v-else-if="cell.kind === 'temple'">
          <p class="muted small">接受神殿治療：受傷的隊員 HP 回滿（不回復法術環）。</p>
          <button :disabled="templeCost(s) === 0 || s.money_cc < templeCost(s)" @click="game.templeHeal()">
            治療（{{ formatMoney(templeCost(s)) }}）
          </button>
          <ShopPanel :key="`temple-${s.location}-${s.time.day}`" type="temple" />
        </template>

        <template v-else-if="cell.kind === 'shop'">
          <p class="muted small">野外與海路旅行每人每天消耗 1 份乾糧；地下城的安全房長休也要乾糧。目前持有 {{ rations }} 份。</p>
          <ShopPanel :key="`general-${s.location}-${s.time.day}`" type="general" />
          <MarketPanel v-if="publicMarket" kind="public" />
        </template>

        <template v-else-if="cell.kind === 'tavern'">
          <TavernPanel :key="`${s.location}-${s.time.day}`" />
          <details class="tavern-trade">
            <summary class="small">酒館的交易（餐點、情報……）</summary>
            <ShopPanel :key="`tavern-${s.location}-${s.time.day}`" type="tavern" />
          </details>
        </template>

        <template v-else-if="cell.kind === 'guild'">
          <ul class="plain">
            <li class="muted small">📋 委託板每天更新，沒人接的委託會撤下換新（談過報酬的會保留）。</li>
            <li v-if="quests.length === 0" class="muted small">目前沒有委託。</li>
            <li v-for="q in quests" :key="q.id">
              <div><span class="tag">{{ q.rank }}</span> <span class="tag">{{ AREA_NAME[q.area] }}</span> {{ q.title }}</div>
              <div class="small muted">
                報酬 {{ formatMoney(q.reward_cc) }}
                <span v-if="q.status !== 'available'">・進度 {{ q.progress }}/{{ q.goal }}</span>
              </div>
              <button
                v-if="q.status === 'available'"
                class="small"
                :disabled="!canAcceptRank(s, q.rank)"
                @click="game.acceptQuest(q.id); refreshQuests()"
              >{{ canAcceptRank(s, q.rank) ? '接取' : '階級不足' }}</button>
              <button v-else-if="q.status === 'ready'" class="small primary" @click="game.turnInQuest(q.id); refreshQuests()">交付</button>
              <span v-else class="small muted">進行中</span>
              <button
                v-if="!canNegotiate(s, 'quest_reward', { quest: q.id })"
                class="small"
                @click="game.startNegotiation('quest_reward', { quest: q.id })"
              >談判報酬</button>
              <span v-else-if="q.flags?.negotiated" class="small muted">（已談過報酬）</span>
            </li>
          </ul>
        </template>

        <template v-else-if="cell.kind === 'gate'">
          <p class="muted small">出城到近郊的荒野，或從這裡啟程前往其他地點。</p>
          <GuardStatus can-pay />
          <button @click="game.goOutskirts()">前往{{ here.name }}近郊</button>
        </template>

        <template v-else-if="cell.kind === 'exit' && area.kind === 'wild'">
          <GuardStatus can-pay />
          <button @click="game.returnToTown()">返回{{ here.name }}</button>
        </template>

        <template v-else-if="cell.kind === 'exit' && area.kind === 'dungeon'">
          <p class="muted small">{{ here.name }}的入口。可以從這裡離開，前往其他地點。</p>
        </template>

        <template v-else-if="cell.kind === 'stairs_down'">
          <p class="muted small">通往{{ DUNGEON_LAYERS[(area.layer ?? 0) + 1]?.name }}。越往下越危險。</p>
          <button class="primary" @click="game.descend()">往下一層</button>
        </template>

        <template v-else-if="cell.kind === 'stairs_up'">
          <button @click="game.ascend()">回到{{ DUNGEON_LAYERS[(area.layer ?? 1) - 1]?.name }}</button>
        </template>

        <template v-else-if="cell.kind === 'brothel'">
          <BrothelPanel />
        </template>

        <template v-else-if="cell.kind === 'safe'">
          <p class="muted small">安全房：魔物不會靠近，可以安心短休或長休（見下方「休息」）。</p>
        </template>

        <p v-else class="muted small">{{ cell.done ? '這裡已經清理乾淨了。' : '四下無事。' }}</p>

        <WorkPanel :key="`${area.key}-${cell.kind}`" />

        <div v-for="q in runnableHere" :key="q.id" class="quest-here">
          <div class="small"><span class="tag">{{ q.rank }}</span> {{ q.title }}</div>
          <button class="small primary" @click="runQuest(q.id)">執行委託（約 {{ questTemplate(q)?.hours ?? 1 }} 小時）</button>
        </div>
      </section>

      <NegotiationPanel />

      <section v-if="activeQuests.length" class="panel">
        <h3>📜 進行中的委託</h3>
        <ul class="plain small">
          <li v-for="q in activeQuests" :key="q.id">
            <span class="tag">{{ q.rank }}</span> {{ q.title }}（{{ q.progress }}/{{ q.goal }}）
            <span v-if="q.flags?.lead" class="tag">有線索 +5</span>
            <span v-if="q.flags?.suspicious" class="tag">消息走漏 -2</span>
            <div class="muted">{{ questWhere(q) }}</div>
            <button
              v-if="!canNegotiate(s, 'quest_lead', { quest: q.id }) && questTemplate(q)?.dc !== undefined"
              class="small"
              @click="game.startNegotiation('quest_lead', { quest: q.id })"
            >打聽門路</button>
          </li>
        </ul>
      </section>

      <section v-if="canTravelHere(s)" class="panel">
        <h3>🧳 啟程旅行</h3>
    <details v-for="g in destinations" :key="g.region.id" :open="g.region.id === here.region">
      <summary>{{ g.region.name }}</summary>
      <ul class="plain">
        <li v-for="d in g.items" :key="d.id" class="row" style="justify-content: space-between">
          <span>
            {{ locationById(d.id).name }}
            <span v-if="locationById(d.id).type === 'dungeon'" class="tag">冒險區域</span>
            <span class="small muted">・{{ daysText(d.path.days) }}・{{ routeText(d.path) }}</span>
          </span>
          <button class="small" @click="go(d.id)">前往</button>
        </li>
      </ul>
        </details>
      </section>
    </div>
</template>

<style scoped>
.tavern-trade { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 6px; }
.quest-here { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border); display: grid; gap: 4px; }
details summary { cursor: pointer; padding: 4px 0; color: var(--accent-2); }
</style>
