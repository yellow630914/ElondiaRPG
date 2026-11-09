<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEGREE_NAME } from '@/engine/checks'
import { shopRules, type Degree, type ShopType } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { bargainNet, CART_CHANGE_WARNING as CHANGE_WARNING, cartBargainHeld, cartFromRecords, cartQuote, settleNet, shopKey, type Cart } from '@/engine/trade'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'

// 購物車（docs/TRADE.md）：買入與賣出放在同一車，一次結帳；整車交涉每間店每天一次，可以出價
const props = defineProps<{ type: ShopType; cart: { buy: Record<string, number>; sell: Record<string, number> } }>()
const emit = defineEmits<{ done: [summary: string] }>()
const game = useGame()
const s = computed(() => game.state!)
const busy = computed(() => game.judging)

const asCart = (): Cart => cartFromRecords(props.cart)
/** 談好價之後要改購物車：先提醒（改了就照原價交易，今天也不能再交涉） */
const okToChange = () => !cartBargainHeld(s.value, props.type, asCart()) || confirm(CHANGE_WARNING)
const quote = computed(() => cartQuote(s.value, props.type, asCart()))
const empty = computed(() => !quote.value.buy.length && !quote.value.sell.length)
const money = (n: number) => (n > 0 ? `你付 ${formatMoney(n)}` : n < 0 ? `你收 ${formatMoney(-n)}` : '剛好抵銷')

function setBuy(id: string, q: number) {
  if (!okToChange()) return
  if (q > 0) props.cart.buy[id] = q
  else delete props.cart.buy[id]
}
function setSell(name: string, q: number) {
  if (!okToChange()) return
  if (q > 0) props.cart.sell[name] = q
  else delete props.cart.sell[name]
}
function clear(ask = true) {
  if (ask && !okToChange()) return
  for (const k of Object.keys(props.cart.buy)) delete props.cart.buy[k]
  for (const k of Object.keys(props.cart.sell)) delete props.cart.sell[k]
}

// ---- 整車交涉 ----
const haggling = ref(false)
const offerInput = ref<number | ''>('')
const how = ref('')
/** 出價（正數是想付、負數是想收）；沒填時 undefined */
const offer = computed(() => (offerInput.value === '' || !Number.isFinite(Number(offerInput.value)) ? undefined : (quote.value.listNet >= 0 ? 1 : -1) * Math.abs(Number(offerInput.value))))
const DEGREES: Degree[] = ['critical', 'success', 'partial', 'fail', 'fumble']
const F = shopRules.bargain.price_factor
const preview = (d: Degree) => settleNet(quote.value.listNet, bargainNet(quote.value.buyTotal, quote.value.sellTotal, F[d]), d, offer.value)
/** 今天已經和這間店整車交涉過（結帳後用掉的也算） */
const bargained = computed(() => {
  const shop = s.value.shops?.[shopKey(s.value, props.type)]
  return !!shop && shop.day === s.value.time.day && !!shop.cartBargain
})
async function bargain() {
  const before = s.value.reports.length
  await game.bargainCart(props.type, asCart(), how.value, offer.value)
  haggling.value = false
  const r = s.value.reports.length > before ? s.value.reports[s.value.reports.length - 1] : undefined
  if (r?.outcome.summary) emit('done', r.outcome.summary)
}

function checkout() {
  const r = game.checkout(props.type, asCart())
  if (!r) return
  clear(false)
  offerInput.value = ''
  emit('done', r.outcome.summary ?? '')
}
</script>

<template>
  <section class="cart">
    <h3 class="head"><GameIcon name="coins" :size="17" />這次的交易
      <Hint text="商品和行囊的「＋」加進來，一次結帳。可以整車交涉（每間店每天一次）：買的部分打折，賣的部分照原價；有出價時，成交價取你的出價和這個結果能談到的最好價中，對店家有利的那個。談好的價只算交涉時的那一車：之後改了購物車就照原價交易。同一間店收同一類的東西越多，收購價一件比一件低（收購遞減，每天慢慢回復；可以在設定的「遊戲規則」調整）。" />
    </h3>
    <p v-if="empty" class="small muted">從店裡的商品、你的行囊按「＋」加進來。</p>
    <div v-else class="lists">
      <table v-if="quote.buy.length" class="small">
        <thead><tr><th>買入</th><th>數量</th><th>小計</th><th /></tr></thead>
        <tbody>
          <tr v-for="x in quote.buy" :key="x.dealId">
            <td>{{ x.name }}</td>
            <td class="qty">
              <button class="small" @click="setBuy(x.dealId, x.qty - 1)">−</button>{{ x.qty }}<button class="small" @click="setBuy(x.dealId, x.qty + 1)">＋</button>
            </td>
            <td>{{ formatMoney(x.price * x.qty) }}</td>
            <td><button class="small ghost" title="移除" @click="setBuy(x.dealId, 0)">✕</button></td>
          </tr>
        </tbody>
      </table>
      <table v-if="quote.sell.length" class="small">
        <thead><tr><th>賣出</th><th>數量</th><th>小計</th><th /></tr></thead>
        <tbody>
          <tr v-for="x in quote.sell" :key="x.name">
            <td>{{ x.name }}</td>
            <td class="qty">
              <button class="small" @click="setSell(x.name, x.qty - 1)">−</button>{{ x.qty }}<button class="small" @click="setSell(x.name, x.qty + 1)">＋</button>
            </td>
            <td :title="x.total < x.price * x.qty ? `這間店收多了同一類的東西，一件比一件便宜（第一件 ${formatMoney(x.price)}）` : ''">{{ formatMoney(x.total) }}<small v-if="x.total < x.price * x.qty" class="muted"> ▼遞減</small></td>
            <td><button class="small ghost" title="移除" @click="setSell(x.name, 0)">✕</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!empty" class="sum">
      <span>買入 {{ formatMoney(quote.buyTotal) }}</span>
      <span>賣出 {{ formatMoney(quote.sellTotal) }}</span>
      <strong class="net">{{ money(quote.net) }}</strong>
      <span v-if="quote.bargain" class="small muted">
        （今天交涉{{ DEGREE_NAME[quote.bargain.degree] }}<template v-if="quote.net !== quote.listNet">，原價{{ money(quote.listNet) }}</template><template v-if="!quote.held">；購物車改過了，照原價</template>）
      </span>
    </div>

    <div v-if="haggling && !empty" class="haggle small">
      <div class="row">
        {{ quote.listNet >= 0 ? '我想付' : '我想收' }}
        <input v-model.number="offerInput" class="offer" type="number" min="0" :placeholder="String(Math.abs(preview('success')))" />
        白鸛（選填）
      </div>
      <div class="row">
        <input v-model="how" class="grow" placeholder="怎麼交涉？例如：一次買這麼多、搬出熟人、挑出瑕疵" />
      </div>
      <p v-if="!quote.buy.length" class="muted">整車交涉只會讓買的東西便宜，賣出照原價；購物車裡沒有要買的東西。</p>
      <table class="out">
        <thead><tr><th v-for="d in DEGREES" :key="d">{{ DEGREE_NAME[d] }}</th></tr></thead>
        <tbody><tr><td v-for="d in DEGREES" :key="d">{{ money(preview(d)) }}</td></tr></tbody>
      </table>
      <div class="row">
        <span class="muted grow">魅力檢定；結果決定這一車買的東西能便宜多少。之後改了購物車就照原價。</span>
        <button class="small" @click="haggling = false">取消</button>
        <button class="small primary" :disabled="busy || !quote.buy.length" @click="bargain">交涉（檢定）</button>
      </div>
    </div>

    <ul v-if="!empty && quote.blocked" class="warn small plain"><li v-for="b in quote.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
    <div v-if="!empty" class="row actions">
      <button class="small" :disabled="busy" @click="clear()">清空</button>
      <span class="grow" />
      <button v-if="!haggling" class="small" :disabled="busy || bargained" :title="bargained ? '今天已經和這間店交涉過了' : ''" @click="haggling = true">
        {{ bargained ? '今天交涉過了' : '整車交涉' }}
      </button>
      <button class="primary" :disabled="busy || !!quote.blocked" @click="checkout">結帳（{{ money(quote.net) }}）</button>
    </div>
  </section>
</template>

<style scoped>
.cart { border: 1px solid var(--accent); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 8px; background: var(--panel); }
.head { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--accent-2); }
.head :deep(.game-icon) { color: var(--accent); }
.lists { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--border); padding: 3px 4px; }
td { padding: 3px 4px; border-bottom: 1px dashed color-mix(in srgb, currentColor 15%, transparent); }
.qty { white-space: nowrap; }
.qty button { padding: 0 6px; margin: 0 4px; }
.sum { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
.net { font-size: 1.1rem; color: var(--accent-2); }
.haggle { display: grid; gap: 6px; border-top: 1px solid var(--border); padding-top: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grow { flex: 1; min-width: 0; }
.offer { width: 100px; }
.out { text-align: center; }
.out th, .out td { text-align: center; }
.warn { color: var(--danger); margin: 0; padding: 0; list-style: none; }
.actions { justify-content: flex-end; }
@media (max-width: 760px) { .lists { grid-template-columns: 1fr; } }
</style>
