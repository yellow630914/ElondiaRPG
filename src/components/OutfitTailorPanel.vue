<script setup lang="ts">
import { computed, ref } from 'vue'
import { gearRules } from '@/engine/gear'
import { LEWD_STATS, lewdName } from '@/engine/lewd'
import { formatMoney } from '@/engine/money'
import { outfitChoices, outfitOrder, outfitTailorHere } from '@/engine/outfitTailor'
import type { LewdStat } from '@/engine/types'
import { useGame } from '@/stores/game'
import Hint from './ui/Hint.vue'

// 淫服裁縫鋪（成人向，docs/LEWD_STATS.md 第 25 節）：魅氣濃的城鎮，訂做帶慾望指標加成的成人向服裝
const game = useGame()
const s = computed(() => game.state!)
const show = computed(() => outfitTailorHere(s.value))
const choices = outfitChoices()
const base = ref(choices[0]?.base ?? '')
const material = ref('')
const stat = ref<LewdStat>('lewdness')
const materials = computed(() => choices.find((c) => c.base === base.value)?.materials ?? [])
const order = computed(() => {
  const m = materials.value.includes(material.value) ? material.value : materials.value[0]
  return m ? { material: m, ...outfitOrder(base.value, m, stat.value) } : undefined
})
</script>

<template>
  <div v-if="show" class="tailor small">
    <h4>訂做淫服 <Hint text="魅氣濃的城鎮，裁縫願意照你的身材訂做成人向的服裝，選一項慾望指標加成；材料越好加越多。" /></h4>
    <div class="row">
      <select v-model="base"><option v-for="c in choices" :key="c.base" :value="c.base">{{ c.name }}</option></select>
      <select v-model="material"><option value="">（材料）</option><option v-for="m in materials" :key="m" :value="m">{{ gearRules.materials[m]?.name ?? m }}</option></select>
      <select v-model="stat"><option v-for="k in LEWD_STATS" :key="k" :value="k">{{ lewdName(k) }}</option></select>
    </div>
    <div v-if="order" class="row">
      <span class="muted">{{ gearRules.materials[order.material]?.name }}・{{ lewdName(stat) }} +{{ order.bonus }}</span>
      <button class="small primary" :disabled="s.money_cc < order.price" @click="game.orderOutfit(base, order.material, stat)">訂做（{{ formatMoney(order.price) }}）</button>
    </div>
  </div>
</template>

<style scoped>
.tailor { margin-top: 0.6rem; border-top: 1px dashed var(--border, #444); padding-top: 0.4rem; }
.row { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin: 0.3rem 0; }
</style>
