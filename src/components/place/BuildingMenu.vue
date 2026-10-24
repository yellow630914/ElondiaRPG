<script setup lang="ts">
import GameIcon from '../ui/GameIcon.vue'
import type { IconName } from '../ui/iconPaths'

// 建築的功能選單：每一項是一列（圖示、名稱、一行說明、右側的數字或狀態），點了交給上層打開對應的畫面。
// 樣式是全域的 .menu-row（可以展開的區塊 FoldMenu 用同一種）
export interface MenuItem {
  id: string
  icon: IconName
  label: string
  detail?: string
  badge?: string | number
  tone?: 'gold' | 'good' | 'bad'
  disabled?: boolean
}
defineProps<{ items: MenuItem[] }>()
const emit = defineEmits<{ pick: [id: string] }>()
</script>

<template>
  <ul class="menu menu-list">
    <li v-for="it in items" :key="it.id">
      <button class="ghost menu-row" :disabled="it.disabled" @click="emit('pick', it.id)">
        <GameIcon :name="it.icon" :size="20" class="ic" />
        <span class="text"><span class="t">{{ it.label }}</span><span v-if="it.detail" class="d">{{ it.detail }}</span></span>
        <span v-if="it.badge !== undefined && it.badge !== ''" class="tag" :class="it.tone">{{ it.badge }}</span>
        <GameIcon name="right" :size="14" class="chev" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.menu { list-style: none; margin: 4px 0 0; padding: 0; }
</style>
