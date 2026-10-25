<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { apMaxFor, apRegenFor, attrsOf, mod } from '@/engine/character'
import { askingFor, invitable, marketsHere, partyOffersHere, proposeDc, waitChance } from '@/engine/companions'
import { abilityDef, attributeRules, className, companionRules, conditionName, genderName, raceName } from '@/engine/data'
import { mealMenu } from '@/engine/meals'
import { CURRENCY, formatMoney } from '@/engine/money'
import { characterFor, npcRecord } from '@/engine/npcs'
import { perksOf } from '@/engine/perks'
import { isBound, isNoncombatant, leaderOf, partyMax, partyRoom } from '@/engine/party'
import { canNegotiate } from '@/engine/negotiation'
import { discount, keeperTitle, shopKey } from '@/engine/trade'
import type { Character, TavernCandidate } from '@/engine/types'
import { useGame } from '@/stores/game'
import MarketPanel from './MarketPanel.vue'
import { spellSlots } from './party/memberInfo'
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
const partyFull = computed(() => partyRoom(s.value) < 1)
const maxParty = computed(() => partyMax(s.value))

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

// 雇用前的預覽：角色資料以 NPC id 當種子產生，和入隊後一樣
const previews = computed(() => {
  const out: Record<string, Character> = {}
  for (const c of visible.value) {
    const rec = npcRecord(s.value, c.npc)
    if (rec) out[c.npc] = characterFor(s.value, rec)
  }
  return out
})
const pv = (id: string) => previews.value[id]!
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`

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

// 被主人帶著：不能自己雇人，改成向主人提議（主人出錢，見 companions.ts 的 proposeDc）
const master = computed(() => (bound.value ? leaderOf(s.value) : undefined))
function proposeDcOf(id: string): number | null {
  try {
    return proposeDc(s.value, { kind: 'hire', npc: id })
  } catch {
    return null
  }
}
const proposedToday = (id: string) => s.value.flags[`propose_no:${id}`] === s.value.time.day
async function propose(c: TavernCandidate) {
  await game.perform({ kind: 'propose', target: `hire:${c.npc}`, text: approach[c.npc] ?? '' })
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
  if (bound.value) {
    items.push({ id: 'recruit', icon: 'users', label: '向主人提議雇人', detail: partyFull.value ? `隊伍已滿（${maxParty.value} 人）` : visible.value.length ? `請${master.value?.name ?? '主人'}出錢雇用今天城裡的冒險者（${visible.value.length} 位）` : '今天城裡沒有可以雇用的冒險者', badge: visible.value.length || '', tone: 'gold' })
  } else {
    items.push(
      { id: 'recruit', icon: 'users', label: '招募冒險者', detail: partyFull.value ? `隊伍已滿（${maxParty.value} 人）` : visible.value.length ? `今天城裡有 ${visible.value.length} 位可以雇用` : '今天城裡沒有可以雇用的冒險者', badge: visible.value.length || '', tone: 'gold' },
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
    <p v-if="bound" class="small muted">身為奴隸，你不能自己雇人或找隊伍；想多個隊友，可以向主人提議。</p>
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
              <template v-if="previews[c.npc]">
                <div class="vitals small">
                  <span><span class="label">HP</span> <b>{{ pv(c.npc).maxHp }}</b></span>
                  <template v-if="!isNoncombatant(pv(c.npc))">
                    <span><span class="label">AP</span> <b>{{ apMaxFor(pv(c.npc).level, attrsOf(pv(c.npc))) }}</b><small class="muted">（每回合 +{{ apRegenFor(pv(c.npc).level) }}）</small></span>
                    <span v-if="spellSlots(pv(c.npc)).length"><span class="label">法術環</span> {{ spellSlots(pv(c.npc)).map((x) => `${x.circle}環×${x.max}`).join('・') }}</span>
                  </template>
                </div>
                <div class="attr5">
                  <span v-for="a in attributeRules.attributes" :key="a.id" :title="a.desc">
                    <span class="label">{{ a.name }}</span>
                    <b>{{ attrsOf(pv(c.npc))[a.id] }}</b><small>{{ signed(mod(attrsOf(pv(c.npc))[a.id])) }}</small>
                  </span>
                </div>
                <div v-if="pv(c.npc).abilities.length" class="chips">
                  <span class="label small">能力</span>
                  <span v-for="id in pv(c.npc).abilities" :key="id" class="tag" :title="abilityDef(id).desc">{{ abilityDef(id).name }}</span>
                </div>
                <div v-if="perksOf(pv(c.npc)).length" class="chips">
                  <span class="label small">特質</span>
                  <span v-for="p in perksOf(pv(c.npc))" :key="p.id" class="tag" :class="{ bad: p.flaw }" :title="p.desc">{{ p.name }}<template v-if="p.flaw">（缺陷）</template></span>
                </div>
              </template>
              <p class="bio">{{ npcRecord(s, c.npc)!.personality }}</p>
              <details v-if="npcRecord(s, c.npc)!.appearance" class="appearance small">
                <summary>外貌</summary>
                <p class="muted">{{ npcRecord(s, c.npc)!.appearance }}</p>
              </details>
              <div class="price-row">
                <span><span class="label">要價</span> <b>{{ formatMoney(askingFor(c)) }}</b><span v-if="c.counter_cc" class="tag">還價</span></span>
                <template v-if="bound">
                  <span v-if="proposedToday(c.npc)" class="small muted">主人今天不想再聽你提這個人</span>
                  <button v-else class="small primary" :disabled="partyFull" @click="toggle(c)">{{ open === c.npc ? '收起' : '向主人提議' }}</button>
                </template>
                <span v-else-if="c.declined" class="small muted">今天不想再談了</span>
                <button v-else class="small primary" :disabled="partyFull" @click="toggle(c)">{{ open === c.npc ? '收起' : '談雇傭' }}</button>
              </div>
              <div v-if="open === c.npc && bound" class="nego small">
                <p class="muted">請{{ master?.name ?? '主人' }}出錢雇用，加入後是主人的隊員。魅力檢定，參考 DC {{ proposeDcOf(c.npc) ?? '—' }}（主人的親密度、要價相對主人的財力、主人的身分、契約的服從懲罰）。部分成功時主人要你出一半。</p>
                <label><span>怎麼說服主人（選填） <Hint text="會交給 AI 判定。" /></span><input v-model="approach[c.npc]" placeholder="例如：說他能幫主人扛行李、打退攔路的人" /></label>
                <button class="small primary" :disabled="game.judging" @click="propose(c)">向主人提議雇用（魅力檢定）</button>
              </div>
              <div v-else-if="open === c.npc" class="nego small">
                <label>出價（{{ CURRENCY.short }}）<input v-model.number="offers[c.npc]" type="number" min="0" step="5" /></label>
                <label><span>談判方式（選填） <Hint text="會交給 AI 判定。" /></span><input v-model="approach[c.npc]" placeholder="例如：答應分他一成戰利品、請他喝酒" /></label>
                <button class="small primary" :disabled="(offers[c.npc] ?? 0) > s.money_cc || game.judging" @click="hire(c)">
                  {{ (offers[c.npc] ?? 0) >= askingFor(c) ? `雇用（${formatMoney(offers[c.npc] ?? 0)}）` : '提出條件（魅力檢定）' }}
                </button>
              </div>
            </template>
          </article>
        </div>
        <p v-if="partyFull" class="small muted">隊伍已滿（{{ maxParty }} 人）。</p>
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
.appearance summary { cursor: pointer; color: var(--accent-2); }
.appearance p { margin: 4px 0 0; }
.vitals { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.vitals b { font-variant-numeric: tabular-nums; }
.label { color: var(--muted); }
.attr5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.attr5 > span { display: grid; justify-items: center; padding: 2px 0 1px; background: #fff8e488; border: 1px solid #c4a670; border-radius: 2px; }
.attr5 .label { font-size: var(--fs-xs); letter-spacing: 0.2em; line-height: 1.3; }
.attr5 b { font-size: 1.05rem; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; }
.attr5 small { font-size: var(--fs-xs); color: #8a4a1e; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
.chips .label { margin-right: 2px; }
.tag.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
.price-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--border); }
.price-row b { color: var(--accent); font-size: var(--fs-lg); }
.nego { display: grid; gap: 4px; padding: 8px; background: var(--panel-2); border-radius: 3px; }
.nego label { display: grid; gap: 2px; }
.wait { margin-bottom: 10px; }
.wait button { display: inline-flex; align-items: center; gap: 4px; }
.invite li { gap: 8px; }
.grow { flex: 1; min-width: 0; }
</style>
