<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from '@/stores/game'
import NameTag from '../NameTag.vue'

// AI 提議更新人際關係描述：採用、修改後採用，或不採用
const props = defineProps<{ id: string }>()
const game = useGame()
const current = computed(() => game.state?.suggestions?.find((x) => x.id === props.id))
const rel = computed(() => (current.value ? game.state?.relationships?.[current.value.npc] : undefined))
const editing = ref(false)
const draft = ref('')

watch(current, (c) => {
  editing.value = false
  draft.value = c?.text ?? ''
}, { immediate: true })

function accept() {
  if (current.value) game.acceptSuggestion(current.value.id, editing.value ? draft.value : current.value.text)
}
function reject() {
  if (current.value) game.rejectSuggestion(current.value.id)
}
</script>

<template>
  <section v-if="current && rel" class="panel suggestion">
    <h3>💞 <NameTag :id="current.npc" /> 和你的關係有了變化</h3>
    <p class="small muted">目前：{{ rel.toPlayer }}</p>
    <p v-if="!editing" class="small proposal">AI 提議：{{ current.text }}</p>
    <textarea v-else v-model="draft" rows="3" />
    <div class="row">
      <button class="small primary" @click="accept">✔️ 採用</button>
      <button class="small" @click="editing = !editing">✏️ {{ editing ? '取消修改' : '修改' }}</button>
      <button class="small" @click="reject">✖️ 不採用</button>
    </div>
  </section>
</template>

<style scoped>
.suggestion { display: grid; gap: 6px; }
.suggestion h3, .suggestion p { margin: 0; }
.proposal { color: var(--accent); }
textarea { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
