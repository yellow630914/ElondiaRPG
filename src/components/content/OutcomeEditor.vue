<script setup lang="ts">
import { computed } from 'vue'
import { npcs as namedNpcs, type StoryOutcome } from '@/engine/data'
import EffectsEditor from './EffectsEditor.vue'
import FlagInput from './FlagInput.vue'

// 任務點的一個結果：文字、劇情旗標、效果、任務同行的夥伴、完成或失敗
const model = defineModel<StoryOutcome | undefined>()
const props = defineProps<{ label: string; optional?: boolean }>()
const o = computed(() => model.value)

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
      <span v-if="props.optional && !o" class="muted">（沒有寫結果：任務點保持開放，可以再試）</span>
    </label>
    <template v-if="o">
      <label class="block small">發生的事（給玩家與 AI）<textarea v-model="o.text" rows="2" maxlength="400" /></label>
      <div class="row small">設定旗標 <FlagInput v-model="o.set_flags" /></div>
      <div class="row small">清除旗標 <FlagInput v-model="o.clear_flags" /></div>
      <div class="row small">
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
      <EffectsEditor v-model="o.effects" />
      <div class="row small">
        <select v-model="end">
          <option value="">任務繼續</option>
          <option value="complete">✅ 完成任務（發完成報酬）</option>
          <option value="fail">❌ 任務失敗</option>
        </select>
        <label class="check"><input v-model="o.retry" type="checkbox" /> 之後可以再來一次（不結束這個任務點）</label>
      </div>
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.outcome { display: grid; gap: 4px; border-left: 3px solid var(--border); padding-left: 8px; }
.head { gap: 6px; }
</style>
