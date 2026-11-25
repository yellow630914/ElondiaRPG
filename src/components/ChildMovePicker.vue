<script setup lang="ts">
import { computed, ref } from 'vue'
import { childMoveOptions } from '@/engine/children'
import { formatMoney } from '@/engine/money'
import type { ChildRecord } from '@/engine/types'
import { useGame } from '@/stores/game'

// 把孩子送到別的城（自己在別的城的房子、那些城的神殿育幼院）：神殿派人護送，照路程收錢（docs/FAMILY.md 第 7.4 節）
const props = defineProps<{ child: ChildRecord }>()
const game = useGame()
const s = computed(() => game.state!)
const options = computed(() => childMoveOptions(s.value, props.child))
const pick = ref(0)
const chosen = computed(() => options.value[pick.value] ?? options.value[0])
</script>

<template>
  <span v-if="options.length" class="row child-move">
    <select v-model.number="pick" class="small" aria-label="送到別的城">
      <option v-for="(o, i) in options" :key="i" :value="i">{{ o.label }}（{{ formatMoney(o.cost) }}）</option>
    </select>
    <button class="small" :disabled="!chosen || s.money_cc < chosen.cost" :title="chosen && s.money_cc < chosen.cost ? `錢不夠（要 ${formatMoney(chosen.cost)}）` : '神殿派人護送，馬上送到；費用照路程，從育幼院搬走時一起繳清欠的寄養費'" @click="chosen && game.moveChild(child.id, chosen.to)">送過去<template v-if="chosen">（{{ formatMoney(chosen.cost) }}）</template></button>
  </span>
</template>

<style scoped>
.child-move { gap: 4px; max-width: 100%; min-width: 0; }
/* 選項的字很長（房子名稱＋城名＋金額）：選單不超出格子，手機上不撐出左右捲動；金額另外寫在按鈕上，選項被截斷也看得到 */
.child-move select { min-width: 0; width: 18em; max-width: 100%; text-overflow: ellipsis; }
.child-move button { flex: none; }
</style>
