<script setup lang="ts">
import { computed, ref } from 'vue'
import { craftRules } from '@/engine/data'
import { CRAFT_IDS, crafters, rentShopName, skillOf, xpToNext } from '@/engine/crafting'
import { useGame } from '@/stores/game'
import CraftPanel from './CraftPanel.vue'
import RecipePanel from './RecipePanel.vue'
import InventPanel from './InventPanel.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 工藝：隊伍的七種工藝等級，自己動手打造裝備，以及依配方製作（crafts.json，見 docs/CRAFTING.md）
const emit = defineEmits<{ close: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const who = computed(() => crafters(s.value))
const tab = ref<'gear' | 'recipe' | 'invent'>('recipe')
// 租工坊的店：同一家店的工藝放在一起（鍛造、木工：鐵匠鋪……）
const rentShops = computed(() => {
  const by = new Map<string, string[]>()
  for (const c of CRAFT_IDS) by.set(rentShopName(c), [...(by.get(rentShopName(c)) ?? []), craftRules.skills[c].name])
  return [...by].map(([shop, names]) => `${names.join('、')}：${shop}`).join('；')
})
</script>

<template>
  <div class="crafts">
    <div class="table">
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
    </div>
    <div class="tabs">
      <button :class="{ active: tab === 'recipe' }" class="small" @click="tab = 'recipe'"><GameIcon name="scroll" :size="13" /> 依配方製作</button>
      <button :class="{ active: tab === 'invent' }" class="small" @click="tab = 'invent'"><GameIcon name="lightbulb" :size="13" /> 自創配方</button>
      <button :class="{ active: tab === 'gear' }" class="small" @click="tab = 'gear'"><GameIcon name="tools" :size="13" /> 打造裝備</button>
      <Hint :text="`工具：第 1～2 級用隨身工具組（任何地方）；第 3 級要工坊：在旅店、安全房、自己的房子展開攜帶式工坊，或站到地圖上對應的店的格子再打開工藝，就會租用店裡的工坊（每小時 ${craftRules.workshop_rent.per_hour_cc} 白鸛，自己的工具夠用時不租）。\n租工坊的店：${rentShops}。\n第 4～5 級要自己房子裡的工作台。\n夥伴要自願加入而且親密度 ${craftRules.companion.min_affinity} 以上、或是你的奴隸才肯幫忙；在自己的房子裡，留守的夥伴也能幫忙。`" />
    </div>
    <RecipePanel v-if="tab === 'recipe'" @started="emit('close')" />
    <InventPanel v-else-if="tab === 'invent'" @started="emit('close')" />
    <template v-else>
      <p class="small muted">等級 N 可以處理第 N 級以下的裝備材料（鍛造、木工、製革、裁縫、珠寶）。</p>
      <CraftPanel mode="make" @started="emit('close')" />
    </template>
  </div>
</template>

<style scoped>
.crafts { display: grid; gap: 8px; }
.table { overflow-x: auto; min-width: 0; }
table { border-collapse: collapse; width: 100%; }
.tabs { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.tabs .active { border-color: var(--accent); color: var(--accent); }
th, td { padding: 3px 6px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
tr.off { opacity: 0.55; }
p { margin: 0; }
</style>
