<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, craftRules, type CraftId } from '@/engine/data'
import { CRAFT_IDS, crafters, toolTierFor, toolTierName } from '@/engine/crafting'
import { formatMoney } from '@/engine/money'
import { producedQty, produceTarget, recipeItems, recipePlan } from '@/engine/recipes'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import { itemEffect, itemText } from './items/itemInfo'

// 依配方製作（物品的 recipe，crafts.json 的 recipe）：藥劑、料理、家具、工具。做的人擲工藝的屬性檢定加工藝等級
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const s = computed(() => game.state!)

const who = computed(() => crafters(s.value))
const crafterId = ref('pc')
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

const craft = ref<CraftId | ''>('')
const onlyReady = ref(false)
const crafts = computed(() => CRAFT_IDS.filter((c) => recipeItems(c).length))
const rows = computed(() => recipeItems(craft.value || undefined)
  .map((r) => ({ ...r, blocked: recipePlan(s.value, r.name, 1, crafter.value).blocked }))
  .filter((r) => !onlyReady.value || !r.blocked)
  .sort((a, b) => CRAFT_IDS.indexOf(a.recipe.craft) - CRAFT_IDS.indexOf(b.recipe.craft) || a.recipe.level - b.recipe.level))
const groups = computed(() => CRAFT_IDS.map((c) => ({ craft: c, rows: rows.value.filter((r) => r.recipe.craft === c) })).filter((g) => g.rows.length))

const picked = ref('')
const name = computed(() => (rows.value.some((r) => r.name === picked.value) ? picked.value : rows.value[0]?.name ?? ''))
const batches = ref(1)
const plan = computed(() => (name.value ? recipePlan(s.value, name.value, batches.value, crafter.value) : undefined))
const skill = computed(() => (plan.value ? craftRules.skills[plan.value.recipe.craft] : undefined))
const text = ref('')
const use = ref('')

function rename() {
  const from = plan.value?.name
  if (!from) return
  const to = prompt('自創物品的名字（配方也跟著改）', from)
  if (!to || to.trim() === from) return
  const name = game.renameInvention(from, to)
  if (name) picked.value = name
}

function forget() {
  if (plan.value && confirm(`忘記「${plan.value.name}」的配方？做好的成品會留著，但之後不能再做。`)) game.forgetInvention(plan.value.name)
}

function produce() {
  if (!plan.value) return
  const u = parseUse(use.value)
  void game.perform({ kind: 'produce', target: produceTarget(crafter.value.id, name.value, plan.value.batches), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  emit('started')
}
</script>

<template>
  <div class="recipes small">
    <p class="muted">依配方做藥劑、料理、家具與工具：材料從行囊扣，另外的花費（瓶子、溶劑、基本食材）照地點物價付。做的人擲屬性檢定，加上工藝等級；工具階級依配方等級。成功時做的人得到工藝經驗。</p>
    <div class="row">
      <label class="who">誰來做
        <select v-model="crafterId">
          <option v-for="w in who" :key="w.member.id" :value="w.member.id" :disabled="!!w.refusal">{{ w.member.name }}{{ w.refusal ? `（${w.refusal}）` : '' }}</option>
        </select>
      </label>
      <label class="who">工藝
        <select v-model="craft">
          <option value="">全部</option>
          <option v-for="c in crafts" :key="c" :value="c">{{ craftRules.skills[c].name }}</option>
        </select>
      </label>
      <label class="check"><input v-model="onlyReady" type="checkbox" /> 只看做得出來的</label>
    </div>
    <select v-if="rows.length" :value="name" @change="picked = ($event.target as HTMLSelectElement).value">
      <optgroup v-for="g in groups" :key="g.craft" :label="craftRules.skills[g.craft].name">
        <option v-for="r in g.rows" :key="r.name" :value="r.name">{{ r.blocked ? '✗' : '✓' }} Lv.{{ r.recipe.level }} {{ r.invented ? '💡' : '' }}{{ r.name }}{{ (r.recipe.qty ?? 1) > 1 ? ` ×${r.recipe.qty}` : '' }}</option>
      </optgroup>
    </select>
    <p v-else class="muted">沒有做得出來的東西。</p>

    <template v-if="plan && skill">
      <p>
        <b>{{ plan.name }}</b>　<span class="muted">{{ itemEffect(s, plan.name) }}</span>
        <template v-if="s.inventions?.[plan.name]">　<span class="tag">💡 自創</span> <button class="small" @click="rename">✏️ 改名</button> <button class="small" @click="forget">忘記這個配方</button></template>
      </p>
      <p v-if="itemText(s, plan.name)" class="muted">{{ itemText(s, plan.name) }}</p>
      <p class="muted">
        {{ skill.name }} Lv.{{ plan.recipe.level }}（{{ crafter.name }} Lv.{{ plan.level }}）・{{ attrName(skill.attr) }}檢定 +{{ plan.level * craftRules.level_bonus }}・DC {{ plan.dc }}・約 {{ plan.hours }} 小時
      </p>
      <p class="muted">工具：要{{ toolTierName(toolTierFor(plan.recipe.level)) }}，現在 {{ plan.tool.source }}</p>
      <p>
        材料：<span v-for="x in plan.inputs" :key="x.name" :class="{ short: x.have < x.need }" class="input">{{ x.name }} {{ x.have }}/{{ x.need }}</span>
        <template v-if="plan.fee">・花費 {{ formatMoney(plan.fee) }}<span class="muted">{{ plan.rent ? `（含工坊租金 ${formatMoney(plan.rent)}）` : '' }}</span></template>
      </p>
      <label class="row">批數 <input v-model.number="batches" type="number" min="1" :max="craftRules.recipe.max_batches" class="qty" />
        <span class="muted">（材料、花費與時間乘批數，只擲一次）</span>
      </label>
      <p class="muted">大成功：{{ producedQty(plan.qty, 'critical') }} 份・成功：{{ plan.qty }} 份・部分成功：{{ producedQty(plan.qty, 'partial') }} 份・失敗：材料損失一半・大失敗：材料全部損失（花費照付）</p>
      <p v-if="plan.blocked" class="muted">⚠ {{ plan.blocked }}</p>
      <template v-else>
        <input v-model="text" placeholder="想怎麼做（選填）：例如加一點蜂蜜讓藥比較好入口" />
        <AbilityPicker v-model="use" />
        <button class="small" :disabled="game.judging || !!s.pendingAction" @click="produce">📜 {{ crafter.isPlayer ? '動手製作' : `請${crafter.name}製作` }}</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.recipes { display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.recipes p { margin: 0; }
.recipes input:not([type]) { width: 100%; }
.who { display: grid; gap: 2px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.input { margin-right: 6px; }
.short { color: var(--danger); }
.qty { width: 56px; }
</style>
