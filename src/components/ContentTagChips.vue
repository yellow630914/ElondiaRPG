<script setup lang="ts">
import { CONTENT_TAGS, type ContentTag } from '@/engine/content'

// 內容警示：特殊任務與選項的標籤（成人向、NTR、非處女、主角非自願）
defineProps<{ tags?: string[] }>()
const known = (t: string): t is ContentTag => t in CONTENT_TAGS
</script>

<template>
  <span v-for="t in (tags ?? []).filter(known)" :key="t" class="tag content-tag" :title="CONTENT_TAGS[t].desc">⚠ {{ CONTENT_TAGS[t].name }}</span>
</template>

<style scoped>
.content-tag { color: var(--danger); border-color: var(--danger); }
</style>
