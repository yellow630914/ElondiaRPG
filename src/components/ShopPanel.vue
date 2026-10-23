<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { shopDef, type ShopType } from '@/engine/data'
import { canNegotiate } from '@/engine/negotiation'
import { npcRecord } from '@/engine/npcs'
import { discount, isItemDeal, keeperTitle, sellPrice, shopKey } from '@/engine/trade'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AppDialog from './AppDialog.vue'
import ShopDialog from './items/ShopDialog.vue'
import NameTag from './NameTag.vue'

const props = defineProps<{ type: ShopType }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const key = computed(() => shopKey(s.value, props.type))
const loading = ref(false)

onMounted(async () => {
  game.shopState(props.type)
  loading.value = settings.aiJudge && settings.ready('shop')
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
</script>

<template>
  <div class="shop">
    <div class="row" style="justify-content: space-between">
      <h4>🪙 {{ shopDef(type).name }}的交易</h4>
      <span class="small muted">
        <template v-if="loading">AI 正在準備今天的商品…</template>
        <template v-else-if="shop?.source === 'ai'">今天有 AI 準備的特別商品</template>
      </span>
    </div>
    <p v-if="keeper" class="small muted">
      {{ keeperTitle(type) }}：<NameTag :id="keeper.id" />・{{ keeper.personality }}
      <template v-if="off">（你享有 {{ off }}% 折扣）</template>
    </p>

    <p class="small">
      今天有 {{ counts.items }} 樣商品{{ counts.special ? `、${counts.special} 筆特別交易` : '' }}<template v-if="sellable">・行囊裡有 {{ sellable }} 種東西可以賣</template>。
    </p>
    <button class="primary open" @click="showDialog = true">🛒 進入交易</button>

    <AppDialog :open="showDialog" :title="shopDef(type).name" icon="🛒" width="1180px" @close="showDialog = false">
      <ShopDialog :type="type" :loading="loading" />
    </AppDialog>

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
.open { justify-self: start; }
</style>
