<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from '@/stores/game'
import { lewdRules, type LewdKey } from '@/engine/data'
import { currentRegion, lewdName } from '@/engine/lewd'
import { formatMoney } from '@/engine/money'
import { purifiedToday, purifyBlocked, purifyCost, purifyMax, purifyRules, purifyValue } from '@/engine/purify'
import { regionById } from '@/engine/data'
import Hint from './ui/Hint.vue'

// 神殿的「淨身」（docs/LEWD_STATS.md 第 4.1 節）：選一位隊員、一項慾望指標、降幾點；每人每天一次
const game = useGame()
const s = computed(() => game.state!)
const memberId = ref(s.value.party[0]?.id ?? '')
const key = ref<LewdKey>('sensitivity')
const points = ref(1)
const m = computed(() => s.value.party.find((x) => x.id === memberId.value) ?? s.value.party[0]!)
const r = purifyRules()
const region = computed(() => regionById(currentRegion(s.value))?.name ?? '這一帶')
const rows = computed(() => r.stats.map((k) => ({
  k, name: k === 'exposure' ? `曝露名聲（${region.value}）` : lewdName(k), value: purifyValue(s.value, m.value, k),
  def: k === 'exposure' ? 0 : lewdRules.defaults[k], max: purifyMax(s.value, m.value, k),
})))
const max = computed(() => purifyMax(s.value, m.value, key.value))
watch([memberId, key], () => { points.value = Math.min(Math.max(1, points.value), Math.max(1, max.value)) })
const cost = computed(() => purifyCost(s.value, m.value, key.value, Math.min(points.value, max.value)))
const blocked = computed(() => purifyBlocked(s.value, m.value, key.value, points.value))
const HINT = `每點 ${r.per_point_cc} 白鸛，降到預設值以下的部分每點 ×${r.below_default_mult}；一次最多 ${r.max_points} 點，花 ${r.hours} 小時，每人每天一次。神殿也賣清心香、淨念香、自持經、隱名符，帶在身上隨時冥想。`
function go() {
  void game.templePurify(m.value.id, key.value, points.value)
}
</script>

<template>
  <div class="purify small">
    <p class="muted">在聖水池裡靜坐、聽神官誦經，把身上的慾望一點一點洗淡。 <Hint :text="HINT" /></p>
    <label class="field">隊員
      <select v-model="memberId">
        <option v-for="p in s.party" :key="p.id" :value="p.id">{{ p.name }}{{ purifiedToday(s, p) ? '（今天已淨身）' : '' }}</option>
      </select>
    </label>
    <table class="stats">
      <thead><tr><th></th><th>指標</th><th>現在</th><th>預設</th></tr></thead>
      <tbody>
        <tr v-for="x in rows" :key="x.k" :class="{ on: key === x.k, off: !x.max }" @click="x.max && (key = x.k)">
          <td><input v-model="key" type="radio" :value="x.k" :disabled="!x.max" /></td>
          <td>{{ x.name }}</td><td class="num">{{ x.value }}</td><td class="num muted">{{ x.def }}</td>
        </tr>
      </tbody>
    </table>
    <div class="row">
      <label>降幾點 <input v-model.number="points" type="number" min="1" :max="Math.max(1, max)" class="num-in" :disabled="!max" /></label>
      <span>奉獻 <b>{{ formatMoney(cost) }}</b></span>
      <button class="primary small" :disabled="!!blocked || game.judging" :title="blocked || undefined" @click="go">淨身</button>
    </div>
    <p v-if="blocked" class="warn">{{ blocked }}</p>
  </div>
</template>

<style scoped>
.purify { display: grid; gap: 8px; }
.purify p { margin: 0; }
.field { display: flex; gap: 8px; align-items: center; }
.stats { width: 100%; border-collapse: collapse; }
.stats th, .stats td { padding: 3px 6px; text-align: left; border-bottom: 1px solid var(--border); }
.stats tr.on { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.stats tr.off { opacity: .5; }
.stats tbody tr { cursor: pointer; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.num-in { width: 60px; }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.warn { color: var(--danger); }
</style>
