<script setup lang="ts" generic="T extends string">
import Hint from '../ui/Hint.vue'
import { toggled, type CheckOption } from './checks'

// 一排勾選框（內容標籤、主角形象……）：都不勾時是 undefined
const model = defineModel<T[] | undefined>()
defineProps<{ label: string; hint?: string; options: readonly CheckOption[] }>()
</script>

<template>
  <div class="row checks small">
    <span>{{ label }}<Hint v-if="hint" :text="hint" /></span>
    <label v-for="[v, name, title] in options" :key="v" class="check" :title="title">
      <input type="checkbox" :checked="model?.includes(v as T)" @change="model = toggled(model, v as T, ($event.target as HTMLInputElement).checked)" /> {{ name }}
    </label>
  </div>
</template>

<style scoped src="./editor.css"></style>
