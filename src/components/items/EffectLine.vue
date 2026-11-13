<script setup lang="ts">
import type { SummaryPart } from '@/engine/gear'
import Hint from '../ui/Hint.vue'
import BindTip from './BindTip.vue'

// 物品的效果說明（gearSummaryParts、itemEffectParts）：一段一段排開，拘束具的「限制行走 2」可以移上去、用鍵盤聚焦或點一下看細節。
// chips：每段是一個標籤（紙娃娃）；否則用「・」接成一行
defineProps<{ parts: SummaryPart[]; chips?: boolean }>()
</script>

<template>
  <template v-for="(p, i) in parts" :key="i">
    <span v-if="!chips && i" class="sep">・</span>
    <Hint v-if="p.bind" :width="320">
      <template #trigger><span class="has-tip" :class="{ tag: chips }">{{ p.text }}</span></template>
      <BindTip :kind="p.bind.kind" :bind="p.bind.bind" :lock="p.bind.lock" />
    </Hint>
    <span v-else :class="{ tag: chips }">{{ p.text }}</span>
  </template>
</template>

<style scoped>
.has-tip { text-decoration: underline dotted; text-underline-offset: 3px; cursor: help; color: inherit; }
.tag.has-tip { text-decoration: none; border-style: dashed; }
</style>
