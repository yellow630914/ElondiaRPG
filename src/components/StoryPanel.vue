<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, enemies, type StoryCheck, type StoryNode } from '@/engine/data'
import { npcRecord } from '@/engine/npcs'
import { nodesHere, storyAffinity, storyOffersHere } from '@/engine/story'
import { condMet } from '@/engine/storyFlags'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'

// 特殊任務：這裡可以接的任務（公會、身邊的固定 NPC），以及這裡的任務點
const game = useGame()
const s = computed(() => game.state!)
const offers = computed(() => {
  void s.value.time.minute
  void s.value.position
  return storyOffersHere(s.value)
})
const nodes = computed(() => {
  void s.value.time.minute
  void s.value.position
  void s.value.flags
  return nodesHere(s.value)
})
const busy = computed(() => game.judging || !!s.value.pendingAction || !!s.value.combat)
const text = ref<Record<string, string>>({})
const use = ref<Record<string, string>>({})

/** 檢定的說明：屬性與 DC；參考好感時加上好感的加值，沒到門檻時說會直接失敗 */
function checkLabel(c: StoryCheck) {
  const base = `${attrName(c.attr)}檢定・DC ${c.dc}`
  if (!c.affinity) return base
  const a = storyAffinity(s.value, c.affinity)
  if (a.blocked) return `${base}・${a.name}的好感 ${a.affinity}，不到 ${a.min}：會直接失敗`
  return `${base}・${a.name}的好感 ${a.bonus >= 0 ? '+' : ''}${a.bonus}`
}
function foes(n: StoryNode): string {
  return [
    ...(n.enemies ?? []).map(([id, k]) => `${enemies[id]?.name ?? id}${k > 1 ? `×${k}` : ''}`),
    ...(n.foes ?? []).map((id) => npcRecord(s.value, id)?.name ?? id),
  ].join('、')
}
function attempt(ref: string, option?: number) {
  const u = parseUse(use.value[ref] ?? '')
  void game.attemptStory(option === undefined ? ref : `${ref}:${option}`, text.value[ref] ?? '', u)
  text.value[ref] = ''
  use.value[ref] = ''
}
function play(ref: string, option?: number) {
  game.playStoryNode(ref, option, text.value[ref]?.trim() || undefined)
  text.value[ref] = ''
}
</script>

<template>
  <section v-if="offers.length || nodes.length" class="panel story-panel">
    <h3 class="title"><GameIcon name="star" :size="16" />特殊任務</h3>
    <div v-for="d in offers" :key="d.id" class="card">
      <div><span v-if="d.rank" class="tag">{{ d.rank }}</span> <b>{{ d.title }}</b></div>
      <p class="small">{{ d.start.text ?? d.summary }}</p>
      <p v-if="d.start.text" class="small muted">{{ d.summary }}</p>
      <button class="small primary" :disabled="busy" @click="game.startStory(d.id)">接下任務</button>
    </div>
    <div v-for="n in nodes" :key="n.ref" class="card">
      <div class="small muted">{{ n.def.title }}</div>
      <div><b>{{ n.node.title }}</b></div>
      <p v-if="n.node.text" class="small">{{ n.node.text }}</p>
      <template v-if="n.node.kind === 'story'">
        <button class="small primary" :disabled="busy" @click="play(n.ref)">繼續</button>
      </template>
      <template v-else-if="n.node.kind === 'combat'">
        <p class="small"><GameIcon name="sword" :size="13" class="foe" /> {{ foes(n.node) }}</p>
        <button class="small primary" :disabled="busy" @click="play(n.ref)">開始戰鬥</button>
      </template>
      <template v-else>
        <input v-model="text[n.ref]" class="grow" :placeholder="n.node.kind === 'check' ? '怎麼做（選填；AI 判定時參考）' : '補充你的做法（選填）'" />
        <AbilityPicker v-if="n.node.kind === 'check' || n.node.options?.some((o) => o.check)" v-model="use[n.ref]" />
        <div v-if="n.node.kind === 'check' && n.node.check" class="row">
          <button class="small primary" :disabled="busy" @click="attempt(n.ref)">嘗試（{{ checkLabel(n.node.check) }}）</button>
        </div>
        <div v-else class="row">
          <template v-for="(o, i) in n.node.options ?? []" :key="i">
            <!-- 有好感、旗標條件的選項：條件成立才出現 -->
            <button
              v-if="condMet(s, o.requires)" class="small" :class="{ primary: !o.check }" :disabled="busy"
              @click="o.check ? attempt(n.ref, i) : play(n.ref, i)"
            >{{ o.label }}<template v-if="o.check">（{{ checkLabel(o.check) }}）</template></button>
          </template>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.story-panel { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
.story-panel h3 { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.foe { color: var(--danger); vertical-align: -2px; }
.card { border: 1px dashed var(--accent); border-radius: var(--radius); padding: 6px 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.card p { margin: 0; line-height: 1.6; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
.grow { width: 100%; }
</style>
