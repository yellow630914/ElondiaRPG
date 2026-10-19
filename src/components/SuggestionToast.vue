<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from '@/stores/game'
import NameTag from './NameTag.vue'

// AI 提議更新人際關係描述時，在右下角彈出提醒，可以直接採用、修改或不採用。
const emit = defineEmits<{ 'open-relations': [] }>()
const game = useGame()
const later = ref(new Set<string>())
const pending = computed(() => (game.state?.suggestions ?? []).filter((x) => !later.value.has(x.id)))
const current = computed(() => pending.value[0])
const rel = computed(() => (current.value ? game.state?.relationships?.[current.value.npc] : undefined))
const editing = ref(false)
const draft = ref('')

watch(current, (c) => {
  editing.value = false
  draft.value = c?.text ?? ''
}, { immediate: true })

function accept() {
  if (!current.value) return
  game.acceptSuggestion(current.value.id, editing.value ? draft.value : current.value.text)
}
function reject() {
  if (current.value) game.rejectSuggestion(current.value.id)
}
function snooze() {
  if (current.value) later.value = new Set([...later.value, current.value.id])
}
</script>

<template>
  <Transition name="toast">
    <aside v-if="current && rel" class="toast" role="alertdialog" aria-live="polite">
      <header class="row">
        <strong>💞 <NameTag :id="current.npc" /> 和你的關係有了變化</strong>
        <span v-if="pending.length > 1" class="tag">還有 {{ pending.length - 1 }} 則</span>
      </header>
      <p class="small muted">目前：{{ rel.toPlayer }}</p>
      <p v-if="!editing" class="small proposal">AI 提議：{{ current.text }}</p>
      <textarea v-else v-model="draft" rows="3" />
      <div class="row">
        <button class="small primary" @click="accept">✔️ 採用</button>
        <button class="small" @click="editing = !editing">✏️ {{ editing ? '取消修改' : '修改' }}</button>
        <button class="small" @click="reject">✖️ 不採用</button>
        <button class="small" @click="snooze">稍後</button>
        <button class="small link" @click="emit('open-relations')">開啟關係</button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed; right: 16px; bottom: 16px; z-index: 50;
  width: min(380px, calc(100vw - 32px));
  background: var(--panel); border: 1px solid var(--accent); border-radius: var(--radius);
  padding: 12px 14px; box-shadow: 0 8px 30px #000b; display: grid; gap: 6px;
}
.toast header { justify-content: space-between; }
.proposal { color: var(--accent); margin: 0; }
.toast p { margin: 0; }
textarea { width: 100%; }
.link { margin-left: auto; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
</style>
