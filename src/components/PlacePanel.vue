<script setup lang="ts">
import FoldSection from './FoldSection.vue'
import HomePanel from './HomePanel.vue'
import { computed, ref, watch } from 'vue'
import { attrOf, mod } from '@/engine/character'
import { attrName, geography, locationById, shopRules } from '@/engine/data'
import { canTravelHere, CELL_ICON, CELL_NAME, cellName, currentArea, currentCell, DUNGEON_LAYERS, LOCK_METHODS, lockPicker, questRunnableHere, type LockMethod } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { marketsHere } from '@/engine/companions'
import { canNegotiate } from '@/engine/negotiation'
import { canAcceptRank, guildQuests, questTemplate, templeCost } from '@/engine/town'
import { examQuest, isExam, promotionStatus } from '@/engine/guild'
import { canTurnIn, deliverable, isCollectQuest, isMaterialQuest, layerName, layerRanks, questProgressText, rewardFor } from '@/engine/materialQuests'
import { bestTool } from '@/engine/tools'
import { legFare, MODE_NAME } from '@/engine/travel'
import type { Quest } from '@/engine/types'
import { reachable, type Path } from '@/engine/world'
import { useGame } from '@/stores/game'
import { useContent } from '@/stores/content'
import BrothelPanel from './BrothelPanel.vue'
import GuardStatus from './GuardStatus.vue'
import MarketPanel from './MarketPanel.vue'
import NegotiationPanel from './NegotiationPanel.vue'
import StoryPanel from './StoryPanel.vue'
import ShopPanel from './ShopPanel.vue'
import TattooPanel from './TattooPanel.vue'
import TavernPanel from './TavernPanel.vue'
import WorkPanel from './WorkPanel.vue'
import TrainPanel from './TrainPanel.vue'
import { checkBonus } from '@/engine/perks'
import CraftPanel from './CraftPanel.vue'

const game = useGame()
const content = useContent()
const s = computed(() => game.state!)
const here = computed(() => locationById(s.value.location))
const area = computed(() => currentArea(s.value))
const cell = computed(() => currentCell(s.value))
const lockTool = computed(() => bestTool(s.value, 'lockpick'))
const LOCK_ICON: Record<LockMethod, string> = { dex: '🔓', str: '💪', int: '🧠' }
function lockBonus(k: LockMethod): number {
  const picker = lockPicker(s.value, k)
  return mod(attrOf(picker, k)) + (k === 'dex' ? lockTool.value?.bonus ?? 0 : 0) + checkBonus(picker, { context: 'lock', attr: k })
}
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
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

const promo = computed(() => promotionStatus(s.value))
const exam = computed(() => examQuest(s.value))
const activeQuests = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'))
// 材料委託可以過量交付：選要交幾份（預設全部）
const turnInQty = ref<Record<string, number>>({})
function turnIn(q: Quest) {
  game.turnInQuest(q.id, isMaterialQuest(q) ? turnInQty.value[q.id] ?? deliverable(s.value, q) : undefined)
  refreshQuests()
}
const runnableHere = computed(() =>
  activeQuests.value.filter((q) => q.status === 'accepted' && q.area !== 'dungeon' && questRunnableHere(s.value, { ...q, spot: questTemplate(q)?.spot })),
)

function questWhere(q: Quest): string {
  if (canTurnIn(s.value, q)) return `可以交付了！回到${locationById(q.giver).name}的冒險者公會${isMaterialQuest(q) ? '（可以多交，報酬依數量增加）' : ''}`
  if (q.area === 'dungeon') return `目標：${locationById(q.target).name}${q.layer ? `・${layerName(q.layer)}` : ''}`
  if (isMaterialQuest(q)) return `地點：${locationById(q.target).name}近郊（${isCollectQuest(q) && q.monster ? '打倒牠們' : '採集點'}）`
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
  const fare = path.legs.reduce((sum, l) => sum + legFare(l), 0)
  const text = via.length ? `${modes}・經${via.join('、')}` : modes
  return fare > 0 ? `${text}・船資每人 ${formatMoney(fare)}` : text
}

/** 地下城各層的階級，例如「淺層 E・中層 D・深層 C」 */
function layerRankText(id: string) {
  return layerRanks(id).map((r) => `${layerName(r.layer)} ${r.rank}`).join('・')
}

function go(id: string) {
  game.travel(id, intent.value || undefined)
  intent.value = ''
}

const ICON = computed<Partial<Record<string, string>>>(() => {
  void content.version
  return { ...CELL_ICON, floor: '🧭' }
})

// 鐵匠鋪、裁縫店、珠寶店、魔法物品店、情報商：各自的交易清單
const SHOPS = ['smithy', 'tailor', 'jeweler', 'magic', 'informant'] as const
const shopHere = computed(() => (SHOPS as readonly string[]).includes(cell.value.kind) ? (cell.value.kind as (typeof SHOPS)[number]) : null)
// 商店的說明（shops.json 的 desc，內容頁籤可以改）
const shopDesc = computed(() => {
  void content.version
  return Object.values(shopRules.types).find((t) => t.cell === cell.value.kind)?.desc ?? ''
})
</script>

<template>
    <div class="place">
      <!-- 待售的空地、自己的房子 -->
      <HomePanel />
      <!-- 目前所在格子（房子裡由上面的房屋區塊顯示） -->
      <section v-if="area.kind !== 'road' && area.kind !== 'home'" class="panel">
        <h3>{{ ICON[cell.kind] ?? '📍' }} {{ cell.kind === 'wall' ? '道路' : cellName(cell.kind) }}</h3>
        <p v-if="shopDesc" class="muted small">{{ shopDesc }}</p>

        <template v-if="cell.kind === 'inn'">
          <p class="muted small">可以在這裡長休（見下方「休息」）。</p>
        </template>

        <template v-else-if="cell.kind === 'temple'">
          <p class="muted small">接受神殿治療：受傷的隊員 HP 回滿（不回復法術環）。</p>
          <button :disabled="templeCost(s) === 0 || s.money_cc < templeCost(s)" @click="game.templeHeal()">
            治療（{{ formatMoney(templeCost(s)) }}）
          </button>
          <ShopPanel :key="`temple-${s.location}-${s.time.day}`" type="temple" />
          <details class="tavern-trade">
            <summary class="small">🧼 洗刺青（要有聲望）</summary>
            <TattooPanel shop="temple" />
          </details>
        </template>

        <template v-else-if="cell.kind === 'tattoo'">
          <p class="muted small">刺普通刺青（只是外觀），也替人洗掉普通刺青。</p>
          <TattooPanel shop="parlor" />
        </template>

        <template v-else-if="cell.kind === 'carver'">
          <p class="muted small">刻誓約印記（屬性有加有減），也洗普通刺青與誓約印記；身上有奴隸印記時，可以付高價請刻印師燒掉（見主動行動的解除印記）。</p>
          <TattooPanel shop="carver" />
        </template>

        <template v-else-if="cell.kind === 'shop'">
          <p class="muted small">乾糧可以吃來果腹（戰鬥開始時有一點暫時生命）；地下城的安全房長休每人要一份。目前持有 {{ rations }} 份。</p>
          <ShopPanel :key="`general-${s.location}-${s.time.day}`" type="general" />
          <MarketPanel v-if="publicMarket" kind="public" />
        </template>

        <template v-else-if="shopHere">
          <ShopPanel :key="`${shopHere}-${s.location}-${s.time.day}`" :type="shopHere" />
        </template>

        <template v-else-if="cell.kind === 'tavern'">
          <TavernPanel :key="`${s.location}-${s.time.day}`" />
          <details class="tavern-trade">
            <summary class="small">酒館的交易（餐點、情報……）</summary>
            <ShopPanel :key="`tavern-${s.location}-${s.time.day}`" type="tavern" />
          </details>
        </template>

        <template v-else-if="cell.kind === 'guild'">
          <div class="guild-rank small">
            <div>
              🏅 你是 <strong>{{ promo.rank }} 級</strong>冒險者・功績 {{ promo.merit }}<template v-if="promo.next">・升 {{ promo.next }} 級需要功績 {{ promo.needMerit }}、等級 {{ promo.needLevel }}</template>
            </div>
            <div v-if="exam" class="hot">📜 晉升考核：{{ exam.title }}（{{ exam.status === 'available' ? '在委託板上，可以接取' : exam.status === 'ready' ? '完成了，可以交付' : '進行中' }}）</div>
            <div v-else-if="promo.next" class="muted">功績與等級都夠了，公會就會發晉升考核；通過才升階。交付委託（依委託階級）、打倒地下城層主、完成特殊任務都有功績。</div>
          </div>
          <FoldSection id="guild.board" title="📋 委託板" :count="quests.length">
          <ul class="plain">
            <li class="muted small">委託板每天更新，沒人接的委託會撤下換新（談過報酬的會保留）。</li>
            <li v-if="quests.length === 0" class="muted small">目前沒有委託。</li>
            <li v-for="q in quests" :key="q.id">
              <div><span class="tag" :class="{ hot: isExam(q) }">{{ isExam(q) ? `晉升 ${q.rank}` : q.rank }}</span> <span class="tag">{{ AREA_NAME[q.area] }}</span> {{ q.title }}</div>
              <div class="small muted">
                報酬 {{ formatMoney(q.reward_cc) }}<template v-if="isMaterialQuest(q) && (q.max ?? q.goal) > q.goal">（可以過量交付到 {{ q.max }}{{ isCollectQuest(q) ? ' 份' : ' 次' }}，報酬依比例增加）</template>
                <span v-if="q.status !== 'available'">・{{ questProgressText(s, q) }}</span>
              </div>
              <button
                v-if="q.status === 'available'"
                class="small"
                :disabled="!canAcceptRank(s, q.rank, q)"
                @click="game.acceptQuest(q.id); refreshQuests()"
              >{{ canAcceptRank(s, q.rank, q) ? '接取' : '階級不足' }}</button>
              <template v-else-if="canTurnIn(s, q)">
                <input
                  v-if="isMaterialQuest(q) && deliverable(s, q) > q.goal"
                  v-model.number="turnInQty[q.id]" type="number" class="qty" :min="q.goal" :max="deliverable(s, q)"
                  :placeholder="String(deliverable(s, q))"
                />
                <button class="small primary" @click="turnIn(q)">
                  交付<template v-if="isMaterialQuest(q)">（{{ formatMoney(rewardFor(q, turnInQty[q.id] ?? deliverable(s, q))) }}）</template>
                </button>
              </template>
              <span v-else class="small muted">進行中</span>
              <button
                v-if="!canNegotiate(s, 'quest_reward', { quest: q.id })"
                class="small"
                @click="game.startNegotiation('quest_reward', { quest: q.id })"
              >談判報酬</button>
              <span v-else-if="q.flags?.negotiated" class="small muted">（已談過報酬）</span>
            </li>
          </ul>
          </FoldSection>
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

        <template v-else-if="cell.kind === 'merchant'">
          <p class="muted small">照著情報找到的流浪商人：賣城裡少見的材料、藥劑、卷軸與幾件優良裝備。</p>
          <ShopPanel :key="`wanderer-${s.location}-${s.time.day}`" type="wanderer" />
        </template>

        <template v-else-if="cell.kind === 'exit' && area.kind === 'side'">
          <p class="muted small">{{ area.name }}的出口。</p>
          <button @click="game.leaveSide()">離開，回到{{ s.road ? '旅途' : '原本的地方' }}</button>
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

        <template v-else-if="cell.kind === 'chest' && !cell.done && cell.lock">
          <p class="muted small">🔒 上鎖的寶箱（DC {{ cell.lock }}）。選一種方式試著打開，由隊伍中那項屬性最高的人來做；失敗可以再試或換一種，每次 10 分鐘。{{ lockTool ? `開鎖時用${lockTool.name}（+${lockTool.bonus}）。` : '靈巧開鎖時，帶著開鎖類的工具會容易一點。' }}</p>
          <div class="row lock-methods">
            <button v-for="(m, k) in LOCK_METHODS" :key="k" class="small" @click="game.pickLock(k)">
              {{ LOCK_ICON[k] }} {{ m.name }} <span class="muted">（{{ attrName(k) }}・{{ lockPicker(s, k).name }} {{ signed(lockBonus(k)) }}）</span>
            </button>
          </div>
        </template>

        <p v-else class="muted small">{{ cell.done ? '這裡已經清理乾淨了。' : '四下無事。' }}</p>

        <WorkPanel :key="`${area.key}-${cell.kind}`" />
        <TrainPanel :key="`train-${area.key}-${cell.kind}`" />
        <CraftPanel :key="`craft-${area.key}-${cell.kind}`" />

        <div v-for="q in runnableHere" :key="q.id" class="quest-here">
          <div class="small"><span class="tag">{{ q.rank }}</span> {{ q.title }}</div>
          <button class="small primary" @click="runQuest(q.id)">執行委託（約 {{ questTemplate(q)?.hours ?? 1 }} 小時）</button>
        </div>
      </section>

      <NegotiationPanel />
      <StoryPanel />

      <section v-if="activeQuests.length" class="panel">
        <FoldSection id="quests.active" title="📜 進行中的委託" :count="activeQuests.length" level="h3">
        <ul class="plain small">
          <li v-for="q in activeQuests" :key="q.id">
            <span class="tag">{{ q.rank }}</span> {{ q.title }}（{{ questProgressText(s, q) }}）
            <span v-if="q.flags?.lead" class="tag">有線索 +5</span>
            <div class="muted">{{ questWhere(q) }}</div>
          </li>
        </ul>
        </FoldSection>
      </section>

      <section v-if="canTravelHere(s)" class="panel">
        <h3>🧳 啟程旅行</h3>
    <details v-for="g in destinations" :key="g.region.id" :open="g.region.id === here.region">
      <summary>{{ g.region.name }}</summary>
      <ul class="plain">
        <li v-for="d in g.items" :key="d.id" class="row" style="justify-content: space-between">
          <span>
            {{ locationById(d.id).name }}
            <span v-if="locationById(d.id).type === 'dungeon'" class="tag" :title="layerRankText(d.id)">冒險區域・{{ layerRankText(d.id) }}</span>
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
.guild-rank { display: grid; gap: 2px; padding: 6px 8px; border: 1px dashed var(--accent); border-radius: var(--radius); margin-bottom: 6px; }
.guild-rank .hot { color: var(--accent); }
.tag.hot { border-color: var(--accent); color: var(--accent); }
.lock-methods { display: flex; flex-wrap: wrap; gap: 4px; }
.tavern-trade { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 6px; }
.qty { width: 56px; }
.quest-here { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border); display: grid; gap: 4px; }
details summary { cursor: pointer; padding: 4px 0; color: var(--accent-2); }
</style>
