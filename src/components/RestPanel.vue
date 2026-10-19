<script setup lang="ts">
import { computed, ref } from 'vue'
import { classEmoji, companionRules, raceEmoji } from '@/engine/data'
import { currentArea, currentCell } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { leaderOf } from '@/engine/party'
import { autoHitDice, hitDiceLeft, hitDie, innCost, longRestBlocked } from '@/engine/rest'
import { useGame } from '@/stores/game'
import NameTag from './NameTag.vue'

const game = useGame()
const s = computed(() => game.state!)
const cell = computed(() => currentCell(s.value))
const area = computed(() => currentArea(s.value))
const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0)
const ambush = computed(() => (cell.value.kind === 'safe' ? 0 : companionRules.rest.ambush[area.value.kind] ?? 0))
const place = computed(() => (cell.value.kind === 'inn' ? 'inn' : cell.value.kind === 'safe' ? 'safe' : null))
const blocked = computed(() => (place.value ? longRestBlocked(s.value, place.value) : null))
const leaveMode = computed(() => s.value.pendingLeave?.mode)
const lowAffinity = computed(() =>
  s.value.party.filter((m) => !m.isPlayer && m.bond !== 'slave' && (m.affinity ?? 0) <= companionRules.leave_threshold),
)
const leader = computed(() => leaderOf(s.value))

// 長休時的互動
const talkText = ref('')
const talkTarget = ref('')
const companions = computed(() => s.value.party.filter((m) => !m.isPlayer))
async function doLongRest(where: 'inn' | 'safe') {
  const text = talkText.value.trim()
  talkText.value = ''
  await game.longRest(where, text ? { text, ...(talkTarget.value ? { target: talkTarget.value } : {}) } : undefined)
}
</script>

<template>
  <section class="panel">
    <h3>🛏️ 休息</h3>
    <p class="small muted">
      短休 1 小時：花生命骰回復生命值。<span v-if="ambush">這裡有 {{ Math.round(ambush * 100) }}% 的機率被襲擊。</span>
    </p>
    <ul class="plain small dice">
      <li v-for="m in s.party" :key="m.id">
        <NameTag :id="m.id" />：生命骰 d{{ hitDie(m) }} × {{ hitDiceLeft(m) }}/{{ m.level }}<span v-if="autoHitDice(m)" class="muted">（會用 {{ autoHitDice(m) }} 顆）</span>
      </li>
    </ul>
    <button class="small" @click="game.shortRest()">☕ 短休</button>

    <template v-if="place === 'inn'">
      <p class="small muted">長休（住到隔天早上）：生命值、法術環全滿，回復一半生命骰。24 小時內只能長休一次。</p>
      <button :disabled="!!blocked || s.money_cc < innCost(s)" @click="doLongRest('inn')">🌙 長休（{{ formatMoney(innCost(s)) }}）</button>
    </template>
    <template v-else-if="place === 'safe'">
      <p class="small muted">安全房可以長休 8 小時（每人 1 份乾糧，每間一次），短休也不會被襲擊。</p>
      <button :disabled="!!blocked || rations < s.party.length" @click="doLongRest('safe')">🌙 長休（乾糧 {{ s.party.length }} 份）</button>
    </template>
    <p v-else class="small muted">長休要在旅店或地下城的安全房。</p>
    <p v-if="blocked && place" class="small muted">{{ blocked }}</p>
    <div v-if="place && !blocked" class="talk small">
      <label>
        長休時想做什麼？（選填，主動行動）
        <textarea v-model="talkText" rows="2" :placeholder="place === 'inn' ? '例如：睡前在旅店大廳和其他旅客聊天、陪莉娜看星星' : '例如：守夜時和隊友聊起各自的故鄉'" />
      </label>
      <select v-model="talkTarget">
        <option value="">👥 全體夥伴</option>
        <option v-for="m in companions" :key="m.id" :value="m.id">{{ raceEmoji(m.race) }}{{ m.name }}{{ classEmoji(m.class) }}</option>
        <option v-if="place === 'inn'" value="guests">🏨 同旅館的旅客</option>
      </select>
    </div>

    <p v-if="leaveMode && leader" class="small warn">下次休息時會{{ leaveMode === 'sneak' ? '偷偷離開' : '向' + leader.name + '正式道別並離開' }}隊伍。</p>
    <p v-if="lowAffinity.length" class="small warn">{{ lowAffinity.map((m) => m.name).join('、') }}對你積怨已深，下次休息時會離隊。</p>
  </section>
</template>

<style scoped>
.dice { margin: 4px 0; }
.talk { display: grid; gap: 4px; margin-top: 6px; }
.talk label { display: grid; gap: 2px; }
.talk textarea { width: 100%; }
.warn { color: var(--danger); }
</style>
