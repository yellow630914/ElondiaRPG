<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { itemRules, shopDef, type ItemCategory, type ShopType } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { breakdownText, buyBreakdown, CART_CHANGE_WARNING as CHANGE_WARNING, cartBargainHeld, cartFromRecords, costText, dealMoney, discount, effectText, glutMult, isItemDeal, isUniqueItem, keeperTitle, sellBreakdown, sellPrice, shopKey, shopPlace } from '@/engine/trade'
import { pctText, tradeCategory } from '@/engine/market'
import { materialGroup, materialGroupName, materialGroupOrder, materialRecipesFull, materialTier } from '@/engine/materialInfo'
import type { Deal, Report } from '@/engine/types'
import { useGame } from '@/stores/game'
import NameTag from '../NameTag.vue'
import { CATEGORY_ORDER, categoryName, categoryOf, itemEffect, itemRarity, itemText } from './itemInfo'
import ItemIcon from './ItemIcon.vue'
import GameIcon from '../ui/GameIcon.vue'
import SwipeTabs from '../mobile/SwipeTabs.vue'
import { isMobile } from '../mobile/mobile'
import ContentTagChips from '../ContentTagChips.vue'
import { storyDef, storyMaxCost } from '@/engine/story'
import CartPanel from './CartPanel.vue'
import MarketBadge from './MarketBadge.vue'
import MarketTags from './MarketTags.vue'
import PriceSteps from './PriceSteps.vue'
import { vMarquee } from '../marquee'

// 商店的交易視窗：左邊是店裡的商品，右邊是行囊（可以賣的標出收購價），下面是購物車（一般商品與賣出一次結帳，CartPanel）。
// 特別交易（AI 準備的、情報、服務）照舊一件一件買、一件一件交涉
const props = defineProps<{ type: ShopType; loading?: boolean }>()
const game = useGame()
const s = computed(() => game.state!)
// 購物車：買入（交易 id → 數量）、賣出（物品名稱 → 數量）
const cart = reactive<{ buy: Record<string, number>; sell: Record<string, number> }>({ buy: {}, sell: {} })
const cartCount = computed(() => Object.values(cart.buy).reduce((a, b) => a + b, 0) + Object.values(cart.sell).reduce((a, b) => a + b, 0))
// 手機版的分頁：店裡的商品｜你的行囊｜購物車（電腦版購物車放在兩欄下面）
const SIDES = computed(() => [
  { id: 'buy', label: '店裡的商品' }, { id: 'sell', label: '你的行囊' },
  ...(isMobile.value ? [{ id: 'cart', label: `購物車${cartCount.value ? ` ${cartCount.value}` : ''}` }] : []),
])
const side = ref('buy')
const key = computed(() => shopKey(s.value, props.type))
const shop = computed(() => {
  const cur = s.value.shops?.[key.value]
  return cur && cur.day === s.value.time.day ? cur : undefined
})
const keeper = computed(() => (shop.value ? npcRecord(s.value, shop.value.keeper) : undefined))
const off = computed(() => Math.round(discount(s.value, key.value) * 100))
const busy = computed(() => game.judging)
const place = computed(() => shopPlace(s.value))
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
// 搜尋與排序
const query = ref('')
const sort = ref<'default' | 'cheap' | 'dear' | 'name'>('default')
const shownDeals = computed(() => {
  const q = query.value.trim()
  const list = deals.value.filter((d) => (filter.value === 'all' || groupOf(d) === filter.value)
    && (!q || d.title.includes(q) || (isItemDeal(d) && (itemEffect(s.value, itemName(d)) ?? '').includes(q))))
  if (sort.value === 'cheap') return [...list].sort((a, b) => price(a) - price(b))
  if (sort.value === 'dear') return [...list].sort((a, b) => price(b) - price(a))
  if (sort.value === 'name') return [...list].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
  return list
})
// 特別交易內容多，維持卡片；一般商品一列一件，點一下展開
const specialDeals = computed(() => shownDeals.value.filter((d) => !isItemDeal(d)))
/** 情報商賣的特殊任務消息：任務的內容標籤、途中最多一次要付的錢（買之前就知道） */
function dealStory(d: Deal) {
  const g = d.gets.find((x) => x.type === 'start_story')
  return g?.type === 'start_story' ? storyDef(g.story) : undefined
}
const itemDeals = computed(() => shownDeals.value.filter(isItemDeal))
// 特別交易預設收起（只看到標題列與筆數）；篩選「特別交易」或搜尋時展開
const specialsOpen = ref(false)
const specialsFolded = computed(() => filter.value === 'all' && !query.value.trim() && !specialsOpen.value)
const expanded = ref<string | null>(null)
const toggle = (id: string) => { expanded.value = expanded.value === id ? null : id }
const groupName = (g: Group) => (g === 'special' ? '特別交易' : itemRules.categories[g])

const buyQty = reactive<Record<string, number>>({})
/** 還沒放進購物車的存貨 */
const leftOf = (d: Deal) => d.stock - (cart.buy[d.id] ?? 0)
const qtyOf = (d: Deal) => Math.max(1, Math.min(leftOf(d), Math.floor(buyQty[d.id] ?? 1) || 1))
/** 談好價之後要改購物車：先提醒（改了就照原價交易） */
const okToChange = () => !cartBargainHeld(s.value, props.type, cartFromRecords(cart)) || confirm(CHANGE_WARNING)
function addBuy(d: Deal, all = false) {
  if (leftOf(d) <= 0 || !okToChange()) return
  cart.buy[d.id] = (cart.buy[d.id] ?? 0) + (all ? leftOf(d) : qtyOf(d))
  buyQty[d.id] = 1
}
/** 從購物車拿掉（數量照輸入框，最多拿到 0） */
function removeBuy(d: Deal) {
  const inCart = cart.buy[d.id] ?? 0
  if (inCart <= 0 || !okToChange()) return
  const n = Math.min(inCart, Math.max(1, Math.floor(buyQty[d.id] ?? 1) || 1))
  if (inCart - n > 0) cart.buy[d.id] = inCart - n
  else delete cart.buy[d.id]
}
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
const buysText = computed(() => shopDef(props.type).buys.map((c) => itemRules.categories[c]).join('、'))
const onlySellable = ref(true)
// 行囊的篩選：類別與搜尋（和店裡的商品一樣）
const bagFilter = ref<ItemCategory | 'other' | 'all'>('all')
const bagQuery = ref('')
const bagCat = (name: string): ItemCategory | 'other' => categoryOf(s.value, name) ?? 'other'
const bagAll = computed(() => s.value.inventory
  .filter((i) => i.qty > 0)
  .map((i) => ({ ...i, price: sellPrice(s.value, key.value, i.name) }))
  .filter((i) => !onlySellable.value || i.price !== null))
const bagCats = computed(() => {
  const set = new Set(bagAll.value.map((i) => bagCat(i.name)))
  return [...CATEGORY_ORDER.filter((c) => set.has(c)), ...(set.has('other') ? ['other' as const] : [])]
})
const bag = computed(() => bagAll.value
  .filter((i) => (bagFilter.value === 'all' || bagCat(i.name) === bagFilter.value)
    && (!bagQuery.value.trim() || i.name.includes(bagQuery.value.trim()) || (itemEffect(s.value, i.name) ?? '').includes(bagQuery.value.trim())))
  .sort((a, b) => Number(b.price !== null) - Number(a.price !== null)))
// 行囊依類別分段，材料再依小類（和行囊頁一樣，materialInfo.ts）；同一段裡能賣的在前、等級高的在前
const bagGroups = computed(() => {
  const groupOf = (name: string) => {
    const c = categoryOf(s.value, name)
    if (c === 'material') {
      const g = materialGroup(s.value, name)
      return { id: `material:${g}`, order: CATEGORY_ORDER.indexOf('material') + (materialGroupOrder().indexOf(g) + 1) / 100, name: `${itemRules.categories.material}・${materialGroupName(g)}` }
    }
    return c ? { id: c, order: CATEGORY_ORDER.indexOf(c), name: itemRules.categories[c] } : { id: 'other', order: 99, name: '其他' }
  }
  const groups = new Map<string, { id: string; order: number; name: string; items: typeof bag.value }>()
  for (const i of bag.value) {
    const g = groupOf(i.name)
    if (!groups.has(g.id)) groups.set(g.id, { ...g, items: [] })
    groups.get(g.id)!.items.push(i)
  }
  const tier = (name: string) => materialTier(s.value, name)?.tier ?? 0
  return [...groups.values()].sort((a, b) => a.order - b.order).map((g) => ({
    ...g, items: [...g.items].sort((a, b) => Number(b.price !== null) - Number(a.price !== null) || tier(b.name) - tier(a.name)),
  }))
})
const sellQty = reactive<Record<string, number>>({})
/** 收購遞減：這間店最近收了很多這一類時，收購價旁邊寫出降了多少 */
const glutText = (name: string) => { const g = glutMult(s.value, key.value, tradeCategory(s.value, name)); return g < 1 ? `收多了 ${pctText(g)}` : '' }
/** 展開了收購價拆解的物品 */
const sellWhy = ref<string | null>(null)
const buyWhy = (d: Deal) => buyBreakdown(s.value, key.value, d)
const buyWhyText = (d: Deal) => { const b = buyWhy(d); return b ? `${breakdownText(b)}\n（點一下展開）` : undefined }
const sellLeft = (name: string, have: number) => have - (cart.sell[name] ?? 0)
const sellN = (name: string, have: number) => Math.max(1, Math.min(sellLeft(name, have), Math.floor(sellQty[name] ?? 1) || 1))
function addSell(name: string, have: number, all = false) {
  if (sellLeft(name, have) <= 0 || !okToChange()) return
  cart.sell[name] = (cart.sell[name] ?? 0) + (all ? sellLeft(name, have) : sellN(name, have))
  sellQty[name] = 1
}
function removeSell(name: string) {
  const inCart = cart.sell[name] ?? 0
  if (inCart <= 0 || !okToChange()) return
  const n = Math.min(inCart, Math.max(1, Math.floor(sellQty[name] ?? 1) || 1))
  if (inCart - n > 0) cart.sell[name] = inCart - n
  else delete cart.sell[name]
}

// ---- 結果 ----
function done(r: Report | undefined) {
  if (r) last.value = r.outcome.summary ?? ''
}
function buy(d: Deal) {
  done(game.buyDeal(props.type, d.id, isItemDeal(d) ? qtyOf(d) : 1))
  buyQty[d.id] = 1
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
      <strong class="money"><GameIcon name="coins" :size="16" />{{ formatMoney(s.money_cc) }}</strong>
    </div>
    <MarketTags :location="place.id" :name="place.name" />
    <p v-if="game.error" class="error small"><GameIcon name="warning" :size="13" /> {{ game.error }}</p>
    <p v-else-if="last" class="last small"><GameIcon name="check" :size="13" /> {{ last }}</p>

    <!-- 電腦版左右兩欄；手機版變成「店裡的商品｜你的行囊」兩個分頁，可以左右滑 -->
    <SwipeTabs v-model="side" :tabs="SIDES" :swipe="isMobile" :bar="isMobile" all class="cols">
      <template #default="{ id }">
        <template v-if="id === 'buy'">
          <!-- 店裡的商品 -->
          <section class="col">
            <h3 class="head"><GameIcon name="store" :size="17" />店裡的商品</h3>
            <nav class="row chips">
              <button class="small" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 {{ deals.length }}</button>
              <button v-for="g in groups" :key="g" class="small" :class="{ active: filter === g }" @click="filter = g">
                <GameIcon v-if="g === 'special'" name="sparkles" :size="14" /><ItemIcon v-else :category="g" :size="14" /> {{ groupName(g) }}
              </button>
            </nav>
            <div class="row tools">
              <input v-model="query" class="grow search" type="search" placeholder="搜尋名稱或效果" />
              <select v-model="sort" class="small" aria-label="排序">
                <option value="default">預設排序</option>
                <option value="cheap">價格低到高</option>
                <option value="dear">價格高到低</option>
                <option value="name">名稱</option>
              </select>
            </div>
            <p v-if="!deals.length" class="small muted">今天沒有東西可以買了。</p>
            <p v-else-if="!shownDeals.length" class="small muted">沒有符合的商品。</p>
            <div class="list">
              <button v-if="specialDeals.length && filter === 'all' && !query.trim()" class="group-head small ghost" :aria-expanded="!specialsFolded" @click="specialsOpen = !specialsOpen">
                <GameIcon :name="specialsFolded ? 'right' : 'down'" :size="13" /><GameIcon name="sparkles" :size="13" />特別交易<span class="muted">{{ specialDeals.length }}</span>
              </button>
              <ul v-if="specialDeals.length && !specialsFolded" class="plain rows specials">
                <li v-for="d in specialDeals" :key="d.id" class="item-row" :class="{ open: expanded === d.id }">
                  <div class="line special-line" @click="toggle(d.id)">
                    <span class="item-tile special"><GameIcon name="sparkles" :size="18" /></span>
                    <span v-marquee class="what marquee"><span class="what-in">
                      <strong>{{ d.title }}</strong>
                      <ContentTagChips v-if="dealStory(d)" :tags="dealStory(d)!.tags" />
                      <span class="small effect">{{ d.gets.map((g) => effectText(s, g, shop?.keeper)).join('、') }}</span>
                    </span></span>
                    <span class="price">{{ costText(s, key, d) }}</span>
                    <span class="stock small muted">{{ d.stock < 20 ? `剩 ${d.stock}` : '' }}</span>
                    <span class="btns" @click.stop>
                      <button class="small primary" :disabled="busy || !affordable(d)" @click="buy(d)">買下</button>
                      <button v-if="price(d) > 0" class="small" :disabled="d.haggled || busy" @click="haggling = haggling === d.id ? null : d.id">{{ d.haggled ? '已交涉' : '交涉' }}</button>
                    </span>
                  </div>
                  <div v-if="expanded === d.id" class="more small">
                    <div class="effect">得到：{{ d.gets.map((g) => effectText(s, g, shop?.keeper)).join('、') }}</div>
                    <div v-if="d.desc" class="muted">{{ d.desc }}</div>
                    <div v-if="dealStory(d) && storyMaxCost(dealStory(d)!)" class="muted">任務途中有要付錢的地方（一次最多 {{ formatMoney(storyMaxCost(dealStory(d)!)) }}），錢不夠時那一步不能選</div>
                  </div>
                  <div v-if="haggling === d.id" class="row haggle">
                    <input v-model="haggleText[d.id]" class="grow" placeholder="怎麼交涉？例如：挑出瑕疵、搬出熟人、請店主喝一杯" />
                    <button class="small" :disabled="busy" @click="bargain(d)">交涉（檢定）</button>
                  </div>
                </li>
              </ul>
              <ul v-if="itemDeals.length" class="plain rows">
                <li v-for="d in itemDeals" :key="d.id" class="item-row" :class="{ open: expanded === d.id }">
                  <div class="line" @click="toggle(d.id)">
                    <span class="item-tile" :class="`r-${itemRarity(s, itemName(d))}`"><ItemIcon :name="itemName(d)" :size="22" /></span>
                    <span v-marquee class="what marquee"><span class="what-in">
                      <strong>{{ d.title }}</strong>
                      <span class="small muted">{{ categoryName(s, itemName(d)) }}</span>
                      <MarketBadge :name="itemName(d)" />
                      <span v-if="itemEffect(s, itemName(d))" class="small effect">{{ itemEffect(s, itemName(d)) }}</span>
                    </span></span>
                    <span class="price" :title="buyWhyText(d)">{{ costText(s, key, d) }}</span>
                    <span class="stock small muted">{{ d.stock < 20 ? `剩 ${leftOf(d)}` : '' }}</span>
                    <span class="incart small" :title="cart.buy[d.id] ? `購物車裡有 ${cart.buy[d.id]} 個` : undefined"><template v-if="cart.buy[d.id]"><GameIcon name="cart" :size="13" />{{ cart.buy[d.id] }}</template></span>
                    <span class="btns" @click.stop>
                      <input v-model.number="buyQty[d.id]" class="num" type="number" min="1" :max="Math.max(1, leftOf(d), cart.buy[d.id] ?? 0)" placeholder="1" :disabled="d.stock <= 1" aria-label="數量" />
                      <span class="stepper">
                        <button class="small" :disabled="!cart.buy[d.id]" title="從購物車拿掉" aria-label="從購物車拿掉" @click="removeBuy(d)"><GameIcon name="minus" :size="14" /></button>
                        <button class="small" :disabled="leftOf(d) <= 0" title="加進購物車" aria-label="加進購物車" @click="addBuy(d)"><GameIcon name="plus" :size="14" /></button>
                      </span>
                      <button class="small all" :disabled="leftOf(d) <= 0" :title="`剩下的 ${leftOf(d)} 個全部加進購物車`" @click="addBuy(d, true)"><GameIcon name="cart" :size="14" />全部</button>
                    </span>
                  </div>
                  <div v-if="expanded === d.id" class="more small">
                    <div v-if="itemEffect(s, itemName(d))" class="effect">{{ itemEffect(s, itemName(d)) }}</div>
                    <div v-if="d.desc || itemText(s, itemName(d))" class="muted">{{ d.desc ?? itemText(s, itemName(d)) }}</div>
                    <PriceSteps v-if="buyWhy(d)" :b="buyWhy(d)!" />
                  </div>
                </li>
              </ul>
            </div>
          </section>
        </template>
        <template v-else-if="id === 'cart'">
          <CartPanel :type="type" :cart="cart" @done="(t) => (last = t)" />
        </template>
        <template v-else>
          <!-- 行囊 -->
          <section class="col">
            <h3 class="head"><GameIcon name="backpack" :size="17" />你的行囊</h3>
            <div class="row small">
              <span class="muted">這間店收：{{ buysText || '不收東西' }}</span>
              <span class="grow" />
              <label class="check"><input v-model="onlySellable" type="checkbox" /> 只顯示能賣的</label>
            </div>
            <nav v-if="bagCats.length > 1" class="row chips">
              <button class="small" :class="{ active: bagFilter === 'all' }" @click="bagFilter = 'all'">全部 {{ bagAll.length }}</button>
              <button v-for="c in bagCats" :key="c" class="small" :class="{ active: bagFilter === c }" @click="bagFilter = c">
                <ItemIcon v-if="c !== 'other'" :category="c" :size="14" /> {{ c === 'other' ? '其他' : itemRules.categories[c] }}
              </button>
            </nav>
            <div class="row tools">
              <input v-model="bagQuery" class="grow search" type="search" placeholder="搜尋行囊" />
            </div>
            <p v-if="!bag.length" class="small muted">{{ bagAll.length ? '沒有符合篩選的東西。' : onlySellable ? '沒有這間店收的東西。' : '行囊是空的。' }}</p>
            <div class="list">
              <template v-for="g in bagGroups" :key="g.id">
                <div class="group-head small">{{ g.name }}<span class="muted">{{ g.items.length }}</span></div>
                <ul class="plain rows">
                  <li v-for="i in g.items" :key="i.name" class="item-row" :class="{ open: sellWhy === i.name, dim: i.price === null }">
                    <div class="line bag-line" @click="sellWhy = sellWhy === i.name ? null : i.name">
                      <span class="item-tile" :class="`r-${itemRarity(s, i.name)}`"><ItemIcon :name="i.name" :size="22" /></span>
                      <span v-marquee class="what marquee"><span class="what-in">
                        <strong>{{ i.name }}</strong>
                        <span class="qty small">×{{ i.qty }}</span>
                        <span class="small muted">{{ categoryName(s, i.name) }}</span>
                        <MarketBadge v-if="i.price !== null" :name="i.name" />
                        <span v-if="itemEffect(s, i.name)" class="small effect">{{ itemEffect(s, i.name) }}</span>
                      </span></span>
                      <span class="price" :title="i.price !== null ? '收購價（一個）' : undefined">{{ i.price !== null ? formatMoney(i.price) : '' }}</span>
                      <span class="incart small" :title="cart.sell[i.name] ? `購物車裡要賣 ${cart.sell[i.name]} 個` : undefined"><template v-if="cart.sell[i.name]"><GameIcon name="cart" :size="13" />{{ cart.sell[i.name] }}</template></span>
                      <span class="btns" @click.stop>
                        <template v-if="i.price !== null">
                          <input v-model.number="sellQty[i.name]" class="num" type="number" min="1" :max="Math.max(1, sellLeft(i.name, i.qty), cart.sell[i.name] ?? 0)" placeholder="1" :disabled="i.qty <= 1" aria-label="數量" />
                          <span class="stepper">
                            <button class="small" :disabled="!cart.sell[i.name]" title="從購物車拿掉" aria-label="從購物車拿掉" @click="removeSell(i.name)"><GameIcon name="minus" :size="14" /></button>
                            <button class="small" :disabled="sellLeft(i.name, i.qty) <= 0" title="加進購物車（賣出）" aria-label="加進購物車（賣出）" @click="addSell(i.name, i.qty)"><GameIcon name="plus" :size="14" /></button>
                          </span>
                          <button class="small all" :disabled="sellLeft(i.name, i.qty) <= 0" :title="`剩下的 ${sellLeft(i.name, i.qty)} 個全部加進購物車（賣出）`" @click="addSell(i.name, i.qty, true)"><GameIcon name="cart" :size="14" />全部</button>
                        </template>
                        <span v-else class="small muted">{{ isUniqueItem(s, i.name) ? '獨特裝備不能賣' : '這間店不收' }}</span>
                      </span>
                    </div>
                    <div v-if="sellWhy === i.name" class="more small">
                      <div v-if="itemEffect(s, i.name)" class="effect" :title="materialRecipesFull(i.name) || undefined">{{ itemEffect(s, i.name) }}</div>
                      <div v-if="itemText(s, i.name)" class="muted">{{ itemText(s, i.name) }}</div>
                      <div v-if="i.price !== null && glutText(i.name)" class="glut">收購遞減：{{ glutText(i.name) }}</div>
                      <PriceSteps v-if="i.price !== null && sellBreakdown(s, key, i.name)" :b="sellBreakdown(s, key, i.name)!" sell />
                    </div>
                  </li>
                </ul>
              </template>
            </div>
          </section>
        </template>
      </template>
    </SwipeTabs>
    <CartPanel v-if="!isMobile" :type="type" :cart="cart" @done="(t) => (last = t)" />
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 6px; }
.head :deep(.game-icon), .money :deep(.game-icon) { color: var(--accent); }
.shop-dialog { display: grid; gap: 10px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.shop-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; }
.money { color: var(--accent-2); }
.tag.ok { border-color: var(--accent); color: var(--accent); margin-left: 6px; }
.error { color: var(--danger); margin: 0; }
.last { color: var(--accent); margin: 0; }
.cols { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; align-items: start; }
@media (max-width: 760px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; align-content: start; min-width: 0; }
.col h3 { margin: 0; color: var(--accent-2); }
/* 手機版：分頁列已經寫了是哪一邊 */
.cols.swipe .col > h3.head { display: none; }
.chips { gap: 4px; }
.chips button.active { border-color: var(--accent); color: var(--accent); }
/* 電腦版：下面還有購物車，清單矮一點；手機版購物車是另一個分頁 */
.list { display: grid; gap: 6px; margin: 0; max-height: max(220px, calc(100vh - 600px)); overflow-y: auto; padding-right: 2px; align-content: start; }
.cols.swipe .list { max-height: calc(100vh - 350px); }
/* 手機：清單自己會捲，橫滑要留給分頁切換（不然瀏覽器把橫滑當成清單的捲動） */
.cols.swipe .list { touch-action: pan-y; }
.specials { margin-bottom: 6px; }
.tools { flex-wrap: nowrap; }
.search { min-width: 0; }
/* 一般商品：一列一件，約 44px 高 */
.rows { display: grid; gap: 0; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.item-row { padding: 0; border-bottom: 1px solid var(--border); }
.item-row:last-child { border-bottom: none; }
.item-row.open { background: #c99a4510; }
.item-row .line { display: grid; grid-template-columns: 30px minmax(0, 1fr) 5.5em 3em 3em auto; gap: 8px; align-items: center; min-height: 44px; padding: 3px 8px; cursor: pointer; }
.item-row .line:hover { background: #c99a450a; }
/* 特別交易：價錢、庫存、買下與交涉；行囊：收購價、購物車、數量與按鈕 */
.item-row .line.special-line { grid-template-columns: 30px minmax(0, 1fr) 5.5em 3em auto; }
.item-row .line.bag-line { grid-template-columns: 30px minmax(0, 1fr) 5.5em 3em auto; }
.item-row.dim .line { opacity: 0.55; }
/* 手機：圖示、名稱、價錢一排，庫存與按鈕換到下一排 */
@media (max-width: 720px) {
  .item-row .line, .item-row .line.special-line, .item-row .line.bag-line { grid-template-columns: 30px minmax(0, 1fr) auto; row-gap: 2px; }
  .item-row .line .stock { grid-column: 2; }
  .item-row .line .incart { grid-column: 3; }
  .item-row .line .btns { grid-column: 2 / -1; flex-wrap: wrap; }
}
.what { min-width: 0; }
/* 名稱、類別、行情、效果放不下時整行跑馬燈（v-marquee） */
.what .what-in { display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; }
/* 展開的那一列：說明已經寫在下面，跑馬燈停在開頭 */
.item-row.open .marquee.run > span { animation: none; transform: none; }
.stock { text-align: right; white-space: nowrap; }
.btns { display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end; }
.btns .num { width: 52px; height: 28px; padding: 2px 6px; }
/* 購物車裡有幾個：固定寬度的一欄，不擠動旁邊的輸入框與按鈕 */
.incart { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 3em; color: var(--accent); font-weight: 600; white-space: nowrap; }
/* 減號與加號連成一組 */
.stepper { display: inline-flex; }
.stepper button { border-radius: 0; padding: 2px 8px; }
.stepper button:first-child { border-top-left-radius: var(--radius); border-bottom-left-radius: var(--radius); }
.stepper button:last-child { border-top-right-radius: var(--radius); border-bottom-right-radius: var(--radius); margin-left: -1px; }
.all { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.item-row .more { display: grid; gap: 2px; padding: 0 10px 6px 46px; }
.item-row .haggle { padding: 0 8px 6px 46px; }
.group-head { display: flex; gap: 6px; align-items: center; padding: 4px 2px 0; color: var(--accent-2); font-weight: 700; }
button.group-head { border: none; background: none; justify-content: flex-start; width: 100%; text-align: left; cursor: pointer; }
.list > .group-head { padding-top: 6px; }
.grow { flex: 1; min-width: 0; }
.price { font-weight: 600; white-space: nowrap; text-align: right; }
.qty { font-weight: 600; color: var(--accent-2); }
.effect { color: var(--accent); }
.num { width: 58px; }
.glut { color: var(--danger); font-size: 0.78rem; }
</style>
