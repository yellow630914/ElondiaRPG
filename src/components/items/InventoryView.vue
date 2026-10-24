<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { itemRules, type ItemCategory } from '@/engine/data'
import { canEquip, canUse, isIntelItem } from '@/engine/inventory'
import { formatMoney } from '@/engine/money'
import { itemValue } from '@/engine/trade'
import { useGame } from '@/stores/game'
import { CATEGORY_ORDER, categoryName, categoryOf, itemEffect, itemRarity, itemText } from './itemInfo'
import ItemIcon from './ItemIcon.vue'
import GameIcon from '../ui/GameIcon.vue'

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
// 搜尋與排序
const query = ref('')
const sort = ref<'category' | 'name' | 'value' | 'qty'>('category')
const value = (name: string) => itemValue(s.value, name)
const shown = computed(() => {
  const q = query.value.trim()
  const list = items.value.filter((i) => (filter.value === 'all' || categoryOf(s.value, i.name) === filter.value)
    && (!q || i.name.includes(q) || itemEffect(s.value, i.name).includes(q)))
  if (sort.value === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  if (sort.value === 'value') return [...list].sort((a, b) => (value(b.name) ?? 0) - (value(a.name) ?? 0))
  if (sort.value === 'qty') return [...list].sort((a, b) => b.qty - a.qty)
  return list
})
// 「全部」依類別分段，每段可以收合；材料預設收合（搜尋時全部展開）
const sections = computed(() => {
  if (filter.value !== 'all') return [{ id: filter.value, name: '', items: shown.value }]
  const out = CATEGORY_ORDER.map((c) => ({ id: c as ItemCategory | 'other', name: itemRules.categories[c], items: shown.value.filter((i) => categoryOf(s.value, i.name) === c) }))
  out.push({ id: 'other', name: '其他', items: shown.value.filter((i) => !categoryOf(s.value, i.name)) })
  return out.filter((x) => x.items.length)
})
const folded = reactive(new Set<string>(['material']))
const isFolded = (id: string) => filter.value === 'all' && !query.value.trim() && folded.has(id)
function fold(id: string) {
  if (folded.has(id)) folded.delete(id)
  else folded.add(id)
}
const expanded = ref<string | null>(null)
const target = reactive<Record<string, string>>({})
</script>

<template>
  <div class="inventory">
    <div class="row head">
      <span class="money"><GameIcon name="coins" :size="16" />{{ formatMoney(s.money_cc) }}</span>
      <span class="small muted">共 {{ items.length }} 種物品・全隊共用</span>
    </div>
    <nav class="row tabs">
      <button class="small" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 {{ items.length }}</button>
      <template v-for="c in CATEGORY_ORDER" :key="c">
        <button v-if="counts[c]" class="small" :class="{ active: filter === c }" @click="filter = c">
          <ItemIcon :category="c" :size="14" /> {{ itemRules.categories[c] }} {{ counts[c] }}
        </button>
      </template>
    </nav>
    <div class="row tools">
      <input v-model="query" class="grow" type="search" placeholder="搜尋名稱或效果" />
      <select v-model="sort" class="small" aria-label="排序">
        <option value="category">依類別</option>
        <option value="name">名稱</option>
        <option value="value">價值高到低</option>
        <option value="qty">數量多到少</option>
      </select>
    </div>
    <p v-if="!items.length" class="muted small">空空如也。</p>
    <p v-else-if="!shown.length" class="muted small">沒有符合的物品。</p>
    <section v-for="sec in sections" :key="sec.id" class="sec">
      <button v-if="sec.name" class="sec-head ghost" @click="fold(sec.id)">
        <GameIcon :name="isFolded(sec.id) ? 'right' : 'down'" :size="13" />
        <ItemIcon v-if="sec.id !== 'other'" :category="sec.id" :size="14" />{{ sec.name }}<span class="muted small">{{ sec.items.length }}</span>
      </button>
      <ul v-if="!isFolded(sec.id)" class="plain rows">
        <li v-for="i in sec.items" :key="i.name" class="item-row" :class="{ open: expanded === i.name }">
          <div class="line" @click="expanded = expanded === i.name ? null : i.name">
            <span class="item-tile" :class="`r-${itemRarity(s, i.name)}`"><ItemIcon :name="i.name" :size="22" /></span>
            <span class="what">
              <strong>{{ i.name }}</strong>
              <span class="small muted">{{ categoryName(s, i.name) }}</span>
              <span v-if="itemEffect(s, i.name)" class="small effect">{{ itemEffect(s, i.name) }}</span>
            </span>
            <span class="small muted val">{{ value(i.name) !== undefined ? `約 ${formatMoney(value(i.name)!)}` : '' }}</span>
            <span class="qty">×{{ i.qty }}</span>
            <span class="btns" @click.stop>
              <button v-if="isIntelItem(s, i.name)" class="small" :disabled="inCombat" title="記進冒險筆記（和向情報商買情報一樣），用掉這件情報" @click="game.readIntel(i.name)"><GameIcon name="search" :size="13" /> 解讀</button>
              <template v-else-if="canUse(i.name) || canEquip(s, i.name)">
                <select :value="target[i.name] ?? s.party[0]?.id" class="small" aria-label="對象" @change="target[i.name] = ($event.target as HTMLSelectElement).value">
                  <option v-for="m in s.party" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
                <button v-if="canUse(i.name)" class="small" :disabled="inCombat" @click="game.useItem(i.name, target[i.name] ?? s.party[0]!.id)">使用</button>
                <button v-if="canEquip(s, i.name)" class="small" :disabled="inCombat" @click="game.equipItem(i.name, target[i.name] ?? s.party[0]!.id)">裝備</button>
              </template>
            </span>
          </div>
          <div v-if="expanded === i.name" class="more small">
            <div v-if="itemEffect(s, i.name)" class="effect">{{ itemEffect(s, i.name) }}</div>
            <div v-if="itemText(s, i.name)" class="muted">{{ itemText(s, i.name) }}</div>
          </div>
        </li>
      </ul>
    </section>
    <p v-if="inCombat" class="small muted">戰鬥中只能從戰鬥畫面使用道具。</p>
  </div>
</template>

<style scoped>
.money { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.money :deep(.game-icon) { color: var(--accent); }
.inventory { display: grid; gap: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.head { justify-content: space-between; }
.tabs { gap: 4px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.tools { flex-wrap: nowrap; }
.grow { flex: 1; min-width: 0; }
.qty { font-weight: 600; color: var(--accent-2); text-align: right; white-space: nowrap; }
.effect { color: var(--accent); }
.sec { display: grid; gap: 4px; }
.sec-head { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; border: none; color: var(--accent-2); font-weight: 700; }
/* 一列一件：圖示、名稱、類別、效果摘要、估價、數量、動作；點一下展開描述 */
.rows { display: grid; margin: 0; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.item-row { padding: 0; border-bottom: 1px solid var(--border); }
.item-row:last-child { border-bottom: none; }
.item-row.open { background: #c99a4510; }
.item-row .line { display: grid; grid-template-columns: 30px minmax(0, 1fr) 6.5em 3em 13.5em; gap: 8px; align-items: center; min-height: 40px; padding: 3px 8px; cursor: pointer; }
.item-row .line:hover { background: #c99a450a; }
.what { display: flex; align-items: baseline; gap: 6px; min-width: 0; white-space: nowrap; overflow: hidden; }
.what strong { flex-shrink: 0; }
.what .effect { overflow: hidden; text-overflow: ellipsis; }
.val { text-align: right; white-space: nowrap; }
.btns { display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end; min-width: 0; }
.btns select { height: 28px; padding: 2px 6px; max-width: 9em; }
.item-row .more { display: grid; gap: 2px; padding: 0 10px 6px 46px; }
</style>
