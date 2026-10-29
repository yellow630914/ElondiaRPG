<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { auctionBlocked, auctionLots, auctionRules, consignable } from '@/engine/auction'
import { itemDef } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import Hint from './ui/Hint.vue'

// 拍賣會（成人向，docs/LEWD_STATS.md 第 26 節）：今天的拍品、出價、寄賣
const game = useGame()
const s = computed(() => game.state!)
const blocked = computed(() => auctionBlocked(s.value))
const lots = computed(() => auctionLots(s.value))
const bids = reactive<Record<number, number>>({})
const goods = computed(() => consignable(s.value))
const pick = ref('')
const rules = auctionRules()

function bid(i: number) {
  void game.placeBid(i, bids[i] ?? lots.value[i]!.start)
}
function sell() {
  if (!pick.value) return
  void game.consign(pick.value)
  pick.value = ''
}
</script>

<template>
  <div class="auction small">
    <h4>今晚的拍品 <Hint :text="`每件每天出一次價。出價高過包廂裡的對手（看不到他們願意出多少）就得標，只要付對手的最高價多一口。得標後有 ${Math.round(rules.watch_chance * 100)}% 會被盯上。`" /></h4>
    <p v-if="blocked" class="muted">{{ blocked }}</p>
    <template v-else>
      <div v-for="(lot, i) in lots" :key="lot.name" class="lot">
        <div><b>{{ lot.name }}</b> <span class="muted">{{ itemDef(lot.name)?.desc }}</span></div>
        <div class="row">
          <span class="muted">起標 {{ formatMoney(lot.start) }}</span>
          <template v-if="lot.won !== undefined"><span class="good">已得標（{{ formatMoney(lot.won) }}）</span></template>
          <template v-else-if="lot.lost"><span class="muted">被別人標走了</span></template>
          <template v-else>
            <input v-model.number="bids[i]" type="number" :min="lot.start" :step="Math.max(10, Math.round(lot.start / 10))" :placeholder="String(lot.start)" class="num" />
            <button class="small primary" :disabled="(bids[i] ?? lot.start) > s.money_cc" @click="bid(i)">出價</button>
          </template>
        </div>
      </div>
      <h4>寄賣 <Hint :text="`成人向的物品與色情技能書，照當天的行情（價格的 ${rules.consign_ratio[0]}～${rules.consign_ratio[1]} 倍）賣掉，扣 ${Math.round(rules.consign_fee * 100)}% 手續費。`" /></h4>
      <div class="row">
        <select v-model="pick">
          <option value="">{{ goods.length ? '選一件寄賣…' : '行囊裡沒有拍賣會收的東西' }}</option>
          <option v-for="n in goods" :key="n" :value="n">{{ n }}</option>
        </select>
        <button class="small" :disabled="!pick" @click="sell">寄賣</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.auction { display: grid; gap: 6px; margin-top: 6px; }
.lot { border-top: 1px dashed var(--border, #444); padding-top: 4px; }
.row { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.num { width: 7em; }
.good { color: var(--good, #6c6); }
</style>
