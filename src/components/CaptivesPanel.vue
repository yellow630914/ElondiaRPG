<script setup lang="ts">
import { computed, ref } from 'vue'
import { captiveConsequence, captiveRecords, deedDone, type CaptiveDeed } from '@/engine/captives'
import { tagDef } from '@/engine/data'
import { npcTitle } from '@/engine/npcs'
import { partyRoom } from '@/engine/party'
import { parseUse, useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'

// 打贏冒險者之後處置被制伏的人（見 docs/NPC_SYSTEM.md 第 8.2 節）
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const captives = computed(() => captiveRecords(s.value))
const busy = computed(() => game.judging || !!s.value.pendingAction)
const firstHand = computed(() => (s.value.captives?.aggressor === 'party' ? '是你先動的手' : '是對方先動的手'))
const room = computed(() => partyRoom(s.value) > 0)
const text = ref<Record<string, string>>({})
const use = ref('')

function cost(choice: 'execute' | 'enslave' | CaptiveDeed): string {
  const k = captiveConsequence(s.value, choice)
  const parts = [k.alert ? `這裡的警戒 +${k.alert}` : '', k.reputation ? `聲望 ${k.reputation}` : ''].filter(Boolean)
  return parts.length ? parts.join('、') : '沒有衛兵與聲望的後果'
}

/** 主動行動：對被制伏的人做任何事（審問、搜身、勸降……），交給 AI 判定；之後還是要處置 */
/** 處置：寫了文字就當作怎麼做（交給 AI 寫經過，結果照選的處置） */
function resolve(id: string, choice: 'release' | 'enslave' | 'execute') {
  void game.resolveCaptive(id, choice, text.value[id] ?? '')
  text.value[id] = ''
}

/** 劫財、劫色：寫了文字就當作怎麼做；做完人還在手上 */
function deed(id: string, d: CaptiveDeed) {
  void game.captiveDeed(id, d, text.value[id] ?? '')
  text.value[id] = ''
}

function act(id: string) {
  const u = parseUse(use.value)
  void game.perform({ kind: 'free', target: id, text: text.value[id] ?? '', ...(u ? { use: u } : {}) })
  text.value[id] = ''
  use.value = ''
}
</script>

<template>
  <section class="panel captives">
    <div class="row head">
      <h3><GameIcon name="lock" :size="16" />戰後處置</h3>
      <JudgeToggle />
    </div>
    <p class="small muted">對方倒在地上，任你處置（{{ firstHand }}）。每個人都處置完才能繼續移動或休息。</p>
    <article v-for="c in captives" :key="c.id" class="captive">
      <div class="row">
        <NameTag :id="c.id" />
        <span class="muted small">{{ npcTitle(c) }} Lv.{{ c.level }}</span>
        <span v-for="t in (c.tags ?? []).map(tagDef).filter(Boolean)" :key="t!.name" class="tag small">{{ t!.emoji }}{{ t!.name }}</span>
      </div>
      <textarea v-model="text[c.id]" rows="2" placeholder="想對對方做什麼、怎麼做（選填）。按「主動行動」交給 AI 判定（審問、勸降……）；按劫財、放過、收為奴隸、處決等，就照這段文字寫出經過" />
      <div class="row acts">
        <button class="small" :disabled="busy || !(text[c.id] ?? '').trim()" @click="act(c.id)"><GameIcon name="d20" :size="13" />主動行動</button>
        <button class="small" :disabled="busy || deedDone(s, c.id, 'rob')" :title="deedDone(s, c.id, 'rob') ? '已經搜刮過了' : `搜走對方身上的錢（之後還是要處置）；${cost('rob')}`" @click="deed(c.id, 'rob')"><GameIcon name="coins" :size="13" />劫財</button>
        <button v-if="settings.adult" class="small" :disabled="busy || deedDone(s, c.id, 'violate')" :title="deedDone(s, c.id, 'violate') ? '已經這麼做過了' : `成人向：趁對方無力反抗時強行佔有（之後還是要處置）；${cost('violate')}`" @click="deed(c.id, 'violate')"><GameIcon name="heart" :size="13" />劫色</button>
        <span class="spacer" />
        <button class="small" :disabled="busy" :title="s.captives?.aggressor === 'npc' ? '對方欠你一份情：親密度上升' : '對方會記恨在心'" @click="resolve(c.id, 'release')"><GameIcon name="hand" :size="13" />放過</button>
        <button class="small" :disabled="busy || !room" :title="room ? `以奴隸身分加入隊伍；${cost('enslave')}` : '隊伍已滿'" @click="resolve(c.id, 'enslave')"><GameIcon name="lock" :size="13" />收為奴隸</button>
        <button class="small danger" :disabled="busy" :title="cost('execute')" @click="resolve(c.id, 'execute')"><GameIcon name="skull" :size="13" />處決</button>
      </div>
      <p class="small muted">劫財：{{ cost('rob') }}<template v-if="settings.adult">；劫色：{{ cost('violate') }}</template>（做完還是要處置）。收為奴隸：{{ room ? cost('enslave') : '隊伍已滿，帶不走' }}；處決：{{ cost('execute') }}。</p>
    </article>
    <AbilityPicker v-model="use" />
  </section>
</template>

<style scoped>
.captives { border-color: var(--danger); }
.captives .head { justify-content: space-between; }
.captives h3 { margin: 0; color: var(--danger); display: flex; align-items: center; gap: 6px; }
.captive { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid var(--border); }
.captive textarea { width: 100%; }
.acts .spacer { flex: 1; }
.acts button { display: inline-flex; align-items: center; gap: 4px; }
</style>
