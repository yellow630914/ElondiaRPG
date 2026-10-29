<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, slaveryRules } from '@/engine/data'
import { pendingEventDef, pendingEventExists, stanceModifiers } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import { contractOf } from '@/engine/tattoos'

// 主人的突發事件：三選一，或自己輸入回應（見 docs/COMPANIONS.md 2.4）
const game = useGame()
const s = computed(() => game.state!)
const ev = computed(() => s.value.pendingMasterEvent!)
const exists = computed(() => pendingEventExists(s.value))
const def = computed(() => pendingEventDef(s.value))
const master = computed(() => contractOf(s.value.party.find((m) => m.isPlayer))?.masterName ?? '主人')
const busy = computed(() => game.judging || !!s.value.pendingAction)
/** 屈服或抵抗的回應：順從帶來的加減 */
function stanceNote(o: (typeof def.value.options)[number]): string {
  const m = o.check ? stanceModifiers(s.value.party.find((x) => x.isPlayer)!, o.stance)[0] : undefined
  return m ? `・${m.label} ${m.value > 0 ? '+' : ''}${m.value}` : ''
}
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
      <h3 class="title"><GameIcon name="lock" :size="16" />{{ master }}的要求</h3>
      <JudgeToggle />
    </div>
    <p>{{ ev.text }}</p>
    <template v-if="!exists">
      <p class="small muted">這個事件已經從內容編輯器刪掉了。</p>
      <button class="small" @click="game.dropMissingMasterEvent()">略過</button>
    </template>
    <template v-else>
    <div class="options">
      <button v-for="(o, i) in def.options" :key="o.label" class="small" :disabled="busy" @click="game.answerMasterEvent(i)">
        {{ o.label }}<span v-if="o.check" class="muted">（{{ attrName(o.check.attr) }} DC {{ o.check.dc }}{{ stanceNote(o) }}）</span>
      </button>
    </div>
    <p class="small muted">或者自己決定怎麼回應（參考 DC {{ def.free_dc ?? slaveryRules.master_events.free_dc }}，可以搭配能力）：</p>
    <textarea v-model="text" rows="2" placeholder="例如：端上一杯熱茶，問主人今天遇到了什麼事" />
    <AbilityPicker v-model="use" />
    <button class="small primary" :disabled="!text.trim() || busy" @click="respond">回應</button>
    </template>
  </section>
</template>

<style scoped>
.master-event { border-color: var(--accent-2); }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.options { display: grid; gap: 4px; margin: 6px 0; grid-template-columns: minmax(0, 1fr); }
.options button { text-align: left; }
textarea { width: 100%; margin: 6px 0; }
</style>
