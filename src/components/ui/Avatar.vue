<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { genderDef } from '@/engine/data'
import { npcRecord } from '@/engine/npcs'
import { useGame } from '@/stores/game'
import { portraitKey, usePortraits } from '@/stores/portraits'

// 小頭像：有形象圖時顯示圖，沒有時顯示名字第一個字的印章（依性別上色）
const props = withDefaults(defineProps<{ id: string; size?: number }>(), { size: 44 })
const game = useGame()
const portraits = usePortraits()
const key = computed(() => (game.state ? portraitKey(game.state, props.id) : ''))
const url = computed(() => (key.value ? portraits.urls[key.value] : null))
const who = computed(() => {
  const s = game.state
  if (!s) return undefined
  return s.party.find((m) => m.id === props.id) ?? npcRecord(s, props.id)
})
const glyph = computed(() => [...(who.value?.name ?? '?')][0])
const color = computed(() => genderDef(who.value?.gender)?.color ?? 'var(--accent)')

onMounted(() => key.value && void portraits.load(key.value))
watch(key, (k) => k && void portraits.load(k))
</script>

<template>
  <span class="avatar" :style="{ width: `${size}px`, height: `${size}px`, '--seal': color }">
    <img v-if="url" :src="url" alt="" />
    <span v-else class="seal" :style="{ fontSize: `${Math.round(size * 0.48)}px` }">{{ glyph }}</span>
  </span>
</template>

<style scoped>
.avatar {
  display: grid; place-items: center; flex: none; overflow: hidden;
  border: 1px solid #000; box-shadow: 0 0 0 1px var(--gold-lo);
  background: radial-gradient(circle at 50% 35%, #4a3a2a, #1d1610);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.seal { font-weight: 900; color: var(--seal); text-shadow: 0 1px 0 #000, 0 0 8px color-mix(in srgb, var(--seal) 40%, transparent); line-height: 1; }
</style>
