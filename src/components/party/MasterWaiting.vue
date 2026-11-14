<script setup lang="ts">
import { computed, reactive } from 'vue'
import { rosterBlocked, rosterDc, rosterMaster, rosterWaiting } from '@/engine/masterRoster'
import { useGame } from '@/stores/game'
import Avatar from '../ui/Avatar.vue'
import NameTag from '../NameTag.vue'

// 主人留在這座城（酒館或主人家裡）的隊員：向主人提議帶上（engine/masterRoster.ts）
const props = defineProps<{ place: 'tavern' | 'home' }>()
const game = useGame()
const s = computed(() => game.state!)
const master = computed(() => rosterMaster(s.value))
const list = computed(() => {
  void s.value.time.minute
  return rosterWaiting(s.value).filter((w) => w.place === props.place)
})
const text = reactive<Record<string, string>>({})
async function take(id: string) {
  await game.perform({ kind: 'propose', target: `take:${id}`, text: text[id] ?? '' })
  text[id] = ''
}
</script>

<template>
  <ul v-if="master" class="plain waiting">
    <li v-for="w in list" :key="w.rec.id" class="row">
      <Avatar :id="w.rec.id" :size="30" />
      <span class="grow"><NameTag :id="w.rec.id" /> <span v-if="rosterBlocked(s, 'take', w.rec.id)" class="muted small">{{ rosterBlocked(s, 'take', w.rec.id) }}</span></span>
      <input v-model="text[w.rec.id]" class="say" placeholder="怎麼說服主人（選填）" :aria-label="`怎麼說服${master.name}帶上${w.character.name}`" />
      <button class="small primary" :disabled="game.judging || !!rosterBlocked(s, 'take', w.rec.id)" @click="take(w.rec.id)">請主人帶上（DC {{ rosterDc(s, 'take') }}）</button>
    </li>
    <li v-if="!list.length" class="muted small">主人沒有把人留在這裡。</li>
  </ul>
</template>

<style scoped>
.waiting { display: grid; gap: 6px; margin: 0; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grow { flex: 1 1 8em; }
.say { flex: 1 1 10em; min-width: 8em; font-size: var(--fs-xs); }
</style>
