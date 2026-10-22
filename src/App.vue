<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { locationById } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { formatTime } from '@/engine/state'
import { alertLevel, factionName } from '@/engine/security'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import { useContent } from '@/stores/content'
import HomeView from '@/components/HomeView.vue'
import ActionPanel from '@/components/ActionPanel.vue'
import AppDialog from '@/components/AppDialog.vue'
import NotebookView from '@/components/NotebookView.vue'
import CraftDialog from '@/components/CraftDialog.vue'
import { canTurnIn } from '@/engine/materialQuests'
import RoadPanel from '@/components/RoadPanel.vue'
import CombatView from '@/components/CombatView.vue'
import IntentPanel from '@/components/IntentPanel.vue'
import LogView from '@/components/LogView.vue'
import MapPanel from '@/components/MapPanel.vue'
import NewGameView from '@/components/NewGameView.vue'
import PartyView from '@/components/PartyView.vue'
import InventoryView from '@/components/items/InventoryView.vue'
import PeoplePanel from '@/components/PeoplePanel.vue'
import PlacePanel from '@/components/PlacePanel.vue'
import RelationsView from '@/components/RelationsView.vue'
import RestPanel from '@/components/RestPanel.vue'
import SaveDialog from '@/components/SaveDialog.vue'
import SettingsView from '@/components/SettingsView.vue'
import EventCenter from '@/components/events/EventCenter.vue'
import { activeEvents, eventDialogOpen, pendingEvents } from '@/components/events/eventQueue'

// 提示詞頁籤會載入整本世界書，切過去時才載入
const PromptsView = defineAsyncComponent(() => import('@/components/PromptsView.vue'))
const ContentView = defineAsyncComponent(() => import('@/components/ContentView.vue'))

const game = useGame()
// 成人向開關變更時重畫遊戲畫面（娼館／按摩店等名稱）
const settings = useSettings()
const inCombat = computed(() => !!game.state?.combat)
const pendingSkills = computed(() => game.state?.party.some((m) => m.pendingAbilityChoices?.length || m.attrPoints > 0) ?? false)
const suggestionCount = computed(() => game.state?.suggestions?.length ?? 0)
// 需要回應的事件（事件視窗關著時在上方提醒）
const eventCount = computed(() => pendingEvents(game.state).length)
const blockingEvent = computed(() => activeEvents(game.state).some((e) => e.blocking))
// 通緝與這裡的衛兵警戒
const crime = computed(() => {
  const s = game.state
  if (!s) return null
  const wanted = Object.keys(s.wanted ?? {})
  if (wanted.length) return { text: '⛔ 通緝中', title: `被${wanted.map(factionName).join('、')}通緝` }
  const level = alertLevel(s)
  return level ? { text: `🚨 警戒 ${level}`, title: `${locationById(s.location).name}的衛兵警戒 ${level}` } : null
})

type Tab = 'adventure' | 'prompts' | 'content'
const TABS: { id: Tab; label: string }[] = [
  { id: 'adventure', label: '🗺️ 冒險' },
  { id: 'prompts', label: '🧩 提示詞' },
  { id: 'content', label: '🛠️ 內容' },
]
const tab = ref<Tab>('adventure')

// 沒有載入遊戲時：首頁與它的幾個畫面（開新遊戲、世界管理、提示詞管理）
type Screen = 'home' | 'new' | 'worlds' | 'prompts'
const screen = ref<Screen>('home')
const content = useContent()
// 進入遊戲時切到冒險頁；回到首頁時從首頁開始
watch(() => !!game.state, (inGame) => {
  if (inGame) {
    tab.value = 'adventure'
    showSaves.value = false
  } else screen.value = 'home'
})
async function goHome() {
  closeDialogs()
  await game.toHome()
}
function closeDialogs() {
  showParty.value = showInventory.value = showRelations.value = showNotebook.value = showCraft.value = showSaves.value = showSettings.value = false
}

const showSettings = ref(false)
const showParty = ref(false)
const showInventory = ref(false)
const showRelations = ref(false)
const showNotebook = ref(false)
const showCraft = ref(false)
/** 可以回公會交付的委託 */
const readyQuests = computed(() => (game.state ? game.state.quests.filter((q) => canTurnIn(game.state!, q)).length : 0))
const showSaves = ref(false)

function askQuickLoad() {
  if (!game.state || confirm('讀取快速存檔？目前的進度會先自動存一份。')) void game.quickLoad()
}

// 快捷鍵：F8 / Ctrl+S 快速存檔，F9 快速讀檔
function onKey(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
  if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
    e.preventDefault()
    if (game.state) void game.quickSave()
  } else if (e.key === 'F9' && !typing && game.state) {
    e.preventDefault()
    askQuickLoad()
  }
}
// 自動保存失敗時，離開頁面前提醒一下
function onLeave(e: BeforeUnloadEvent) {
  if (!game.saveWarning) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onLeave)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onLeave)
})
</script>

<template>
  <header class="top">
    <h1>⚔️ 埃隆迪亞大陸</h1>
    <nav v-if="game.state" class="row tabs">
      <button v-for="t in TABS" :key="t.id" :class="{ active: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
    </nav>
    <nav v-else-if="screen !== 'home'" class="row tabs">
      <button @click="screen = 'home'">← 首頁</button>
    </nav>
    <div v-if="game.state" class="row status small">
      <span>📅 {{ formatTime(game.state.time) }}</span>
      <span>📍 {{ locationById(game.state.location).name }}</span>
      <span>💰 {{ formatMoney(game.state.money_cc) }}</span>
      <span v-if="crime" class="crime" :title="crime.title">{{ crime.text }}</span>
    </div>
    <div class="row top-buttons">
      <button v-if="eventCount" class="small events" :class="{ hot: blockingEvent }" title="需要你處理的事" @click="eventDialogOpen = true">🔔 {{ eventCount }} 件待處理</button>
      <button v-if="game.state" class="small" title="快速存檔（F8 / Ctrl+S）" @click="game.quickSave()">⚡ 快存</button>
      <button v-if="game.state" class="small" title="快速讀檔（F9）" @click="askQuickLoad">⚡ 快讀</button>
      <button v-if="game.state" title="存檔與讀檔" @click="showSaves = true">💾 存讀檔</button>
      <button title="設定" @click="showSettings = true">⚙️ 設定</button>
      <button v-if="game.state" title="存好進度，回到首頁" @click="goHome">🏠 首頁</button>
    </div>
  </header>
  <Transition name="fade">
    <div v-if="game.notice" class="notice">{{ game.notice }}</div>
  </Transition>

  <div v-if="game.saveWarning" class="error row save-warning">
    <span>💾⚠️ {{ game.saveWarning }}</span>
    <button class="small" style="margin-left: auto" @click="showSaves = true">💾 存讀檔</button>
  </div>

  <div v-if="game.error" class="error row">
    <span>⚠️ {{ game.error }}</span>
    <button class="small" style="margin-left: auto" @click="game.error = null">✕</button>
  </div>

  <template v-if="!game.state">
    <HomeView
      v-if="screen === 'home'"
      @new="screen = 'new'" @load="showSaves = true" @worlds="screen = 'worlds'" @prompts="screen = 'prompts'" @settings="showSettings = true"
    />
    <!-- 換世界時重畫，自訂的種族、能力、NPC 才會跟著變 -->
    <NewGameView v-else-if="screen === 'new'" :key="content.active" @settings="showSettings = true" @home="screen = 'home'" />
    <ContentView v-else-if="screen === 'worlds'" />
    <PromptsView v-else-if="screen === 'prompts'" />
  </template>

  <PromptsView v-if="game.state && tab === 'prompts'" />
  <ContentView v-if="game.state && tab === 'content'" />

  <main v-if="game.state" v-show="tab === 'adventure'" :key="settings.adult ? 'adult' : 'safe'" class="game" :class="{ combat: inCombat }">
    <aside class="left">
      <MapPanel />
      <RoadPanel v-if="game.state.road && !inCombat" />
      <section class="panel quick">
        <button @click="showParty = true">
          👥 隊伍 <span v-if="pendingSkills" class="tag hot">可升級</span>
        </button>
        <button @click="showInventory = true">🎒 行囊</button>
        <button @click="showRelations = true">
          💞 關係 <span v-if="suggestionCount" class="tag hot">{{ suggestionCount }} 則提議</span>
        </button>
        <button @click="showNotebook = true">
          📒 筆記 <span v-if="readyQuests" class="tag hot">{{ readyQuests }} 件可交付</span>
        </button>
        <button @click="showCraft = true">🛠️ 工藝</button>
      </section>
      <template v-if="!inCombat">
        <RestPanel />
        <ActionPanel />
        <IntentPanel />
      </template>
    </aside>

    <section class="center">
      <CombatView v-if="inCombat" />
      <LogView v-else />
    </section>

    <aside v-if="!inCombat" class="right">
      <PeoplePanel />
      <PlacePanel />
    </aside>
  </main>

  <AppDialog :open="showParty" title="隊伍" icon="👥" width="1200px" @close="showParty = false">
    <PartyView />
  </AppDialog>
  <AppDialog :open="showInventory" title="行囊" icon="🎒" width="1000px" @close="showInventory = false">
    <InventoryView />
  </AppDialog>
  <AppDialog :open="showRelations" title="人際關係與冒險記憶" icon="💞" width="1200px" @close="showRelations = false">
    <RelationsView />
  </AppDialog>
  <AppDialog :open="showNotebook" title="冒險筆記" icon="📒" width="900px" @close="showNotebook = false">
    <NotebookView />
  </AppDialog>
  <AppDialog :open="showCraft" title="工藝" icon="🛠️" width="760px" @close="showCraft = false">
    <CraftDialog @close="showCraft = false" />
  </AppDialog>
  <AppDialog :open="showSaves" title="存檔與讀檔" icon="💾" width="860px" @close="showSaves = false">
    <SaveDialog @loaded="showSaves = false" />
  </AppDialog>
  <AppDialog :open="showSettings" title="設定" icon="⚙️" width="760px" @close="showSettings = false">
    <SettingsView />
  </AppDialog>

  <EventCenter v-if="game.state" @open-party="tab = 'adventure'; showParty = true" @open-relations="tab = 'adventure'; showRelations = true" />
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.top h1 { font-size: 1.4rem; color: var(--accent); letter-spacing: 0.1em; margin: 0; }
.status { gap: 16px; color: var(--muted); }
.crime { color: var(--danger); }
.events { border-color: var(--accent); color: var(--accent); }
.events.hot { border-color: var(--danger); color: var(--danger); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.55; } }
.tabs { gap: 6px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.top-buttons { margin-left: auto; gap: 6px; }
.notice {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 60;
  background: var(--panel); border: 1px solid var(--accent); border-radius: var(--radius);
  padding: 6px 14px; box-shadow: 0 6px 20px #000a;
}
.save-warning { position: sticky; top: 0; z-index: 50; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.game {
  display: grid;
  grid-template-columns: 410px minmax(0, 1fr) 380px;
  grid-template-areas: 'left center right';
  gap: 14px;
  align-items: start;
}
.left { grid-area: left; }
.center { grid-area: center; min-width: 0; }
.right { grid-area: right; }
.game.combat { grid-template-areas: 'left center center'; }
.quick { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.quick button { padding: 10px 4px; font-size: 1rem; }
.tag.hot { color: var(--accent); border-color: var(--accent); }

@media (max-width: 1380px) {
  .game { grid-template-columns: 410px minmax(0, 1fr); grid-template-areas: 'left center' 'right center'; }
  .game.combat { grid-template-areas: 'left center'; }
}
@media (max-width: 960px) {
  .game, .game.combat { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'left' 'center' 'right'; }
}
</style>
