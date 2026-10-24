<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { mod } from '@/engine/character'
import { askingFor, invitable, marketsHere, partyOffersHere, waitChance } from '@/engine/companions'
import { className, combatRules, companionRules, conditionName, genderName, raceName } from '@/engine/data'
import { mealMenu } from '@/engine/meals'
import { CURRENCY, formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { isBound, leaderOf } from '@/engine/party'
import { canNegotiate } from '@/engine/negotiation'
import { discount, keeperTitle, shopKey } from '@/engine/trade'
import type { TavernCandidate } from '@/engine/types'
import { useGame } from '@/stores/game'
import MarketPanel from './MarketPanel.vue'
import NameTag from './NameTag.vue'
import AppDialog from './AppDialog.vue'
import ShopDialog from './items/ShopDialog.vue'
import BuildingMenu, { type MenuItem } from './place/BuildingMenu.vue'
import Avatar from './ui/Avatar.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { useSettings } from '@/stores/settings'

const game = useGame()
const s = computed(() => game.state!)
const candidates = ref<TavernCandidate[]>([])
const bound = computed(() => isBound(s.value))
const partyFull = computed(() => s.value.party.length >= combatRules.party_max)

function refresh() {
  candidates.value = game.tavernCandidates()
}

// 酒館的交易清單（AI 開啟時請 AI 準備今天的特別商品）
const settings = useSettings()
const tradeLoading = ref(false)
onMounted(async () => {
  refresh()
  game.shopState('tavern')
  tradeLoading.value = settings.aiJudge && settings.ready('shop')
  await Promise.all([game.flavorRoster().then(refresh), game.flavorShop('tavern')])
  tradeLoading.value = false
})

const visible = computed(() => {
  // 依存檔重新取：雇用、還價、拒絕後即時更新
  const today = s.value.taverns?.[s.value.location]
  const list = today && today.day === s.value.time.day ? today.candidates : candidates.value
  return list.filter((c) => !s.value.party.some((m) => m.id === c.npc))
})

const offers = reactive<Record<string, number>>({})
const approach = reactive<Record<string, string>>({})
const open = ref<string | null>(null)

function toggle(c: TavernCandidate) {
  open.value = open.value === c.npc ? null : c.npc
  offers[c.npc] ??= askingFor(c)
}

async function hire(c: TavernCandidate) {
  await game.hire(c.npc, Math.max(0, Math.floor(offers[c.npc] ?? askingFor(c))), approach[c.npc] ?? '')
  open.value = null
}

// ---- 用餐 ----
const menu = computed(() => {
  void s.value.time.minute
  return mealMenu(s.value)
})
// 隊伍現在的用餐與喝酒狀態
const MEAL_CONDITIONS = new Set(['fed_light', 'fed_well', 'fed_fine', 'fed_feast', 'fed_legend', 'cheered', 'tipsy'])
const fed = computed(() => s.value.party
  .map((m) => ({ name: m.name, list: m.status.filter((c) => MEAL_CONDITIONS.has(c)).map(conditionName) }))
  .filter((x) => x.list.length))

// ---- 組隊 ----
const offersHere = computed(() => partyOffersHere(s.value))
const leader = computed(() => leaderOf(s.value))
const chance = computed(() => Math.round(waitChance(s.value) * 100))


// ---- 邀請、黑市 ----
const inviteList = computed(() => invitable(s.value))
const inviteText = ref('')
const blackText = ref('')
const blackKnown = computed(() => marketsHere(s.value).some((m) => m.kind === 'black'))

// ---- 選單 ----
type Section = 'meals' | 'recruit' | 'offers' | 'invite' | 'black' | 'trade'
const section = ref<Section | null>(null)
const bestMeal = computed(() => {
  const list = s.value.party.flatMap((m) => m.status.filter((c) => MEAL_CONDITIONS.has(c)))
  return list.length ? conditionName(list[0]!) : ''
})
const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    { id: 'meals', icon: 'mug', label: '用餐', detail: `今天的菜單 ${menu.value.filter((m) => !m.unavailable).length} 道（全隊一起吃）`, badge: bestMeal.value, tone: 'good' },
  ]
  if (!bound.value) {
    items.push(
      { id: 'recruit', icon: 'users', label: '招募冒險者', detail: partyFull.value ? `隊伍已滿（${combatRules.party_max} 人）` : visible.value.length ? `今天城裡有 ${visible.value.length} 位可以雇用` : '今天城裡沒有可以雇用的冒險者', badge: visible.value.length || '', tone: 'gold' },
      { id: 'offers', icon: 'flag', label: leader.value ? '你所在的隊伍' : '加入別人的隊伍', detail: leader.value ? `正跟著${leader.value.name}的隊伍` : `等待組隊 ${companionRules.wait_party.hours} 小時・機率約 ${chance.value}%`, badge: leader.value ? '' : offersHere.value.length || '' },
    )
    if (inviteList.value.length) items.push({ id: 'invite', icon: 'feather', label: '邀請認識的人', detail: `${inviteList.value.length} 位認識的人可以邀請`, badge: inviteList.value.length })
    items.push({ id: 'black', icon: 'eye', label: blackKnown.value ? '黑市' : '打聽黑市', detail: blackKnown.value ? '不公開的奴隸買賣' : '魅力檢定，約 2 小時' })
  }
  items.push({ id: 'trade', icon: 'coins', label: '酒館的交易', detail: tradeLoading.value ? 'AI 正在準備今天的特別交易…' : '餐點以外的交易：情報、請客、幫忙……' })
  // 長期折扣（和其他商店一樣，見 ShopPanel）
  items.push({
    id: 'discount', icon: 'hand', label: '談長期折扣', disabled: !!discountBlocked.value,
    detail: discountBlocked.value ?? (off.value ? `目前享有 ${off.value}% 折扣` : '和老闆談一個長期的折扣'),
    badge: off.value ? `${off.value}%` : '', tone: 'good',
  })
  return items
})
const keeper = computed(() => {
  const shop = s.value.shops?.[shopKey(s.value, 'tavern')]
  return shop && shop.day === s.value.time.day ? npcRecord(s.value, shop.keeper) : undefined
})
const off = computed(() => Math.round(discount(s.value, shopKey(s.value, 'tavern')) * 100))
const discountBlocked = computed(() => canNegotiate(s.value, 'shop_discount', { shop: 'tavern' }))
function pick(id: string) {
  if (id === 'discount') game.startNegotiation('shop_discount', { shop: 'tavern' })
  else section.value = id as Section
}
const TITLES: Record<Section, string> = { meals: '用餐', recruit: '招募冒險者', offers: '加入別人的隊伍', invite: '邀請認識的人', black: '黑市', trade: '酒館的交易' }
</script>
<template>
  <div class="tavern">
    <p v-if="bound" class="small muted">身為奴隸，你只能在一旁看著主人和別人談話。</p>
    <p v-if="keeper" class="small muted keeper">{{ keeperTitle('tavern') }}：<NameTag :id="keeper.id" />・{{ keeper.personality }}</p>
    <BuildingMenu :items="menuItems" @pick="pick" />

    <AppDialog :open="section !== null" :title="section ? TITLES[section] : ''" icon="mug" :inline-error="section === 'trade'" :width="section === 'trade' ? '1180px' : section === 'black' ? '980px' : '900px'" @close="section = null">
      <template #head>
        <Hint v-if="section === 'meals'" text="全隊一起吃（價格是每人）。吃完的狀態到下次長休前有效；同時只保留最好的一餐，喝酒喝多了會微醺。" />
        <Hint v-else-if="section === 'recruit'" text="今天在城裡、可以雇用的冒險者（在右側「這裡的人」也能直接雇用）。出價低於要價時要談判；出價的影響最大，運氣好甚至能免費雇到人。" />
        <Hint v-else-if="section === 'invite'" text="需要親密度與魅力檢定。被婉拒後，要等下次長休才能再邀請。" />
      </template>

      <!-- 用餐 -->
      <template v-if="section === 'meals'">
        <div class="meals">
          <article v-for="m in menu" :key="m.id" class="meal" :class="{ off: !!m.unavailable }">
            <header><b>{{ m.name }}</b><span class="price">{{ m.unavailable ?? formatMoney(m.price) }}<small v-if="!m.unavailable && s.party.length > 1"> ×{{ s.party.length }}</small></span></header>
            <div class="small cond"><span class="tag good">{{ conditionName(m.condition) }}</span></div>
            <p class="small muted">{{ m.desc }}</p>
            <button class="small" :disabled="!!m.unavailable || s.money_cc < m.total || game.judging" @click="game.eatMeal(m.id)">點餐<template v-if="!m.unavailable">（{{ formatMoney(m.total) }}）</template></button>
          </article>
        </div>
        <p v-if="fed.length" class="small muted fed">目前：{{ fed.map((x) => `${x.name}：${x.list.join('、')}`).join('；') }}</p>
      </template>

      <!-- 招募 -->
      <template v-else-if="section === 'recruit'">
        <p v-if="visible.length === 0" class="muted small">今天城裡沒有可以雇用的冒險者。</p>
        <div class="cands">
          <article v-for="c in visible" :key="c.npc" class="cand">
            <template v-if="npcRecord(s, c.npc)">
              <header>
                <Avatar :id="c.npc" :size="52" />
                <div>
                  <NameTag :id="c.npc" />
                  <div class="small muted">{{ genderName(npcRecord(s, c.npc)!.gender) }}・{{ raceName(npcRecord(s, c.npc)!.race) }}・{{ className(npcRecord(s, c.npc)!.class) }} Lv.{{ npcRecord(s, c.npc)!.level }}</div>
                </div>
              </header>
              <p class="bio">{{ npcRecord(s, c.npc)!.personality }}</p>
              <p v-if="npcRecord(s, c.npc)!.appearance" class="small muted appearance">{{ npcRecord(s, c.npc)!.appearance }}</p>
              <div class="price-row">
                <span><span class="label">要價</span> <b>{{ formatMoney(askingFor(c)) }}</b><span v-if="c.counter_cc" class="tag">還價</span></span>
                <span v-if="c.declined" class="small muted">今天不想再談了</span>
                <button v-else class="small primary" :disabled="partyFull" @click="toggle(c)">{{ open === c.npc ? '收起' : '談雇傭' }}</button>
              </div>
              <div v-if="open === c.npc" class="nego small">
                <label>出價（{{ CURRENCY.short }}）<input v-model.number="offers[c.npc]" type="number" min="0" step="5" /></label>
                <label>談判方式（選填，會交給 AI 判定）<input v-model="approach[c.npc]" placeholder="例如：答應分他一成戰利品、請他喝酒" /></label>
                <button class="small primary" :disabled="(offers[c.npc] ?? 0) > s.money_cc || game.judging" @click="hire(c)">
                  {{ (offers[c.npc] ?? 0) >= askingFor(c) ? `雇用（${formatMoney(offers[c.npc] ?? 0)}）` : '提出條件（魅力檢定）' }}
                </button>
              </div>
            </template>
          </article>
        </div>
        <p v-if="partyFull" class="small muted">隊伍已滿（{{ combatRules.party_max }} 人）。</p>
      </template>

      <!-- 加入別人的隊伍 -->
      <template v-else-if="section === 'offers'">
        <p v-if="leader" class="small muted">你正跟著{{ leader.name }}的隊伍。想離開的話，到「隊伍」選擇離隊方式，會在下次休息時進行。</p>
        <template v-else>
          <div class="row wait">
            <button :disabled="partyFull" @click="game.waitForParty()"><GameIcon name="hourglass" :size="15" /> 等待組隊（{{ companionRules.wait_party.hours }} 小時）</button>
            <span class="small muted">機率約 {{ chance }}%，受魅力與等級影響；對方可能付簽約金給你。</span>
          </div>
          <p v-if="!offersHere.length" class="small muted">目前沒有隊伍邀請你。</p>
          <div class="cands">
            <article v-for="o in offersHere" :key="o.id" class="cand small">
              <header>
                <Avatar :id="o.leader" :size="44" />
                <div><NameTag :id="o.leader" /> <span class="muted">Lv.{{ npcRecord(s, o.leader)?.level }}</span><div class="muted">邀請你同行<template v-if="o.pay_cc">，願意付 {{ formatMoney(o.pay_cc) }}</template></div></div>
              </header>
              <div v-if="o.members.length" class="muted">隊員：<template v-for="(id, i) in o.members" :key="id"><span v-if="i">、</span><NameTag :id="id" /></template></div>
              <p class="bio">{{ npcRecord(s, o.leader)?.personality }}</p>
              <div class="row">
                <button class="small primary" @click="game.acceptPartyOffer(o.id)">加入</button>
                <button class="small" @click="game.declinePartyOffer(o.id)">婉拒</button>
              </div>
            </article>
          </div>
        </template>
      </template>

      <!-- 邀請 -->
      <template v-else-if="section === 'invite'">
        <input v-model="inviteText" class="wide" placeholder="邀請的方式（選填）" />
        <ul class="plain invite">
          <li v-for="r in inviteList" :key="r.id" class="row">
            <Avatar :id="r.id" :size="30" />
            <span class="grow"><NameTag :id="r.id" /> <span class="muted small">Lv.{{ r.level }}・親密度 {{ s.relationships?.[r.id]?.affinity }}</span></span>
            <button class="small" :disabled="partyFull || game.judging" @click="game.perform({ kind: 'invite', target: r.id, text: inviteText }); inviteText = ''">邀請</button>
          </li>
        </ul>
      </template>

      <!-- 黑市 -->
      <template v-else-if="section === 'black'">
        <MarketPanel v-if="blackKnown" kind="black" />
        <template v-else>
          <p class="small muted">有些城鎮有不公開的奴隸買賣。向酒館裡的人打聽看看（魅力檢定，約 2 小時）。</p>
          <input v-model="blackText" class="wide" placeholder="打聽的方式（選填）" />
          <button class="primary" :disabled="game.judging" @click="game.perform({ kind: 'black_market', text: blackText }); blackText = ''; section = null">打聽黑市</button>
        </template>
      </template>

      <!-- 酒館的交易 -->
      <ShopDialog v-else-if="section === 'trade'" type="tavern" :loading="tradeLoading" />
    </AppDialog>
  </div>
</template>

<style scoped>
.tavern { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); }
.wide { width: 100%; margin-bottom: 8px; }
.meals { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.meal { display: grid; gap: 4px; align-content: start; padding: 10px; background: #fff8e455; border: 1px solid var(--border); border-radius: 2px; }
.meal.off { opacity: 0.55; }
.meal header { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
.meal .price { font-weight: 700; color: var(--accent); white-space: nowrap; }
.meal p { margin: 0; }
.meal button { justify-self: start; }
.tag.good { color: var(--good); border-color: color-mix(in srgb, var(--good) 50%, transparent); }
.fed { margin-top: 10px; }
.cands { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.cand { display: grid; gap: 6px; align-content: start; padding: 12px; background: #fff8e455; border: 1px solid var(--border); border-radius: 2px; }
.cand header { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.bio { margin: 0; font-family: var(--font-story); font-size: var(--fs-sm); line-height: 1.8; }
.appearance { margin: 0; }
.price-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--border); }
.price-row b { color: var(--accent); font-size: var(--fs-lg); }
.nego { display: grid; gap: 4px; padding: 8px; background: var(--panel-2); border-radius: 3px; }
.nego label { display: grid; gap: 2px; }
.wait { margin-bottom: 10px; }
.wait button { display: inline-flex; align-items: center; gap: 4px; }
.invite li { gap: 8px; }
.grow { flex: 1; min-width: 0; }
</style>
