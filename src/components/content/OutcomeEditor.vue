<script setup lang="ts">
import { computed } from 'vue'
import { geography, npcs as namedNpcs, specialMaps, type StoryOutcome } from '@/engine/data'
import { travelEvents } from '@/engine/road'
import { SIDE_MAPS, STORY_EFFECTS } from '@/engine/storyMods'
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
    <label class="check small head">
      <input v-if="props.optional" type="checkbox" :checked="!!o" @change="enable(($event.target as HTMLInputElement).checked)" />
      <b>{{ label }}</b>
      <span v-if="props.optional && !o" class="muted">{{ props.event ? '（沒有寫結果：什麼也沒發生）' : '（沒有寫結果：任務點保持開放，可以再試）' }}</span>
    </label>
    <template v-if="o">
      <label class="block small">發生的事（給玩家與 AI）<textarea v-model="o.text" rows="2" maxlength="400" /></label>
      <div class="row small">設定旗標 <FlagInput v-model="o.set_flags" /></div>
      <div class="row small">清除旗標 <FlagInput v-model="o.clear_flags" /></div>
      <CounterDeltasEditor v-model="o.counters" />
      <div v-if="!props.event" class="row small">
        死去的角色 <Hint text="故事裡的死亡：這些固定 NPC 在這裡死去（不用和他戰鬥），之後不再出現；需要他的其他任務會失敗。要和他戰鬥時，改用一隻代替他的怪物。" />
        <span v-for="(d, i) in o.deaths ?? []" :key="d" class="tag chip">{{ namedNpcs.find((n) => n.id === d)?.name ?? d }} <button class="x" @click="o.deaths!.splice(i, 1); if (!o.deaths!.length) delete o.deaths">×</button></span>
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
      <EffectsEditor v-model="o.effects" :types="props.event ? EVENT_EFFECTS : undefined" />
      <div v-if="!props.event" class="row small">
        <select v-model="end">
          <option value="">任務繼續</option>
          <option value="complete">✅ 完成任務（發完成報酬）</option>
          <option value="fail">❌ 任務失敗</option>
        </select>
        <label class="check"><input v-model="o.retry" type="checkbox" /> 之後可以再來一次 <Hint text="不結束這個任務點。" /></label>
      </div>
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.outcome { display: grid; gap: 4px; border-left: 3px solid var(--border); padding-left: 8px; }
.head { gap: 6px; }
</style>
