<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/engine/money'
import { currentArea, currentCell, DUNGEON_LAYERS } from '@/engine/grid'
import { areaLighting, currentLight, isDark, isNight, lightSources } from '@/engine/light'
import { DEFEAT_LOOT_NAME, defeatLootRule, retreatDc } from '@/engine/expedition'
import { useGame } from '@/stores/game'

// 地圖下方的狀態列：光線與光源、地下城這趟探索撿到的東西、緊急撤退
const game = useGame()
const s = computed(() => game.state!)
const area = computed(() => currentArea(s.value))
const show = computed(() => area.value.kind !== 'settlement' && area.value.kind !== 'road')

const lighting = computed(() => {
  const l = areaLighting(area.value)
  const dark = isDark(s.value, area.value)
  if (l === 'lit') return { icon: '💡', text: '有光' }
  if (l === 'daylight') return dark ? { icon: '🌙', text: '夜裡一片漆黑' } : { icon: '☀️', text: '白天有光' }
  return { icon: '🌑', text: '黑暗' }
})
const dark = computed(() => isDark(s.value, area.value))
const light = computed(() => currentLight(s.value))
const spare = computed(() => lightSources(s.value).filter((x) => !x.permanent).reduce((n, x) => n + x.spare, 0))

const expedition = computed(() => (area.value.kind === 'dungeon' && s.value.expedition?.location === s.value.location ? s.value.expedition : undefined))
const lootCount = computed(() => expedition.value?.loot.reduce((n, l) => n + l.qty, 0) ?? 0)
const lootTitle = computed(() => expedition.value?.loot.map((l) => `${l.name}×${l.qty}`).join('、') ?? '')
const safe = computed(() => currentCell(s.value).kind === 'safe')
const atEntrance = computed(() => (area.value.layer ?? 0) === 0 && currentCell(s.value).kind === 'exit')
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
      <span :title="night ? '晚上' : '白天'">{{ lighting.icon }} {{ lighting.text }}</span>
      <template v-if="dark">
        <span v-if="light" class="ok" :title="light.permanent ? '不會燒掉' : '在黑暗的地方每走一格燒掉一點，燒完自動點下一份'">
          {{ light.permanent ? '✨' : '🔥' }} {{ light.name }}<template v-if="light.left !== undefined">・還能照 {{ light.left }} 格</template><template v-if="!light.permanent">・備用 {{ spare }} 份</template>
        </span>
        <span v-else-if="spare" class="muted" title="在黑暗的地方走一步就會點起來">🔥 走一步就點起光源（備用 {{ spare }} 份）</span>
        <span v-else class="warn" title="視野只剩腳下、戰鬥中命中降低、陷阱更難察覺">⚠️ 沒有光源</span>
      </template>
    </div>
    <div v-if="expedition" class="row">
      <span :title="lootTitle || '還沒撿到東西'">
        🎒 這趟：最深到{{ DUNGEON_LAYERS[expedition.deepest]?.name }}・撿到 {{ lootCount }} 件<template v-if="expedition.money_cc">、{{ formatMoney(expedition.money_cc) }}</template>
      </span>
      <span class="muted" title="可以在 ⚙️ 設定的「這個存檔的規則」修改">（戰敗時：{{ DEFEAT_LOOT_NAME[defeatLootRule(s)] }}）</span>
      <button v-if="!atEntrance" class="small" :disabled="busy" @click="retreat">🏃 {{ safe ? '從安全房撤出' : '緊急撤退' }}</button>
    </div>
  </div>
</template>

<style scoped>
.exp { display: grid; gap: 4px; margin-top: 6px; }
.exp .row { gap: 8px; }
.ok { color: var(--accent); }
.warn { color: var(--danger); }
</style>
