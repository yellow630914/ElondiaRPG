<script setup lang="ts">
import { computed } from 'vue'
import { npcs as namedNpcs, type StoryCheck } from '@/engine/data'
import Hint from '../ui/Hint.vue'

// 檢定參考某位固定 NPC 的好感：每幾點 +1（上限）、門檻（不到就直接失敗，不擲骰）
const check = defineModel<StoryCheck>({ required: true })
const on = computed(() => !!check.value.affinity)
function toggle(v: boolean) {
  if (v) check.value.affinity = { npc: namedNpcs[0]?.id ?? '', per: 10, max: 5 }
  else delete check.value.affinity
}
const minText = computed({
  get: () => (check.value.affinity?.min === undefined ? '' : String(check.value.affinity.min)),
  set: (v: string) => {
    const a = check.value.affinity
    if (!a) return
    const n = Number(v)
    if (v.trim() === '' || !Number.isFinite(n)) delete a.min
    else a.min = Math.max(-100, Math.min(100, Math.round(n)))
  },
})
</script>

<template>
  <div class="row small">
    <label class="check"><input type="checkbox" :checked="on" @change="toggle(($event.target as HTMLInputElement).checked)" /> 參考好感</label>
    <template v-if="check.affinity">
      <select v-model="check.affinity.npc"><option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option></select>
      每 <input v-model.number="check.affinity.per" type="number" min="1" max="100" class="num" /> 點 +1，最多 ±<input v-model.number="check.affinity.max" type="number" min="0" max="20" class="num" />
      ・門檻 <input v-model="minText" class="num" placeholder="不限" />
      <Hint text="好感（親密度）換成加值放進檢定（負的好感會扣）。有門檻時，好感不到門檻就直接套用失敗的結果，不擲骰。AI 判定時也會知道這位角色對主角的好感。" />
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
