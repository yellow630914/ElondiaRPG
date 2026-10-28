<script setup lang="ts">
import { computed, ref } from 'vue'
import { captiveConsequence, captiveRecords, type CaptiveChoice, type CaptiveDeed } from '@/engine/captives'
import { tagDef } from '@/engine/data'
import { npcTitle } from '@/engine/npcs'
import { isEnslaved } from '@/engine/party'
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
const unseen = computed(() => !!s.value.captives?.unseen)
/** 不能收為奴隸的原因：主角身上有奴隸印記（奴隸不能擁有奴隸）；隊伍滿了時先騰出位子 */
const enslaveWhy = computed(() => (isEnslaved(s.value) ? '身上還有奴隸印記，不能擁有奴隸' : ''))
function enslave(id: string) {
  const name = captives.value.find((c) => c.id === id)?.name ?? ''
  game.requireRoom(1, `收${name}為奴隸`, () => resolve(id, 'enslave'))
}
const text = ref<Record<string, string>>({})
const use = ref<Record<string, string>>({})
/** 處置時順便做的事（劫財、劫色），和處置寫成同一篇 */
const deeds = ref<Record<string, Record<CaptiveDeed, boolean>>>({})

function chosen(id: string): CaptiveDeed[] {
  const d = deeds.value[id]
  if (!d) return []
  return (['rob', 'violate'] as CaptiveDeed[]).filter((k) => d[k])
}

function toggle(id: string, d: CaptiveDeed, on: boolean) {
  deeds.value[id] = { ...(deeds.value[id] ?? { rob: false, violate: false }), [d]: on }
}

function cost(id: string, choice: CaptiveChoice): string {
  const k = captiveConsequence(s.value, choice, chosen(id))
  if (k.wanted) return `會被通緝（警戒 +${k.alert}${k.reputation ? `、聲望 ${k.reputation}` : ''}）`
  const parts = [k.alert ? `這裡的警戒 +${k.alert}` : '', k.reputation ? `聲望 ${k.reputation}` : ''].filter(Boolean)
  return parts.length ? parts.join('、') : '沒有衛兵與聲望的後果'
}

/** 處置：連同勾選的劫財、劫色寫成一篇；寫了文字就當作怎麼做（交給 AI 寫經過，結果照選的處置） */
async function resolve(id: string, choice: CaptiveChoice) {
  await game.resolveCaptive(id, choice, text.value[id] ?? '', chosen(id))
  if (!game.error) {
    text.value[id] = ''
    delete deeds.value[id]
  }
}

/** 主動行動：對被制伏的人做任何事（審問、勸降……），交給 AI 判定；之後還是要處置 */
async function act(id: string) {
  const u = parseUse(use.value[id] ?? '')
  await game.perform({ kind: 'free', target: id, text: text.value[id] ?? '', ...(u ? { use: u } : {}) })
  if (!game.error) {
    text.value[id] = ''
    use.value[id] = ''
  }
}
</script>

<template>
  <section class="panel captives">
    <div class="row head">
      <h3><GameIcon name="lock" :size="16" />戰後處置</h3>
      <JudgeToggle />
    </div>
    <p class="small muted">對方倒在地上，任你處置（{{ firstHand }}{{ unseen ? '，沒有人看到' : '' }}）。每個人都處置完才能繼續移動或休息。</p>
    <article v-for="c in captives" :key="c.id" class="captive">
      <div class="row">
        <NameTag :id="c.id" />
        <span class="muted small">{{ npcTitle(c) }} Lv.{{ c.level }}</span>
        <span v-for="t in (c.tags ?? []).map(tagDef).filter(Boolean)" :key="t!.name" class="tag small">{{ t!.emoji }}{{ t!.name }}</span>
      </div>
      <textarea v-model="text[c.id]" rows="2" placeholder="想對對方做什麼、怎麼做（選填）。按「主動行動」交給 AI 判定（審問、勸降……）；按放過、收為奴隸、處決，就照這段文字寫出經過" />
      <div class="row deeds">
        <span class="small muted">處置時順便：</span>
        <label class="small" title="搜走對方藏起來的錢；對方親密度下降">
          <input type="checkbox" :checked="!!deeds[c.id]?.rob" :disabled="busy" @change="toggle(c.id, 'rob', ($event.target as HTMLInputElement).checked)" />
          <GameIcon name="coins" :size="13" />劫財
        </label>
        <label class="small" title="成人向：趁對方無力反抗時強行佔有；對方親密度大幅下降">
          <input type="checkbox" :checked="!!deeds[c.id]?.violate" :disabled="busy" @change="toggle(c.id, 'violate', ($event.target as HTMLInputElement).checked)" />
          <GameIcon name="heart" :size="13" />劫色
        </label>
      </div>
      <div class="row acts">
        <button class="small" :disabled="busy || !(text[c.id] ?? '').trim()" title="交給 AI 判定；做完人還在你手上" @click="act(c.id)"><GameIcon name="d20" :size="13" />主動行動</button>
        <span class="spacer" />
        <button class="small" :disabled="busy" :title="`${s.captives?.aggressor === 'npc' ? '對方欠你一份情：親密度上升' : '對方會記恨在心'}；${cost(c.id, 'release')}`" @click="resolve(c.id, 'release')"><GameIcon name="hand" :size="13" />放過</button>
        <button class="small" :disabled="busy || !!enslaveWhy" :title="enslaveWhy || `以奴隸身分加入隊伍（1 HP）；${cost(c.id, 'enslave')}`" @click="enslave(c.id)"><GameIcon name="lock" :size="13" />收為奴隸</button>
        <button class="small danger" :disabled="busy" :title="cost(c.id, 'execute')" @click="resolve(c.id, 'execute')"><GameIcon name="skull" :size="13" />處決</button>
      </div>
      <AbilityPicker v-model="use[c.id]" />
      <p class="small muted">
        <template v-if="chosen(c.id).length">放過：{{ cost(c.id, 'release') }}；</template>收為奴隸：{{ enslaveWhy || cost(c.id, 'enslave') }}；處決：{{ cost(c.id, 'execute') }}。
      </p>
    </article>
  </section>
</template>

<style scoped>
.captives { border-color: var(--danger); }
.captives .head { justify-content: space-between; }
.captives h3 { margin: 0; color: var(--danger); display: flex; align-items: center; gap: 6px; }
.captive { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid var(--border); }
.captive textarea { width: 100%; }
.deeds { gap: 12px; align-items: center; }
.deeds label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.acts .spacer { flex: 1; }
.acts button { display: inline-flex; align-items: center; gap: 4px; }
</style>
