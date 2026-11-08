<script setup lang="ts">
import { computed, ref } from 'vue'
import { arenaHere, arenaOpponent, arenaPurse, arenaRestraints, arenaRules, arenaTier } from '@/engine/arena'
import { enemies } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { isBound, leaderOf } from '@/engine/party'
import { useGame } from '@/stores/game'
import FoldMenu from './ui/FoldMenu.vue'

// 淫鬥場（成人向，docs/LEWD_STATS.md 第 21 節）：地下街（underworld.ts）裡的淫鬥場地標
const game = useGame()
const s = computed(() => game.state!)
const open = computed(() => arenaHere(s.value))
// 被主人帶著：主人帶你來報名（報名費、獎金照樣是你自己的錢）
const master = computed(() => (isBound(s.value) ? leaderOf(s.value) : undefined))
const rules = arenaRules()
const restraint = ref('')
const wager = ref(false)
const restraints = computed(() => arenaRestraints(s.value))

const rings = computed(() => Object.entries(rules.rings).map(([id, r]) => {
  const tier = arenaTier(s.value, id)
  const foes = arenaOpponent(id, tier).map(([m, n]) => `${enemies[m]?.name ?? m}${n > 1 ? ` ×${n}` : ''}`).join('、')
  const rec = s.value.arena?.[s.value.location]?.[id]
  return { id, name: r.name, desc: r.desc, restraint: !!r.restraint, tier, foes, streak: rec?.streak ?? 0, best: rec?.best ?? 0, ...arenaPurse(tier, wager.value) }
}))

function enter(id: string, needsRestraint: boolean) {
  void game.startArena(id, { ...(needsRestraint ? { restraint: restraint.value } : {}), ...(wager.value ? { wager: true } : {}) })
}
</script>

<template>
  <FoldMenu v-if="open" id="place.arena" class="arena small" icon="trophy" label="淫鬥場" :detail="`地下的擂臺・${rings.length} 種`">
    <p v-if="master" class="muted">{{ master.name }}帶你來報名；報名費從你的錢出，獎金也是你的。</p>
    <p class="muted">地下的擂臺。每贏 {{ rules.streak_per_tier }} 場換更強的對手，輸了連勝歸零；輸了不會損失錢，也不會有戰敗事件。</p>
    <label class="check"><input v-model="wager" type="checkbox" /> 賭注賽（報名費與獎金 ×{{ rules.wager.mult }}；輸了曝露名聲、順從上升）</label>
    <div v-for="r in rings" :key="r.id" class="ring">
      <div><b>{{ r.name }}</b> <span class="muted">{{ r.desc }}</span></div>
      <div class="muted">對手：{{ r.foes }}・連勝 {{ r.streak }}（最佳 {{ r.best }}）・獎金 {{ formatMoney(r.prize) }}</div>
      <div class="row">
        <select v-if="r.restraint" v-model="restraint">
          <option value="">{{ restraints.length ? '選一件拘束具戴上…' : '行囊裡沒有拘束具' }}</option>
          <option v-for="n in restraints" :key="n" :value="n">{{ n }}</option>
        </select>
        <button class="small primary" :disabled="s.money_cc < r.fee || (r.restraint && !restraint)" @click="enter(r.id, r.restraint)">報名（{{ formatMoney(r.fee) }}）</button>
      </div>
    </div>
  </FoldMenu>
</template>

<style scoped>
.ring { margin: 0.4rem 0; }
.row { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
</style>
