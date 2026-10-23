<script setup lang="ts">
import GameIcon from './GameIcon.vue'
import type { IconName } from './iconPaths'

// 短資訊的小標籤：價格、DC、狀態、變化
withDefaults(defineProps<{ tone?: 'plain' | 'gold' | 'good' | 'bad' | 'jade'; icon?: IconName }>(), { tone: 'plain', icon: undefined })
</script>

<template>
  <span class="chip" :class="tone"><GameIcon v-if="icon" :name="icon" :size="13" /><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); line-height: 20px; padding: 0 7px;
  border: 1px solid var(--chip-border); border-radius: 2px; background: var(--chip-bg); color: var(--muted); white-space: nowrap;
}
.chip.gold { border-color: var(--gold-lo); color: var(--gold-hi); }
.chip.good { border-color: color-mix(in srgb, var(--good) 55%, transparent); color: var(--good); }
.chip.bad { border-color: color-mix(in srgb, var(--danger) 60%, transparent); color: var(--danger); }
.chip.jade { border-color: color-mix(in srgb, var(--accent-2) 55%, transparent); color: var(--accent-2); }
</style>
