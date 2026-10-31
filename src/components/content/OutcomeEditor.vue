<script setup lang="ts">
import { computed, ref } from 'vue'
import { geography, npcs as namedNpcs, specialMaps, storyCounters, type StoryOutcome } from '@/engine/data'
import { travelEvents } from '@/engine/road'
import { SIDE_MAPS, STORY_EFFECTS, STORY_SCENE_CHARS } from '@/engine/storyMods'
import { MAX_JUMP_HOURS, TARGET_NAME, timeJumpText, type TimeTarget } from '@/engine/timeOfDay'
import type { RewardEffect } from '@/engine/effects'
import EffectsEditor from './EffectsEditor.vue'
import FlagInput from './FlagInput.vue'
import CounterDeltasEditor from './CounterDeltasEditor.vue'
import Hint from '../ui/Hint.vue'

// 任務點的一個結果：文字、劇情旗標、效果、任務同行的夥伴、完成或失敗。
// 旅途與城鎮事件（event）只用文字、旗標、移動與效果
const model = defineModel<StoryOutcome | undefined>()
const props = defineProps<{ label: string; optional?: boolean; event?: boolean }>()
const o = computed(() => model.value)
// 事件不能讓主角淪為奴隸（只有特殊任務可以）
const EVENT_EFFECTS = (Object.keys(STORY_EFFECTS) as RewardEffect['type'][]).filter((t) => t !== 'enslave_player')

function addDeath(id: string) {
  if (!id || !o.value) return
  o.value.deaths = [...new Set([...(o.value.deaths ?? []), id])]
}
function enable(on: boolean) {
  model.value = on ? {} : undefined
}
// 一行摘要：寫了內容的結果預設收起來，只看這一行（點標題展開）
const open = ref(!model.value?.text)
const summary = computed(() => {
  const x = o.value
  if (!x) return ''
  const name = (id: string) => namedNpcs.find((n) => n.id === id)?.name ?? id
  const parts: string[] = []
  if (x.text) parts.push(`「${x.text.length > 18 ? `${x.text.slice(0, 18)}…` : x.text}」`)
  if (x.scene) parts.push('💗 親密場景')
  if (x.set_flags?.length) parts.push(`→ ${x.set_flags.map((f) => `🚩${f}`).join('、')}`)
  if (x.clear_flags?.length) parts.push(`清除 ${x.clear_flags.map((f) => `🚩${f}`).join('、')}`)
  for (const [k, v] of Object.entries(x.counters ?? {})) parts.push(`${storyCounters[k]?.name ?? k} ${v > 0 ? '+' : ''}${v}`)
  for (const d of x.deaths ?? []) parts.push(`💀 ${name(d)}`)
  if (x.join) parts.push(`${name(x.join)} 同行`)
  if (x.leave) parts.push(`${name(x.leave)} 離開`)
  if (x.side_map) parts.push(`進入${travelEvents.side_maps[x.side_map]?.name ?? x.side_map}`)
  if (x.special_map) parts.push(`傳送到${specialMaps[x.special_map]?.name ?? x.special_map}`)
  if (x.time) parts.push(`🕑 ${timeJumpText(x.time)}`)
  if (x.travel_to) parts.push(`改去${geography.locations.find((l) => l.id === x.travel_to)?.name ?? x.travel_to}`)
  for (const e of x.effects ?? []) parts.push(e.type === 'money' ? `${e.amount > 0 ? '+' : ''}${e.amount} 白鸛` : STORY_EFFECTS[e.type] ?? e.type)
  if (x.complete) parts.push('✅ 完成任務')
  if (x.fail_quest) parts.push('❌ 任務失敗')
  if (x.retry) parts.push('↻ 可以再來')
  return parts.join('；')
})
// 結束時把時間往前推：經過幾小時、再推到夜裡或隔天早上（都沒有時拿掉）
function setTime(patch: { hours?: number; until?: TimeTarget | '' }) {
  if (!o.value) return
  const t = { ...o.value.time, ...patch }
  const hours = Math.min(MAX_JUMP_HOURS, Math.max(0, Math.round(Number(t.hours) || 0)))
  const next = { ...(hours ? { hours } : {}), ...(t.until ? { until: t.until } : {}) }
  if (next.hours || next.until) o.value.time = next
  else delete o.value.time
}
const end = computed({
  get: () => (o.value?.complete ? 'complete' : o.value?.fail_quest ? 'fail' : ''),
  set: (v: string) => {
    if (!o.value) return
    delete o.value.complete
    delete o.value.fail_quest
    if (v === 'complete') o.value.complete = true
    if (v === 'fail') o.value.fail_quest = true
  },
})
</script>

<template>
  <div class="outcome">
    <div class="row small head">
      <button v-if="o" type="button" class="fold" :title="open ? '收起' : '展開'" :aria-expanded="open" @click="open = !open">{{ open ? '▾' : '▸' }}</button>
      <label class="check">
        <input v-if="props.optional" type="checkbox" :checked="!!o" @change="enable(($event.target as HTMLInputElement).checked)" />
        <b>{{ label }}</b>
      </label>
      <span v-if="props.optional && !o" class="muted">{{ props.event ? '（沒有寫結果：什麼也沒發生）' : '（沒有寫結果：任務點保持開放，可以再試）' }}</span>
      <span v-else-if="o && !open" class="muted summary-line" @click="open = true">{{ summary || '（還沒有寫內容）' }}</span>
    </div>
    <div v-if="o" v-show="open" class="body">
      <label class="block small">發生的事（給玩家與 AI）<textarea v-model="o.text" rows="2" maxlength="400" /></label>
      <label v-if="!props.event" class="block small">
        <span>親密場景（成人向，可以空著）<Hint text="寫了，這段經過就交給「成人場景正文」，依成人場景規則詳細描寫、不會一筆帶過。寫誰和誰、在哪裡、做了什麼；只給 AI 看。任務要標「成人向」。" /></span>
        <textarea v-model="o.scene" rows="2" :maxlength="STORY_SCENE_CHARS" />
      </label>
      <div class="row small">設定旗標 <FlagInput v-model="o.set_flags" /></div>
      <div class="row small">清除旗標 <FlagInput v-model="o.clear_flags" /></div>
      <CounterDeltasEditor v-model="o.counters" />
      <div v-if="!props.event" class="row small">
        死去的角色 <Hint text="故事裡的死亡：這些固定 NPC 在這裡死去（不用和他戰鬥），之後不再出現；需要他的其他任務會失敗。要和他戰鬥時，改用一隻代替他的怪物。" />
        <span v-for="(d, i) in o.deaths ?? []" :key="d" class="tag chip">{{ namedNpcs.find((n) => n.id === d)?.name ?? d }} <button class="x" @click="o.deaths!.splice(i, 1); if (!o.deaths!.length) delete o.deaths" title="移除">✕</button></span>
        <select :value="''" @change="addDeath(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">＋ 選擇角色</option>
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id" :disabled="o.deaths?.includes(n.id)">{{ n.name }}</option>
        </select>
      </div>
      <div v-if="!props.event" class="row small">
        同行加入
        <select v-model="o.join">
          <option :value="undefined">（無）</option>
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
        同行離開
        <select v-model="o.leave">
          <option :value="undefined">（無）</option>
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </div>
      <div class="row small">
        進入臨時地圖
        <select v-model="o.side_map">
          <option :value="undefined">（無）</option>
          <option v-for="k in SIDE_MAPS()" :key="k" :value="k">{{ travelEvents.side_maps[k]!.name }}</option>
        </select>
        傳送到特殊地圖
        <select v-model="o.special_map">
          <option :value="undefined">（無）</option>
          <option v-for="m in Object.values(specialMaps)" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        改去別的地點
        <select v-model="o.travel_to">
          <option :value="undefined">（無）</option>
          <option v-for="l in geography.locations.filter((x) => !props.event || x.type !== 'dungeon')" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
      </div>
      <div class="row small">
        結束時的時間 <Hint text="這件事結束時把時間往前推：先經過幾小時，再推到夜裡（20 點，已經是夜裡時不動）或隔天早上（8 點）。例如夜裡的密會結束後「到隔天早上」，就不會在大白天看到月亮。只往前推；旅途中不調整。" />
        經過 <input type="number" min="0" :max="MAX_JUMP_HOURS" class="num" :value="o.time?.hours ?? ''" placeholder="0" @change="setTime({ hours: Number(($event.target as HTMLInputElement).value) })" /> 小時，
        <select :value="o.time?.until ?? ''" @change="setTime({ until: ($event.target as HTMLSelectElement).value as TimeTarget | '' })">
          <option value="">不調整時段</option>
          <option v-for="(n, k) in TARGET_NAME" :key="k" :value="k">再{{ n }}</option>
        </select>
      </div>
      <EffectsEditor v-model="o.effects" :types="props.event ? EVENT_EFFECTS : undefined" />
      <div v-if="!props.event" class="row small">
        <select v-model="end">
          <option value="">任務繼續</option>
          <option value="complete">✅ 完成任務（發完成報酬）</option>
          <option value="fail">❌ 任務失敗</option>
        </select>
        <label class="check"><input v-model="o.retry" type="checkbox" /> 之後可以再來一次 <Hint text="不結束這個任務點。" /></label>
      </div>
    </div>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.outcome { display: grid; gap: 4px; border-left: 3px solid var(--border); padding-left: 8px; }
.head { gap: 6px; flex-wrap: nowrap; }
.fold { padding: 0 4px; min-height: 0; line-height: 1.2; border: none; background: none; color: var(--accent); cursor: pointer; }
.summary-line { cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.body { display: grid; gap: 4px; }
</style>
