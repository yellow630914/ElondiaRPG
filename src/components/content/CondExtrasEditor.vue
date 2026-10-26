<script setup lang="ts">
import { computed } from 'vue'
import { storyCounters, type CounterRange, type StoryCond } from '@/engine/data'
import { useContent } from '@/stores/content'
import FlagInput from './FlagInput.vue'

// 條件的進階部分：至少一個旗標成立（或）、劇情計數器的範圍（見 docs/STORY_QUESTS.md 第 1.1 節）
const cond = defineModel<StoryCond>({ required: true })
const content = useContent()
const counterIds = computed(() => {
  void content.version
  return Object.keys(storyCounters)
})
const rows = computed(() => Object.entries(cond.value.counters ?? {}))

// 換掉整個物件（父層傳進來的可能是暫時的空物件）
function put(next: Partial<StoryCond>) {
  const out = { ...cond.value, ...next }
  if (!out.flags_any?.length) delete out.flags_any
  if (!out.counters || !Object.keys(out.counters).length) delete out.counters
  cond.value = out
}
const any = computed({
  get: () => cond.value.flags_any,
  set: (v: string[] | undefined) => put({ flags_any: v }),
})
const num = (s: string): number | undefined => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Math.round(Number(s)))
function setRow(oldId: string, id: string, r: CounterRange) {
  const next: Record<string, CounterRange> = {}
  for (const [k, v] of rows.value) next[k === oldId ? id : k] = k === oldId ? r : v
  put({ counters: next })
}
function add() {
  const id = counterIds.value.find((k) => !(k in (cond.value.counters ?? {})))
  if (id) put({ counters: { ...(cond.value.counters ?? {}), [id]: { min: 1 } } })
}
function remove(id: string) {
  const { [id]: _drop, ...rest } = cond.value.counters ?? {}
  put({ counters: rest })
}
</script>

<template>
  <div class="row small">至少一個成立 <FlagInput v-model="any" placeholder="任一成立即可" /></div>
  <div class="row small">
    劇情計數器
    <span v-for="[id, r] in rows" :key="id" class="row">
      <select :value="id" @change="setRow(id, ($event.target as HTMLSelectElement).value, r)">
        <option v-for="k in counterIds" :key="k" :value="k" :disabled="k !== id && k in (cond.counters ?? {})">{{ storyCounters[k]?.name ?? k }}</option>
        <option v-if="!counterIds.includes(id)" :value="id">{{ id }}（不存在）</option>
      </select>
      ≥ <input :value="r.min ?? ''" type="number" class="num" placeholder="不限" @change="setRow(id, id, { ...r, min: num(($event.target as HTMLInputElement).value) })" />
      且 ≤ <input :value="r.max ?? ''" type="number" class="num" placeholder="不限" @change="setRow(id, id, { ...r, max: num(($event.target as HTMLInputElement).value) })" />
      <button class="small" @click="remove(id)">移除</button>
    </span>
    <button v-if="counterIds.length" class="small" @click="add">＋ 計數器條件</button>
  </div>
</template>

<style scoped src="./editor.css"></style>
