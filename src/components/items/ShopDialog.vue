<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { itemRules, shopRules, type ItemCategory, type ShopType } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { costText, dealMoney, discount, effectText, isItemDeal, keeperTitle, sellPrice, shopKey } from '@/engine/trade'
import type { Deal, Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import NameTag from '../NameTag.vue'
import { CATEGORY_ICON, CATEGORY_ORDER, categoryIcon, categoryName, categoryOf, itemEffect, itemText } from './itemInfo'

// 商店的交易視窗：左邊是店裡的商品，右邊是行囊（可以賣的標出收購價）
const props = defineProps<{ type: ShopType; loading?: boolean }>()
const game = useGame()
const s = computed(() => game.state!)
const key = computed(() => shopKey(s.value, props.type))
const shop = computed(() => {
  const cur = s.value.shops?.[key.value]
  return cur && cur.day === s.value.time.day ? cur : undefined
})
const keeper = computed(() => (shop.value ? npcRecord(s.value, shop.value.keeper) : undefined))
const off = computed(() => Math.round(discount(s.value, key.value) * 100))
const busy = computed(() => game.judging)
/** 最近一次交易的結果（顯示在視窗上方） */
const last = ref('')

// ---- 商品 ----
type Group = ItemCategory | 'special'
const itemName = (d: Deal) => d.id.slice('item:'.length)
const groupOf = (d: Deal): Group => (isItemDeal(d) ? categoryOf(s.value, itemName(d)) ?? 'special' : 'special')
const deals = computed(() => shop.value?.deals.filter((d) => d.stock > 0) ?? [])
const groups = computed(() => {
  const set = new Set(deals.value.map(groupOf))
  return [...CATEGORY_ORDER.filter((c) => set.has(c)), ...(set.has('special') ? ['special' as const] : [])]
})
const filter = ref<Group | 'all'>('all')
const shownDeals = computed(() => deals.value.filter((d) => filter.value === 'all' || groupOf(d) === filter.value))
const groupName = (g: Group) => (g === 'special' ? '✨ 特別交易' : `${CATEGORY_ICON[g]} ${itemRules.categories[g]}`)

const buyQty = reactive<Record<string, number>>({})
const qtyOf = (d: Deal) => Math.max(1, Math.min(d.stock, Math.floor(buyQty[d.id] ?? 1) || 1))
const price = (d: Deal) => dealMoney(s.value, key.value, d)
function affordable(d: Deal, n = 1): boolean {
  if (s.value.money_cc < price(d) * n) return false
  return d.gives.every((g) => g.type !== 'item' || (s.value.inventory.find((i) => i.name === g.name)?.qty ?? 0) >= (g.qty ?? 1) * n)
}

// ---- 交涉 ----
const haggling = ref<string | null>(null)
const haggleText = reactive<Record<string, string>>({})
async function bargain(d: Deal) {
  haggling.value = null
  const before = s.value.reports.length
  last.value = '交涉中…'
  await game.bargain(props.type, d.id, haggleText[d.id] ?? '')
  const r = s.value.reports.length > before ? s.value.reports[s.value.reports.length - 1] : undefined
  last.value = r?.outcome.summary ?? ''
}

// ---- 行囊 ----
const buysText = computed(() => shopRules.types[props.type].buys.map((c) => itemRules.categories[c]).join('、'))
const onlySellable = ref(true)
const bag = computed(() => s.value.inventory
  .filter((i) => i.qty > 0)
  .map((i) => ({ ...i, price: sellPrice(s.value, key.value, i.name) }))
  .filter((i) => !onlySellable.value || i.price !== null)
  .sort((a, b) => Number(b.price !== null) - Number(a.price !== null)))
const sellQty = reactive<Record<string, number>>({})
const sellN = (name: string, have: number) => Math.max(1, Math.min(have, Math.floor(sellQty[name] ?? 1) || 1))

// ---- 結果 ----
function done(r: Report | undefined) {
  if (r) last.value = r.outcome.summary ?? ''
}
function buy(d: Deal) {
  done(game.buyDeal(props.type, d.id, isItemDeal(d) ? qtyOf(d) : 1))
  buyQty[d.id] = 1
}
function sell(name: string, have: number) {
  done(game.sellItem(props.type, name, sellN(name, have)))
  sellQty[name] = 1
}
</script>

<template>
  <div class="shop-dialog">
    <div class="shop-bar">
      <div class="small">
        <template v-if="keeper">{{ keeperTitle(type) }}：<NameTag :id="keeper.id" /><span class="muted">・{{ keeper.personality }}</span></template>
        <span v-if="off" class="tag ok">折扣 {{ off }}%</span>
        <span v-if="loading" class="muted">・AI 正在準備今天的商品…</span>
        <span v-else-if="shop?.source === 'ai'" class="muted">・今天有 AI 準備的特別商品</span>
      </div>
      <strong class="money">💰 {{ formatMoney(s.money_cc) }}</strong>
    </div>
    <p v-if="game.error" class="error small">⚠️ {{ game.error }}</p>
    <p v-else-if="last" class="last small">✔ {{ last }}</p>

    <div class="cols">
      <!-- 店裡的商品 -->
      <section class="col">
        <h3>🏪 店裡的商品</h3>
        <nav class="row chips">
          <button class="small" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 {{ deals.length }}</button>
          <button v-for="g in groups" :key="g" class="small" :class="{ active: filter === g }" @click="filter = g">{{ groupName(g) }}</button>
        </nav>
        <p v-if="!deals.length" class="small muted">今天沒有東西可以買了。</p>
        <ul class="plain list">
          <li v-for="d in shownDeals" :key="d.id" class="entry">
            <div class="row top">
              <span class="icon">{{ isItemDeal(d) ? categoryIcon(s, itemName(d)) : '✨' }}</span>
              <strong class="grow">{{ d.title }}</strong>
              <span class="price">{{ costText(s, key, d) }}</span>
            </div>
            <div v-if="isItemDeal(d)" class="small">
              <span class="muted">{{ categoryName(s, itemName(d)) }}</span>
              <span v-if="itemEffect(s, itemName(d))" class="effect">・{{ itemEffect(s, itemName(d)) }}</span>
            </div>
            <div v-else class="small effect">得到：{{ d.gets.map((g) => effectText(s, g, shop?.keeper)).join('、') }}</div>
            <div v-if="d.desc || (isItemDeal(d) && itemText(s, itemName(d)))" class="small muted">{{ d.desc ?? itemText(s, itemName(d)) }}</div>
            <div class="row actions">
              <span v-if="d.stock < 20" class="small muted">剩 {{ d.stock }}</span>
              <span class="grow" />
              <input v-if="isItemDeal(d) && d.stock > 1" v-model.number="buyQty[d.id]" class="num" type="number" min="1" :max="d.stock" placeholder="1" />
              <button class="small primary" :disabled="busy || !affordable(d, isItemDeal(d) ? qtyOf(d) : 1)" @click="buy(d)">
                {{ isItemDeal(d) && qtyOf(d) > 1 ? `買 ${qtyOf(d)} 個（${formatMoney(price(d) * qtyOf(d))}）` : '買下' }}
              </button>
              <button
                v-if="price(d) > 0" class="small" :disabled="d.haggled || busy"
                @click="haggling = haggling === d.id ? null : d.id"
              >{{ d.haggled ? '已交涉過' : '交涉' }}</button>
            </div>
            <div v-if="haggling === d.id" class="row">
              <input v-model="haggleText[d.id]" class="grow" placeholder="怎麼交涉？例如：挑出瑕疵、搬出熟人、請店主喝一杯" />
              <button class="small" :disabled="busy" @click="bargain(d)">交涉（檢定）</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 行囊 -->
      <section class="col">
        <h3>🎒 你的行囊</h3>
        <div class="row small">
          <span class="muted">這間店收：{{ buysText || '不收東西' }}</span>
          <span class="grow" />
          <label class="check"><input v-model="onlySellable" type="checkbox" /> 只顯示能賣的</label>
        </div>
        <p v-if="!bag.length" class="small muted">{{ onlySellable ? '沒有這間店收的東西。' : '行囊是空的。' }}</p>
        <ul class="plain list">
          <li v-for="i in bag" :key="i.name" class="entry" :class="{ dim: i.price === null }">
            <div class="row top">
              <span class="icon">{{ categoryIcon(s, i.name) }}</span>
              <strong class="grow">{{ i.name }}</strong>
              <span class="qty">×{{ i.qty }}</span>
            </div>
            <div class="small">
              <span class="muted">{{ categoryName(s, i.name) }}</span>
              <span v-if="itemEffect(s, i.name)" class="effect">・{{ itemEffect(s, i.name) }}</span>
            </div>
            <div class="row actions">
              <template v-if="i.price !== null">
                <span class="small">收購 {{ formatMoney(i.price) }} / 個</span>
                <span class="grow" />
                <input v-if="i.qty > 1" v-model.number="sellQty[i.name]" class="num" type="number" min="1" :max="i.qty" placeholder="1" />
                <button class="small" :disabled="busy" @click="sell(i.name, i.qty)">
                  賣 {{ sellN(i.name, i.qty) > 1 ? `${sellN(i.name, i.qty)} 個（${formatMoney(i.price * sellN(i.name, i.qty))}）` : `（${formatMoney(i.price)}）` }}
                </button>
              </template>
              <span v-else class="small muted">這間店不收</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shop-dialog { display: grid; gap: 10px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.shop-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; }
.money { color: var(--accent-2); }
.tag.ok { border-color: var(--accent); color: var(--accent); margin-left: 6px; }
.error { color: var(--danger); margin: 0; }
.last { color: var(--accent); margin: 0; }
.cols { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; align-items: start; }
@media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
.col { display: grid; gap: 6px; align-content: start; min-width: 0; }
.col h3 { margin: 0; color: var(--accent-2); }
.chips { gap: 4px; }
.chips button.active { border-color: var(--accent); color: var(--accent); }
.list { display: grid; gap: 6px; margin: 0; max-height: calc(100vh - 350px); overflow-y: auto; padding-right: 2px; align-content: start; }
.entry { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; display: grid; gap: 2px; background: var(--panel); }
.entry.dim { opacity: 0.55; }
.top { flex-wrap: nowrap; }
.icon { font-size: 1.15rem; }
.grow { flex: 1; min-width: 0; }
.price { font-weight: 600; white-space: nowrap; }
.qty { font-weight: 600; color: var(--accent-2); }
.effect { color: var(--accent); }
.actions { margin-top: 2px; }
.num { width: 58px; }
</style>
