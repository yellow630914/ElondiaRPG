<script setup lang="ts">
import ContentTagChips from './ContentTagChips.vue'
import { computed, ref } from 'vue'
import { attrName, enemies, type StoryCheck } from '@/engine/data'
import { npcRecord } from '@/engine/npcs'
import { npcFree, optionOpen, storyAffinity, type ActiveNode } from '@/engine/story'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'

// 一個任務點：劇情按「繼續」、判定按「嘗試」、戰鬥按「開始戰鬥」、選擇按選項。
// prompt：走到任務點時跳出來的事件視窗（多一個「稍候」或「放棄」，見 eventQueue.ts）
const props = defineProps<{ n: ActiveNode; prompt?: boolean }>()
const game = useGame()
const s = computed(() => game.state!)
const busy = computed(() => game.judging || !!s.value.pendingAction || !!s.value.combat)
const text = ref('')
const use = ref('')

/** 檢定的說明：屬性與 DC；參考好感時加上好感的加值，沒到門檻時說會直接失敗 */
function checkLabel(c: StoryCheck) {
  const base = `${attrName(c.attr)}檢定・DC ${c.dc}`
  if (!c.affinity) return base
  const a = storyAffinity(s.value, c.affinity)
  if (a.blocked) return `${base}・${a.name}的好感 ${a.affinity}，不到 ${a.min}：會直接失敗`
  return `${base}・${a.name}的好感 ${a.bonus >= 0 ? '+' : ''}${a.bonus}`
}
// 已經死了、被制伏的角色不上場
const foes = computed(() => [
  ...(props.n.node.enemies ?? []).map(([id, k]) => `${enemies[id]?.name ?? id}${k > 1 ? `×${k}` : ''}`),
  ...(props.n.node.foes ?? []).filter((id) => npcFree(s.value, id)).map((id) => npcRecord(s.value, id)?.name ?? id),
].join('、'))
function attempt(option?: number) {
  void game.attemptStory(option === undefined ? props.n.ref : `${props.n.ref}:${option}`, text.value, parseUse(use.value))
  text.value = ''
  use.value = ''
}
function play(option?: number) {
  game.playStoryNode(props.n.ref, option, text.value.trim() || undefined)
  text.value = ''
}
function abandon() {
  if (confirm(`放棄特殊任務「${props.n.def.title}」？放棄後不能再接。`)) game.abandonStory(props.n.def.id)
}
</script>

<template>
  <div class="card" :class="{ prompt }">
    <div class="small muted">{{ n.def.title }}</div>
    <div><b>{{ n.node.title }}</b></div>
    <p v-if="n.node.text" class="small">{{ n.node.text }}</p>
    <template v-if="n.node.kind === 'story'">
      <div class="row"><button class="small primary" :disabled="busy" @click="play()">繼續</button></div>
    </template>
    <template v-else-if="n.node.kind === 'combat'">
      <p class="small"><GameIcon name="sword" :size="13" class="foe" /> {{ foes || '對手已經不在了' }}</p>
      <div class="row"><button class="small primary" :disabled="busy" @click="play()">{{ foes ? '開始戰鬥' : '繼續' }}</button></div>
    </template>
    <template v-else>
      <input v-model="text" class="grow" :placeholder="n.node.kind === 'check' ? '怎麼做（選填；AI 判定時參考）' : '補充你的做法（選填）'" />
      <AbilityPicker v-if="n.node.kind === 'check' || n.node.options?.some((o) => o.check)" v-model="use" />
      <div v-if="n.node.kind === 'check' && n.node.check" class="row">
        <button class="small primary" :disabled="busy" @click="attempt()">嘗試（{{ checkLabel(n.node.check) }}）</button>
      </div>
      <div v-else class="row">
        <template v-for="(o, i) in n.node.options ?? []" :key="i">
          <!-- 有好感、旗標條件的選項：條件成立才出現 -->
          <button
            v-if="optionOpen(s, n.node, i)" class="small" :class="{ primary: !o.check }" :disabled="busy"
            @click="o.check ? attempt(i) : play(i)"
          >{{ o.label }}<template v-if="o.check">（{{ checkLabel(o.check) }}）</template> <ContentTagChips :tags="o.tags" /></button>
        </template>
      </div>
    </template>
    <div v-if="prompt" class="row later">
      <button v-if="!n.node.urgent" class="small" :disabled="busy" title="這次先略過，不記在日誌；離開這裡之後再來還會遇到" @click="game.waitStory(n.ref)">稍候</button>
      <button v-else class="small danger" :disabled="busy" title="任務線中斷，之後不能再接" @click="abandon">放棄任務</button>
    </div>
  </div>
</template>

<style scoped>
.card { border: 1px dashed var(--accent); border-radius: var(--radius); padding: 6px 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.card.prompt { border: none; padding: 0; gap: 8px; }
.card p { margin: 0; line-height: 1.6; }
.foe { color: var(--danger); vertical-align: -2px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
.later { justify-content: flex-end; }
.grow { width: 100%; }
</style>
