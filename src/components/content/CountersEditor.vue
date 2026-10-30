<script setup lang="ts">
import { computed, ref } from 'vue'
import { storyCounters } from '@/engine/data'
import { builtinCounter, counterUsage, newCounter, type CounterMod } from '@/engine/counterMods'
import { cleanCounterId } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { counterValue } from '@/engine/storyFlags'
import Hint from '../ui/Hint.vue'
import HelpText from './HelpText.vue'

// 劇情計數器：任務與事件的結果加減、條件要求範圍（說明見 docs/STORY_QUESTS.md 第 1.1 節）
const content = useContent()
const game = useGame()
const msg = ref('')
const newId = ref('')

interface Row { id: string; draft: CounterMod; builtin: boolean; edited: boolean }
const rows = ref<Row[]>([])
function load() {
  void content.version
  rows.value = Object.entries(storyCounters).map(([id, c]) => ({
    id,
    draft: { ...c },
    builtin: !!builtinCounter(id),
    edited: !!content.mods.counters?.[id] && !content.mods.counters[id]!.custom,
  }))
}
load()
const usage = computed(() => {
  void content.version
  return Object.fromEntries(rows.value.map((r) => [r.id, counterUsage(r.id)]))
})

function run(fn: () => void, ok: string) {
  try {
    fn()
    msg.value = ok
    load()
  } catch (e) {
    msg.value = (e as Error).message
  }
}
function save(r: Row) {
  run(() => content.saveCounter(r.id, r.draft), `已儲存「${r.draft.name}」`)
}
function restore(r: Row) {
  run(() => content.restoreCounter(r.id), `已恢復「${r.draft.name}」的預設`)
}
function remove(r: Row) {
  run(() => content.deleteCounter(r.id), `已刪除「${r.draft.name}」`)
}
function create() {
  const id = cleanCounterId(newId.value)
  if (!id) {
    msg.value = '計數器的 id 只能用小寫英文、數字與底線'
    return
  }
  if (storyCounters[id]) {
    msg.value = '已經有這個 id 的計數器了'
    return
  }
  run(() => content.saveCounter(id, newCounter()), `已新增計數器 ${id}`)
  newId.value = ''
}
const num = (s: string): number | undefined => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Math.round(Number(s)))
</script>

<template>
  <div class="editor">
    <h3>🔢 劇情計數器</h3>
    <HelpText text="特殊任務、旅途與城鎮事件的結果可以加減計數器，任務的接取條件、任務點、選項、固定 NPC 的出現與事件的條件可以要求計數器在某個範圍內。
      例如人類方的政治故事線各自讓「人類世界的走向」主和 +1、主戰 -1，最後的史詩線看它是正是負決定走和平或開戰。" />
    <div v-for="r in rows" :key="r.id" class="stage">
      <div class="row">
        <b>{{ r.draft.name }}</b> <code class="small muted">{{ r.id }}</code>
        <span v-if="!r.builtin" class="tag small">自建</span>
        <span v-else-if="r.edited" class="tag small">已修改</span>
        <span v-if="game.state" class="small muted">目前的存檔：{{ counterValue(game.state, r.id) }}</span>
        <span class="spacer" />
        <button class="small" @click="save(r)">儲存</button>
        <button v-if="r.edited" class="small" @click="restore(r)">恢復預設</button>
        <button v-if="!r.builtin" class="small" :disabled="!!usage[r.id]?.length" :title="usage[r.id]?.length ? `還有地方用到：${usage[r.id]!.join('、')}` : ''" @click="remove(r)">刪除</button>
      </div>
      <div class="row small">
        <label>名稱 <input v-model="r.draft.name" maxlength="20" /></label>
        <label>初始值 <input :value="r.draft.initial ?? 0" type="number" class="num" @change="r.draft.initial = num(($event.target as HTMLInputElement).value)" /></label>
        <label>下限 <input :value="r.draft.min ?? ''" type="number" class="num" placeholder="不限" @change="r.draft.min = num(($event.target as HTMLInputElement).value)" /></label>
        <label>上限 <input :value="r.draft.max ?? ''" type="number" class="num" placeholder="不限" @change="r.draft.max = num(($event.target as HTMLInputElement).value)" /></label>
      </div>
      <label class="block small">說明 <Hint text="給作者自己看的：這個計數器代表什麼、誰會加減。" /><textarea v-model="r.draft.desc" rows="2" maxlength="160" /></label>
      <p v-if="usage[r.id]?.length" class="small muted">用到的地方：{{ usage[r.id]!.join('、') }}</p>
    </div>
    <div class="row small">
      新增計數器：id <input v-model="newId" placeholder="例如 dawn_succession" maxlength="40" />
      <button class="small" @click="create">＋ 新增</button>
    </div>
    <p v-if="msg" class="small">{{ msg }}</p>
  </div>
</template>

<style scoped src="./editor.css"></style>
