<script setup lang="ts">
// 可以輸入的下拉選單：從清單挑（有說明的顯示在旁邊），也可以自己打。
// 用在和系統資料有關、但允許自訂的欄位（出身、職業描述、店主職稱……）。
const model = defineModel<string | undefined>()
defineProps<{ options: (string | { value: string; label?: string })[]; placeholder?: string; maxlength?: number }>()
const id = `combo-${Math.random().toString(36).slice(2, 8)}`
const val = (o: string | { value: string }) => (typeof o === 'string' ? o : o.value)
const lab = (o: string | { value: string; label?: string }) => (typeof o === 'string' ? undefined : o.label)
</script>

<template>
  <span class="combo">
    <input :value="model ?? ''" :list="id" :placeholder="placeholder ?? '從清單選，或自己輸入'" :maxlength="maxlength" @input="model = ($event.target as HTMLInputElement).value" />
    <datalist :id="id"><option v-for="o in options" :key="val(o)" :value="val(o)">{{ lab(o) }}</option></datalist>
  </span>
</template>

<style scoped>
.combo { display: block; min-width: 0; }
.combo input { width: 100%; }
</style>
