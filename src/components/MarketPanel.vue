<script setup lang="ts">
import FoldMenu from './ui/FoldMenu.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { marketsHere, proposeDc, selfSaleChance, type MarketKind } from '@/engine/companions'
import { className, contractDef, genderName, raceName, slaveryRules, tagDef } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { isBound, isEnslaved, leaderOf, partyRoom } from '@/engine/party'
import type { MarkChoice } from '@/engine/slavery'
import type { SlaveListing } from '@/engine/types'
import { useGame } from '@/stores/game'
import MarkPicker from './MarkPicker.vue'
import NameTag from './NameTag.vue'
import Hint from './ui/Hint.vue'

const props = defineProps<{ kind: MarketKind }>()
const game = useGame()
const s = computed(() => game.state!)
const market = computed(() => marketsHere(s.value).find((m) => m.kind === props.kind)?.def)
const loaded = ref<SlaveListing[]>([])

onMounted(() => {
  loaded.value = game.marketStock(props.kind)
})

const stock = computed(() => s.value.markets?.[`${s.value.location}/${props.kind}`]?.stock ?? loaded.value)
const partyFull = computed(() => partyRoom(s.value) < 1)
const enslaved = computed(() => isEnslaved(s.value))
const bound = computed(() => isBound(s.value))
// 這個市場常見的買家（依權重）
const buyers = computed(() => Object.entries(slaveryRules.master_tags.tags)
  .filter(([, t]) => t[props.kind] > 0)
  .sort((a, b) => b[1][props.kind] - a[1][props.kind])
  .map(([id, t]) => `${tagDef(id)?.name ?? id}${t.chance ? `（${t.chance > 0 ? '+' : ''}${Math.round(t.chance * 100)}%）` : ''}`)
  .join('、'))
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

// ---- 被主人帶著：向主人提議買下 ----
const master = computed(() => (bound.value ? leaderOf(s.value) : undefined))
const proposing = ref<string | null>(null)
const proposeText = reactive<Record<string, string>>({})
const proposedToday = (id: string) => s.value.flags[`propose_no:${id}`] === s.value.time.day
function proposeDcOf(id: string): number | null {
  try {
    return proposeDc(s.value, { kind: 'buy', market: props.kind, npc: id })
  } catch {
    return null
  }
}
async function propose(l: SlaveListing) {
  await game.perform({ kind: 'propose', target: `buy:${props.kind}:${l.npc}`, text: proposeText[l.npc] ?? '' })
  proposing.value = null
}

function sellSelf() {
  const msg = enslaved.value
    ? '登記出售自己：買下你的人會成為新主人，身上的印記沿用。確定嗎？'
    : '登記出售自己：買家主要看你的魅力與等級，你幾乎無法影響結果。被買下後要過一次刻印檢定，決定刻上哪一種契約印記；原本的同伴會離開。確定嗎？'
  if (confirm(msg)) {
    game.offerSelf(props.kind)
  }
}
</script>

<template>
  <div v-if="market" class="market">
    <FoldMenu :id="`market.${kind}`" icon="users" :label="market.name" :detail="kind === 'black' ? '不公開的奴隸買賣：價格較低，風險自負' : '合法的奴隸買賣'" :badge="stock.length" :open="kind === 'public'">
    <p class="small muted intro">
      今天的貨 <Hint :text="`${kind === 'black' ? '不公開的買賣，價格較低，也有精靈這類在公開市場買不到的人，但風險自負。' : '合法的奴隸市場。'}\n買下時可以選擇要刻上的契約印記（也可以自訂），之後奴隸不會因為親密度低而離隊，你對他的主動行動都有優勢。可以殺價或用其他方式影響價格（每人每天一次）。`" />
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
            <!-- 被主人帶著：向主人提議買下（主人出錢，奴隸屬於主人） -->
            <template v-if="bound">
              <span v-if="proposedToday(l.npc)" class="muted">主人今天不想再聽你提這個人</span>
              <button v-else class="small primary" :disabled="partyFull || game.judging" @click="proposing = proposing === l.npc ? null : l.npc">向主人提議買下…</button>
            </template>
            <template v-else>
              <button class="small primary" :disabled="partyFull || enslaved || s.money_cc < l.price_cc" :title="enslaved ? '身上還有奴隸印記，不能擁有奴隸（只能把自己賣出去）' : ''" @click="toggleMarking(l)">買下…</button>
              <button class="small" :disabled="l.haggled || enslaved || game.judging" @click="open = open === l.npc ? null : l.npc">
                {{ l.haggled ? '已殺過價' : '殺價／交涉' }}
              </button>
            </template>
          </div>
          <div v-if="proposing === l.npc" class="pick">
            <span class="muted">請{{ master?.name ?? '主人' }}出錢買下，買下後是主人的奴隸、跟著隊伍。魅力檢定，參考 DC {{ proposeDcOf(l.npc) ?? '—' }}（主人的親密度、售價相對主人的財力、主人的身分、契約的服從懲罰）；部分成功時主人要你出一半。</span>
            <div class="row">
              <input v-model="proposeText[l.npc]" style="flex: 1" placeholder="怎麼說服主人（選填），例如：說她會做菜、能幫主人管帳" />
              <button class="small primary" :disabled="game.judging" @click="propose(l)">向主人提議（魅力檢定）</button>
            </div>
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
    </FoldMenu>

    <FoldMenu v-if="!bound" class="small" icon="scale" :label="enslaved ? '登記出售自己（找新主人）' : '登記出售自己'" :detail="`等 ${slaveryRules.self_sale.hours} 小時，有買家的機率約 ${Math.round(selfSaleChance(s) * 100)}%`">
      <p class="muted self-sale">
        等 {{ slaveryRules.self_sale.hours }} 小時，有買家的機率約 {{ Math.round(selfSaleChance(s) * 100) }}%；成交後你拿到成交價的 {{ Math.round(slaveryRules.self_sale.share * 100) }}%。隊伍必須只剩你一人。
        <Hint :text="`機率主要看魅力與等級，再依出價的人的身分增減。${enslaved ? '身上有印記：這筆錢還會照新主人契約的「收益歸屬」被抽走一部分（當作被奴隸商人抽走了）。買下你的人成為新主人，身上的印記沿用；逃亡狀態解除。' : '之後由主人帶領；要恢復自由只能談判或逃離。'}普通人主人會同行，但不參與戰鬥。`" />
      </p>
      <p class="muted">常見的買家：{{ buyers }}</p>
      <button class="small danger go" :disabled="s.party.length > 1" @click="sellSelf">登記</button>
    </FoldMenu>
  </div>
</template>

<style scoped>
.market { display: grid; gap: 0; margin-top: 6px; }
.market p { margin: 0; }
.intro { display: flex; align-items: center; gap: 4px; }
.go { justify-self: start; }
h4 { margin: 6px 0 0; color: var(--accent-2); font-size: 0.95rem; }
.pick { display: grid; gap: 4px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; }
.item { border-top: 1px solid var(--border); padding: 6px 0; display: grid; gap: 2px; }
</style>
