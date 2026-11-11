<script setup lang="ts">
import { computed, ref } from 'vue'
import { inkKind, shopRefusal } from '@/engine/tattooShop'
import { cureOffers, reinkOffers } from '@/engine/parasiteEvents'
import { freePlaces, tattooKindName, tattoosOf } from '@/engine/tattoos'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import TattooPanel, { type TattooSection } from '../TattooPanel.vue'
import BuildingMenu, { type MenuItem } from './BuildingMenu.vue'

// 刺青店、刻印師的選單：刺青、洗刺青、解咒、紋回來各開一個對話框（內容是 TattooPanel 的那一段）
const props = defineProps<{ shop: 'parlor' | 'carver' }>()
const game = useGame()
const s = computed(() => game.state!)
const pc = computed(() => s.value.party.find((m) => m.isPlayer)!)
const refusal = computed(() => shopRefusal(s.value, props.shop))
const kindName = computed(() => tattooKindName(inkKind(props.shop)!))
const free = computed(() => freePlaces(pc.value).length)
const washable = computed(() => tattoosOf(pc.value).filter((t) => t.kind !== 'slave').length)
const cures = computed(() => (props.shop === 'carver' ? cureOffers(s.value).length : 0))
const reinks = computed(() => reinkOffers(s.value).length)

const items = computed<MenuItem[]>(() => [
  {
    id: 'ink', icon: 'feather', label: `刺${kindName.value}`,
    detail: props.shop === 'carver' ? '讓屬性有加有減的印記：挑現成的圖樣或自己描述' : '只是外觀的圖樣：挑現成的或自己描述',
    badge: free.value ? `空位 ${free.value}` : '沒有空位', tone: free.value ? undefined : 'bad',
  },
  { id: 'wash', icon: 'waves', label: '洗刺青', detail: '洗掉身上的刺青（奴隸印記要解除契約才能去掉）', badge: washable.value || '' },
  ...(cures.value ? [{ id: 'cure', icon: 'sparkles', label: '解咒', detail: '拿掉身上的寄生物（寄生裝備、淫紋、寄生種子）', badge: cures.value, tone: 'bad' } as MenuItem] : []),
  ...(reinks.value ? [{ id: 'reink', icon: 'refresh', label: '紋回來', detail: '照原樣紋回被頂掉、洗掉的淫紋與被蓋掉的刺青', badge: reinks.value } as MenuItem] : []),
])
const open = ref<TattooSection | null>(null)
const title = computed(() => items.value.find((i) => i.id === open.value)?.label ?? { ink: `刺${kindName.value}`, wash: '洗刺青', cure: '解咒', reink: '紋回來' }[open.value ?? 'wash'])
</script>

<template>
  <p v-if="refusal" class="muted small">{{ refusal }}</p>
  <BuildingMenu :items="items" @pick="open = $event as TattooSection" />
  <AppDialog :open="open !== null" :title="title" icon="feather" width="760px" @close="open = null">
    <TattooPanel v-if="open" :shop="shop" :section="open" />
  </AppDialog>
</template>
