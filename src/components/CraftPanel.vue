<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, craftRules, damageTypeName, itemDef } from '@/engine/data'
import { canCraftHere, craftKindsHere, craftPlan, craftRarity, craftTarget, makeTarget, type AuxItem } from '@/engine/craft'
import { crafters, skillOf, toolTierFor, toolTierName } from '@/engine/crafting'
import { gearName, gearRules, gearSummary, rarityName, rarityPoints, slotName } from '@/engine/gear'
import { formatMoney } from '@/engine/money'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'

// 打造裝備（data/rules/gear.json 的 craft）：選底材與材料，可以描述想要的樣子。
// commission：在鐵匠鋪、裁縫店、珠寶店委託店主；make：主角或肯幫忙的夥伴自己動手（crafts.json）
const props = withDefaults(defineProps<{ mode?: 'commission' | 'make' }>(), { mode: 'commission' })
const make = computed(() => props.mode === 'make')
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const here = computed(() => make.value || canCraftHere(s.value))

// 自己動手：誰來做（不肯幫忙的列出原因）
const who = computed(() => crafters(s.value))
const crafterId = ref('pc')
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

// 委託：只列這間店做得出來的底材（鐵匠鋪：金屬、木材；裁縫店：皮革、布料；珠寶店：寶石）；自己動手：全部
const bases = computed(() => Object.entries(gearRules.bases).filter(([, b]) => make.value || craftKindsHere(s.value).includes(b.kind)).map(([id, b]) => ({ id, ...b })))
const picked = ref('')
const base = computed({
  get: () => (bases.value.some((b) => b.id === picked.value) ? picked.value : bases.value[0]?.id ?? 'longsword'),
  set: (v: string) => { picked.value = v },
})
const kind = computed(() => gearRules.bases[base.value]!.kind)
const materials = computed(() => Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind.value).map(([id, m]) => ({ id, ...m })))
const material = ref('iron')
const mat = computed(() => (gearRules.materials[material.value]?.kind === kind.value ? material.value : materials.value[0]!.id))
// 輔料：行囊裡的任何材料（最多三種），不論結果都會用掉
const aux = ref<AuxItem[]>([])
const auxPick = ref('')
const auxRules = gearRules.craft.aux
const auxOptions = computed(() => s.value.inventory.filter((i) => itemDef(i.name)?.category === 'material' && !aux.value.some((a) => a.name === i.name)))
function addAux() {
  if (!auxPick.value || aux.value.length >= auxRules.max_kinds) return
  aux.value.push({ name: auxPick.value, qty: 1 })
  auxPick.value = ''
}
const plan = computed(() => craftPlan(s.value, base.value, mat.value, aux.value, make.value ? crafter.value : undefined))
const skill = computed(() => craftRules.skills[plan.value.craft])
const text = ref('')
const use = ref('')
const slotLabel = (slot: string) => (slot === 'ring' ? '戒指' : slotName(slot as never))

function craft() {
  const u = parseUse(use.value)
  const target = make.value ? makeTarget(crafter.value.id, base.value, mat.value, aux.value) : craftTarget(base.value, mat.value, aux.value)
  void game.perform({ kind: make.value ? 'make' : 'craft', target, text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  aux.value = []
  use.value = ''
  emit('started')
}
</script>

<template>
  <component :is="make ? 'div' : 'details'" v-if="here" class="craft small">
    <summary v-if="!make">🔨 委託打造</summary>
    <p v-if="!make" class="muted">第一級材料由工匠提供；更好的材料要自備（龍鱗、秘銀礦石之類可以打造的材料）。{{ attrName(gearRules.craft.attr) }}檢定，約 {{ gearRules.craft.hours }} 小時。店主的工藝等級要達到材料等級，比需要的高時做得更好。</p>
    <p v-else class="muted">第一級材料自己買（材料費），更好的材料要自備。做的人擲屬性檢定，加上工藝等級；約 {{ craftRules.self.hours }} 小時。成功時做的人得到工藝經驗。</p>
    <label v-if="make" class="who">誰來做
      <select v-model="crafterId">
        <option v-for="w in who" :key="w.member.id" :value="w.member.id" :disabled="!!w.refusal">{{ w.member.name }}{{ w.refusal ? `（${w.refusal}）` : '' }}</option>
      </select>
    </label>
    <div class="row">
      <select v-model="base">
        <option v-for="b in bases" :key="b.id" :value="b.id">{{ slotLabel(b.slot) }}・{{ b.name }}</option>
      </select>
      <select :value="mat" @change="material = ($event.target as HTMLSelectElement).value">
        <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}（{{ rarityName(m.rarity) }}，建議 {{ m.level }} 級）</option>
      </select>
    </div>
    <p>成品：<b>{{ gearName({ base, material: mat }) }}</b>　{{ gearSummary({ base, material: mat }) }}</p>
    <p class="muted">
      {{ skill.name }}：{{ make ? `${crafter.name} Lv.${skillOf(crafter, plan.craft).level}` : `工匠 Lv.${plan.level}` }}（這個材料要 Lv.{{ plan.tier }}）
      <template v-if="make">・{{ attrName(skill.attr) }}檢定 +{{ plan.level * craftRules.level_bonus }}・工具：要{{ toolTierName(toolTierFor(plan.tier)) }}，現在 {{ plan.tool?.source }}</template>
    </p>
    <p class="muted">
      {{ make ? `花費 ${formatMoney(plan.fee)}${plan.materialCost ? `（材料費 ${formatMoney(plan.materialCost)}）` : ''}${plan.rent ? `（工坊租金 ${formatMoney(plan.rent)}）` : ''}` : `工錢 ${formatMoney(plan.fee)}` }}・DC {{ plan.dc }}
      <template v-if="plan.units">・打造材料 {{ plan.have }} / {{ plan.units }} 份<template v-if="plan.uses.length">（用掉 {{ plan.uses.map((u) => `${u.name}×${u.qty}`).join('、') }}）</template></template>
    </p>
    <p class="muted">大成功：{{ rarityName(craftRarity(mat, 'critical')!) }}（附魔 {{ rarityPoints(craftRarity(mat, 'critical')!) }} 點）・成功：{{ rarityName(craftRarity(mat, 'success')!) }}（{{ rarityPoints(craftRarity(mat, 'success')!) }} 點）・部分成功：沒有附魔・失敗：材料損失一半</p>
    <div class="aux">
      <span>輔料（選填，最多 {{ auxRules.max_kinds }} 種，不論結果都會用掉）：</span>
      <span v-for="(a, i) in aux" :key="a.name" class="tag">
        {{ a.name }} ×<input v-model.number="a.qty" type="number" min="1" :max="auxRules.max_qty" class="qty" />
        <button class="x" @click="aux.splice(i, 1)">×</button>
      </span>
      <template v-if="aux.length < auxRules.max_kinds && auxOptions.length">
        <select v-model="auxPick">
          <option value="">加入材料…</option>
          <option v-for="i in auxOptions" :key="i.name" :value="i.name">{{ i.name }}（持有 {{ i.qty }}）</option>
        </select>
        <button class="small" :disabled="!auxPick" @click="addAux">＋</button>
      </template>
      <span v-else-if="!aux.length" class="muted">行囊裡沒有材料。</span>
    </div>
    <p v-if="aux.length" class="muted">
      輔料價值 {{ formatMoney(plan.auxValue) }}：{{ Math.round(plan.auxChance * 100) }}% 機率品質再高一級（部分成功時照成功做）<template v-if="plan.elements.length">・附魔偏向 {{ plan.elements.map((e) => damageTypeName(e)).join('、') }}</template>
    </p>
    <p v-if="plan.blocked" class="muted">⚠ {{ plan.blocked }}</p>
    <template v-else>
      <input v-model="text" placeholder="想要的樣子（選填）：例如刻上家紋、劍身帶著火焰紋路、取名「破曉」" />
      <AbilityPicker v-model="use" />
      <button class="small" :disabled="game.judging || !!s.pendingAction" @click="craft">{{ make ? `🛠️ ${crafter.isPlayer ? '親手' : `請${crafter.name}`}打造` : '委託打造' }}</button>
    </template>
  </component>
</template>

<style scoped>
.craft { margin-top: 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.craft input:not([type]) { width: 100%; }
.who { display: grid; gap: 2px; }
.craft p { margin: 0; }
.aux { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.aux .qty { width: 46px; }
.aux .x { padding: 0 4px; }
</style>
