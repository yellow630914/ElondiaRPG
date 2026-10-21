<script setup lang="ts">
import { computed, ref } from 'vue'
import { safeText } from '@/engine/content'
import { attrName, slaveryRules } from '@/engine/data'
import { pendingEventDef } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'

// 主人的突發事件：三選一，或自己輸入回應（見 docs/COMPANIONS.md 2.4）
const game = useGame()
const s = computed(() => game.state!)
const ev = computed(() => s.value.pendingMasterEvent!)
const def = computed(() => pendingEventDef(s.value))
const master = computed(() => s.value.party.find((m) => m.isPlayer)?.contract?.masterName ?? '主人')
const busy = computed(() => game.judging || !!s.value.pendingAction)
const text = ref('')
const use = ref('')

function respond() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'master_event', text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <section class="panel master-event">
    <div class="row head">
      <h3>⛓️ {{ master }}的要求</h3>
      <JudgeToggle />
    </div>
    <p>{{ ev.text }}</p>
    <div class="options">
      <button v-for="(o, i) in def.options" :key="o.label" class="small" :disabled="busy" @click="game.answerMasterEvent(i)">
        {{ safeText(o.label) }}<span v-if="o.check" class="muted">（{{ attrName(o.check.attr) }} DC {{ o.check.dc }}）</span>
      </button>
    </div>
    <p class="small muted">或者自己決定怎麼回應（參考 DC {{ def.free_dc ?? slaveryRules.master_events.free_dc }}，可以搭配能力）：</p>
    <textarea v-model="text" rows="2" placeholder="例如：端上一杯熱茶，問主人今天遇到了什麼事" />
    <AbilityPicker v-model="use" />
    <button class="small primary" :disabled="!text.trim() || busy" @click="respond">回應</button>
  </section>
</template>

<style scoped>
.master-event { border-color: var(--accent-2); }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.options { display: grid; gap: 4px; margin: 6px 0; grid-template-columns: minmax(0, 1fr); }
.options button { text-align: left; }
textarea { width: 100%; margin: 6px 0; }
</style>
