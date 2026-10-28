<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, craftRules, itemDef, type CraftId } from '@/engine/data'
import { CRAFT_IDS, crafters, skillOf, toolTierFor, toolTierName, toolWhere } from '@/engine/crafting'
import {
  capsSource, capsText, INVENT_CATEGORY_NAME, INVENT_GRADE_NAME, inventCaps, inventCategories, inventPlan, inventTarget,
  type InventCategory, type InventGrade, type InventRequest,
} from '@/engine/invention'
import { formatMoney } from '@/engine/money'
import { parseUse, useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 自創配方（crafts.json 的 invention）：選工藝、等級、類別與材料，描述想做的東西；AI 設計成品，強度不超過高一級的現成配方
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)

const who = computed(() => crafters(s.value))
const crafterId = ref('pc')
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

const crafts = CRAFT_IDS.filter((c) => inventCategories(c).length)
const craft = ref<CraftId>('alchemy')
const categories = computed(() => inventCategories(craft.value))
const pickedCategory = ref<InventCategory>('consumable')
const category = computed(() => (categories.value.includes(pickedCategory.value) ? pickedCategory.value : categories.value[0]!))
const maxLevel = computed(() => skillOf(crafter.value, craft.value).level)
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

const req = computed<InventRequest>(() => ({ craft: craft.value, level: level.value, category: category.value, inputs: inputs.value }))
const plan = computed(() => inventPlan(s.value, req.value, crafter.value))
// 強度依擲骰：各成功程度的上限
const GRADES: InventGrade[] = ['success', 'critical', 'partial']
const grades = computed(() => GRADES.map((g) => ({ grade: g, caps: inventCaps(craft.value, level.value, category.value, g) })).filter((x) => x.caps))
const gradeShown = ref<InventGrade>('success')
const shownCaps = computed(() => grades.value.find((x) => x.grade === gradeShown.value)?.caps ?? grades.value[0]?.caps)
const skill = computed(() => craftRules.skills[craft.value])
const aiOn = computed(() => settings.judgesWithAi())
const text = ref('')
const use = ref('')

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
  <div class="invent small">
    <p class="muted intro">
      寫下做法，放進材料試做。
      <Hint :text="`${aiOn ? 'AI 會依做法與材料設計成品並取名' : '沒有開啟 AI 判定時，會仿照同級的現成配方做一件「特製」品'}，做好之後可以在日誌或配方清單上改名。\n強度依擲骰：大成功稍強（最多到高一級的現成配方）、成功和同級相當、部分成功稍弱。做出東西時記成新的配方（只在這個存檔），之後可以在「依配方製作」重複做。`" />
    </p>
    <div class="row">
      <label class="field">誰來做
        <select v-model="crafterId">
          <option v-for="w in who" :key="w.member.id" :value="w.member.id" :disabled="!!w.refusal">{{ w.member.name }}{{ w.refusal ? `（${w.refusal}）` : '' }}</option>
        </select>
      </label>
      <label class="field">工藝
        <select v-model="craft">
          <option v-for="c in crafts" :key="c" :value="c">{{ craftRules.skills[c].name }}（Lv.{{ skillOf(crafter, c).level }}）</option>
        </select>
      </label>
      <label class="field">類別
        <select :value="category" @change="pickedCategory = ($event.target as HTMLSelectElement).value as InventCategory">
          <option v-for="c in categories" :key="c" :value="c">{{ INVENT_CATEGORY_NAME[c] }}</option>
        </select>
      </label>
      <label class="field">配方等級
        <select :value="level" @change="pickedLevel = Number(($event.target as HTMLSelectElement).value)">
          <option v-for="n in maxLevel" :key="n" :value="n">Lv.{{ n }}</option>
        </select>
      </label>
    </div>

    <div v-if="shownCaps" class="caps">
      <div class="row grades">
        <strong>強度上限</strong>
        <button v-for="x in grades" :key="x.grade" class="small" :class="{ active: shownCaps === x.caps }" @click="gradeShown = x.grade">{{ INVENT_GRADE_NAME[x.grade] }}</button>
      </div>
      <p class="muted">參考{{ capsSource(shownCaps) }}</p>
      <ul class="plain">
        <li v-for="t in capsText(shownCaps)" :key="t">・{{ t }}</li>
      </ul>
    </div>

    <div class="inputs">
      <span>材料（最多 {{ craftRules.invention.max_inputs }} 種） <Hint text="不論結果都會用掉。" />：</span>
      <span v-for="(x, i) in inputs" :key="x.name" class="tag">
        {{ x.name }} ×<input v-model.number="x.qty" type="number" min="1" max="99" class="qty" />
        <button class="x" @click="inputs.splice(i, 1)">×</button>
      </span>
      <template v-if="inputs.length < craftRules.invention.max_inputs && inputOptions.length">
        <select v-model="inputPick">
          <option value="">加入材料…</option>
          <option v-for="i in inputOptions" :key="i.name" :value="i.name">{{ i.name }}（持有 {{ i.qty }}）</option>
        </select>
        <button class="small" :disabled="!inputPick" @click="addInput">＋</button>
      </template>
    </div>
    <p class="muted">
      材料價值 {{ formatMoney(plan.inputValue) }}<template v-if="plan.cost">・不夠的部分另外花 {{ formatMoney(plan.cost) }}（成品份數多時再補）</template><template v-if="plan.rent">・工坊租金 {{ formatMoney(plan.rent) }}</template>
    </p>
    <p class="muted">
      {{ attrName(skill.attr) }}檢定 +{{ plan.skill * craftRules.level_bonus }}・DC {{ plan.dc }}・約 {{ plan.hours }} 小時・工具：要{{ toolTierName(toolTierFor(level)) }} <Hint :text="toolWhere(req.craft, toolTierFor(level))" />，現在 {{ plan.tool.source }}
    </p>
    <p class="muted">大成功：稍強，多做一半・成功：同級，照設計的份數・部分成功：稍弱，份數一半・失敗：材料損失一半・大失敗：材料全部損失（花費照付）</p>
    <ul v-if="plan.blocked" class="warn blockers"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
    <template v-else>
      <label class="field"><span>做法 <Hint text="不用取名，名字由 AI 依做法與材料決定。" /></span>
        <textarea v-model="text" rows="3" maxlength="400" placeholder="例如「把硫磺磨成粉，和藥草汁一起封進陶瓶，瓶口塞一條浸了油的布」「肉抹上蜂蜜和鹽，掛在爐邊慢慢烘乾」" />
      </label>
      <AbilityPicker v-model="use" />
      <button class="small" :disabled="game.judging || !!s.pendingAction || !text.trim()" @click="invent"><GameIcon name="lightbulb" :size="13" /> {{ crafter.isPlayer ? '試做看看' : `請${crafter.name}試做` }}</button>
    </template>
  </div>
</template>

<style scoped>
.invent { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); }
.invent p { margin: 0; }
.invent textarea { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.field { display: grid; gap: 2px; }
.caps { padding: 6px 8px; border: 1px dashed var(--border); border-radius: 6px; }
.caps ul { margin: 2px 0 0; }
.grades { align-items: center; gap: 4px; }
.grades .active { border-color: var(--accent); color: var(--accent); }
.inputs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.qty { width: 46px; }
.x { padding: 0 4px; }
.intro { display: flex; align-items: center; gap: 4px; }
.warn { color: var(--danger); }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
</style>
