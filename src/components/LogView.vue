<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import ReportCard from './ReportCard.vue'

const game = useGame()
const hideTrade = ref(true)
const reports = computed(() =>
  [...(game.state?.reports ?? [])].reverse().filter((r: Report) => !(hideTrade.value && r.kind === 'trade')),
)
</script>

<template>
  <div class="row" style="margin-bottom: 10px">
    <label class="small"><input v-model="hideTrade" type="checkbox" /> 隱藏交易紀錄</label>
  </div>
  <p v-if="reports.length === 0" class="muted">還沒有任何紀錄。</p>
  <ReportCard v-for="r in reports" :key="r.report_id" :report="r" />
</template>
