<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/stores/game'
import { childrenAtTemple, owedFee, ownHomes, templeDebt } from '@/engine/children'
import { familyRules } from '@/engine/pregMarks'
import { genderName, raceName } from '@/engine/data'
import { formatMoney } from '@/engine/money'

// 神殿的育幼院（docs/FAMILY.md 第 7.2 節）：寄在這裡的孩子、繳寄養費、探望、接回這座城自己的房子
const game = useGame()
const s = computed(() => game.state!)
const kids = computed(() => childrenAtTemple(s.value, s.value.location))
const debt = computed(() => templeDebt(s.value))
const fee = computed(() => (familyRules.nursery as { fee_cc: number }).fee_cc)
const homesHere = computed(() => ownHomes(s.value).filter((h) => h.location === s.value.location))
const prepay = ref(7)
const prepayCost = computed(() => debt.value + Math.max(0, prepay.value) * fee.value * kids.value.length)
</script>

<template>
  <div class="nursery small">
    <p class="muted">寄養費每個孩子每天 {{ formatMoney(fee) }}，寄養的第一天不收。欠著的時候孩子照樣有人照顧，只是神殿的其他服務（治療、解咒、洗刺青、診察）要先繳清。</p>
    <ul class="plain">
      <li v-for="k in kids" :key="k.id" class="row">
        <span>🍼 {{ k.name }} <span class="muted">（{{ genderName(k.gender) }}・{{ raceName(k.race) }}・{{ s.time.day - k.born }} 天大・母親{{ k.mother.name }}・父親{{ k.father?.name ?? '不明' }}<template v-if="owedFee(s, k)">・欠 {{ formatMoney(owedFee(s, k)) }}</template>）</span></span>
        <span class="row">
          <button class="small" @click="game.visitChild(k.id)">探望</button>
          <button v-for="h in homesHere" :key="h.id" class="small" :disabled="s.money_cc < owedFee(s, k)" @click="game.moveChild(k.id, { kind: 'home', home: h.id })">接回「{{ h.name }}」</button>
        </span>
      </li>
      <li v-if="!kids.length" class="muted">這座神殿沒有寄養你的孩子。</li>
    </ul>
    <div v-if="kids.length" class="row">
      <span>欠的寄養費：{{ formatMoney(debt) }}</span>
      <label>再預繳 <input v-model.number="prepay" type="number" min="0" max="60" style="width: 60px" /> 天</label>
      <button class="small" :disabled="prepayCost <= 0 || s.money_cc < prepayCost" @click="game.payNursery(prepay)">繳費（{{ formatMoney(prepayCost) }}）</button>
    </div>
  </div>
</template>

<style scoped>
.nursery { display: grid; gap: 8px; }
.nursery p, .nursery ul { margin: 0; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: space-between; }
</style>
