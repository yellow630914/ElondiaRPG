<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, combatRules } from '@/engine/data'
import { defeatAdultAllowed } from '@/engine/content'
import { characterBody } from '@/engine/look'
import { pcOf } from '@/engine/party'
import { parseUse, useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 成人向的戰敗事件：敵人圍了上來，三選一或自己描述反應（data/rules/combat.json 的 defeat_event）
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const ev = computed(() => s.value.pendingDefeat!)
const rules = combatRules.defeat_event
const busy = computed(() => game.judging || !!s.value.pendingAction)
const text = ref('')
const use = ref('')
const foes = computed(() => ev.value.foes.map((f) => f.name).join('、'))
// 設定改成不發生（關閉成人向、主角非自願或戰敗事件）時可以直接離開
const allowed = computed(() => {
  void settings.adult
  void settings.contentFilters
  void settings.defeatAdult
  return defeatAdultAllowed(characterBody(pcOf(s.value)))
})

function choose(i: number) {
  void game.perform({ kind: 'defeat_event', target: `opt:${i}`, text: rules.options[i]!.label })
}
function respond() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'defeat_event', target: 'free', text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <section class="panel defeat-event">
    <div class="row head">
      <h3 class="title"><GameIcon name="warning" :size="16" />倒下之後<Hint v-if="allowed" text="結束後和一般戰敗一樣：地下城回到入口、近郊回到城門。" /></h3>
      <JudgeToggle v-if="allowed" />
    </div>
    <template v-if="allowed">
      <p>你倒在{{ ev.scene }}，{{ foes }}圍了上來，看向你的眼神不懷好意……你要怎麼做？</p>
      <div class="options">
        <button v-for="(o, i) in rules.options" :key="o.label" class="small" :disabled="busy" @click="choose(i)">
          {{ o.label }}<span class="muted">（{{ attrName(o.attr) }} DC {{ o.dc }}）</span>
        </button>
      </div>
      <p class="small muted">或者自己描述反應（參考 DC {{ rules.free_dc }}，可以搭配能力）：</p>
      <textarea v-model="text" rows="2" placeholder="例如：假裝昏迷，等最近的那個靠過來時抓起沙子往牠臉上撒" />
      <AbilityPicker v-model="use" />
      <button class="small primary" :disabled="!text.trim() || busy" @click="respond">回應</button>
    </template>
    <template v-else>
      <p>你被{{ foes }}打倒了。</p>
      <button class="small primary" @click="game.skipDefeatEvent()">離開</button>
    </template>
  </section>
</template>

<style scoped>
.defeat-event { border-color: var(--danger); }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.defeat-event .title :deep(.game-icon) { color: var(--danger); }
.options { display: grid; gap: 4px; margin: 6px 0; grid-template-columns: minmax(0, 1fr); }
.options button { text-align: left; }
textarea { width: 100%; margin: 6px 0; }
</style>
