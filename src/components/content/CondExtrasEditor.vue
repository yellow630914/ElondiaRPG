<script setup lang="ts">
import { computed } from 'vue'
import { BIND_KINDS, lewdRules, storyCounters, type BindKind, type CounterRange, type ParasiteRange, type StoryCond, type WearingCond } from '@/engine/data'
import { charmRules } from '@/engine/charm'
import { LEWD_KEYS, lewdName } from '@/engine/lewd'
import { pcTagChoices } from '@/engine/pcTags'
import { parasiteRules } from '@/engine/parasites'
import { useContent } from '@/stores/content'
import FlagInput from './FlagInput.vue'

// 條件的進階部分：至少一個旗標成立（或）、劇情計數器的範圍、主角身上的寄生物（見 docs/STORY_QUESTS.md 第 1.1 節）；
// 成人向：主角的慾望指標、所在地的魅氣濃度、主角身上戴著什麼（docs/LEWD_STATS.md 第 27 節）
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
  if (!out.stats || !Object.keys(out.stats).length) delete out.stats
  if (!out.charm || (out.charm.min === undefined && out.charm.max === undefined)) delete out.charm
  if (!out.wearing || !Object.keys(out.wearing).length) delete out.wearing
  if (!out.pc_tags?.length) delete out.pc_tags
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
// 慾望指標（有效值；曝露名聲看目前的地區）：0～100
function setStat(k: (typeof LEWD_KEYS)[number], side: 'min' | 'max', v: string) {
  const stats = { ...(cond.value.stats ?? {}) }
  const r: CounterRange = { ...(stats[k] ?? {}), [side]: num(v) }
  if (r[side] === undefined) delete r[side]
  if (r.min === undefined && r.max === undefined) delete stats[k]
  else stats[k] = r
  put({ stats })
}
// 魅氣濃度 1～4
const charmNames = charmRules().names
function setCharm(side: 'min' | 'max', v: string) {
  const c: CounterRange = { ...(cond.value.charm ?? {}) }
  if (v) c[side] = Number(v)
  else delete c[side]
  put({ charm: c })
}
// 戴著什麼：每一項「不限／要有／要沒有」
const WEAR_FLAGS: [keyof Omit<WearingCond, 'bind_kind'>, string][] = [['bind', '任何拘束具'], ['locked', '別人鎖上的拘束具（主人或陷阱）'], ['adult_outfit', '成人向服裝'], ['mark', '奴隸印記']]
function wearOf(k: keyof Omit<WearingCond, 'bind_kind'>): string {
  const v = cond.value.wearing?.[k]
  return v === undefined ? '' : v ? 'yes' : 'no'
}
function setWear(k: keyof Omit<WearingCond, 'bind_kind'>, v: string) {
  const w: WearingCond = { ...(cond.value.wearing ?? {}) }
  if (v) w[k] = v === 'yes'
  else delete w[k]
  put({ wearing: w })
}
function setBindKind(v: string) {
  const w: WearingCond = { ...(cond.value.wearing ?? {}) }
  if (v) w.bind_kind = v as BindKind
  else delete w.bind_kind
  put({ wearing: w })
}
// 主角的身分標籤：勾的裡面至少有一個
const pcTagList = pcTagChoices()
function togglePcTag(id: string, on: boolean) {
  const next = new Set(cond.value.pc_tags ?? [])
  if (on) next.add(id)
  else next.delete(id)
  put({ pc_tags: [...next] })
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
  <div class="row small">
    主角的身分標籤（至少一個）
    <label v-for="[id, t] in pcTagList" :key="id" class="check"><input type="checkbox" :checked="cond.pc_tags?.includes(id)" @change="togglePcTag(id, ($event.target as HTMLInputElement).checked)" /> {{ t.name }}</label>
  </div>
  <details class="small" :open="!!(cond.stats || cond.charm || cond.wearing)">
    <summary>成人向的條件（慾望指標、魅氣濃度、戴著什麼）</summary>
    <div class="row small">
      主角的慾望指標
      <span v-for="k in LEWD_KEYS" :key="k" class="row">
        {{ lewdName(k) }} ≥ <input :value="cond.stats?.[k]?.min ?? ''" type="number" min="0" max="100" class="num" placeholder="不限" @change="setStat(k, 'min', ($event.target as HTMLInputElement).value)" />
        且 ≤ <input :value="cond.stats?.[k]?.max ?? ''" type="number" min="0" max="100" class="num" placeholder="不限" @change="setStat(k, 'max', ($event.target as HTMLInputElement).value)" />
      </span>
    </div>
    <div class="row small">
      所在地的魅氣濃度
      <select :value="cond.charm?.min ?? ''" @change="setCharm('min', ($event.target as HTMLSelectElement).value)">
        <option value="">最低不限</option><option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">至少 {{ n }}（{{ charmNames[n] }}）</option>
      </select>
      <select :value="cond.charm?.max ?? ''" @change="setCharm('max', ($event.target as HTMLSelectElement).value)">
        <option value="">最高不限</option><option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">最多 {{ n }}（{{ charmNames[n] }}）</option>
      </select>
    </div>
    <div class="row small">
      主角身上
      <label v-for="[k, n] in WEAR_FLAGS" :key="k" class="row">{{ n }}
        <select :value="wearOf(k)" @change="setWear(k, ($event.target as HTMLSelectElement).value)">
          <option value="">不限</option><option value="yes">要有</option><option value="no">要沒有</option>
        </select>
      </label>
      <label class="row">戴著這種拘束具
        <select :value="cond.wearing?.bind_kind ?? ''" @change="setBindKind(($event.target as HTMLSelectElement).value)">
          <option value="">不限</option><option v-for="k in BIND_KINDS" :key="k" :value="k">{{ lewdRules.two_face.kinds[k].name }}</option>
        </select>
      </label>
    </div>
  </details>
</template>

<style scoped src="./editor.css"></style>
