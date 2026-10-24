<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, craftRules, type CraftId } from '@/engine/data'
import { CRAFT_IDS, crafters, toolTierFor, toolTierName, toolWhere } from '@/engine/crafting'
import { formatMoney } from '@/engine/money'
import { producedQty, produceTarget, recipeItems, recipePlan } from '@/engine/recipes'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
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
      <Hint text="依配方做藥劑、料理、家具與工具：材料從行囊扣，另外的花費（瓶子、溶劑、基本食材）照地點物價付。做的人擲屬性檢定，加上工藝等級；工具階級依配方等級。成功時做的人得到工藝經驗。" />
    </div>
    <select v-if="rows.length" :value="name" @change="picked = ($event.target as HTMLSelectElement).value">
      <optgroup v-for="g in groups" :key="g.craft" :label="craftRules.skills[g.craft].name">
        <option v-for="r in g.rows" :key="r.name" :value="r.name">{{ r.blocked ? '✗' : '✓' }} Lv.{{ r.recipe.level }} {{ r.invented ? '★' : '' }}{{ r.name }}{{ (r.recipe.qty ?? 1) > 1 ? ` ×${r.recipe.qty}` : '' }}</option>
      </optgroup>
    </select>
    <p v-else class="muted">沒有做得出來的東西。</p>

    <template v-if="plan && skill">
      <div class="head">
        <b class="name">{{ plan.name }}</b>
        <template v-if="s.inventions?.[plan.name]"><span class="tag"><GameIcon name="lightbulb" :size="12" />自創</span> <button class="small" @click="rename"><GameIcon name="edit" :size="13" /> 改名</button> <button class="small" @click="forget">忘記這個配方</button></template>
      </div>
      <p v-if="itemText(s, plan.name)" class="desc">{{ itemText(s, plan.name) }}</p>
      <table class="kv">
        <tr v-if="itemEffect(s, plan.name)"><th>效果</th><td>{{ itemEffect(s, plan.name) }}</td></tr>
        <tr><th>配方</th><td>{{ skill.name }} Lv.{{ plan.recipe.level }}<span class="muted">（{{ crafter.name }}的{{ skill.name }} Lv.{{ plan.level }}）</span></td></tr>
        <tr><th>檢定</th><td>{{ attrName(skill.attr) }} +{{ plan.level * craftRules.level_bonus }}・DC {{ plan.dc }}</td></tr>
        <tr><th>時間</th><td>約 {{ plan.hours }} 小時</td></tr>
        <tr><th>工具</th><td>要{{ toolTierName(toolTierFor(plan.recipe.level)) }} <Hint :text="toolWhere(plan.recipe.craft, toolTierFor(plan.recipe.level))" /><span class="muted">・現在 {{ plan.tool.source }}</span></td></tr>
        <tr>
          <th>材料</th>
          <td><span v-for="x in plan.inputs" :key="x.name" :class="{ short: x.have < x.need }" class="input">{{ x.name }} {{ x.have }}/{{ x.need }}</span><span v-if="!plan.inputs.length" class="muted">不需要</span></td>
        </tr>
        <tr v-if="plan.fee"><th>花費</th><td>{{ formatMoney(plan.fee) }}<span v-if="plan.rent" class="muted">（含工坊租金 {{ formatMoney(plan.rent) }}）</span></td></tr>
        <tr>
          <th>批數</th>
          <td><input v-model.number="batches" type="number" min="1" :max="craftRules.recipe.max_batches" class="qty" /> <span class="muted">材料、花費與時間乘批數，只擲一次</span></td>
        </tr>
      </table>
      <table class="outcomes">
        <tr><th>大成功</th><th>成功</th><th>部分成功</th><th>失敗</th><th>大失敗</th></tr>
        <tr>
          <td>{{ producedQty(plan.qty, 'critical') }} 份</td>
          <td>{{ plan.qty }} 份</td>
          <td>{{ producedQty(plan.qty, 'partial') }} 份</td>
          <td>材料損失一半</td>
          <td>材料全部損失<span class="muted">（花費照付）</span></td>
        </tr>
      </table>
      <ul v-if="plan.blocked" class="warn blockers"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
      <template v-else>
        <input v-model="text" placeholder="想怎麼做（選填）：例如加一點蜂蜜讓藥比較好入口" />
        <AbilityPicker v-model="use" />
        <button class="small" :disabled="game.judging || !!s.pendingAction" @click="produce"><GameIcon name="scroll" :size="13" /> {{ crafter.isPlayer ? '動手製作' : `請${crafter.name}製作` }}</button>
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
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; }
.name { font-size: 1.05rem; }
.desc { color: var(--muted); font-family: var(--font-story); }
table { width: 100%; border-collapse: collapse; }
.kv th { text-align: left; font-weight: 600; white-space: nowrap; width: 1%; padding: 5px 14px 5px 0; color: var(--muted); vertical-align: top; }
.kv td { padding: 5px 0; vertical-align: top; }
.kv tr + tr > * { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.input { display: inline-block; margin-right: 10px; }
.outcomes { margin: 4px 0 2px; text-align: center; font-size: var(--fs-xs); }
.outcomes th { font-weight: 600; color: var(--muted); padding: 4px; border-bottom: 1px solid var(--border); }
.outcomes td { padding: 4px; }
.short { color: var(--danger); }
.warn { color: var(--danger); }
.row > .hint { align-self: center; }
.qty { width: 56px; }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
</style>
