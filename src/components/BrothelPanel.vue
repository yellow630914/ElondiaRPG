<script setup lang="ts">
import { computed, ref } from 'vue'
import { madamHere, patronPrice } from '@/engine/brothel'
import { safeText } from '@/engine/content'
import { contractDef, raceName, slaveryRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcTitle } from '@/engine/npcs'
import { isBound, isEnslaved } from '@/engine/party'
import { nearbyPeople } from '@/engine/population'
import { seekMasterDc } from '@/engine/slavery'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import Hint from './ui/Hint.vue'

// 娼館（關閉成人向時是按摩店）：消費、找老鴇當主人
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
const use = ref('')

function patron() {
  const u = parseUse(use.value)
  void game.perform({ kind: 'patron', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
}

function seekMadam() {
  void game.perform({ kind: 'seek_master', target: madam.value!.id, text: text.value })
  text.value = ''
}
</script>

<template>
  <div class="brothel small">
    <p class="muted">{{ safeText('娼館。老鴇招呼著客人，娼妓們在廳裡陪酒說笑。') }}</p>

    <template v-if="bound">
      <p class="mark">{{ safeText('有主人的奴隸不能在娼館消費。被主人帶著經過時，還可能被推進去接客。') }}</p>
    </template>
    <template v-else>
      <h4>{{ safeText('消費') }} <Hint :text="safeText('魅力檢定：表現好可以打折、身心放鬆（下次長休前檢定 +1）；搞砸了可能被多收錢，甚至被摸走錢袋。')" /></h4>
      <div class="row">
        <select v-model="target">
          <option value="">{{ safeText('交給老鴇安排') }}（{{ formatMoney(patronPrice(s)) }}）</option>
          <option v-for="w in workers" :key="w.id" :value="w.id">{{ w.name }}・{{ w.title }}（{{ formatMoney(w.price) }}）</option>
        </select>
      </div>
      <input v-model="text" :placeholder="safeText('想怎麼度過（選填，會交給 AI 判定與描寫）')" />
      <AbilityPicker v-model="use" />
      <button class="small primary" :disabled="busy || s.money_cc < price" @click="patron">消費（{{ formatMoney(price) }}）</button>
    </template>

    <template v-if="marked && madam">
      <h4>{{ safeText('請老鴇收留') }}</h4>
      <p class="muted">
        {{ safeText(`你身上有印記卻沒有人帶著：可以請${madam.name}收下你（魅力，DC ${seekMasterDc(s, madam)}）。老鴇會把印記改刻成${contractDef(slaveryRules.roles.madam).name}，收入九成歸她。`) }}
      </p>
      <button class="small" :disabled="busy" @click="seekMadam">{{ safeText(`請${madam.name}收留`) }}</button>
    </template>
  </div>
</template>

<style scoped>
.brothel { display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.brothel input { width: 100%; }
h4 { margin: 6px 0 0; color: var(--accent-2); font-size: 0.95rem; display: flex; align-items: center; gap: 4px; }
.mark { color: var(--accent-2); }
</style>
