<script setup lang="ts">
import { computed } from 'vue'
import { tagDef, tagsExclusive } from '@/engine/data'
import { PC_TAG_MAX, pcTagChoices } from '@/engine/pcTags'

// 主角的身分標籤（和 NPC 共用 npc_tags.json）：最多 3 個，互斥的不能同時選
const tags = defineModel<string[]>({ required: true })
const choices = computed(() => pcTagChoices().map(([id]) => ({ id, def: tagDef(id)! })))

function blocked(id: string): string {
  if (tags.value.includes(id)) return ''
  if (tags.value.length >= PC_TAG_MAX) return `最多 ${PC_TAG_MAX} 個`
  const clash = tags.value.find((t) => tagsExclusive(t, id))
  return clash ? `和「${tagDef(clash)?.name ?? clash}」互斥` : ''
}
function toggle(id: string) {
  if (tags.value.includes(id)) tags.value = tags.value.filter((t) => t !== id)
  else if (!blocked(id)) tags.value = [...tags.value, id]
}
const EFFECT: Record<string, string> = { palace: '不必聲望也能進出王城' }
function effects(id: string): string {
  const e = tagDef(id)?.pc_effects ?? {}
  return Object.entries(e).filter(([, on]) => on).map(([k]) => EFFECT[k] ?? k).join('、')
}
</script>

<template>
  <div class="pc-tags">
    <button
      v-for="c in choices" :key="c.id" type="button" class="tag-btn" :class="{ on: tags.includes(c.id) }" :disabled="!!blocked(c.id)"
      :title="[c.def.ai_hint, effects(c.id) && `效果：${effects(c.id)}`, blocked(c.id)].filter(Boolean).join('\n')" @click="toggle(c.id)"
    >
      {{ c.def.emoji }} {{ c.def.name }}<span v-if="effects(c.id)" class="fx">★</span>
    </button>
    <span class="small muted">{{ tags.length }}／{{ PC_TAG_MAX }}</span>
  </div>
</template>

<style scoped>
.pc-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-btn { padding: 2px 10px; }
.tag-btn.on { border-color: var(--accent); color: var(--accent); background: var(--chip-bg); }
.fx { margin-left: 3px; color: var(--accent); font-size: 11px; }
</style>
