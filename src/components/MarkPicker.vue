<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { slaveryRules } from '@/engine/data'
import { sanitizeTerms, templateTerms, type MarkChoice } from '@/engine/slavery'
import { placeName, TATTOO_PLACES } from '@/engine/tattoos'
import type { MarkTerms } from '@/engine/types'
import Hint from './ui/Hint.vue'

// 選擇契約印記：模板（勞役、戰奴、魔導束縛）或自訂（名稱、描述、部位與各項數值）
const props = defineProps<{ allowed?: string[]; allowCustom?: boolean; base?: string }>()
const model = defineModel<MarkChoice>({ required: true })

const templates = computed(() => props.allowed ?? Object.keys(slaveryRules.contracts))
// 初始值不在可選範圍內時改選第一個可選的印記
const mode = ref<string>(
  typeof model.value !== 'string' ? (props.allowCustom ? 'custom' : templates.value[0]!)
    : templates.value.includes(model.value) ? model.value : templates.value[0] ?? (props.allowCustom ? 'custom' : model.value),
)
const r = slaveryRules.custom_mark
const custom = reactive<MarkTerms>(templateTerms(props.base ?? templates.value[0] ?? slaveryRules.roles.default))
const sideText = ref(custom.side_effects.join('\n'))

watch([mode, custom, sideText], () => {
  model.value = mode.value === 'custom'
    ? sanitizeTerms({ ...custom, side_effects: sideText.value.split('\n') })
    : mode.value
}, { deep: true, immediate: true })

const pct = (n: number) => `${Math.round(n * 100)}%`
function summary(t: MarkTerms): string {
  return `收益 ${pct(t.income_share)}・談判 DC ${t.negotiate_dc}・逃離 DC ${t.escape_dc}・出城 DC ${t.exit_dc}・被找到 ${pct(t.recapture_chance)}・反噬 ${pct(t.escape_hp_ratio)}・服從 -${t.obedience_penalty}`
}

/** 從模板開始改 */
function startFrom(id: string) {
  Object.assign(custom, templateTerms(id))
  sideText.value = custom.side_effects.join('\n')
  mode.value = 'custom'
}
</script>

<template>
  <div class="mark-picker small">
    <label v-for="id in templates" :key="id" class="option">
      <input v-model="mode" type="radio" :value="id" />
      <span>
        <strong>{{ templateTerms(id).name }}</strong>（{{ placeName(templateTerms(id).place) }}）：{{ templateTerms(id).mark }}
        <span class="muted"><br />{{ summary(templateTerms(id)) }}<br />{{ templateTerms(id).side_effects.join('；') }}</span>
      </span>
    </label>
    <template v-if="allowCustom">
      <label class="option">
        <input v-model="mode" type="radio" value="custom" />
        <strong>自訂印記</strong>
      </label>
      <div v-if="mode === 'custom'" class="custom">
        <div class="row">
          <span class="muted">從模板開始：</span>
          <button v-for="id in Object.keys(slaveryRules.contracts)" :key="id" class="small" type="button" @click="startFrom(id)">{{ templateTerms(id).name }}</button>
        </div>
        <label>名稱 <input v-model="custom.name" :maxlength="r.name_chars" /></label>
        <label><span>描述 <Hint text="印記的樣子與感覺，會交給 AI 描寫。" /></span><textarea v-model="custom.mark" rows="2" :maxlength="r.mark_chars" /></label>
        <label><span>部位 <Hint text="原本的刺青會被蓋掉。" /></span>
          <select v-model="custom.place"><option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}</option></select>
        </label>
        <div class="nums">
          <label>收益歸主人 <input v-model.number="custom.income_share" type="number" step="0.05" :min="r.income_share[0]" :max="r.income_share[1]" /></label>
          <label>談判 DC <input v-model.number="custom.negotiate_dc" type="number" :min="r.negotiate_dc[0]" :max="r.negotiate_dc[1]" /></label>
          <label>逃離 DC <input v-model.number="custom.escape_dc" type="number" :min="r.escape_dc[0]" :max="r.escape_dc[1]" /></label>
          <label>出城 DC <input v-model.number="custom.exit_dc" type="number" :min="r.exit_dc[0]" :max="r.exit_dc[1]" /></label>
          <label>被找到的機率 <input v-model.number="custom.recapture_chance" type="number" step="0.05" :min="r.recapture_chance[0]" :max="r.recapture_chance[1]" /></label>
          <label>逃離反噬（生命值比例）<input v-model.number="custom.escape_hp_ratio" type="number" step="0.05" :min="r.escape_hp_ratio[0]" :max="r.escape_hp_ratio[1]" /></label>
          <label>服從懲罰 <input v-model.number="custom.obedience_penalty" type="number" :min="r.obedience_penalty[0]" :max="r.obedience_penalty[1]" /></label>
        </div>
        <label>副作用（一行一項，最多 {{ r.side_effects }} 項）<textarea v-model="sideText" rows="2" /></label>
        <p class="muted">數值超出範圍時會自動調整。</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mark-picker { display: grid; gap: 6px; }
.option { display: flex; gap: 6px; align-items: flex-start; }
.custom { display: grid; gap: 6px; padding: 6px 8px; border: 1px dashed var(--border); border-radius: 6px; }
.custom label { display: grid; gap: 2px; }
.custom textarea { width: 100%; }
.nums { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.nums input { width: 100%; }
</style>
