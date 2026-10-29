<script setup lang="ts">
import { computed, ref } from 'vue'
import { fusionCandidates, fusionHere, fusionRules } from '@/engine/fusion'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import Hint from './ui/Hint.vue'

// 淫器合煉（成人向，docs/LEWD_STATS.md 第 22 節）：鐵匠鋪把一件武器和一件拘束具合成淫器，也可以拆回來
const game = useGame()
const s = computed(() => game.state!)
const rules = fusionRules()
const c = computed(() => fusionCandidates(s.value))
const show = computed(() => fusionHere(s.value) && (c.value.fused.length > 0 || (c.value.weapons.length > 0 && c.value.restraints.length > 0)))
const weapon = ref('')
const restraint = ref('')
const tiers = rules.tiers.map(([d, m]) => `${d} 天 ×${m}`).join('、')

function fuse() {
  void game.fuseGear(weapon.value, restraint.value)
  weapon.value = ''
  restraint.value = ''
}
</script>

<template>
  <div v-if="show" class="fuse small">
    <h4>淫器合煉 <Hint :text="`把一件武器和一件拘束具合成淫器：平常是拘束具（雙面效應照算，日常的檢定減值 ×${rules.penalty_mult}），戰鬥時展開成那件武器。最近 ${rules.days} 天裡穿了幾天決定傷害倍率（${tiers}），更少時展開不了。可以免費拆回原本的兩件。`" /></h4>
    <div v-if="c.weapons.length && c.restraints.length" class="row">
      <select v-model="weapon">
        <option value="">選一件武器…</option>
        <option v-for="n in c.weapons" :key="n" :value="n">{{ n }}</option>
      </select>
      <select v-model="restraint">
        <option value="">選一件拘束具…</option>
        <option v-for="n in c.restraints" :key="n" :value="n">{{ n }}</option>
      </select>
      <button class="small primary" :disabled="!weapon || !restraint || s.money_cc < rules.fee_cc" @click="fuse">合煉（{{ formatMoney(rules.fee_cc) }}）</button>
    </div>
    <div v-for="n in c.fused" :key="n" class="row">
      <span>{{ n }}</span>
      <button class="small" @click="game.splitGear(n)">拆開</button>
    </div>
  </div>
</template>

<style scoped>
.fuse { margin-top: 0.6rem; border-top: 1px dashed var(--border, #444); padding-top: 0.4rem; }
.row { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin: 0.3rem 0; }
</style>
