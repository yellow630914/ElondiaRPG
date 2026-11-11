<script setup lang="ts">
import { computed, ref } from 'vue'
import { madamHere, patronPrice } from '@/engine/brothel'
import { contractDef, raceName, slaveryRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcTitle } from '@/engine/npcs'
import { isBound, isEnslaved } from '@/engine/party'
import { nearbyPeople } from '@/engine/population'
import { seekMasterDc } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import AppDialog from './AppDialog.vue'
import BuildingMenu, { type MenuItem } from './place/BuildingMenu.vue'

// 娼館：消費、找老鴇當主人（選單各開一個對話框）
const game = useGame()
const s = computed(() => game.state!)
const busy = computed(() => game.judging || !!s.value.pendingAction)
const bound = computed(() => isBound(s.value))
const marked = computed(() => isEnslaved(s.value) && !bound.value)
const madam = computed(() => madamHere(s.value))
const workers = computed(() => nearbyPeople(s.value)
  .filter((p) => p.rec.tags?.includes('prostitute') && p.rec.id !== madam.value?.id)
  .map((p) => ({ id: p.rec.id, name: p.rec.name, title: `${raceName(p.rec.race)}・${npcTitle(p.rec)}`, price: patronPrice(s.value, p.rec.id) })))
const target = ref('')
const price = computed(() => patronPrice(s.value, target.value || undefined))
const text = ref('')
const madamText = ref('')
const use = ref('')
const open = ref<'patron' | 'madam' | null>(null)

const menu = computed<MenuItem[]>(() => [
  {
    id: 'patron', icon: 'heart', label: '消費', disabled: bound.value,
    detail: bound.value ? '有主人的奴隸不能在娼館消費；被主人帶著經過時，還可能被推進去接客' : `交給老鴇安排 ${formatMoney(patronPrice(s.value))}${workers.value.length ? '，也可以指名' : ''}`,
    badge: bound.value ? '' : workers.value.length ? `${workers.value.length} 位可指名` : '',
  },
  ...(marked.value && madam.value ? [{
    id: 'madam', icon: 'crown', label: `請${madam.value.name}收留`, detail: `身上有印記卻沒有人帶著：請老鴇收下你（魅力 DC ${seekMasterDc(s.value, madam.value)}）`, tone: 'gold',
  } as MenuItem] : []),
])

function patron() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'patron', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  open.value = null
}

function seekMadam() {
  void game.perform({ kind: 'seek_master', target: madam.value!.id, text: madamText.value })
  madamText.value = ''
  open.value = null
}
</script>

<template>
  <div class="brothel small">
    <p class="muted">娼館。老鴇招呼著客人，娼妓們在廳裡陪酒說笑。</p>
    <BuildingMenu :items="menu" @pick="open = $event as 'patron' | 'madam'" />

    <AppDialog :open="open === 'patron' && !bound" title="消費" icon="heart" width="640px" @close="open = null">
      <div class="brothel small">
        <p class="muted">魅力檢定：表現好可以打折、身心放鬆（下次長休前檢定 +1）；搞砸了可能被多收錢，甚至被摸走錢袋。</p>
        <select v-model="target">
          <option value="">交給老鴇安排（{{ formatMoney(patronPrice(s)) }}）</option>
          <option v-for="w in workers" :key="w.id" :value="w.id">{{ w.name }}・{{ w.title }}（{{ formatMoney(w.price) }}）</option>
        </select>
        <input v-model="text" placeholder="想怎麼度過（選填，會交給 AI 判定與描寫）" />
        <AbilityPicker v-model="use" />
        <button class="small primary go" :disabled="busy || s.money_cc < price" @click="patron">消費（{{ formatMoney(price) }}）</button>
      </div>
    </AppDialog>

    <AppDialog :open="open === 'madam' && marked && !!madam" :title="`請${madam?.name ?? '老鴇'}收留`" icon="crown" width="560px" @close="open = null">
      <div v-if="madam" class="brothel small">
        <p class="muted">
          你身上有印記卻沒有人帶著：可以請{{ madam.name }}收下你（魅力，DC {{ seekMasterDc(s, madam) }}）。老鴇會把印記改刻成{{ contractDef(slaveryRules.roles.madam).name }}，收入九成歸她。
        </p>
        <input v-model="madamText" placeholder="怎麼開口（選填，會交給 AI 判定與描寫）" />
        <button class="small primary go" :disabled="busy" @click="seekMadam">請{{ madam.name }}收留</button>
      </div>
    </AppDialog>
  </div>
</template>

<style scoped>
.brothel { display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.brothel input { width: 100%; }
.brothel p { margin: 0; }
.go { justify-self: start; }
</style>
