<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { itemRules, type ItemCategory } from '@/engine/data'
import { canEquip, canUse, isIntelItem } from '@/engine/inventory'
import { formatMoney } from '@/engine/money'
import { itemValue } from '@/engine/trade'
import { useGame } from '@/stores/game'
import { CATEGORY_ICON, CATEGORY_ORDER, categoryIcon, categoryName, categoryOf, itemEffect, itemText } from './itemInfo'

// 行囊：依類別篩選，使用、裝備（戰鬥以外）
const game = useGame()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)

const filter = ref<ItemCategory | 'all'>('all')
const items = computed(() => s.value.inventory.filter((i) => i.qty > 0))
const counts = computed(() => {
  const out: Partial<Record<ItemCategory, number>> = {}
  for (const i of items.value) {
    const c = categoryOf(s.value, i.name)
    if (c) out[c] = (out[c] ?? 0) + 1
  }
  return out
})
const shown = computed(() => items.value.filter((i) => filter.value === 'all' || categoryOf(s.value, i.name) === filter.value))
const target = reactive<Record<string, string>>({})
const value = (name: string) => itemValue(s.value, name)
</script>

<template>
  <div class="inventory">
    <div class="row head">
      <span>💰 {{ formatMoney(s.money_cc) }}</span>
      <span class="small muted">共 {{ items.length }} 種物品・全隊共用</span>
    </div>
    <nav class="row tabs">
      <button class="small" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 {{ items.length }}</button>
      <template v-for="c in CATEGORY_ORDER" :key="c">
        <button v-if="counts[c]" class="small" :class="{ active: filter === c }" @click="filter = c">
          {{ CATEGORY_ICON[c] }} {{ itemRules.categories[c] }} {{ counts[c] }}
        </button>
      </template>
    </nav>
    <p v-if="!items.length" class="muted small">空空如也。</p>
    <ul class="plain grid">
      <li v-for="i in shown" :key="i.name" class="item">
        <div class="row top">
          <span class="icon">{{ categoryIcon(s, i.name) }}</span>
          <strong class="grow">{{ i.name }}</strong>
          <span class="qty">×{{ i.qty }}</span>
        </div>
        <div class="small muted">{{ categoryName(s, i.name) }}<template v-if="value(i.name) !== undefined">・約 {{ formatMoney(value(i.name)!) }}</template></div>
        <div v-if="itemEffect(s, i.name)" class="small effect">{{ itemEffect(s, i.name) }}</div>
        <div v-if="itemText(s, i.name)" class="small muted">{{ itemText(s, i.name) }}</div>
        <div v-if="isIntelItem(s, i.name)" class="row actions">
          <button class="small" :disabled="inCombat" title="記進冒險筆記（和向情報商買情報一樣），用掉這件情報" @click="game.readIntel(i.name)">🔍 解讀</button>
        </div>
        <div v-else-if="canUse(i.name) || canEquip(s, i.name)" class="row actions">
          <select :value="target[i.name] ?? s.party[0]?.id" class="small" @change="target[i.name] = ($event.target as HTMLSelectElement).value">
            <option v-for="m in s.party" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <button v-if="canUse(i.name)" class="small" :disabled="inCombat" @click="game.useItem(i.name, target[i.name] ?? s.party[0]!.id)">使用</button>
          <button v-if="canEquip(s, i.name)" class="small" :disabled="inCombat" @click="game.equipItem(i.name, target[i.name] ?? s.party[0]!.id)">裝備</button>
        </div>
      </li>
    </ul>
    <p v-if="inCombat" class="small muted">戰鬥中只能從戰鬥畫面使用道具。</p>
  </div>
</template>

<style scoped>
.inventory { display: grid; gap: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.head { justify-content: space-between; }
.tabs { gap: 4px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; margin: 0; }
.item { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 3px; align-content: start; background: var(--panel); }
.top { flex-wrap: nowrap; }
.icon { font-size: 1.2rem; }
.grow { flex: 1; min-width: 0; }
.qty { font-weight: 600; color: var(--accent-2); }
.effect { color: var(--accent); }
.actions { margin-top: 4px; }
</style>
