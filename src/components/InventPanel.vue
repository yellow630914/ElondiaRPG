<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, craftRules, itemDef, type CraftId } from '@/engine/data'
import { crafters, skillOf, toolTierFor, toolTierName, toolWhere } from '@/engine/crafting'
import {
  capsSource, capsText, INVENT_CATEGORY_NAME, INVENT_GRADE_NAME, inventCaps, inventCategories, inventPlan, inventTarget,
  type InventCategory, type InventGrade, type InventRequest,
} from '@/engine/invention'
import { formatMoney } from '@/engine/money'
import { parseUse, useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AbilityPicker from './AbilityPicker.vue'
import CraftCard, { type CardOutcome, type CardReq } from './craft/CraftCard.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 自創配方（crafts.json 的 invention；docs/CRAFTING.md 第 7 節）：「製作物品」配方清單最後一張卡片。
// 工藝沿用上面選的；類別沿用上面選的（這種工藝不能自創那一類時用第一種）。AI 設計成品，強度不超過高一級的現成配方
const props = withDefaults(defineProps<{ craft: CraftId; categoryHint?: string; crafterId?: string }>(), { categoryHint: '', crafterId: 'pc' })
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const crafter = computed(() => crafters(s.value).find((w) => w.member.id === props.crafterId && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

const categories = computed(() => inventCategories(props.craft))
const pickedCategory = ref<InventCategory | ''>('')
const category = computed<InventCategory>(() => {
  for (const c of [pickedCategory.value, props.categoryHint]) if (categories.value.includes(c as InventCategory)) return c as InventCategory
  return categories.value[0] ?? 'consumable'
})
const skill = computed(() => craftRules.skills[props.craft])
const maxLevel = computed(() => skillOf(crafter.value, props.craft).level)
const pickedLevel = ref(1)
const level = computed(() => Math.max(1, Math.min(maxLevel.value, pickedLevel.value)))

// 材料：行囊裡裝備以外的東西
const inputs = ref<{ name: string; qty: number }[]>([])
const inputPick = ref('')
const inputOptions = computed(() => s.value.inventory.filter((i) => i.qty > 0 && itemDef(i.name)?.category !== 'equipment' && !inputs.value.some((x) => x.name === i.name)))
function addInput() {
  if (!inputPick.value || inputs.value.length >= craftRules.invention.max_inputs) return
  inputs.value.push({ name: inputPick.value, qty: 1 })
  inputPick.value = ''
}

const req = computed<InventRequest>(() => ({ craft: props.craft, level: level.value, category: category.value, inputs: inputs.value }))
const plan = computed(() => inventPlan(s.value, req.value, crafter.value))
// 強度依擲骰：各成功程度的上限
const GRADES: InventGrade[] = ['success', 'critical', 'partial']
const grades = computed(() => GRADES.map((g) => ({ grade: g, caps: inventCaps(props.craft, level.value, category.value, g) })).filter((x) => x.caps))
const gradeShown = ref<InventGrade>('success')
const shownCaps = computed(() => grades.value.find((x) => x.grade === gradeShown.value)?.caps ?? grades.value[0]?.caps)
const aiOn = computed(() => settings.judgesWithAi())
const text = ref('')
const use = ref('')

const outcomes: CardOutcome[] = [
  { degree: 'critical', text: '稍強（最多到高一級的現成配方），份數多一半' },
  { degree: 'success', text: '和同級的現成配方相當' },
  { degree: 'partial', text: '稍弱，份數一半' },
  { degree: 'fail', text: '沒做成，材料損失一半' },
  { degree: 'fumble', text: '搞砸了，材料全部損失，花費照付' },
]
const reqs = computed<CardReq[]>(() => {
  const need = toolTierFor(level.value)
  const p = plan.value
  return [
    { state: p.skill >= level.value ? 'ok' : 'no', label: '工藝', text: `${crafter.value.name} ${skill.value.name} Lv.${p.skill}（要 Lv.${level.value}）` },
    { state: p.tool.tier >= need ? 'ok' : 'no', label: '工具', text: `要${toolTierName(need)}・現在 ${p.tool.source}` },
    { state: !p.inputs.length || p.inputs.some((x) => x.have < x.need) ? 'no' : 'ok', label: '材料', text: p.inputs.length ? `${p.inputs.length} 種・價值 ${formatMoney(p.inputValue)}` : '至少要放一種' },
  ]
})

function invent() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'invent', target: inventTarget(crafter.value.id, req.value), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  inputs.value = []
  emit('started')
}
</script>

<template>
  <CraftCard
    title="自創配方" icon="lightbulb"
    :tags="[{ text: skill.name }, { text: INVENT_CATEGORY_NAME[category] }, { text: '自創', hot: true }]"
    :outcomes="outcomes" :check="`d20 + 工藝 ${plan.skill * craftRules.level_bonus} + ${attrName(skill.attr)}調整值 ÷${craftRules.attr_div}・DC ${plan.dc}`" :reqs="reqs"
  >
    <template #result>
      <div v-if="shownCaps" class="caps">
        <div class="row">
          <span class="muted">強度上限</span>
          <button v-for="x in grades" :key="x.grade" class="small" :class="{ primary: shownCaps === x.caps }" @click="gradeShown = x.grade">{{ INVENT_GRADE_NAME[x.grade] }}</button>
        </div>
        <ul class="plain">
          <li v-for="t in capsText(shownCaps)" :key="t">・{{ t }}</li>
        </ul>
        <p class="muted note">參考{{ capsSource(shownCaps) }}</p>
      </div>
      <p class="muted note">
        {{ aiOn ? 'AI 會依做法與材料設計成品並取名' : '沒有開啟 AI 判定時，會仿照同級的現成配方做一件「特製」品' }}；做出東西時記成新的配方（只在這個存檔），之後可以在配方清單重複做、改名。
      </p>
    </template>
    <template #needs-before>
      <div v-if="categories.length > 1" class="row">
        <span class="muted">類別</span>
        <button v-for="c in categories" :key="c" class="small" :class="{ primary: category === c }" @click="pickedCategory = c">{{ INVENT_CATEGORY_NAME[c] }}</button>
      </div>
      <div class="row">
        <span class="muted">配方等級</span>
        <button
          v-for="n in craftRules.max_level" :key="n" class="small" :class="{ primary: level === n }" :disabled="n > maxLevel"
          :title="n > maxLevel ? `${crafter.name}的${skill.name}要 Lv.${n}` : ''" @click="pickedLevel = n"
        >Lv.{{ n }}</button>
      </div>
    </template>
    <template #needs>
      <table v-if="inputs.length" class="mats">
        <thead><tr><th>放進去的材料</th><th class="num">數量</th><th class="num">持有</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(x, i) in inputs" :key="x.name">
            <td>{{ x.name }}</td>
            <td class="num"><input v-model.number="x.qty" type="number" min="1" max="99" class="qty" /></td>
            <td class="num" :class="{ short: (plan.inputs[i]?.have ?? 0) < x.qty }">{{ plan.inputs[i]?.have ?? 0 }}</td>
            <td class="num"><button class="x" @click="inputs.splice(i, 1)">×</button></td>
          </tr>
        </tbody>
      </table>
      <div class="row">
        <template v-if="inputs.length < craftRules.invention.max_inputs && inputOptions.length">
          <select v-model="inputPick">
            <option value="">加入材料…</option>
            <option v-for="i in inputOptions" :key="i.name" :value="i.name">{{ i.name }}（持有 {{ i.qty }}）</option>
          </select>
          <button class="small" :disabled="!inputPick" @click="addInput">＋</button>
        </template>
        <span class="muted note">最多 {{ craftRules.invention.max_inputs }} 種，不論結果都會用掉</span>
      </div>
      <p class="muted note">工具要{{ toolTierName(toolTierFor(level)) }} <Hint :text="toolWhere(req.craft, toolTierFor(level))" /></p>
    </template>
    <template #foot>
      <div class="sum">
        <span>時間 <b>約 {{ plan.hours }} 小時</b></span>
        <span v-if="plan.cost" class="muted">材料價值不夠的部分另外花 {{ formatMoney(plan.cost) }}（成品份數多時再補）</span>
        <span v-if="plan.rent" class="muted">工坊租金 {{ formatMoney(plan.rent) }}</span>
      </div>
      <label class="field">
        <span class="muted note">做法（不用取名，名字由 AI 依做法與材料決定）</span>
        <textarea v-model="text" rows="2" maxlength="400" placeholder="例如「把硫磺磨成粉，和藥草汁一起封進陶瓶，瓶口塞一條浸了油的布」「肉抹上蜂蜜和鹽，掛在爐邊慢慢烘乾」" />
      </label>
      <ul v-if="plan.blockers.length" class="blockers"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
      <div class="row go-row">
        <details class="more"><summary>使用技能（選填）</summary><AbilityPicker v-model="use" /></details>
        <button class="primary" :disabled="!!plan.blocked || game.judging || !!s.pendingAction || !text.trim()" @click="invent">
          <GameIcon name="lightbulb" :size="14" /> {{ crafter.isPlayer ? '試做看看' : `請${crafter.name}試做` }}
        </button>
      </div>
    </template>
  </CraftCard>
</template>

<style scoped>
p { margin: 0; }
.row { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; }
.caps { display: grid; gap: 4px; }
.caps ul { margin: 0; padding: 0; list-style: none; }
.note { font-size: var(--fs-xs); }
table { width: 100%; border-collapse: collapse; }
.mats th { text-align: left; font-weight: 600; color: var(--muted); padding: 3px 4px; border-bottom: 1px solid var(--border); }
.mats td { padding: 3px 4px; border-bottom: 1px dashed color-mix(in srgb, currentColor 15%, transparent); }
.mats .num { text-align: right; white-space: nowrap; }
.qty { width: 50px; }
.x { padding: 0 5px; }
.short { color: var(--danger); }
.sum { display: flex; flex-wrap: wrap; gap: 2px 14px; align-items: baseline; }
.field { display: grid; gap: 2px; }
.field textarea { width: 100%; }
.go-row { justify-content: space-between; }
.more { flex: 1; min-width: 200px; }
.more summary { cursor: pointer; color: var(--muted); font-size: var(--fs-xs); }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; color: var(--danger); }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
</style>
