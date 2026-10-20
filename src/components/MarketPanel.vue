<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { marketsHere, selfSaleChance, type MarketKind } from '@/engine/companions'
import { className, combatRules, contractDef, genderName, raceName, slaveryRules } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { isEnslaved } from '@/engine/party'
import type { MarkChoice } from '@/engine/slavery'
import type { SlaveListing } from '@/engine/types'
import { useGame } from '@/stores/game'
import MarkPicker from './MarkPicker.vue'
import NameTag from './NameTag.vue'

const props = defineProps<{ kind: MarketKind }>()
const game = useGame()
const s = computed(() => game.state!)
const market = computed(() => marketsHere(s.value).find((m) => m.kind === props.kind)?.def)
const loaded = ref<SlaveListing[]>([])

onMounted(() => {
  loaded.value = game.marketStock(props.kind)
})

const stock = computed(() => s.value.markets?.[`${s.value.location}/${props.kind}`]?.stock ?? loaded.value)
const partyFull = computed(() => s.value.party.length >= combatRules.party_max)
const enslaved = computed(() => isEnslaved(s.value))
const haggleText = reactive<Record<string, string>>({})
const open = ref<string | null>(null)
// 買下前選印記：預設是這名奴隸身上原本的契約
const marking = ref<string | null>(null)
const marks = reactive<Record<string, MarkChoice>>({})

function toggleMarking(l: SlaveListing) {
  marks[l.npc] ??= l.contract
  marking.value = marking.value === l.npc ? null : l.npc
}

function buy(l: SlaveListing) {
  game.buySlave(props.kind, l.npc, marks[l.npc] ?? l.contract)
  marking.value = null
}

function haggle(l: SlaveListing) {
  void game.perform({ kind: 'haggle', target: `${props.kind}:${l.npc}`, text: haggleText[l.npc] ?? '' })
  open.value = null
}

function sellSelf() {
  if (confirm('登記出售自己：買家主要看你的魅力與等級，你幾乎無法影響結果。被買下後要過一次刻印檢定，決定刻上哪一種契約印記；原本的同伴會離開。確定嗎？')) {
    game.offerSelf(props.kind)
  }
}
</script>

<template>
  <div v-if="market" class="market">
    <h4>⛓️ {{ market.name }}</h4>
    <p class="small muted">
      {{ kind === 'black' ? '不公開的買賣，價格較低，也有精靈這類在公開市場買不到的人，但風險自負。' : '合法的奴隸市場。' }}
      買下時可以選擇要刻上的契約印記（也可以自訂），之後奴隸不會因為親密度低而離隊，你對他的主動行動都有優勢。可以殺價或用其他方式影響價格（每人每天一次）。
    </p>
    <ul class="plain">
      <li v-for="l in stock" :key="l.npc" class="item small">
        <template v-if="npcRecord(s, l.npc)">
          <div class="row" style="justify-content: space-between">
            <NameTag :id="l.npc" />
            <span class="muted">{{ genderName(npcRecord(s, l.npc)!.gender) }}・{{ raceName(npcRecord(s, l.npc)!.race) }}・{{ className(npcRecord(s, l.npc)!.class) }} Lv.{{ npcRecord(s, l.npc)!.level }}</span>
          </div>
          <div class="muted">{{ npcRecord(s, l.npc)!.appearance }} {{ npcRecord(s, l.npc)!.background }}</div>
          <div class="muted" :title="contractDef(l.contract).side_effects.join('；')">契約：{{ contractDef(l.contract).name }}</div>
          <div class="row">
            <span>{{ formatMoney(l.price_cc) }}</span>
            <button class="small primary" :disabled="partyFull || enslaved || s.money_cc < l.price_cc" @click="toggleMarking(l)">買下…</button>
            <button class="small" :disabled="l.haggled || enslaved || game.judging" @click="open = open === l.npc ? null : l.npc">
              {{ l.haggled ? '已殺過價' : '殺價／交涉' }}
            </button>
          </div>
          <div v-if="marking === l.npc" class="pick">
            <span class="muted">選擇要刻上的印記：</span>
            <MarkPicker v-model="marks[l.npc]!" allow-custom :base="l.contract" />
            <div class="row">
              <button class="small primary" @click="buy(l)">付 {{ formatMoney(l.price_cc) }} 買下</button>
              <button class="small" @click="marking = null">取消</button>
            </div>
          </div>
          <div v-if="open === l.npc" class="row">
            <input v-model="haggleText[l.npc]" style="flex: 1" placeholder="例如：指出他身上的舊傷、對商人拋媚眼、搬出公會的名號" />
            <button class="small" @click="haggle(l)">交涉（魅力檢定）</button>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="stock.length === 0" class="small muted">今天沒有貨了。</p>

    <details v-if="!enslaved" class="small">
      <summary>登記出售自己</summary>
      <p class="muted">
        等 {{ slaveryRules.self_sale.hours }} 小時，有買家的機率約 {{ Math.round(selfSaleChance(s) * 100) }}%（主要看魅力與等級）。
        成交後你拿到成交價的 {{ Math.round(slaveryRules.self_sale.share * 100) }}% 作為賣身錢，之後由主人帶領；要恢復自由只能談判或逃離。
        隊伍必須只剩你一人。
      </p>
      <button class="small danger" :disabled="s.party.length > 1" @click="sellSelf">登記</button>
    </details>
  </div>
</template>

<style scoped>
.market { display: grid; gap: 6px; margin-top: 6px; }
h4 { margin: 6px 0 0; color: var(--accent-2); font-size: 0.95rem; }
.pick { display: grid; gap: 4px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; }
.item { border-top: 1px solid var(--border); padding: 6px 0; display: grid; gap: 2px; }
</style>
