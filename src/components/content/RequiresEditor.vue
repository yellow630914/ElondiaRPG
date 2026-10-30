<script setup lang="ts">
import { computed } from 'vue'
import { npcs as namedNpcs, storyCounters, type StoryCond } from '@/engine/data'
import { parasiteRules } from '@/engine/parasites'
import AffinityCondEditor from './AffinityCondEditor.vue'
import CondExtrasEditor from './CondExtrasEditor.vue'
import FlagInput from './FlagInput.vue'

// 劇情條件（docs/STORY_QUESTS.md 第 1.1 節）：任務的接取、任務點的解鎖、選項、固定 NPC 的出現與階段、事件、地標……都用這一個。
// 「要有」「不能有」的旗標一直顯示；其他（至少一個成立、好感、計數器、寄生物、身分、成人向）收在「更多條件」，有寫的時候自動展開。
// 每次修改都換掉整個物件（父層傳進來的可能是暫時的空物件），空的欄位拿掉。
const cond = defineModel<StoryCond>({ required: true })
const props = withDefaults(defineProps<{
  /** 這組條件是什麼（例如「解鎖條件」） */
  label: string
  /** 「不能有」 */
  none?: boolean
  /** 「至少一個成立」（extras 已經包含） */
  any?: boolean
  /** 好感 */
  affinity?: boolean
  /** 計數器、寄生物、主角的身分標籤、成人向的條件（含「至少一個成立」） */
  extras?: boolean
  placeholder?: string
}>(), { none: true, any: false, affinity: false, extras: true, placeholder: '全部成立' })

function put(next: Partial<StoryCond>) {
  const out: StoryCond = { ...cond.value, ...next }
  for (const k of ['flags', 'flags_none', 'flags_any'] as const) if (!out[k]?.length) delete out[k]
  cond.value = out
}
const flags = computed({ get: () => cond.value.flags, set: (v: string[] | undefined) => put({ flags: v }) })
const flagsNone = computed({ get: () => cond.value.flags_none, set: (v: string[] | undefined) => put({ flags_none: v }) })
const flagsAny = computed({ get: () => cond.value.flags_any, set: (v: string[] | undefined) => put({ flags_any: v }) })

const hasMore = computed(() => props.extras || props.any || props.affinity)
/** 「更多條件」裡寫了什麼（收起來時顯示在標題上） */
const moreSummary = computed(() => {
  const c = cond.value
  const out: string[] = []
  if (c.flags_any?.length) out.push(`任一 ${c.flags_any.map((f) => `🚩${f}`).join('、')}`)
  if (props.affinity) for (const [id, v] of Object.entries(c.affinity ?? {})) out.push(`${namedNpcs.find((n) => n.id === id)?.name ?? id}的好感 ≥ ${v}`)
  if (props.extras) {
    for (const [id, r] of Object.entries(c.counters ?? {})) out.push(`${storyCounters[id]?.name ?? id}${r.min !== undefined ? ` ≥ ${r.min}` : ''}${r.max !== undefined ? ` ≤ ${r.max}` : ''}`)
    for (const id of Object.keys(c.parasites ?? {})) out.push(`身上有${parasiteRules.parasites[id]?.name ?? id}`)
    if (c.pc_tags?.length) out.push('主角的身分')
    if (c.stats || c.charm || c.wearing) out.push('成人向的條件')
  }
  return out.join('；')
})
</script>

<template>
  <div class="requires small">
    <div class="row"><span class="k">{{ label }}：要有</span><FlagInput v-model="flags" :placeholder="placeholder" /></div>
    <div v-if="none" class="row"><span class="k">不能有</span><FlagInput v-model="flagsNone" placeholder="任一成立就不行" /></div>
    <details v-if="hasMore" class="more" :open="!!moreSummary">
      <summary>更多條件{{ moreSummary ? `：${moreSummary}` : `（${[extras || any ? '至少一個成立' : '', affinity ? '好感' : '', extras ? '計數器、寄生物、身分、成人向' : ''].filter(Boolean).join('、')}）` }}</summary>
      <div class="more-body">
        <div v-if="any && !extras" class="row"><span class="k">至少一個成立</span><FlagInput v-model="flagsAny" placeholder="任一成立即可" /></div>
        <AffinityCondEditor v-if="affinity" :model-value="cond" label="好感至少" @update:model-value="cond = $event" />
        <CondExtrasEditor v-if="extras" :model-value="cond" @update:model-value="cond = $event" />
      </div>
    </details>
  </div>
</template>

<style scoped>
.requires { display: grid; gap: 4px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.k { color: var(--muted, inherit); min-width: 5em; }
.more summary { cursor: pointer; color: var(--accent); }
.more-body { display: grid; gap: 4px; margin-top: 4px; padding-left: 10px; border-left: 2px solid var(--border); }
</style>
