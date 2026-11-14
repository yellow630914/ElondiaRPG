<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/stores/game'
import { attributeRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { respecBlocked, respecCost, respecMembers, respecPoints } from '@/engine/respec'
import Hint from './ui/Hint.vue'

// 神殿的「重新分配屬性點」（respec.ts）：主角與自己隊上的夥伴，屬性退回職業與種族的基本值，點數重新分配
const emit = defineEmits<{ done: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const r = attributeRules.respec
const rows = computed(() => respecMembers(s.value).map((m) => ({
  m, points: respecPoints(s.value, m.id), cost: respecCost(s.value, m.id), blocked: respecBlocked(s.value, m.id),
})))
const HINT = `屬性退回職業與種族的基本值，建角加的、升級分配的與苦練換來的點都變回未分配的屬性點，之後到角色詳情重新分配。每級 ${r.cost_per_level} 白鸛（照洗點那位的等級），花 ${r.hours} 小時。夥伴只退回高於基本值的部分。`
function go(id: string, name: string, points: number, cost: number) {
  if (!confirm(`讓${name}在神殿洗點？屬性退回職業與種族的基本值，${points} 點屬性點重新分配（奉獻 ${formatMoney(cost)}，花 ${r.hours} 小時）。之後到角色詳情分配。`)) return
  void game.templeRespec(id)
  emit('done')
}
</script>

<template>
  <div class="respec small">
    <p class="muted">在冥想室裡靜坐，讓神官洗去身上的鍛鍊。 <Hint :text="HINT" /></p>
    <table class="rows">
      <thead><tr><th>隊員</th><th>等級</th><th>退回</th><th>奉獻</th><th></th></tr></thead>
      <tbody>
        <tr v-for="x in rows" :key="x.m.id">
          <td>{{ x.m.name }}</td>
          <td class="num">Lv.{{ x.m.level }}</td>
          <td class="num">{{ x.points }} 點</td>
          <td class="num">{{ formatMoney(x.cost) }}</td>
          <td class="act">
            <button class="primary small" :disabled="!!x.blocked || game.judging" :title="x.blocked || undefined" @click="go(x.m.id, x.m.isPlayer ? '你' : x.m.name, x.points, x.cost)">洗點</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ul class="why">
      <template v-for="x in rows" :key="x.m.id"><li v-if="x.blocked" class="muted">{{ x.m.name }}：{{ x.blocked }}</li></template>
    </ul>
  </div>
</template>

<style scoped>
.respec { display: grid; gap: 8px; }
.respec p { margin: 0; }
.rows { width: 100%; border-collapse: collapse; }
.rows th, .rows td { padding: 4px 6px; text-align: left; border-bottom: 1px solid var(--border); }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.act { text-align: right; }
.why { margin: 0; padding-left: 1.2em; display: grid; gap: 2px; }
</style>
