<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/engine/money'
import { currentArea, currentCell, DUNGEON_LAYERS } from '@/engine/grid'
import { areaLighting, currentLight, isDark, isNight, lightSources } from '@/engine/light'
import { DEFEAT_LOOT_NAME, defeatLootRule, retreatDc } from '@/engine/expedition'
import { dungeonFirstLayer } from '@/engine/data'
import { inPark } from '@/engine/park'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'

// 地圖下方的狀態列：光線與光源、地下城這趟探索撿到的東西、緊急撤退
const game = useGame()
const s = computed(() => game.state!)
const area = computed(() => currentArea(s.value))
const show = computed(() => area.value.kind !== 'settlement' && area.value.kind !== 'road')

const lighting = computed(() => {
  const l = areaLighting(area.value)
  const dark = isDark(s.value, area.value)
  if (l === 'lit') return { icon: 'lightbulb' as const, text: '有光' }
  if (l === 'daylight') return dark ? { icon: 'moon' as const, text: '夜裡一片漆黑' } : { icon: 'sun' as const, text: '白天有光' }
  return { icon: 'moon' as const, text: '黑暗' }
})
const dark = computed(() => isDark(s.value, area.value))
const light = computed(() => currentLight(s.value))
const spare = computed(() => lightSources(s.value).filter((x) => !x.permanent).reduce((n, x) => n + x.spare, 0))

const expedition = computed(() => (area.value.kind === 'dungeon' && s.value.expedition?.location === s.value.location ? s.value.expedition : undefined))
const lootCount = computed(() => expedition.value?.loot.reduce((n, l) => n + l.qty, 0) ?? 0)
const lootTitle = computed(() => expedition.value?.loot.map((l) => `${l.name}×${l.qty}`).join('、') ?? '')
const safe = computed(() => currentCell(s.value).kind === 'safe')
const atEntrance = computed(() => (area.value.layer ?? 0) === dungeonFirstLayer(area.value.location) && currentCell(s.value).kind === 'exit')
// 園區的魅氣：跨戰鬥保留的慾望
const parkLust = computed(() => (inPark(s.value) ? s.value.party.map((m) => ({ name: m.name, pct: Math.round((s.value.expedition?.lust?.[m.id] ?? 0) * 100) })) : []))
const busy = computed(() => !!s.value.combat || game.judging || !!s.value.standoff)
const night = computed(() => isNight(s.value.time))

function retreat() {
  const msg = safe.value ? '從安全房循原路撤出地下城？' : `撤出地下城？隊伍中靈巧最高的人帶路檢定（DC ${retreatDc(s.value, area.value)}），失敗會被魔物追上打一場。`
  if (confirm(msg)) game.retreat()
}
</script>

<template>
  <div v-if="show" class="exp small">
    <div class="row">
      <span :title="night ? '晚上' : '白天'"><GameIcon :name="lighting.icon" :size="13" /> {{ lighting.text }}</span>
      <template v-if="dark">
        <span v-if="light" class="ok" :title="light.permanent ? '不會燒掉' : '在黑暗的地方每走一格燒掉一點，燒完自動點下一份'">
          <GameIcon :name="light.permanent ? 'sparkles' : 'fire'" :size="13" /> {{ light.name }}<template v-if="light.left !== undefined">・還能照 {{ light.left }} 格</template><template v-if="!light.permanent">・備用 {{ spare }} 份</template>
        </span>
        <span v-else-if="spare" class="muted" title="在黑暗的地方走一步就會點起來"><GameIcon name="fire" :size="13" /> 走一步就點起光源（備用 {{ spare }} 份）</span>
        <span v-else class="warn" title="視野只剩腳下、戰鬥中命中降低、陷阱更難察覺"><GameIcon name="warning" :size="13" /> 沒有光源</span>
      </template>
    </div>
    <div v-if="expedition" class="row">
      <span :title="lootTitle || '還沒撿到東西'">
        <GameIcon name="backpack" :size="13" /> 這趟：最深到{{ DUNGEON_LAYERS[expedition.deepest]?.name }}・撿到 {{ lootCount }} 件<template v-if="expedition.money_cc">、{{ formatMoney(expedition.money_cc) }}</template>
      </span>
      <span class="muted" title="可以在設定的「這個存檔的規則」修改">（戰敗時：{{ DEFEAT_LOOT_NAME[defeatLootRule(s)] }}）</span>
      <span v-if="parkLust.length" class="lust" title="魅氣：在園區裡慾望跨戰鬥保留，每走一格慢慢增加；回到入口廣場就散了">
        <GameIcon name="heart" :size="13" /> 魅氣 {{ parkLust.map((x) => `${x.name} ${x.pct}%`).join('、') }}
      </span>
      <button v-if="!atEntrance" class="small" :disabled="busy" @click="retreat"><GameIcon name="door" :size="13" /> {{ safe ? '從安全房撤出' : '緊急撤退' }}</button>
    </div>
  </div>
</template>

<style scoped>
.exp { display: grid; gap: 4px; margin-top: 6px; }
.exp .row { gap: 8px; }
.ok { color: var(--accent); }
.exp :deep(.game-icon) { vertical-align: -2px; }
.warn { color: var(--danger); }
.lust { color: #e0508f; }
</style>
