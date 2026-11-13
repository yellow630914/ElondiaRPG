<script setup lang="ts">
import { computed, ref } from 'vue'
import { inkKind, shopRefusal } from '@/engine/tattooShop'
import { cureOffers, reinkOffers } from '@/engine/parasiteEvents'
import { freePlaces, tattooKindName, tattoosOf } from '@/engine/tattoos'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import TattooPanel, { type TattooSection } from '../TattooPanel.vue'
import BuildingMenu, { type MenuItem } from './BuildingMenu.vue'
import VolunteerSlavePanel from '../VolunteerSlavePanel.vue'
import { volunteerBlocked, volunteerCandidates } from '@/engine/voluntarySlave'
import PledgeSelfPanel from '../PledgeSelfPanel.vue'
import { isEnslaved } from '@/engine/party'
import { pledgeBlocked, pledgeCandidates } from '@/engine/selfPledge'

// 刺青店、刻印師的選單：刺青、洗刺青、解咒、紋回來各開一個對話框（內容是 TattooPanel 的那一段）；
// 刻印師另有收夥伴為奴（自願為奴，VolunteerSlavePanel）與自由身時的請夥伴收自己為奴（主動認主，PledgeSelfPanel）；兩列的數字都是現在會答應的人數
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
  ...(props.shop === 'carver' ? [{ id: 'volunteer', icon: 'link', label: '收夥伴為奴', detail: '問信任你的同伴願不願意成為你的奴隸（親密度 60 以上；數字是現在會答應的人數）', badge: volunteers.value || '' } as MenuItem] : []),
  // 主動認主：自由身才有（身上有印記時是「投靠新主人」）
  ...(pledgeable.value ? [{ id: 'pledge', icon: 'link', label: '請夥伴收自己為奴', detail: '請信任你的同伴或身邊認識的人當你的主人（親密度 60 以上；數字是現在會答應的人數）', badge: pledgers.value || '' } as MenuItem] : []),
])
/** 現在就會答應的人數（和「請夥伴收自己為奴」一樣） */
const volunteers = computed(() => (props.shop === 'carver' ? volunteerCandidates(s.value).filter((m) => !volunteerBlocked(s.value, m.id)).length : 0))
const pledgeable = computed(() => props.shop === 'carver' && !isEnslaved(s.value))
/** 現在就會答應的人數 */
const pledgers = computed(() => (pledgeable.value ? pledgeCandidates(s.value).filter((x) => !pledgeBlocked(s.value, x.id)).length : 0))
type Dialog = TattooSection | 'volunteer' | 'pledge'
const own = (x: Dialog | null): x is 'volunteer' | 'pledge' => x === 'volunteer' || x === 'pledge'
const open = ref<Dialog | null>(null)
const title = computed(() => items.value.find((i) => i.id === open.value)?.label ?? { ink: `刺${kindName.value}`, wash: '洗刺青', cure: '解咒', reink: '紋回來', volunteer: '收夥伴為奴', pledge: '請夥伴收自己為奴' }[open.value ?? 'wash'])
</script>

<template>
  <p v-if="refusal" class="muted small">{{ refusal }}</p>
  <BuildingMenu :items="items" @pick="open = $event as Dialog" />
  <AppDialog :open="open !== null && !own(open)" :title="title" icon="feather" width="760px" @close="open = null">
    <TattooPanel v-if="open && !own(open)" :shop="shop" :section="open" />
  </AppDialog>
  <AppDialog :open="open === 'volunteer'" title="收夥伴為奴" icon="link" width="720px" @close="open = null">
    <VolunteerSlavePanel v-if="open === 'volunteer'" @done="open = null" />
  </AppDialog>
  <AppDialog :open="open === 'pledge'" title="請夥伴收自己為奴" icon="link" width="720px" @close="open = null">
    <PledgeSelfPanel v-if="open === 'pledge'" @done="open = null" />
  </AppDialog>
</template>
