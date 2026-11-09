<script setup lang="ts">
import { computed } from 'vue'
import { pctText, tradeCategoryName, townStates, townTags } from '@/engine/market'
import type { TradeTagDef } from '@/engine/market'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 地圖標題旁的城市行情標籤（獵場、邊境…與今天的動態狀態）：只寫名字，
// 滑過或點一下看效果（手機點一下，再點一下或點別處收起）。城門那份完整的行情照舊。
// 顏色看效果方向：全都變便宜＝綠、全都變貴＝紅、有漲有跌＝金；動態狀態是虛線框。
const props = defineProps<{ location: string }>()
const game = useGame()

function tone(def: Pick<TradeTagDef, 'mult'>): 'cheap' | 'dear' | 'mixed' {
  const xs = Object.values(def.mult) as number[]
  if (xs.every((x) => x < 1)) return 'cheap'
  if (xs.every((x) => x > 1)) return 'dear'
  return 'mixed'
}
function lines(def: Pick<TradeTagDef, 'mult'>): string[] {
  return Object.entries(def.mult).map(([c, x]) => `${tradeCategoryName(c)} ${pctText(x as number)}`)
}
const chips = computed(() => {
  const day = game.state?.time.day ?? 0
  const tags = townTags(props.location).map((t) => ({ key: t.id, name: t.def.name, desc: t.def.desc, effects: lines(t.def), tone: tone(t.def), state: false, left: 0 }))
  const states = (game.state ? townStates(game.state, props.location) : []).map((x) => ({ key: x.id, name: x.def.name, desc: x.def.desc, effects: lines(x.def), tone: tone(x.def), state: true, left: x.end - day }))
  return [...tags, ...states].map((c) => ({ ...c, text: `${c.state ? `（還有 ${c.left} 天）` : ''}\n${c.desc ? `${c.desc}\n` : ''}行情：${c.effects.join('、')}` }))
})
</script>

<template>
  <Hint v-for="c in chips" :key="c.key" :width="240" class="town-tag-hint">
    <template #trigger>
      <span class="tag town-tag" :class="[c.tone, { state: c.state }]" :data-tag="c.key"><GameIcon v-if="c.state" name="warning" :size="11" />{{ c.name }}</span>
    </template>
    <b>{{ c.name }}</b>{{ c.text }}
  </Hint>
</template>

<style scoped>
/* Hint 本身是圓形的「?」：當標籤用時拿掉圓角、改成一般游標 */
.town-tag-hint { border-radius: 2px; cursor: help; vertical-align: baseline; margin: 2px 0 2px 5px; }
.town-tag { gap: 2px; }
.town-tag.cheap { color: var(--good); border-color: color-mix(in srgb, var(--good) 55%, transparent); }
.town-tag.dear { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
.town-tag.mixed { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.town-tag.state { border-style: dashed; }
.town-tag-hint:hover .town-tag, .town-tag-hint:focus-visible .town-tag { filter: brightness(1.2); }
</style>
