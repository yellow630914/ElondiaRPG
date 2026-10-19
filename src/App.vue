<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { locationById } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { formatTime } from '@/engine/state'
import { useGame } from '@/stores/game'
import NewGameView from '@/components/NewGameView.vue'
import AdventureView from '@/components/AdventureView.vue'
import CombatView from '@/components/CombatView.vue'
import PartyView from '@/components/PartyView.vue'
import LogView from '@/components/LogView.vue'
import SettingsView from '@/components/SettingsView.vue'

type Tab = 'adventure' | 'party' | 'log' | 'settings'
const TABS: { id: Tab; name: string }[] = [
  { id: 'adventure', name: '冒險' },
  { id: 'party', name: '隊伍' },
  { id: 'log', name: '日誌' },
  { id: 'settings', name: '設定' },
]

const game = useGame()
const tab = ref<Tab>('adventure')
const inCombat = computed(() => !!game.state?.combat)
const pendingSkills = computed(() => game.state?.party.some((m) => m.pendingSkillChoices?.length) ?? false)

watch(inCombat, (now) => {
  if (now) tab.value = 'adventure'
})

function onCombatFinished() {
  tab.value = 'log'
}
</script>

<template>
  <header class="top">
    <h1>埃隆迪亞大陸</h1>
    <div v-if="game.state" class="row status small">
      <span>📅 {{ formatTime(game.state.time) }}</span>
      <span>📍 {{ locationById(game.state.location).name }}</span>
      <span>💰 {{ formatMoney(game.state.money_cc) }}</span>
    </div>
  </header>

  <NewGameView v-if="!game.state && tab !== 'settings'" @settings="tab = 'settings'" />

  <template v-else>
    <nav class="tabs">
      <button
        v-for="t in TABS"
        :key="t.id"
        :class="{ active: tab === t.id }"
        :disabled="!game.state && t.id !== 'settings'"
        @click="tab = t.id"
      >
        {{ t.name }}
        <span v-if="t.id === 'adventure' && inCombat" class="tag">戰鬥中</span>
        <span v-if="t.id === 'party' && pendingSkills" class="tag">可選技能</span>
      </button>
      <button v-if="!game.state" @click="tab = 'adventure'">← 返回</button>
    </nav>

    <div v-if="game.error" class="error">{{ game.error }}</div>

    <template v-if="tab === 'adventure' && game.state">
      <CombatView v-if="inCombat" @finished="onCombatFinished" />
      <AdventureView v-else />
    </template>
    <PartyView v-else-if="tab === 'party'" />
    <LogView v-else-if="tab === 'log'" />
    <SettingsView v-else-if="tab === 'settings'" />
  </template>
</template>

<style scoped>
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.top h1 { font-size: 1.4rem; color: var(--accent); letter-spacing: 0.1em; }
.status { gap: 16px; color: var(--muted); }
.tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
</style>
