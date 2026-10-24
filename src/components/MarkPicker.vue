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
/** 表格的數值欄（模板與自訂共用） */
const COLS: { key: keyof MarkTerms; name: string; hint: string; fmt: (t: MarkTerms) => string; step?: number }[] = [
  { key: 'income_share', name: '收益', hint: '賺到的錢有多少歸主人', fmt: (t) => pct(t.income_share), step: 0.05 },
  { key: 'negotiate_dc', name: '談判', hint: '和主人談判解除契約的 DC', fmt: (t) => `DC ${t.negotiate_dc}` },
  { key: 'escape_dc', name: '逃離', hint: '嘗試逃離主人的 DC', fmt: (t) => `DC ${t.escape_dc}` },
  { key: 'exit_dc', name: '出城', hint: '請求主人讓你出城的 DC', fmt: (t) => `DC ${t.exit_dc}` },
  { key: 'recapture_chance', name: '被找到', hint: '逃亡時每天被主人找到的機率', fmt: (t) => pct(t.recapture_chance), step: 0.05 },
  { key: 'escape_hp_ratio', name: '反噬', hint: '逃離時印記反噬，失去的生命值比例', fmt: (t) => pct(t.escape_hp_ratio), step: 0.05 },
  { key: 'obedience_penalty', name: '服從', hint: '服從懲罰：違抗主人的檢定減值', fmt: (t) => `-${t.obedience_penalty}` },
]
const range = (k: keyof MarkTerms) => (r as unknown as Record<string, [number, number]>)[k]!

/** 從模板開始改 */
function startFrom(id: string) {
  Object.assign(custom, templateTerms(id))
  sideText.value = custom.side_effects.join('\n')
  mode.value = 'custom'
}
</script>

<template>
  <div class="mark-picker small">
    <div class="scroll">
      <table class="marks">
        <thead>
          <tr>
            <th />
            <th>印記</th>
            <th>部位</th>
            <th v-for="c in COLS" :key="c.key" class="num" :title="c.hint">{{ c.name }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="id in templates" :key="id">
            <tr :class="{ on: mode === id }" @click="mode = id">
              <td class="pick"><input v-model="mode" type="radio" :value="id" @click.stop /></td>
              <th>{{ templateTerms(id).name }}</th>
              <td class="nowrap">{{ placeName(templateTerms(id).place) }}</td>
              <td v-for="c in COLS" :key="c.key" class="num">{{ c.fmt(templateTerms(id)) }}</td>
            </tr>
            <tr :class="{ on: mode === id }" class="sub" @click="mode = id">
              <td />
              <td :colspan="COLS.length + 2" class="muted">{{ templateTerms(id).mark }}<template v-if="templateTerms(id).side_effects.length"><br />副作用：{{ templateTerms(id).side_effects.join('；') }}</template></td>
            </tr>
          </template>
          <tr v-if="allowCustom" :class="{ on: mode === 'custom' }" @click="mode = 'custom'">
            <td class="pick"><input v-model="mode" type="radio" value="custom" @click.stop /></td>
            <th>自訂印記</th>
            <td :colspan="COLS.length + 1" class="muted">自己決定名稱、部位與各項數值<template v-if="mode === 'custom'">（{{ custom.name }}）</template></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="allowCustom && mode === 'custom'" class="custom">
      <div class="row">
        <span class="muted">從模板開始：</span>
        <button v-for="id in Object.keys(slaveryRules.contracts)" :key="id" class="small" type="button" @click="startFrom(id)">{{ templateTerms(id).name }}</button>
      </div>
      <table class="form">
        <tr><th>名稱</th><td><input v-model="custom.name" :maxlength="r.name_chars" /></td></tr>
        <tr><th>描述 <Hint text="印記的樣子與感覺，會交給 AI 描寫。" /></th><td><textarea v-model="custom.mark" rows="2" :maxlength="r.mark_chars" /></td></tr>
        <tr><th>部位 <Hint text="原本的刺青會被蓋掉。" /></th><td><select v-model="custom.place"><option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}</option></select></td></tr>
      </table>
      <table class="form nums">
        <thead><tr><th>項目</th><th>數值</th><th class="muted">範圍</th></tr></thead>
        <tr v-for="c in COLS" :key="c.key">
          <th>{{ c.name }} <Hint :text="c.hint" /></th>
          <td><input v-model.number="(custom as unknown as Record<string, number>)[c.key]" type="number" :step="c.step ?? 1" :min="range(c.key)[0]" :max="range(c.key)[1]" /></td>
          <td class="muted nowrap">{{ range(c.key)[0] }}～{{ range(c.key)[1] }}</td>
        </tr>
      </table>
      <label>副作用（一行一項，最多 {{ r.side_effects }} 項）<textarea v-model="sideText" rows="2" /></label>
      <p class="muted">數值超出範圍時會自動調整。</p>
    </div>
  </div>
</template>

<style scoped>
.mark-picker { display: grid; gap: 6px; }
.scroll { overflow-x: auto; }
.marks { width: 100%; border-collapse: collapse; }
.marks thead th { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--border); cursor: help; white-space: nowrap; }
.marks td, .marks tbody th { padding: 5px 6px; text-align: left; vertical-align: top; }
.marks tbody th { white-space: nowrap; }
.marks tbody tr { cursor: pointer; }
.marks tbody tr:not(.sub) { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.marks tr.sub td { padding-top: 0; font-size: var(--fs-xs); }
.marks tr.on th { color: var(--accent); }
.marks tr.on { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.marks .num { text-align: right; white-space: nowrap; }
.marks .pick { width: 1%; }
.nowrap { white-space: nowrap; }
.custom { display: grid; gap: 6px; padding: 6px 8px; border: 1px dashed var(--border); border-radius: 6px; }
.custom label { display: grid; gap: 2px; }
.custom textarea { width: 100%; }
.form { border-collapse: collapse; width: 100%; }
.form th { text-align: left; font-weight: 600; white-space: nowrap; padding: 3px 8px 3px 0; width: 1%; vertical-align: top; }
.form td { padding: 3px 6px 3px 0; }
.form.nums { width: auto; }
.form.nums thead th { font-size: var(--fs-xs); color: var(--muted); }
.form.nums input { width: 90px; }
</style>
