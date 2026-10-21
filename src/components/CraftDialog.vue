<script setup lang="ts">
import { computed } from 'vue'
import { craftRules } from '@/engine/data'
import { CRAFT_IDS, crafters, skillOf, xpToNext } from '@/engine/crafting'
import { useGame } from '@/stores/game'
import CraftPanel from './CraftPanel.vue'

// 工藝：隊伍的五種工藝等級，以及自己動手打造（crafts.json，見 docs/CRAFTING.md）
const emit = defineEmits<{ close: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const who = computed(() => crafters(s.value))
</script>

<template>
  <div class="crafts">
    <table class="small">
      <thead>
        <tr><th></th><th v-for="c in CRAFT_IDS" :key="c">{{ craftRules.skills[c].name }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="w in who" :key="w.member.id" :class="{ off: !!w.refusal }">
          <th :title="w.refusal">{{ w.member.name }}<span v-if="w.refusal" class="muted">（{{ w.refusal }}）</span></th>
          <td v-for="c in CRAFT_IDS" :key="c">
            Lv.{{ skillOf(w.member, c).level }}
            <span v-if="xpToNext(skillOf(w.member, c).level)" class="muted">{{ skillOf(w.member, c).xp }}/{{ xpToNext(skillOf(w.member, c).level) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="small muted">
      等級 N 可以處理第 N 級以下的材料。工具：第 1～2 級材料用隨身工具組（任何地方）；第 3 級要工坊（在旅店、安全房展開攜帶式工坊，或在鐵匠鋪、裁縫店、珠寶店租用）；
      第 4～5 級要房子裡的工作台（之後的房屋系統）。夥伴要自願加入而且親密度 {{ craftRules.companion.min_affinity }} 以上、或是你的奴隸才肯幫忙。
    </p>
    <CraftPanel mode="make" @started="emit('close')" />
  </div>
</template>

<style scoped>
.crafts { display: grid; gap: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 3px 6px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
tr.off { opacity: 0.55; }
p { margin: 0; }
</style>
