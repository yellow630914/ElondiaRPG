<script setup lang="ts">
import { actionRules, ATTR_IDS, attrName, SKILL_IDS, skillName, type AttrId, type SkillId } from '@/engine/data'
import Hint from '../ui/Hint.vue'

// 檢定的屬性、分類與 DC（任務點、選項、事件、主人事件的回應共用）：直接改傳進來的那個檢定
const props = defineProps<{ check: { attr: AttrId; dc: number; skill?: SkillId } }>()

const DEFAULT_TEXT = ATTR_IDS.map((a) => `${attrName(a)}→${skillName(actionRules.attr_skills?.[a]) || '不分類'}`).join('、')

function setSkill(v: string) {
  if (v) props.check.skill = v as SkillId
  else delete props.check.skill
}
</script>

<template>
  <span class="check-row">
    <select v-model="props.check.attr" title="檢定的屬性"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
    <select :value="props.check.skill ?? ''" title="檢定分類：特質、身分寫在這個分類上的加成會算進來" @change="setSkill(($event.target as HTMLSelectElement).value)">
      <option value="">（照屬性：{{ skillName(actionRules.attr_skills?.[props.check.attr]) || '不分類' }}）</option>
      <option v-for="k in SKILL_IDS" :key="k" :value="k">{{ skillName(k) }}</option>
    </select>
    <Hint :text="`檢定分類（說服、欺瞞、潛行……）：特質、身分標籤寫在這個分類上的加值會算進來。沒選時照屬性推：${DEFAULT_TEXT}。`" />
    DC <input v-model.number="props.check.dc" type="number" min="1" max="40" class="dc" />
  </span>
</template>

<style scoped>
.check-row { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.dc { width: 84px; min-width: 84px; }
</style>
