<script setup lang="ts">
import { computed } from 'vue'
import { slotsLeft } from '@/engine/character'
import { abilityDef, classEmoji, raceEmoji } from '@/engine/data'
import { useGame } from '@/stores/game'

// 主動行動時搭配使用的能力（例如用魅惑術幫談判）：法術花法術環、限次技能花次數，換檢定加值。
const model = defineModel<string>({ default: '' })
const game = useGame()

const options = computed(() => {
  const s = game.state
  if (!s) return []
  return s.party.filter((m) => m.hp > 0).flatMap((m) =>
    m.abilities.map((id) => {
      const a = abilityDef(id)
      let note = ''
      let ok = true
      if (a.type === 'spell') {
        const left = slotsLeft(m).slice((a.circle ?? 1) - 1).reduce((x, y) => x + y, 0)
        note = `${a.circle} 環法術・剩 ${left} 個可用法術環・+${Math.min(6, 2 + (a.circle ?? 1))}`
        ok = left > 0
      } else if (a.type === 'skill' && a.uses?.per_rest !== undefined) {
        const left = a.uses.per_rest - (m.usesPerRest[a.id] ?? 0)
        note = `每次休息 ${a.uses.per_rest} 次・剩 ${left}・+3`
        ok = left > 0
      } else note = a.type === 'cantrip' ? '戲法・+1' : '技能・+2'
      return { value: `${m.id}|${id}`, label: `${raceEmoji(m.race)}${m.name}${classEmoji(m.class)}：${a.name}（${note}）`, ok, title: a.desc }
    }),
  )
})
</script>

<template>
  <select v-model="model" class="ability-picker" title="搭配使用的能力會先花掉資源，再換取檢定加值">
    <option value="">✨ 不搭配能力</option>
    <option v-for="o in options" :key="o.value" :value="o.value" :disabled="!o.ok" :title="o.title">{{ o.label }}</option>
  </select>
</template>

<style scoped>
.ability-picker { max-width: 100%; }
</style>
