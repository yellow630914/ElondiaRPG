<script setup lang="ts">
// 冒險記憶的清單（人際關係視窗的「冒險記憶」與人物詳情的「共同記憶」共用）：
// 一次 30 筆、依天分段（新的在前）、內容最多兩行，點一下展開；展開才有「編輯」，編輯時可以刪除。
import { computed, ref, watch } from 'vue'
import { locationName } from '@/engine/data'
import { nameOf as npcName, type Memory } from '@/engine/social'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'

/** items：已經篩好、新的在前；resetKey 變了（換篩選、換人）就回到第一頁 */
const props = defineProps<{ items: Memory[]; resetKey?: string }>()
const game = useGame()
const s = computed(() => game.state!)
const nameOf = (id: string) => npcName(s.value, id)

const PAGE = 30
const limit = ref(PAGE)
const openMemory = ref<string | null>(null)
const editingMemory = ref<string | null>(null)
const memoryDraft = ref('')
watch(() => props.resetKey, () => {
  limit.value = PAGE
  openMemory.value = null
  editingMemory.value = null
})

/** 這一頁的記憶依天分段 */
const days = computed(() => {
  const out: { day: number; items: Memory[] }[] = []
  for (const m of props.items.slice(0, limit.value)) {
    const last = out.at(-1)
    if (last && last.day === m.time.day) last.items.push(m)
    else out.push({ day: m.time.day, items: [m] })
  }
  return out
})
const hhmm = (t: Memory['time']) => `${String(t.hour ?? 0).padStart(2, '0')}:${String(t.minute ?? 0).padStart(2, '0')}`
const STARS = { 1: '★', 2: '★★', 3: '★★★' } as const

function editSummary(m: Memory) {
  editingMemory.value = m.id
  memoryDraft.value = m.summary
}
function saveSummary(id: string) {
  game.editMemory(id, { summary: memoryDraft.value.trim() })
  editingMemory.value = null
}
function removeMemory(id: string) {
  if (confirm('刪除這段記憶？')) game.deleteMemory(id)
}
</script>

<template>
  <div class="memory-list">
    <template v-for="g in days" :key="g.day">
      <div class="day small">第 {{ g.day }} 天</div>
      <ul class="plain">
        <li v-for="m in g.items" :key="m.id" class="memory" :class="{ merged: m.merged }">
          <div class="row small meta">
            <span>{{ m.merged ? `合併 ${m.merged} 筆` : hhmm(m.time) }}</span>
            <b>{{ m.scene ?? locationName(m.location) }}</b>
            <span class="who muted" :title="m.participants.map(nameOf).join('、')">{{ m.participants.map(nameOf).join('、') }}</span>
            <span class="spacer" />
            <button
              class="small icon star"
              :title="'重要程度：' + ['', '日常', '重要', '難忘'][m.importance] + '（點一下換）'"
              @click="game.editMemory(m.id, { importance: ((m.importance % 3) + 1) as Memory['importance'] })"
            >{{ STARS[m.importance] }}</button>
            <button class="small icon" :class="{ pinned: m.pinned }" :title="m.pinned ? '已釘選（點一下取消）' : '釘選：交給 AI 時一定找得到'" :aria-label="m.pinned ? '取消釘選' : '釘選'" @click="game.editMemory(m.id, { pinned: !m.pinned })">
              <GameIcon name="bookmark" :size="12" />
            </button>
          </div>
          <div v-if="editingMemory !== m.id" class="summary" :class="{ open: openMemory === m.id }" :title="openMemory === m.id ? '' : '點一下看完整內容'" @click="openMemory = openMemory === m.id ? null : m.id">{{ m.summary }}</div>
          <div v-if="openMemory === m.id && editingMemory !== m.id" class="row">
            <button class="small" @click="editSummary(m)"><GameIcon name="edit" :size="12" /> 編輯</button>
          </div>
          <div v-else-if="editingMemory === m.id" class="row">
            <textarea v-model="memoryDraft" rows="3" style="flex: 1" />
            <div class="col-btns">
              <button class="small primary" @click="saveSummary(m.id)">儲存</button>
              <button class="small" @click="editingMemory = null">取消</button>
              <button class="small danger" @click="removeMemory(m.id)">刪除</button>
            </div>
          </div>
        </li>
      </ul>
    </template>
    <div v-if="items.length > limit" class="more-mem">
      <button class="small" @click="limit += PAGE">顯示更早的 {{ Math.min(PAGE, items.length - limit) }} 筆（還有 {{ items.length - limit }} 筆）</button>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.day { color: var(--accent-2, var(--accent)); font-weight: bold; margin: 8px 0 0; }
.memory { display: grid; gap: 3px; padding: 5px 0; border-bottom: 1px solid var(--border); }
.memory.merged .summary { color: var(--muted); }
.meta { gap: 8px; flex-wrap: nowrap; min-width: 0; }
.meta > span:first-child { white-space: nowrap; }
.meta b { font-weight: normal; white-space: nowrap; }
.meta .who { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon { padding: 0 6px; min-height: 0; height: 24px; flex: none; }
/* 內容最多兩行，點一下展開 */
.summary { cursor: pointer; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.summary.open { display: block; overflow: visible; }
.summary:hover { color: var(--accent); }
.col-btns { display: grid; gap: 4px; }
.more-mem { text-align: center; margin-top: 10px; }
.spacer { flex: 1; }
.star { color: var(--accent); }
.pinned { border-color: var(--accent); color: var(--accent); }
</style>
