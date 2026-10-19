<script setup lang="ts">
import { computed } from 'vue'
import { armorClass, attackBonus, damageDice, guildRankFor, xpToNext } from '@/engine/character'
import { className, raceName, skills } from '@/engine/data'
import { useGame } from '@/stores/game'
import StatBar from './StatBar.vue'

const QUALITY_NAME: Record<string, string> = {
  common: '普通', uncommon: '優良', rare: '稀有', epic: '史詩', legendary: '傳說', mythic: '神話',
}

const game = useGame()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)
</script>

<template>
  <div class="grid">
    <section v-for="m in s.party" :key="m.id" class="panel">
      <div class="row" style="justify-content: space-between">
        <h2>{{ m.name }}</h2>
        <span class="tag">{{ guildRankFor(m.level) }} 級</span>
      </div>
      <div class="small muted">{{ raceName(m.race) }}・{{ className(m.class) }}・Lv.{{ m.level }}（經驗 {{ m.xp }}/{{ xpToNext(m.level) }}）</div>
      <StatBar kind="hp" :value="m.hp" :max="m.maxHp" />
      <StatBar kind="mp" :value="m.mp" :max="m.maxMp" />
      <div class="small muted">AC {{ armorClass(m) }}・命中 +{{ attackBonus(m) }}・傷害 {{ damageDice(m) }}</div>
      <p v-if="m.personality" class="small">{{ m.personality }}</p>

      <h3 class="small" style="margin-top: 8px">技能</h3>
      <div class="row">
        <span v-for="id in m.skills" :key="id" class="tag" :title="`${skills[id]?.mp ?? 0} MP`">
          {{ skills[id]?.name ?? id }}【{{ QUALITY_NAME[skills[id]?.quality ?? 'common'] }}】
        </span>
      </div>

      <div v-if="m.pendingSkillChoices?.length" class="choose">
        <strong class="small">升級！請選擇一個技能：</strong>
        <div class="row">
          <button
            v-for="id in m.pendingSkillChoices[0]"
            :key="id"
            class="small"
            :disabled="inCombat"
            @click="game.chooseSkill(m.id, id)"
          >{{ skills[id]?.name }}【{{ QUALITY_NAME[skills[id]?.quality ?? 'common'] }}】</button>
        </div>
      </div>

      <button v-if="!m.isPlayer" class="small danger" style="margin-top: 8px" :disabled="inCombat" @click="game.dismiss(m.id)">
        請離隊伍
      </button>
    </section>
  </div>

  <section class="panel">
    <h2>行囊</h2>
    <p v-if="s.inventory.length === 0" class="muted small">空空如也。</p>
    <div class="row">
      <span v-for="i in s.inventory" :key="i.name" class="tag">{{ i.name }} ×{{ i.qty }}</span>
    </div>
  </section>
</template>

<style scoped>
.choose { margin-top: 8px; padding: 8px; border: 1px dashed var(--accent); border-radius: 6px; }
</style>
