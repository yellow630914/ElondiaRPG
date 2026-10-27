<script setup lang="ts">
import { computed } from 'vue'
import { storyCounters, type CounterRange, type ParasiteRange, type StoryCond } from '@/engine/data'
import { parasiteRules } from '@/engine/parasites'
import { useContent } from '@/stores/content'
import FlagInput from './FlagInput.vue'

// 條件的進階部分：至少一個旗標成立（或）、劇情計數器的範圍、主角身上的寄生物（見 docs/STORY_QUESTS.md 第 1.1 節）
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
  if (!out.parasites || !Object.keys(out.parasites).length) delete out.parasites
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

// 寄生物：主角身上有（沒沉睡），侵蝕度在範圍內；馴服：不限、要已馴服、要還沒馴服
const parasiteIds = Object.keys(parasiteRules.parasites)
const prows = computed(() => Object.entries(cond.value.parasites ?? {}))
function setP(oldId: string, id: string, r: ParasiteRange) {
  const next: Record<string, ParasiteRange> = {}
  for (const [k, v] of prows.value) next[k === oldId ? id : k] = k === oldId ? r : v
  put({ parasites: next })
}
function addP() {
  const id = parasiteIds.find((k) => !(k in (cond.value.parasites ?? {})))
  if (id) put({ parasites: { ...(cond.value.parasites ?? {}), [id]: {} } })
}
function removeP(id: string) {
  const { [id]: _drop, ...rest } = cond.value.parasites ?? {}
  put({ parasites: rest })
}
function tamedOf(r: ParasiteRange): string {
  return r.tamed === undefined ? '' : r.tamed ? 'yes' : 'no'
}
function setTamed(id: string, r: ParasiteRange, v: string) {
  const { tamed: _t, ...rest } = r
  setP(id, id, v ? { ...rest, tamed: v === 'yes' } : rest)
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
  <div class="row small">
    主角的寄生物
    <span v-for="[id, r] in prows" :key="id" class="row">
      <select :value="id" @change="setP(id, ($event.target as HTMLSelectElement).value, r)">
        <option v-for="k in parasiteIds" :key="k" :value="k" :disabled="k !== id && k in (cond.parasites ?? {})">{{ parasiteRules.parasites[k]!.name }}</option>
        <option v-if="!parasiteIds.includes(id)" :value="id">{{ id }}（不存在）</option>
      </select>
      侵蝕度 ≥ <input :value="r.min ?? ''" type="number" min="0" max="100" class="num" placeholder="不限" @change="setP(id, id, { ...r, min: num(($event.target as HTMLInputElement).value) })" />
      且 ≤ <input :value="r.max ?? ''" type="number" min="0" max="100" class="num" placeholder="不限" @change="setP(id, id, { ...r, max: num(($event.target as HTMLInputElement).value) })" />
      <select :value="tamedOf(r)" @change="setTamed(id, r, ($event.target as HTMLSelectElement).value)">
        <option value="">馴服不限</option><option value="yes">已馴服</option><option value="no">還沒馴服</option>
      </select>
      <button class="small" @click="removeP(id)">移除</button>
    </span>
    <button class="small" @click="addP">＋ 寄生物條件</button>
  </div>
</template>

<style scoped src="./editor.css"></style>
