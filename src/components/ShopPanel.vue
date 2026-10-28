<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ShopType } from '@/engine/data'
import { canNegotiate } from '@/engine/negotiation'
import { npcRecord } from '@/engine/npcs'
import { discount, isItemDeal, keeperTitle, sellPrice, shopKey, shopPlace } from '@/engine/trade'
import { shopTitle } from '@/engine/shopNames'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AppDialog from './AppDialog.vue'
import ShopDialog from './items/ShopDialog.vue'
import NameTag from './NameTag.vue'
import BuildingMenu, { type MenuItem } from './place/BuildingMenu.vue'

// 商店的選單：進入交易、談長期折扣，加上地點面板給的其他項目（神殿治療、洗刺青、市場……），那些點了交給上層
const props = withDefaults(defineProps<{ type: ShopType; extra?: MenuItem[] }>(), { extra: () => [] })
const emit = defineEmits<{ extra: [id: string] }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const key = computed(() => shopKey(s.value, props.type))
const loading = ref(false)

onMounted(async () => {
  game.shopState(props.type)
  loading.value = settings.designs('shop')
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

// ---- 交易視窗 ----
const showDialog = ref(false)
const counts = computed(() => {
  const items = deals.value.filter(isItemDeal).length
  return { items, special: deals.value.length - items }
})
const sellable = computed(() => s.value.inventory.filter((i) => sellPrice(s.value, key.value, i.name) !== null).length)
const discountBlocked = computed(() => canNegotiate(s.value, 'shop_discount', { shop: props.type }))

const items = computed<MenuItem[]>(() => [
  {
    id: 'trade', icon: 'store', label: '進入交易',
    detail: `今天有 ${counts.value.items} 樣商品${counts.value.special ? `、${counts.value.special} 筆特別交易` : ''}${sellable.value ? `・行囊裡有 ${sellable.value} 種東西可以賣` : ''}`,
    badge: loading.value ? 'AI 準備中…' : shop.value?.source === 'ai' ? '特別商品' : '', tone: 'gold',
  },
  {
    id: 'discount', icon: 'hand', label: '談長期折扣', disabled: !!discountBlocked.value,
    detail: discountBlocked.value ?? (off.value ? `目前享有 ${off.value}% 折扣` : '和店主談一個長期的折扣'),
    badge: off.value ? `${off.value}%` : '', tone: 'good',
  },
  ...props.extra,
])
function pick(id: string) {
  if (id === 'trade') showDialog.value = true
  else if (id === 'discount') game.startNegotiation('shop_discount', { shop: props.type })
  else emit('extra', id)
}
</script>

<template>
  <div class="shop">
    <p v-if="keeper" class="small muted keeper">{{ keeperTitle(type) }}：<NameTag :id="keeper.id" />・{{ keeper.personality }}</p>
    <BuildingMenu :items="items" @pick="pick" />
    <AppDialog :open="showDialog" :title="shopTitle(shopPlace(s).id, type).name" icon="store" width="1180px" inline-error @close="showDialog = false">
      <ShopDialog :type="type" :loading="loading" />
    </AppDialog>
  </div>
</template>

<style scoped>
.shop { display: grid; gap: 4px; margin-top: 4px; }
.keeper { margin: 0; }
</style>
