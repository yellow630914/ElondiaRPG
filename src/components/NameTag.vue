<script setup lang="ts">
import { computed } from 'vue'
import { className, classEmoji, genderDef, raceEmoji, raceName } from '@/engine/data'
import { npcRecord } from '@/engine/npcs'
import { useGame } from '@/stores/game'

// 角色名牌：{種族 emoji}{依性別上色的名字}{職業 emoji}。給 id 時從隊伍或 NPC 登錄查資料。
const props = defineProps<{ id?: string; name?: string; race?: string; cls?: string; gender?: string }>()
const game = useGame()

const info = computed(() => {
  const s = game.state
  const member = props.id && s ? s.party.find((m) => m.id === props.id) : undefined
  const rec = !member && props.id && s ? npcRecord(s, props.id) : undefined
  const src = member ?? rec
  return {
    name: props.name ?? src?.name ?? (props.id && s?.relationships?.[props.id]?.name) ?? props.id ?? '',
    race: props.race ?? src?.race,
    cls: props.cls ?? src?.class,
    gender: props.gender ?? src?.gender,
  }
})
const gender = computed(() => genderDef(info.value.gender))
const title = computed(() =>
  [gender.value?.name ?? info.value.gender, info.value.race && raceName(info.value.race), info.value.cls && className(info.value.cls)]
    .filter(Boolean).join('・'),
)
</script>

<template>
  <span class="name-tag" :title="title">
    <span v-if="info.race" class="emoji">{{ raceEmoji(info.race) }}</span>
    <span class="name" :style="gender ? { color: gender.color } : {}">{{ info.name }}</span>
    <span v-if="info.cls" class="emoji">{{ classEmoji(info.cls) }}</span>
  </span>
</template>

<style scoped>
.name-tag { display: inline-flex; align-items: baseline; gap: 2px; font-weight: 600; }
.emoji { font-weight: normal; }
</style>
