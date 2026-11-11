<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/stores/game'
import { nurseryRefusal } from '@/engine/children'
import { slotNameFor } from '@/engine/gear'
import { formatMoney } from '@/engine/money'
import { cursedGearOf } from '@/engine/restraints'

// 神殿的「解開詛咒具」（docs/LEWD_STATS.md 第 7.2 節）：隊上每一件詛咒具與價錢，解開之後詛咒具碎掉
const game = useGame()
const s = computed(() => game.state!)
const list = computed(() => cursedGearOf(s.value))
const owed = computed(() => nurseryRefusal(s.value))
const raceOf = (id: string) => s.value.party.find((m) => m.id === id)?.race
</script>

<template>
  <div class="uncurse small">
    <p class="muted">詛咒具掙不開、鑰匙打不開、鐵匠也剪不斷，只能請神官解咒。解開之後詛咒具會碎成灰，不會回到行囊。</p>
    <p v-if="owed" class="warn">{{ owed }}</p>
    <ul class="plain">
      <li v-for="c in list" :key="`${c.member}:${c.slot}`" class="row">
        <span><b>{{ c.name }}</b> <span class="muted">（{{ c.memberName }}・{{ slotNameFor(c.slot, raceOf(c.member)) }}）</span></span>
        <button class="small" :disabled="!!owed || !!s.combat || s.money_cc < c.fee" @click="game.uncurse(c.member, c.slot)">解咒（{{ formatMoney(c.fee) }}）</button>
      </li>
      <li v-if="!list.length" class="muted">隊上沒有人戴著詛咒具。</li>
    </ul>
  </div>
</template>

<style scoped>
.uncurse { display: grid; gap: 8px; }
.uncurse p { margin: 0; }
.plain { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.warn { color: var(--danger); }
</style>
