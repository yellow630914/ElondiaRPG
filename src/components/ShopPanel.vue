<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { itemRules, shopRules, type ShopType } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { canNegotiate } from '@/engine/negotiation'
import { npcRecord } from '@/engine/npcs'
import { costText, dealMoney, discount, effectText, itemCategory, keeperTitle, sellPrice, shopKey } from '@/engine/trade'
import type { Deal } from '@/engine/types'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import NameTag from './NameTag.vue'

const props = defineProps<{ type: ShopType }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const key = computed(() => shopKey(s.value, props.type))
const loading = ref(false)

onMounted(async () => {
  game.shopState(props.type)
  loading.value = settings.aiJudge && settings.ready()
  await game.flavorShop(props.type)
  loading.value = false
})

const shop = computed(() => {
  const cur = s.value.shops?.[key.value]
  return cur && cur.day === s.value.time.day ? cur : undefined
})
const keeper = computed(() => (shop.value ? npcRecord(s.value, shop.value.keeper) : undefined))
const deals = computed(() => shop.value?.deals.filter((d) => d.stock > 0) ?? [])
const off = computed(() => Math.round(discount(s.value, key.value) * 100))

function affordable(d: Deal): boolean {
  if (s.value.money_cc < dealMoney(s.value, key.value, d)) return false
  return d.gives.every((g) => g.type !== 'item' || (s.value.inventory.find((i) => i.name === g.name)?.qty ?? 0) >= (g.qty ?? 1))
}

function isSimpleItem(d: Deal) {
  return d.id.startsWith('item:')
}

// ---- 交涉 ----
const open = ref<string | null>(null)
const text = reactive<Record<string, string>>({})
function bargain(d: Deal) {
  void game.bargain(props.type, d.id, text[d.id] ?? '')
  open.value = null
}

// ---- 賣東西 ----
const sellable = computed(() =>
  s.value.inventory
    .map((i) => ({ ...i, price: sellPrice(s.value, key.value, i.name) }))
    .filter((i): i is typeof i & { price: number } => i.price !== null),
)
const buysText = computed(() => shopRules.types[props.type].buys.map((c) => itemRules.categories[c]).join('、'))
function categoryName(name: string): string {
  const c = itemCategory(s.value, name)
  return c ? itemRules.categories[c] : ''
}
const sellQty = reactive<Record<string, number>>({})
const discountBlocked = computed(() => canNegotiate(s.value, 'shop_discount', { shop: props.type }))
</script>

<template>
  <div class="shop">
    <div class="row" style="justify-content: space-between">
      <h4>🪙 {{ shopRules.types[type].name }}的交易</h4>
      <span class="small muted">
        <template v-if="loading">AI 正在準備今天的商品…</template>
        <template v-else-if="shop?.source === 'ai'">今天的清單由 AI 設計</template>
      </span>
    </div>
    <p v-if="keeper" class="small muted">
      {{ keeperTitle(type) }}：<NameTag :id="keeper.id" />・{{ keeper.personality }}
      <template v-if="off">（你享有 {{ off }}% 折扣）</template>
    </p>

    <ul class="plain">
      <li v-for="d in deals" :key="d.id" class="deal small">
        <div class="row" style="justify-content: space-between">
          <strong>{{ d.title }}</strong>
          <span>{{ costText(s, key, d) }}<span v-if="d.stock < 20" class="muted">・剩 {{ d.stock }}</span></span>
        </div>
        <div v-if="d.desc" class="muted">{{ d.desc }}</div>
        <div v-if="!isSimpleItem(d)" class="gets">得到：{{ d.gets.map((g) => effectText(s, g, shop?.keeper)).join('、') }}</div>
        <div class="row">
          <button class="small primary" :disabled="!affordable(d)" @click="game.buyDeal(type, d.id)">交易</button>
          <button
            v-if="dealMoney(s, key, d) > 0"
            class="small"
            :disabled="d.haggled || game.judging"
            @click="open = open === d.id ? null : d.id"
          >{{ d.haggled ? '已交涉過' : '交涉' }}</button>
        </div>
        <div v-if="open === d.id" class="row">
          <input v-model="text[d.id]" style="flex: 1" placeholder="怎麼交涉？例如：挑出瑕疵、搬出熟人、請店主喝一杯" />
          <button class="small" @click="bargain(d)">交涉（檢定）</button>
        </div>
      </li>
    </ul>
    <p v-if="!deals.length" class="small muted">今天沒有東西可以買了。</p>

    <details v-if="sellable.length" class="small">
      <summary>賣東西（{{ buysText }}）</summary>
      <ul class="plain">
        <li v-for="i in sellable" :key="i.name" class="row">
          <span>{{ i.name }} ×{{ i.qty }}<span class="muted">（{{ categoryName(i.name) }}・每個 {{ formatMoney(i.price) }}）</span></span>
          <input v-model.number="sellQty[i.name]" type="number" min="1" :max="i.qty" style="width: 60px" placeholder="1" />
          <button class="small" @click="game.sellItem(type, i.name, sellQty[i.name] || 1)">賣出</button>
        </li>
      </ul>
    </details>

    <div class="row small">
      <button class="small" :disabled="!!discountBlocked" :title="discountBlocked ?? ''" @click="game.startNegotiation('shop_discount', { shop: type })">
        談長期折扣
      </button>
      <span v-if="discountBlocked" class="muted">{{ discountBlocked }}</span>
    </div>
  </div>
</template>

<style scoped>
.shop { display: grid; gap: 6px; margin-top: 6px; }
h4 { margin: 0; color: var(--accent-2); font-size: 0.95rem; }
.deal { border-top: 1px solid var(--border); padding: 6px 0; display: grid; gap: 2px; }
.gets { color: var(--accent); }
</style>
