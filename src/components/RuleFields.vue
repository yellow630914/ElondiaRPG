<script setup lang="ts">
// 這個存檔的規則（數值類，見 engine/gameRules.ts）：設定的「遊戲規則」「成人內容」頁與開新遊戲共用。
// 欄位清空或填回預設值就是預設；改了的項目旁邊可以一鍵恢復。
// groups：只列這幾類（沒給是全部）；headings：每一類前面加小標題（開新遊戲用）；noAdultMark：小標題不加（成人向）（成人內容頁本身就是成人向）；badge：每一項名稱後面的小標籤（設定頁標「存檔」）。
import { computed } from 'vue'
import { RULE_DEFS, RULE_GROUPS, type NumericRule, type RuleGroup } from '@/engine/gameRules'
import Hint from './ui/Hint.vue'

const props = defineProps<{ modelValue: Partial<Record<NumericRule, number>>; groups?: RuleGroup[]; headings?: boolean; badge?: string; noAdultMark?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: Partial<Record<NumericRule, number>>] }>()

const ALL = Object.keys(RULE_DEFS) as NumericRule[]
const sections = computed(() => RULE_GROUPS
  .filter((g) => !props.groups || props.groups.includes(g.id))
  .map((g) => ({ ...g, keys: ALL.filter((k) => RULE_DEFS[k].group === g.id) }))
  .filter((g) => g.keys.length))

function set(key: NumericRule, raw: string) {
  const next = { ...props.modelValue }
  const v = raw.trim() === '' ? NaN : Number(raw)
  if (Number.isFinite(v)) next[key] = v
  else delete next[key]
  emit('update:modelValue', next)
}

function reset(key: NumericRule) {
  const next = { ...props.modelValue }
  delete next[key]
  emit('update:modelValue', next)
}

const changed = (key: NumericRule) => props.modelValue[key] !== undefined && props.modelValue[key] !== RULE_DEFS[key].default
</script>

<template>
  <div class="rules">
    <template v-for="g in sections" :key="g.id">
    <h4 v-if="headings" class="group">{{ g.name }}<span v-if="g.adult && !noAdultMark" class="muted">（成人向）</span></h4>
    <label v-for="k in g.keys" :key="k" class="rule" :class="{ changed: changed(k) }">
      <span class="lab">{{ RULE_DEFS[k].label }} <span v-if="badge" class="badge">{{ badge }}</span><Hint :text="RULE_DEFS[k].hint" /></span>
      <span class="val">
        <input
          type="number" :min="RULE_DEFS[k].min" :max="RULE_DEFS[k].max" :step="RULE_DEFS[k].step"
          :value="modelValue[k] ?? RULE_DEFS[k].default"
          @change="set(k, ($event.target as HTMLInputElement).value)"
        />
        <span class="unit muted">{{ RULE_DEFS[k].zero && modelValue[k] === 0 ? RULE_DEFS[k].zero : RULE_DEFS[k].unit }}</span>
        <button type="button" class="small ghost" :class="{ hidden: !changed(k) }" :title="`恢復預設（${RULE_DEFS[k].default}）`" @click.prevent="reset(k)">恢復預設</button>
      </span>
    </label>
    </template>
  </div>
</template>

<style scoped>
.rules { display: grid; gap: 2px; }
.rule { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; align-items: center; padding: 4px 0; }
.rule + .rule { border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
.lab { display: inline-flex; align-items: center; gap: 4px; flex: 1 1 11em; min-width: 9em; } /* 窄的時候數值換到下一行，名稱不會被擠成一直行 */
.val { display: grid; grid-template-columns: 80px 5.5em auto; align-items: center; gap: 6px; margin-left: auto; }
.unit { font-size: var(--fs-sm); white-space: nowrap; }
.hidden { visibility: hidden; }
.changed .lab { color: var(--accent-2); }
.group { margin: 10px 0 2px; font-size: var(--fs-sm); color: var(--accent); }
.group:first-child { margin-top: 0; }
.badge { font-size: 11px; padding: 0 5px; border: 1px solid color-mix(in srgb, var(--accent-2) 60%, transparent); border-radius: 3px; color: var(--accent-2); font-weight: normal; white-space: nowrap; flex-shrink: 0; }
</style>
