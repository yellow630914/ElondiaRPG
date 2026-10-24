<script setup lang="ts">
// 這個存檔的規則（數值類，見 engine/gameRules.ts）：設定的「這個存檔的規則」與開新遊戲共用。
// 欄位清空或填回預設值就是預設；改了的項目旁邊可以一鍵恢復。
import { RULE_DEFS, type NumericRule } from '@/engine/gameRules'
import Hint from './ui/Hint.vue'

const props = defineProps<{ modelValue: Partial<Record<NumericRule, number>> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Partial<Record<NumericRule, number>>] }>()

const KEYS = Object.keys(RULE_DEFS) as NumericRule[]

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
    <label v-for="k in KEYS" :key="k" class="rule" :class="{ changed: changed(k) }">
      <span class="lab">{{ RULE_DEFS[k].label }} <Hint :text="RULE_DEFS[k].hint" /></span>
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
</style>
