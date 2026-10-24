<script setup lang="ts">
import { computed, ref } from 'vue'
import { captiveConsequence, captiveRecords } from '@/engine/captives'
import { tagDef } from '@/engine/data'
import { npcTitle } from '@/engine/npcs'
import { partyRoom } from '@/engine/party'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'

// 打贏冒險者之後處置被制伏的人（見 docs/NPC_SYSTEM.md 第 8.2 節）
const game = useGame()
const s = computed(() => game.state!)
const captives = computed(() => captiveRecords(s.value))
const busy = computed(() => game.judging || !!s.value.pendingAction)
const firstHand = computed(() => (s.value.captives?.aggressor === 'party' ? '是你先動的手' : '是對方先動的手'))
const room = computed(() => partyRoom(s.value) > 0)
const text = ref<Record<string, string>>({})
const use = ref('')

function cost(choice: 'execute' | 'enslave'): string {
  const k = captiveConsequence(s.value, choice)
  const parts = [k.alert ? `這裡的警戒 +${k.alert}` : '', k.reputation ? `聲望 ${k.reputation}` : ''].filter(Boolean)
  return parts.length ? parts.join('、') : '沒有衛兵與聲望的後果'
}

/** 主動行動：對被制伏的人做任何事（審問、搜身、勸降……），交給 AI 判定；之後還是要處置 */
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
      <textarea v-model="text[c.id]" rows="2" placeholder="想對對方做什麼（審問、搜身、勸降……會交給 AI 判定；之後還是要選下面的處置）" />
      <div class="row acts">
        <button class="small" :disabled="busy || !(text[c.id] ?? '').trim()" @click="act(c.id)"><GameIcon name="d20" :size="13" />主動行動</button>
        <span class="spacer" />
        <button class="small" :disabled="busy" :title="s.captives?.aggressor === 'npc' ? '對方欠你一份情：親密度上升' : '對方會記恨在心'" @click="game.resolveCaptive(c.id, 'release')"><GameIcon name="hand" :size="13" />放過</button>
        <button class="small" :disabled="busy || !room" :title="room ? `以奴隸身分加入隊伍；${cost('enslave')}` : '隊伍已滿'" @click="game.resolveCaptive(c.id, 'enslave')"><GameIcon name="lock" :size="13" />收為奴隸</button>
        <button class="small danger" :disabled="busy" :title="cost('execute')" @click="game.resolveCaptive(c.id, 'execute')"><GameIcon name="skull" :size="13" />處決</button>
      </div>
      <p class="small muted">收為奴隸：{{ room ? cost('enslave') : '隊伍已滿，帶不走' }}；處決：{{ cost('execute') }}。</p>
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
