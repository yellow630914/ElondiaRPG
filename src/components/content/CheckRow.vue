<script setup lang="ts">
import { ATTR_IDS, attrName, type AttrId } from '@/engine/data'

// 檢定的屬性與 DC（任務點、選項、事件、主人事件的回應共用）：直接改傳進來的那個檢定
const props = defineProps<{ check: { attr: AttrId; dc: number } }>()
</script>

<template>
  <span class="check-row">
    <select v-model="props.check.attr" title="檢定的屬性"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
    DC <input v-model.number="props.check.dc" type="number" min="1" max="40" class="dc" />
  </span>
</template>

<style scoped>
.check-row { display: inline-flex; gap: 4px; align-items: center; }
.dc { width: 84px; min-width: 84px; }
</style>
