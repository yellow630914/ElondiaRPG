<script setup lang="ts">
import { ICON_PATHS, type IconName } from './iconPaths'

// 介面用的像素圖示（顏色跟著文字色）
withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })
</script>

<template>
  <svg class="game-icon" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>

<style scoped>
.game-icon { fill: currentColor; flex: none; vertical-align: -0.2em; shape-rendering: crispEdges; }
</style>
