<script setup lang="ts">
import { computed, ref } from 'vue'
import { standoffFoes } from '@/engine/encounters'
import { tagDef } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcTitle } from '@/engine/npcs'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'

// 和敵對的冒險者對峙（見 docs/NPC_SYSTEM.md 第 8.1 節）
const game = useGame()
const s = computed(() => game.state!)
const standoff = computed(() => s.value.standoff!)
const foes = computed(() => standoffFoes(s.value))
const busy = computed(() => game.judging || !!s.value.pendingAction)
const text = ref('')
const use = ref('')

function talk(kind: 'bluff' | 'intimidate') {
  const u = parseUse(use.value)
  void game.perform({ kind, target: foes.value[0]!.id, text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <section class="panel standoff">
    <div class="row head">
      <h3><GameIcon name="warning" :size="16" />對峙</h3>
      <JudgeToggle />
    </div>
    <ul class="plain small">
      <li v-for="f in foes" :key="f.id" class="row">
        <NameTag :id="f.id" />
        <span class="muted">{{ npcTitle(f) }} Lv.{{ f.level }}</span>
        <span v-for="t in (f.tags ?? []).map(tagDef).filter(Boolean)" :key="t!.name" class="tag">{{ t!.emoji }}{{ t!.name }}</span>
      </li>
    </ul>

    <template v-if="!standoff.detected">
      <p class="small">對方還沒發現你。</p>
      <div class="row">
        <button class="small" @click="game.avoidFoes()"><GameIcon name="eyeOff" :size="13" />悄悄避開</button>
        <button class="small danger" @click="game.fightFoes()"><GameIcon name="sword" :size="13" />偷襲（先手）</button>
        <button class="small" title="之後的蒙混或威嚇檢定 +2" @click="game.revealSelf()"><GameIcon name="hand" :size="13" />主動現身</button>
      </div>
    </template>

    <template v-else>
      <p class="small">對方擋住了去路，開口要 {{ formatMoney(standoff.demand_cc) }} 的過路費。<template v-if="standoff.revealed"><span class="muted">（你主動現身：檢定 +2）</span></template></p>
      <textarea v-model="text" rows="2" placeholder="怎麼蒙混或威嚇（選填，會交給 AI 判定）" />
      <AbilityPicker v-model="use" />
      <div class="row">
        <button class="small" :disabled="busy" title="魅力檢定：成功就放行，失敗開戰" @click="talk('bluff')"><GameIcon name="message" :size="13" />蒙混過關</button>
        <button class="small" :disabled="busy" title="力量檢定（依雙方等級修正）：成功就放行，失敗開戰" @click="talk('intimidate')"><GameIcon name="zap" :size="13" />威嚇</button>
        <button class="small" :disabled="busy || s.money_cc < standoff.demand_cc" @click="game.payToll()"><GameIcon name="coins" :size="13" />付 {{ formatMoney(standoff.demand_cc) }}</button>
        <button class="small danger" :disabled="busy" @click="game.fightFoes()"><GameIcon name="sword" :size="13" />開戰</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.standoff { border-color: var(--danger); }
.standoff .head { justify-content: space-between; }
.standoff h3 { margin: 0; color: var(--danger); display: flex; align-items: center; gap: 6px; }
.standoff .row button { display: inline-flex; align-items: center; gap: 4px; }
.standoff textarea { width: 100%; }
</style>
