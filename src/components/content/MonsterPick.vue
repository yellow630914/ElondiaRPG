<script setup lang="ts">
import { computed } from 'vue'
import { enemies } from '@/engine/data'
import { useContent } from '@/stores/content'

// 一種怪物與隻數（[怪物 id, 隻數]）：特殊任務的戰鬥、特殊地圖的遭遇表與 BOSS 格共用。直接改傳進來的那一組；移除交給外面。
const props = withDefaults(defineProps<{ entry: [string, number]; min?: number; max?: number }>(), { min: 1, max: 6 })
defineEmits<{ remove: [] }>()
const content = useContent()
const list = computed(() => {
  void content.version
  return Object.values(enemies).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
})
// 不能寫 v-model="entry[0]"（props 是唯讀的型別）：照原本的做法直接改那一組
const id = computed({ get: () => props.entry[0], set: (v: string) => { props.entry[0] = v } })
const count = computed({ get: () => props.entry[1], set: (v: number) => { props.entry[1] = v } })
</script>

<template>
  <span class="monster-pick">
    <select v-model="id">
      <option v-for="e in list" :key="e.id" :value="e.id">{{ e.name }}（{{ e.level }} 級）</option>
      <option v-if="!enemies[id]" :value="id">{{ id }}（不存在）</option>
    </select>
    ×<input v-model.number="count" type="number" :min="min" :max="max" class="count" />
    <button type="button" class="x" title="移除這種怪物" @click="$emit('remove')">✕</button>
  </span>
</template>

<style scoped>
.monster-pick { display: inline-flex; gap: 4px; align-items: center; }
.count { width: 3.5em; }
.x { padding: 0 4px; line-height: 1.2; }
</style>
