<script setup lang="ts">
import { ref } from 'vue'

// 長的說明：平常只顯示一行（後面「…」），點一下展開完整的文字，再點一下收起
defineProps<{ text: string }>()
const open = ref(false)
</script>

<template>
  <p class="small muted help" :class="{ open }" :title="open ? '' : '點一下看完整說明'" @click="open = !open">
    <span class="mark">ⓘ</span> {{ text }}
  </p>
</template>

<style scoped>
.help { margin: 0; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.help.open { white-space: normal; cursor: default; }
.mark { color: var(--accent); }
</style>
