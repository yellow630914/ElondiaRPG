<script setup lang="ts">
import { computed, ref } from 'vue'
import mapUrl from '../../assets/map/elondia-map.webp'
import { combatRules, encounterTables, geography, isSettlement, locationById, raceName, className } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { canAcceptRank, recruitableHere, restCost, RATION_CC } from '@/engine/town'
import { MODE_NAME } from '@/engine/travel'
import type { Quest } from '@/engine/types'
import { reachable, type Path } from '@/engine/world'
import { useGame } from '@/stores/game'

const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const settlement = computed(() => isSettlement(here.value))
const canExplore = computed(() => !!encounterTables[s.value.location])
const intent = ref('')
const rationQty = ref(5)
const showMap = ref(false)
const guildOpen = ref(false)
const quests = ref<Quest[]>([])

const destinations = computed(() => {
  const list = reachable(s.value.location)
  return geography.regions
    .map((r) => ({
      region: r,
      items: list.filter((d) => locationById(d.id).region === r.id),
    }))
    .filter((g) => g.items.length > 0)
})

const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0)
const activeQuests = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'))
const recruitable = computed(() => recruitableHere(s.value))
const partyFull = computed(() => s.value.party.length >= combatRules.party_max)

function daysText(days: [number, number]) {
  return days[0] === days[1] ? `${days[0]} 天` : `${days[0]}～${days[1]} 天`
}

function routeText(path: Path) {
  const modes = [...new Set(path.legs.map((l) => MODE_NAME[l.mode]))].join('/')
  const via = path.legs.slice(0, -1).map((l) => locationById(l.to).name)
  return via.length ? `${modes}・經${via.join('、')}` : modes
}

function openGuild() {
  quests.value = game.visitGuild()
  guildOpen.value = true
}

function refreshQuests() {
  quests.value = s.value.quests.filter((q) => q.giver === s.value.location && q.status !== 'completed')
}

function accept(id: string) {
  game.acceptQuest(id)
  refreshQuests()
}

function turnIn(id: string) {
  game.turnInQuest(id)
  refreshQuests()
}

function go(id: string) {
  game.travel(id, intent.value || undefined)
  intent.value = ''
  guildOpen.value = false
}

function explore() {
  game.explore(intent.value || undefined)
  intent.value = ''
}
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between">
      <h2>{{ here.name }}</h2>
      <button class="small" @click="showMap = !showMap">{{ showMap ? '收起地圖' : '世界地圖' }}</button>
    </div>
    <p class="muted small">
      {{ geography.regions.find((r) => r.id === here.region)?.name }}
      <span v-if="here.note">・{{ here.note }}</span>
    </p>
    <img v-if="showMap" :src="mapUrl" alt="埃隆迪亞大陸地圖" class="map" />
    <label class="intent small">
      行動備註（選填，會交給 AI 作為玩家意圖）
      <input v-model="intent" placeholder="例如：優先保護隊友、想打聽關於魔族的消息" />
    </label>
  </section>

  <div class="grid">
    <!-- 冒險區域 -->
    <section v-if="canExplore" class="panel">
      <h3>探索 {{ here.name }}</h3>
      <p class="muted small">深入冒險區域會遭遇敵人，進入逐回合戰鬥。</p>
      <button class="primary" @click="explore">開始探索</button>
    </section>

    <!-- 城鎮設施 -->
    <template v-if="settlement">
      <section class="panel">
        <h3>旅店</h3>
        <p class="muted small">住一晚，全員 HP/MP 回滿。</p>
        <button :disabled="s.money_cc < restCost(s)" @click="game.rest()">休息（{{ formatMoney(restCost(s)) }}）</button>
      </section>

      <section class="panel">
        <h3>雜貨店</h3>
        <p class="muted small">野外與海路旅行每人每天消耗 1 份乾糧。目前持有 {{ rations }} 份。</p>
        <div class="row">
          <input v-model.number="rationQty" type="number" min="1" max="99" style="width: 70px" />
          <button :disabled="s.money_cc < rationQty * RATION_CC || rationQty < 1" @click="game.buyRations(rationQty)">
            購買乾糧（{{ formatMoney(rationQty * RATION_CC) }}）
          </button>
        </div>
      </section>

      <section class="panel">
        <h3>酒館</h3>
        <p v-if="recruitable.length === 0" class="muted small">這裡沒有願意同行的冒險者。</p>
        <ul class="plain">
          <li v-for="n in recruitable" :key="n.id">
            <div class="row" style="justify-content: space-between">
              <strong>{{ n.name }}</strong>
              <span class="small muted">{{ raceName(n.race) }}・{{ className(n.class) }} Lv.{{ n.level }}</span>
            </div>
            <div class="small muted">{{ n.personality }}</div>
            <button
              class="small"
              :disabled="partyFull || s.money_cc < n.hire_cc"
              @click="game.recruit(n.id)"
            >招募（{{ formatMoney(n.hire_cc) }}）</button>
            <span v-if="partyFull" class="small muted"> 隊伍已滿</span>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>冒險者公會</h3>
        <button v-if="!guildOpen" @click="openGuild">查看委託</button>
        <ul v-else class="plain">
          <li v-if="quests.length === 0" class="muted small">目前沒有委託。</li>
          <li v-for="q in quests" :key="q.id">
            <div><span class="tag">{{ q.rank }}</span> {{ q.title }}</div>
            <div class="small muted">
              報酬 {{ formatMoney(q.reward_cc) }}
              <span v-if="q.status !== 'available'">・進度 {{ q.progress }}/{{ q.goal }}</span>
            </div>
            <button v-if="q.status === 'available'" class="small" :disabled="!canAcceptRank(s, q.rank)" @click="accept(q.id)">
              {{ canAcceptRank(s, q.rank) ? '接取' : '階級不足' }}
            </button>
            <button v-else-if="q.status === 'ready'" class="small primary" @click="turnIn(q.id)">交付</button>
            <span v-else class="small muted">進行中</span>
          </li>
        </ul>
      </section>
    </template>

    <section v-if="activeQuests.length" class="panel">
      <h3>進行中的委託</h3>
      <ul class="plain small">
        <li v-for="q in activeQuests" :key="q.id">
          <span class="tag">{{ q.rank }}</span> {{ q.title }}（{{ q.progress }}/{{ q.goal }}）
          <div class="muted">
            {{ q.status === 'ready' ? `完成！回到${locationById(q.giver).name}交付` : `目標：${locationById(q.target).name}` }}
          </div>
        </li>
      </ul>
    </section>
  </div>

  <section class="panel">
    <h3>移動</h3>
    <details v-for="g in destinations" :key="g.region.id" :open="g.region.id === here.region">
      <summary>{{ g.region.name }}</summary>
      <ul class="plain">
        <li v-for="d in g.items" :key="d.id" class="row" style="justify-content: space-between">
          <span>
            {{ locationById(d.id).name }}
            <span v-if="locationById(d.id).type === 'dungeon'" class="tag">冒險區域</span>
            <span class="small muted">
              ・{{ daysText(d.path.days) }}・{{ routeText(d.path) }}
            </span>
          </span>
          <button class="small" @click="go(d.id)">前往</button>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.map { width: 100%; border-radius: var(--radius); margin: 8px 0; }
.intent { display: grid; gap: 4px; margin-top: 8px; }
details summary { cursor: pointer; padding: 4px 0; color: var(--accent-2); }
</style>
