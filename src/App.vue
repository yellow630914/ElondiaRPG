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
import PartyStrip from '@/components/PartyStrip.vue'
import GameIcon from '@/components/ui/GameIcon.vue'
import type { IconName } from '@/components/ui/iconPaths'
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
  if (wanted.length) return { text: '通緝中', title: `被${wanted.map(factionName).join('、')}通緝` }
  const level = alertLevel(s)
  return level ? { text: `警戒 ${level}`, title: `${locationById(s.location).name}的衛兵警戒 ${level}` } : null
})

type Tab = 'adventure' | 'prompts' | 'content'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'adventure', label: '冒險', icon: 'map' },
  { id: 'prompts', label: '提示詞', icon: 'script' },
  { id: 'content', label: '世界', icon: 'world' },
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
// 白天（6～18 點）顯示太陽，晚上顯示月亮
const daytime = computed(() => { const h = game.state?.time.hour ?? 12; return h >= 6 && h < 18 })
const clock = computed(() => (game.state ? formatTime(game.state.time).split(' ').at(-1) : ''))

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
    <div class="logo"><GameIcon name="sword" :size="24" /><h1>埃隆迪亞大陸</h1></div>
    <nav v-if="game.state" class="tabs">
      <button v-for="t in TABS" :key="t.id" :class="{ active: tab === t.id }" @click="tab = t.id"><GameIcon :name="t.icon" :size="15" />{{ t.label }}</button>
    </nav>
    <nav v-else-if="screen !== 'home'" class="tabs">
      <button @click="screen = 'home'"><GameIcon name="home" :size="15" />首頁</button>
    </nav>
    <div v-if="game.state" class="hud">
      <span class="cell" title="遊戲時間"><GameIcon name="calendar" :size="15" /><span class="label">第</span><b>{{ game.state.time.day }}</b><span class="label">天</span><b>{{ clock }}</b><GameIcon :name="daytime ? 'sun' : 'moon'" :size="15" :class="daytime ? 'sun' : 'night'" /></span>
      <span class="cell" title="所在地點"><GameIcon name="pin" :size="15" /><b>{{ locationById(game.state.location).name }}</b></span>
      <span class="cell money" title="持有金錢"><GameIcon name="coins" :size="15" /><b>{{ formatMoney(game.state.money_cc) }}</b></span>
      <span v-if="crime" class="cell crime" :title="crime.title"><GameIcon name="siren" :size="15" /><b>{{ crime.text }}</b></span>
    </div>
    <div class="top-buttons">
      <button v-if="eventCount" class="small events" :class="{ hot: blockingEvent }" title="需要你處理的事" @click="eventDialogOpen = true"><GameIcon name="bell" :size="14" />待處理<span class="badge">{{ eventCount }}</span></button>
      <button v-if="game.state" class="ghost icon" title="快速存檔（F8 / Ctrl+S）" aria-label="快速存檔" @click="game.quickSave()"><GameIcon name="save" /></button>
      <button v-if="game.state" class="ghost icon" title="快速讀檔（F9）" aria-label="快速讀檔" @click="askQuickLoad"><GameIcon name="load" /></button>
      <button v-if="game.state" class="ghost icon" title="存檔與讀檔" aria-label="存檔與讀檔" @click="showSaves = true"><GameIcon name="saves" /></button>
      <button class="ghost icon" title="設定" aria-label="設定" @click="showSettings = true"><GameIcon name="settings" /></button>
      <button v-if="game.state" class="ghost icon" title="存好進度，回到首頁" aria-label="回到首頁" @click="goHome"><GameIcon name="home" /></button>
    </div>
  </header>
  <Transition name="fade">
    <div v-if="game.notice" class="notice">{{ game.notice }}</div>
  </Transition>

  <div v-if="game.saveWarning" class="error row save-warning">
    <span><GameIcon name="warning" :size="15" /> {{ game.saveWarning }}</span>
    <button class="small" style="margin-left: auto" @click="showSaves = true">存讀檔</button>
  </div>

  <div v-if="game.error" class="error row">
    <span><GameIcon name="warning" :size="15" /> {{ game.error }}</span>
    <button class="small ghost" style="margin-left: auto" aria-label="關閉" @click="game.error = null"><GameIcon name="close" :size="14" /></button>
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
      <PartyStrip @open="showParty = true" />
      <RoadPanel v-if="game.state.road && !inCombat" />
      <template v-if="!inCombat">
        <RestPanel />
        <ActionPanel />
        <IntentPanel />
      </template>
    </aside>

    <section class="center">
      <nav class="panel toolbar">
        <button class="ghost" @click="showParty = true"><GameIcon name="users" :size="20" />隊伍<span v-if="pendingSkills" class="note">可升級</span></button>
        <button class="ghost" @click="showInventory = true"><GameIcon name="backpack" :size="20" />行囊</button>
        <button class="ghost" :title="suggestionCount ? `${suggestionCount} 則提議` : ''" @click="showRelations = true"><GameIcon name="heart" :size="20" />關係<span v-if="suggestionCount" class="badge">{{ suggestionCount }}</span></button>
        <button class="ghost" :title="readyQuests ? `${readyQuests} 件委託可以交付` : ''" @click="showNotebook = true"><GameIcon name="notebook" :size="20" />筆記<span v-if="readyQuests" class="badge gold">{{ readyQuests }}</span></button>
        <button class="ghost" @click="showCraft = true"><GameIcon name="tools" :size="20" />工藝</button>
      </nav>
      <CombatView v-if="inCombat" />
      <LogView v-else />
    </section>

    <aside v-if="!inCombat" class="right">
      <PeoplePanel />
      <PlacePanel />
    </aside>
  </main>

  <AppDialog :open="showParty" title="隊伍" icon="users" width="1200px" @close="showParty = false">
    <PartyView />
  </AppDialog>
  <AppDialog :open="showInventory" title="行囊" icon="backpack" width="1000px" @close="showInventory = false">
    <InventoryView />
  </AppDialog>
  <AppDialog :open="showRelations" title="人際關係與冒險記憶" icon="heart" width="1200px" @close="showRelations = false">
    <RelationsView />
  </AppDialog>
  <AppDialog :open="showNotebook" title="冒險筆記" icon="notebook" width="900px" @close="showNotebook = false">
    <NotebookView />
  </AppDialog>
  <AppDialog :open="showCraft" title="工藝" icon="tools" width="760px" @close="showCraft = false">
    <CraftDialog @close="showCraft = false" />
  </AppDialog>
  <AppDialog :open="showSaves" title="存檔與讀檔" icon="saves" width="860px" @close="showSaves = false">
    <SaveDialog @loaded="showSaves = false" />
  </AppDialog>
  <AppDialog :open="showSettings" title="設定" icon="settings" width="760px" @close="showSettings = false">
    <SettingsView />
  </AppDialog>

  <EventCenter v-if="game.state" @open-party="tab = 'adventure'; showParty = true" @open-relations="tab = 'adventure'; showRelations = true" />
</template>

<style scoped>
.top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; padding: 4px 4px 12px; margin-bottom: 14px; position: relative; }
.top::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-lo), var(--accent), var(--gold-lo), transparent);
}
.logo { display: flex; align-items: center; gap: 10px; color: var(--accent); }
.logo h1 {
  margin: 0; font-size: 1.4rem; font-weight: 900; letter-spacing: 0.22em;
  background: linear-gradient(180deg, #fff1c6, #e2b45a 55%, #a87528); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 0 #000);
}
.tabs { display: flex; gap: 2px; }
.tabs button { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; border-bottom: 2px solid transparent; border-radius: 0; color: var(--muted); padding: 6px 12px; }
.tabs button:hover:not(:disabled) { color: var(--text); border-color: transparent; }
.tabs button.active { color: var(--gold-hi); border-bottom-color: var(--accent); }
.hud { display: flex; gap: 4px; flex-wrap: wrap; }
.hud .cell { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; background: #0006; border: 1px solid #ffffff12; border-radius: 2px; color: var(--accent); }
.hud .cell b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.hud .cell .label { letter-spacing: 0.04em; }
.hud .money b { color: var(--gold-hi); }
.hud .night { color: #8ab6ef; }
.hud .crime, .hud .crime b { color: var(--danger); }
.top-buttons { margin-left: auto; display: flex; gap: 2px; align-items: center; }
.top-buttons .icon { width: 34px; height: 34px; padding: 0; display: grid; place-items: center; color: var(--muted); }
.events { display: inline-flex; align-items: center; gap: 4px; border-color: var(--accent); color: var(--gold-hi); margin-right: 6px; }
.events.hot { border-color: var(--danger); color: var(--danger); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.55; } }
.badge {
  display: inline-block; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--danger); color: #fff;
  font: 700 11px/17px system-ui, sans-serif; text-align: center;
}
.badge.gold { background: var(--accent); color: #1a1008; }
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
  grid-template-columns: 400px minmax(0, 1fr) 380px;
  grid-template-areas: 'left center right';
  gap: 16px;
  align-items: start;
}
.left { grid-area: left; }
.center { grid-area: center; min-width: 0; }
.right { grid-area: right; }
.game.combat { grid-template-areas: 'left center center'; }

/* 日誌上方的工具列 */
.toolbar { display: flex; flex-wrap: wrap; padding: 0; margin-bottom: 12px; }
.toolbar button {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: none; border-right: 1px solid #ffffff10; border-radius: 0;
  color: var(--text); font-size: var(--fs-md);
}
.toolbar button :deep(.game-icon) { color: var(--accent); }
.toolbar button:hover:not(:disabled) { background: #c99a4512; color: var(--gold-hi); }
.toolbar .note { font-size: 10px; line-height: 15px; padding: 0 4px; border-radius: 2px; background: var(--accent); color: #1a1008; font-weight: 700; }

@media (max-width: 1380px) {
  .game { grid-template-columns: 400px minmax(0, 1fr); grid-template-areas: 'left center' 'right center'; }
  .game.combat { grid-template-areas: 'left center'; }
}
@media (max-width: 960px) {
  .game, .game.combat { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'left' 'center' 'right'; }
}
</style>
