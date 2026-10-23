<script setup lang="ts">
import { computed } from 'vue'
import type { Body } from '@/engine/traits'
import { BODY_SHAPES } from './bodyShapes'

// 人形剪影：依身形（男性、女性、中性）換輪廓；背面不畫胸線。插槽畫在剪影上面（刺青部位的點）
const props = defineProps<{ body: Body; back?: boolean }>()
const shape = computed(() => BODY_SHAPES[props.body])
</script>

<template>
  <svg class="body-figure" viewBox="0 0 100 220" aria-hidden="true">
    <path class="fill" :d="shape.outline" />
    <circle class="fill" :cx="shape.head.cx" :cy="shape.head.cy" :r="shape.head.r" />
    <template v-if="!back"><path v-for="(d, i) in shape.details" :key="i" class="line" :d="d" /></template>
    <slot />
  </svg>
</template>

<style scoped>
.body-figure { width: 100%; }
.fill { fill: #c99a4526; stroke: #c99a4588; stroke-width: 1.2; stroke-linejoin: round; }
.line { fill: none; stroke: #c99a4566; stroke-width: 1; stroke-linecap: round; }
</style>
