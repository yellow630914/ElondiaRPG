<script setup lang="ts">
import { computed, ref } from 'vue'
import { locationById } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { formatTime } from '@/engine/state'
import { useGame } from '@/stores/game'
import ActionPanel from '@/components/ActionPanel.vue'
import AppDialog from '@/components/AppDialog.vue'
import CombatView from '@/components/CombatView.vue'
import IntentPanel from '@/components/IntentPanel.vue'
import LogView from '@/components/LogView.vue'
import MapPanel from '@/components/MapPanel.vue'
import NewGameView from '@/components/NewGameView.vue'
import PartyView from '@/components/PartyView.vue'
import PlacePanel from '@/components/PlacePanel.vue'
import RelationsView from '@/components/RelationsView.vue'
import RestPanel from '@/components/RestPanel.vue'
import SettingsView from '@/components/SettingsView.vue'
import SuggestionToast from '@/components/SuggestionToast.vue'

const game = useGame()
const inCombat = computed(() => !!game.state?.combat)
const pendingSkills = computed(() => game.state?.party.some((m) => m.pendingAbilityChoices?.length || m.attrPoints > 0) ?? false)
const suggestionCount = computed(() => game.state?.suggestions?.length ?? 0)

const showSettings = ref(false)
const showParty = ref(false)
const showRelations = ref(false)
</script>

<template>
  <header class="top">
    <h1>⚔️ 埃隆迪亞大陸</h1>
    <div v-if="game.state" class="row status small">
      <span>📅 {{ formatTime(game.state.time) }}</span>
      <span>📍 {{ locationById(game.state.location).name }}</span>
      <span>💰 {{ formatMoney(game.state.money_cc) }}</span>
    </div>
    <button class="settings-btn" title="設定" @click="showSettings = true">⚙️ 設定</button>
  </header>

  <div v-if="game.error" class="error row">
    <span>⚠️ {{ game.error }}</span>
    <button class="small" style="margin-left: auto" @click="game.error = null">✕</button>
  </div>

  <NewGameView v-if="!game.state" @settings="showSettings = true" />

  <main v-else class="game" :class="{ combat: inCombat }">
    <aside class="left">
      <MapPanel />
      <section class="panel quick">
        <button @click="showParty = true">
          👥 隊伍 <span v-if="pendingSkills" class="tag hot">可升級</span>
        </button>
        <button @click="showRelations = true">
          💞 關係 <span v-if="suggestionCount" class="tag hot">{{ suggestionCount }} 則提議</span>
        </button>
      </section>
      <template v-if="!inCombat">
        <ActionPanel />
        <RestPanel />
        <IntentPanel />
      </template>
    </aside>

    <section class="center">
      <CombatView v-if="inCombat" />
      <LogView v-else />
    </section>

    <aside v-if="!inCombat" class="right">
      <PlacePanel />
    </aside>
  </main>

  <AppDialog :open="showParty" title="隊伍" icon="👥" width="1200px" @close="showParty = false">
    <PartyView />
  </AppDialog>
  <AppDialog :open="showRelations" title="人際關係與冒險記憶" icon="💞" width="1200px" @close="showRelations = false">
    <RelationsView />
  </AppDialog>
  <AppDialog :open="showSettings" title="設定" icon="⚙️" width="760px" @close="showSettings = false">
    <SettingsView />
  </AppDialog>

  <SuggestionToast v-if="game.state && !showRelations" @open-relations="showRelations = true" />
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
.settings-btn { margin-left: auto; }

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
.quick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.quick button { padding: 10px; font-size: 1rem; }
.tag.hot { color: var(--accent); border-color: var(--accent); }

@media (max-width: 1380px) {
  .game { grid-template-columns: 410px minmax(0, 1fr); grid-template-areas: 'left center' 'right center'; }
  .game.combat { grid-template-areas: 'left center'; }
}
@media (max-width: 960px) {
  .game, .game.combat { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'left' 'center' 'right'; }
}
</style>
