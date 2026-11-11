<script setup lang="ts">
// 自訂難度的係數表（engine/gameRules.ts 的 CUSTOM_COEF）：頭目一列、小怪依最淺出現的區域各一列，欄位是生命、傷害、慾望上限。
// 設定頁與開新遊戲共用；「從…複製」把某個難度的係數整張填進來再改。慾望上限只在慾望戰鬥開著時有用（lust：慾望戰鬥關掉時不顯示那一欄）。
import { computed } from 'vue'
import { COEF_KEYS, COEF_NAME, CUSTOM_COEF, customFrom, DIFFICULTY_DEFS, DIFFICULTY_IDS, sanitizeCustomDifficulty, TIER_NAME } from '@/engine/gameRules'
import { MINION_TIERS, type MinionTier } from '@/engine/data'
import type { CustomDifficulty, Difficulty, DifficultyCoefs } from '@/engine/types'

const props = defineProps<{ modelValue: CustomDifficulty; lust?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: CustomDifficulty] }>()

const keys = computed(() => COEF_KEYS.filter((k) => k !== 'lust' || props.lust !== false))
const rows = computed<{ id: 'boss' | MinionTier; name: string; c: DifficultyCoefs }[]>(() => [
  { id: 'boss', name: '頭目', c: props.modelValue },
  ...MINION_TIERS.map((t) => ({ id: t, name: `${TIER_NAME[t].replace('地下城', '')}小怪`, c: props.modelValue.minions[t] })),
])

function set(row: 'boss' | MinionTier, key: keyof DifficultyCoefs, raw: string) {
  const v = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(v)) return
  const next: CustomDifficulty = JSON.parse(JSON.stringify(props.modelValue))
  if (row === 'boss') next[key] = v
  else next.minions[row][key] = v
  emit('update:modelValue', sanitizeCustomDifficulty(next))
}

function copyFrom(id: string) {
  if (!id) return
  emit('update:modelValue', customFrom(id as Difficulty))
}

const presets = DIFFICULTY_IDS.filter((id) => id !== 'custom')
</script>

<template>
  <div class="custom-diff">
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr><th></th><th v-for="k in keys" :key="k">{{ COEF_NAME[k] }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <th>{{ r.name }}</th>
            <td v-for="k in keys" :key="k">
              <input
                type="number" :min="CUSTOM_COEF.min" :max="CUSTOM_COEF.max" :step="CUSTOM_COEF.step" :value="r.c[k]"
                :aria-label="`${r.name}的${COEF_NAME[k]}係數`"
                @change="set(r.id, k, ($event.target as HTMLInputElement).value)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <label class="copy small">從
      <select value="" @change="copyFrom(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
        <option value="" disabled>選一個難度</option>
        <option v-for="id in presets" :key="id" :value="id">{{ DIFFICULTY_DEFS[id].name }}</option>
      </select>
      複製係數
    </label>
    <p class="small muted">每一格是倍率（{{ CUSTOM_COEF.min }}～{{ CUSTOM_COEF.max }}），1 是普通難度。生命乘在怪物的最大生命，傷害乘在怪物造成的傷害<template v-if="keys.includes('lust')">，慾望上限乘在怪物的慾望上限（慾望戰鬥：越高越難把敵人堆到高潮；頭目的上限本來就照生命放大，所以普通難度的頭目是 1）</template>。小怪依最淺出現的區域分組；層主與有低血大招的特殊任務頭目算頭目。</p>
  </div>
</template>

<style scoped>
.custom-diff { display: grid; gap: 6px; }
.tbl-wrap { overflow-x: auto; }
.tbl { border-collapse: collapse; font-variant-numeric: tabular-nums; }
.tbl th, .tbl td { padding: 2px 4px; text-align: left; white-space: nowrap; }
.tbl thead th { font-weight: normal; font-size: var(--fs-sm); opacity: 0.75; }
.tbl tbody th { font-weight: normal; }
.tbl input { width: 4.6em; }
.copy { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
</style>
