<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ATTR_IDS, attrName } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { inkKind, inkPrice, orderTattoo, removePrice, shopRefusal, tattooShop, type TattooShopId } from '@/engine/tattooShop'
import { cureOffers, reinkOffers } from '@/engine/parasiteEvents'
import {
  freePlaces, oathError, oathText, placeName, tattooError, tattooKindName, tattooName, tattooRules, tattoosOf,
} from '@/engine/tattoos'
import type { TattooPlace } from '@/engine/types'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 刺青店（普通刺青）、刻印師（誓約印記）與神殿（只洗）：刺青與洗刺青
const props = defineProps<{ shop: TattooShopId }>()
const game = useGame()
const s = computed(() => game.state!)
const pc = computed(() => s.value.party.find((m) => m.isPlayer)!)
const rules = computed(() => tattooShop(props.shop))
const kind = computed(() => inkKind(props.shop))
const refusal = computed(() => shopRefusal(s.value, props.shop))

// ---- 刺青 ----
const templates = computed(() => Object.entries(tattooRules.templates).filter(([, t]) => t.kind === kind.value))
const mode = ref<string>('')
const place = ref<TattooPlace | ''>('')
const custom = reactive({ name: '', desc: '', attrs: {} as Record<string, number> })
watch(() => props.shop, () => (mode.value = templates.value[0]?.[0] ?? 'custom'), { immediate: true })
const free = computed(() => freePlaces(pc.value))
// 選圖樣時，部位預設成圖樣建議的空位
watch([mode, free], () => {
  const tpl = tattooRules.templates[mode.value]
  if (place.value && free.value.includes(place.value)) return
  place.value = (tpl?.places ?? []).find((p) => free.value.includes(p)) ?? free.value[0] ?? ''
}, { immediate: true })

const order = computed(() => {
  if (!place.value || !kind.value) return null
  return mode.value === 'custom'
    ? { kind: kind.value, name: custom.name, desc: custom.desc, place: place.value, ...(kind.value === 'oath' ? { attrs: { ...custom.attrs } } : {}) }
    : { template: mode.value, place: place.value }
})
const preview = computed(() => {
  if (!order.value) return null
  try {
    return orderTattoo(s.value, order.value)
  } catch {
    return null
  }
})
const problem = computed(() => {
  if (!free.value.length) return '身上已經沒有空著的部位'
  if (mode.value === 'custom' && !custom.name.trim()) return '請替刺青取個名字'
  if (mode.value === 'custom' && kind.value === 'oath') return oathError(custom.attrs)
  return preview.value ? tattooError(pc.value, preview.value) : undefined
})
const price = computed(() => (preview.value ? inkPrice(props.shop, preview.value) : 0))
function setAttr(a: string, v: number) {
  if (v) custom.attrs[a] = v
  else delete custom.attrs[a]
}
function ink() {
  if (order.value) game.inkTattoo(order.value)
}

// ---- 洗刺青 ----
const washable = computed(() => tattoosOf(pc.value).filter((t) => t.kind !== 'slave').map((t) => ({ t, price: removePrice(props.shop, t.kind, t.kind !== 'curse' || !!t.tamed) })))

// ---- 寄生物：解咒（神殿、刻印師）與紋回來（刻印師） ----
const cures = computed(() => (props.shop === 'parlor' ? [] : cureOffers(s.value)))
const reinks = computed(() => reinkOffers(s.value))
</script>

<template>
  <div class="tattoo-shop small">
    <p v-if="refusal" class="muted">{{ refusal }}</p>
    <template v-if="kind">
      <h4>
        <GameIcon name="feather" :size="14" />刺{{ tattooKindName(kind) }}
        <Hint :text="`${kind === 'oath' ? `誓約印記讓一些屬性變強、另一些變弱（加總為 0，每項最多 ±${tattooRules.oath.max_change}、最多動 ${tattooRules.oath.max_attrs} 項，每人最多 ${tattooRules.oath.max_per_character} 個）。價格依加的總點數。` : '只是外觀，會寫進給 AI 的主角資料。'}自己描述的圖樣另外加 ${formatMoney(rules.custom_extra ?? 0)}。`" />
      </h4>
      <div class="row">
        <select v-model="mode">
          <option v-for="[id, t] in templates" :key="id" :value="id">{{ t.name }}{{ t.attrs ? `（${oathText(t.attrs)}）` : '' }}</option>
          <option value="custom">自己描述…</option>
        </select>
        <select v-model="place">
          <option v-for="p in free" :key="p" :value="p">{{ placeName(p) }}</option>
        </select>
      </div>
      <p v-if="mode !== 'custom' && tattooRules.templates[mode]" class="muted">{{ tattooRules.templates[mode]!.desc }}</p>
      <div v-if="mode === 'custom'" class="custom">
        <input v-model="custom.name" maxlength="20" placeholder="名稱" />
        <textarea v-model="custom.desc" rows="2" maxlength="160" placeholder="外觀（圖樣、顏色、大小）" />
        <div v-if="kind === 'oath'" class="row">
          <label v-for="a in ATTR_IDS" :key="a">{{ attrName(a) }}
            <input type="number" class="num" :min="-tattooRules.oath.max_change" :max="tattooRules.oath.max_change" :value="custom.attrs[a] ?? 0" @input="setAttr(a, Number(($event.target as HTMLInputElement).value))" />
          </label>
        </div>
      </div>
      <div class="row">
        <button :disabled="!!problem || s.money_cc < price" @click="ink">刺上（{{ formatMoney(price) }}，{{ rules.hours }} 小時）</button>
        <span v-if="problem" class="warn">{{ problem }}</span>
      </div>
    </template>

    <h4>洗刺青 <Hint text="奴隸印記要解除契約才能去掉（神殿、刻印師、法師；見「主動行動」的解除印記）。" /></h4>
    <ul v-if="washable.length" class="plain">
      <li v-for="{ t, price: p } in washable" :key="t.place">
        {{ placeName(t.place) }}・{{ tattooKindName(t.kind) }}【{{ tattooName(t) }}】
        <button v-if="p !== undefined" class="small" :disabled="!!refusal || s.money_cc < p" @click="game.washTattoo(t.place)">洗掉（{{ formatMoney(p) }}）</button>
        <span v-else-if="t.kind === 'curse' && !t.tamed" class="muted">未馴服的詛咒印記洗不掉，要解咒</span>
        <span v-else class="muted">這裡不洗{{ tattooKindName(t.kind) }}</span>
      </li>
    </ul>
    <p v-else class="muted">身上沒有可以洗的刺青。</p>

    <template v-if="cures.length">
      <h4>解咒 <Hint text="拿掉身上的寄生物（寄生裝備、淫紋、寄生種子）：先付錢再擲骰，侵蝕度越高越難、越貴；失敗時錢不退、侵蝕度上升。成功時寄生物的任務線也跟著結束。" /></h4>
      <ul class="plain">
        <li v-for="c in cures" :key="c.id">
          {{ c.name }}（{{ attrName(c.attr as never) }}・DC {{ c.dc }}）
          <button class="small" :disabled="!!refusal || s.money_cc < c.price" @click="game.cureParasite(c.id)">解咒（{{ formatMoney(c.price) }}）</button>
        </li>
      </ul>
    </template>
    <template v-if="reinks.length">
      <h4>紋回來 <Hint text="被奴隸印記頂掉、或馴服後洗掉的淫紋，以及刻上淫紋時被蓋掉的刺青，刻印師可以照原樣紋回去（部位要空著）。" /></h4>
      <ul class="plain">
        <li v-for="r in reinks" :key="`${r.parasite}:${r.kind}`">
          {{ placeName(r.tattoo.place) }}・{{ tattooKindName(r.tattoo.kind) }}【{{ tattooName(r.tattoo) }}】
          <button class="small" :disabled="s.money_cc < r.price" @click="game.reinkParasite(r.parasite, r.kind)">紋回來（{{ formatMoney(r.price) }}）</button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.tattoo-shop { display: grid; gap: 6px; }
.tattoo-shop h4 { margin: 6px 0 0; display: flex; align-items: center; gap: 6px; }
.tattoo-shop h4 :deep(.game-icon) { color: var(--accent); }
.custom { display: grid; gap: 4px; }
.custom textarea { width: 100%; }
.num { width: 52px; }
.warn { color: var(--danger); }
</style>
