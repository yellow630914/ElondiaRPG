<script setup lang="ts">
import AuctionPanel from './AuctionPanel.vue'
import { computed, ref } from 'vue'
import { blockedReason, insideLandmark, interiorBlocked, landmarkClosed, landmarkHere, sceneBlocked, sceneCastNames, scenesHere } from '@/engine/landmarks'
import { attrName, specialMaps } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { effectText } from '@/engine/trade'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import ContentTagChips from './ContentTagChips.vue'
import FoldMenu from './ui/FoldMenu.vue'
import GameIcon from './ui/GameIcon.vue'

// 站在城鎮的特色地標上：開放的狀態、參訪、場景、探索（data/world/landmarks.json，見 docs/LANDMARKS.md）
const game = useGame()
const s = computed(() => game.state!)
const l = computed(() => landmarkHere(s.value))
const closed = computed(() => (l.value ? landmarkClosed(s.value, l.value) : undefined))
const visitBlocked = computed(() => (l.value?.visit ? blockedReason(s.value, 'visit') : undefined))
const exploreBlocked = computed(() => (l.value?.explore ? blockedReason(s.value, 'explore') : undefined))
// 有內部的地標：站在外面時可以走進去（裡面從出口離開）
const interior = computed(() => (l.value?.interior && !insideLandmark(s.value, l.value) ? specialMaps[l.value.interior] : undefined))
const interiorWhy = computed(() => (interior.value ? interiorBlocked(s.value) : undefined))
const scenes = computed(() => scenesHere(s.value).map((x) => ({ ...x, blocked: sceneBlocked(s.value, x.index), cast: sceneCastNames(s.value, x.scene).join('、') })))
const gains = (list: { type: string }[] = []) => list.map((e) => effectText(s.value, e as never)).join('、')
const text = ref('')
const use = ref('')

function explore() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'explore', text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}
</script>

<template>
  <div v-if="l" class="landmark small">
    <p v-if="closed" class="warn-text"><GameIcon name="lock" :size="13" /> {{ closed }}</p>
    <div v-if="l.visit" class="item">
      <div><strong class="ttl"><GameIcon name="sparkles" :size="13" /> {{ l.visit.title }}</strong>
        <span class="muted">（{{ l.visit.money_cc ? `${formatMoney(l.visit.money_cc)}・` : '' }}{{ l.visit.hours ?? 0.5 }} 小時{{ (l.visit.cooldown_days ?? 1) > 1 ? `・每 ${l.visit.cooldown_days} 天一次` : '・每天一次' }}）</span>
      </div>
      <p v-if="l.visit.desc" class="muted">{{ l.visit.desc }}</p>
      <p v-if="gains(l.visit.effects)" class="muted">得到：{{ gains(l.visit.effects) }}</p>
      <button class="small" :disabled="!!visitBlocked || game.judging || !!s.pendingAction" :title="visitBlocked ?? ''" @click="game.visitLandmark()">{{ visitBlocked ?? l.visit.title }}</button>
    </div>
    <div v-if="interior" class="item">
      <button class="small primary" :disabled="!!interiorWhy || game.judging || !!s.pendingAction" :title="interiorWhy ?? ''" @click="game.enterLandmark()"><GameIcon name="door" :size="13" /> {{ interiorWhy ?? `走進${interior.name}` }}</button>
    </div>
    <div v-for="x in scenes" :key="x.index" class="item">
      <div><strong class="ttl"><GameIcon name="heart" :size="13" /> {{ x.scene.title }}</strong> <ContentTagChips :tags="x.scene.tags" />
        <span class="muted">（{{ x.scene.money_cc ? `${formatMoney(x.scene.money_cc)}・` : '' }}{{ x.scene.hours ?? 2 }} 小時・{{ (x.scene.cooldown_days ?? 3) > 1 ? `每 ${x.scene.cooldown_days ?? 3} 天一次` : '每天一次' }}）</span>
      </div>
      <p v-if="x.scene.desc" class="muted">{{ x.scene.desc }}</p>
      <p v-if="x.cast" class="muted">在場：{{ x.cast }}</p>
      <button class="small" :disabled="!!x.blocked || game.judging || !!s.pendingAction" :title="x.blocked ?? ''" @click="game.playLandmarkScene(x.index)">{{ x.blocked ?? x.scene.title }}</button>
    </div>
    <AuctionPanel v-if="l.auction" />
    <FoldMenu v-if="l.explore" :id="`landmark.explore`" class="item" icon="search" :label="l.explore.title" :detail="`${attrName(l.explore.attr)}檢定，參考 DC ${l.explore.dc}・${l.explore.hours} 小時`">
      <p v-if="l.explore.desc" class="muted">{{ l.explore.desc }}</p>
      <p class="muted">成功：{{ gains(l.explore.effects) || '有所收穫' }}{{ l.explore.critical?.length ? `；大成功另外 ${gains(l.explore.critical)}` : '' }}。{{ (l.explore.cooldown_days ?? 7) }} 天後才能再試。</p>
      <template v-if="!exploreBlocked">
        <input v-model="text" placeholder="怎麼做（選填，會寫進日誌）" />
        <AbilityPicker v-model="use" />
        <button class="small" :disabled="game.judging || !!s.pendingAction" @click="explore">開始</button>
      </template>
      <p v-else class="muted">{{ exploreBlocked }}</p>
    </FoldMenu>
  </div>
</template>

<style scoped>
.landmark { display: grid; gap: 6px; margin-top: 4px; }
.item { display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.item input { width: 100%; }
.item p { margin: 0; }
.warn-text { color: var(--danger); margin: 0; }
.landmark :deep(.game-icon) { color: var(--accent); vertical-align: -2px; }
.warn-text :deep(.game-icon) { color: var(--danger); }
</style>
