<script setup lang="ts">
import GameIcon from '../ui/GameIcon.vue'
import type { IconName } from '../ui/iconPaths'

// 建築的功能選單：每一項是一列（圖示、名稱、一行說明、右側的數字或狀態），點了交給上層打開對應的畫面
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
  <ul class="menu">
    <li v-for="it in items" :key="it.id">
      <button class="ghost" :disabled="it.disabled" @click="emit('pick', it.id)">
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
.menu li + li { border-top: 1px solid #ffffff0a; }
.menu button {
  position: relative; width: 100%; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto 14px; gap: 8px; align-items: center;
  padding: 9px 8px; border: none; border-radius: 3px; text-align: left; color: var(--text);
}
.menu button:hover:not(:disabled) { background: linear-gradient(90deg, #c99a4522, transparent); color: var(--text); }
.menu button:hover:not(:disabled)::before {
  content: ''; position: absolute; left: -4px; top: 50%; border: 5px solid transparent; border-left-color: var(--gold-hi); transform: translateY(-50%);
}
.ic { color: var(--accent); }
.text { display: grid; min-width: 0; }
.t { font-weight: 600; }
.d { font-size: var(--fs-xs); color: var(--muted); }
.chev { color: var(--muted); }
.tag.gold { color: var(--gold-hi); border-color: var(--gold-lo); }
.tag.good { color: var(--good); border-color: color-mix(in srgb, var(--good) 50%, transparent); }
.tag.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
</style>
