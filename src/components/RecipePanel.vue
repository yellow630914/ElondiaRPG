<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { attrName, craftRules, itemDef, type CraftId } from '@/engine/data'
import { CRAFT_IDS, crafters, skillOf, toolTierFor, toolTierName, toolWhere } from '@/engine/crafting'
import { currentCell } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { producedQty, produceTarget, recipeItems, recipePlan } from '@/engine/recipes'
import { shopTypeForCell } from '@/engine/trade'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import { itemEffect, itemText } from './items/itemInfo'

// 依配方製作（物品的 recipe，crafts.json 的 recipe；docs/CRAFTING.md 第 6 節）：藥劑、料理、家具、工具。
// 工藝 → 類別 → 配方卡片；做的人擲工藝的屬性檢定加工藝等級；不夠的材料可以向站的這間店當場補買
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const s = computed(() => game.state!)

// 站在店裡時先備好今天的商品清單（當場補買要看這裡賣什麼）
onMounted(() => {
  const type = shopTypeForCell(currentCell(s.value).kind)
  if (type) game.shopState(type)
})

const who = computed(() => crafters(s.value))
const crafterId = ref('pc')
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

const CATEGORY_NAME: Record<string, string> = { consumable: '藥劑與消耗品', food: '料理', furniture: '家具', gear: '工具', material: '材料' }
const categoryOf = (name: string) => itemDef(name)?.category ?? s.value.customItems?.[name]?.category ?? 'consumable'
const catName = (c: string) => CATEGORY_NAME[c] ?? c

// 上次選的工藝與類別記在瀏覽器裡
const MEMO = 'elondia.recipePick'
function recall(): { craft?: string; cat?: string; ready?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(MEMO) ?? '{}') as { craft?: string; cat?: string; ready?: boolean }
  } catch {
    return {}
  }
}
const memo = recall()
const buy = ref(true)
const batches = ref(1)
const all = computed(() => recipeItems().map((r) => ({ ...r, cat: categoryOf(r.name), plan: recipePlan(s.value, r.name, 1, crafter.value, { buy: buy.value }) })))
const crafts = computed(() => CRAFT_IDS.filter((c) => all.value.some((r) => r.recipe.craft === c)))
const craftPick = ref<string>(memo.craft ?? '')
const craft = computed<CraftId>(() => (crafts.value.includes(craftPick.value as CraftId) ? craftPick.value as CraftId : crafts.value[0]!))
const inCraft = computed(() => all.value.filter((r) => r.recipe.craft === craft.value))
const cats = computed(() => [...new Set(inCraft.value.map((r) => r.cat))])
const catPick = ref(memo.cat ?? '')
const cat = computed(() => (cats.value.includes(catPick.value) ? catPick.value : ''))
const onlyReady = ref(!!memo.ready)
watch([craft, cat, onlyReady], ([a, b, c]) => {
  try {
    localStorage.setItem(MEMO, JSON.stringify({ craft: a, cat: b, ready: c }))
  } catch {
    // 瀏覽器不給存：只是下次不記得
  }
})
function pickCraft(c: CraftId) {
  craftPick.value = c
  catPick.value = ''
}

// 搜尋：配方或成品的名字、類別
const query = ref('')
const rows = computed(() => {
  const q = query.value.trim()
  return (q ? all.value.filter((r) => r.name.includes(q) || catName(r.cat).includes(q)) : inCraft.value.filter((r) => !cat.value || r.cat === cat.value))
    .filter((r) => !onlyReady.value || !r.plan.blocked)
    .sort((a, b) => a.recipe.level - b.recipe.level || CRAFT_IDS.indexOf(a.recipe.craft) - CRAFT_IDS.indexOf(b.recipe.craft) || a.name.localeCompare(b.name))
})
/** 卡片上的狀態 */
function status(r: (typeof all.value)[number]): { ok: boolean; text: string } {
  if (r.plan.blocked) return { ok: false, text: r.plan.blockers[0]!.replace(/（.*$/, '') }
  return { ok: true, text: r.plan.buyCost ? `要補買 ${formatMoney(r.plan.buyCost)}` : '做得出來' }
}

const picked = ref('')
const name = computed(() => (rows.value.some((r) => r.name === picked.value) ? picked.value : (rows.value.find((r) => !r.plan.blocked) ?? rows.value[0])?.name ?? ''))
const plan = computed(() => (name.value ? recipePlan(s.value, name.value, batches.value, crafter.value, { buy: buy.value }) : undefined))
const skill = computed(() => (plan.value ? craftRules.skills[plan.value.recipe.craft] : undefined))
const sold = computed(() => plan.value?.inputs.some((x) => x.offer) ?? false)
const text = ref('')
const use = ref('')

function rename() {
  const from = plan.value?.name
  if (!from) return
  const to = prompt('自創物品的名字（配方也跟著改）', from)
  if (!to || to.trim() === from) return
  const n = game.renameInvention(from, to)
  if (n) picked.value = n
}

function forget() {
  if (plan.value && confirm(`忘記「${plan.value.name}」的配方？做好的成品會留著，但之後不能再做。`)) game.forgetInvention(plan.value.name)
}

function produce() {
  if (!plan.value) return
  const u = parseUse(use.value)
  void game.perform({ kind: 'produce', target: produceTarget(crafter.value.id, name.value, plan.value.batches, { buy: buy.value }), text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  use.value = ''
  emit('started')
}
</script>

<template>
  <div class="recipes small">
    <p class="muted intro">
      依配方製作
      <Hint text="依配方做藥劑、料理、家具與工具：材料從行囊扣，不夠的材料站在有賣的店裡可以當場補買；另外的花費（瓶子、溶劑、基本食材）照地點物價付。做的人擲屬性檢定，加上工藝等級；工具階級依配方等級。成功時做的人得到工藝經驗。" />
    </p>
    <div class="step">
      <span class="lab">誰來做</span>
      <select v-model="crafterId">
        <option v-for="w in who" :key="w.member.id" :value="w.member.id" :disabled="!!w.refusal">{{ w.member.name }}{{ w.refusal ? `（${w.refusal}）` : '' }}</option>
      </select>
    </div>
    <div class="step">
      <span class="lab">搜尋</span>
      <input v-model="query" class="search" placeholder="找配方或成品，例如「藥劑」「床」" />
    </div>
    <template v-if="!query.trim()">
      <div class="step">
        <span class="lab">工藝</span>
        <div class="chips">
          <button v-for="c in crafts" :key="c" class="small" :class="{ primary: craft === c }" @click="pickCraft(c)">
            {{ craftRules.skills[c].name }}<span class="n">Lv.{{ skillOf(crafter, c).level }}・{{ all.filter((r) => r.recipe.craft === c).length }}</span>
          </button>
        </div>
      </div>
      <div class="step">
        <span class="lab">類別</span>
        <div class="chips">
          <button class="small" :class="{ primary: !cat }" @click="catPick = ''">全部<span class="n">{{ inCraft.length }}</span></button>
          <button v-for="c in cats" :key="c" class="small" :class="{ primary: cat === c }" @click="catPick = c">{{ catName(c) }}<span class="n">{{ inCraft.filter((r) => r.cat === c).length }}</span></button>
          <button class="small" :class="{ primary: onlyReady }" @click="onlyReady = !onlyReady">只看做得出來的<span class="n">{{ inCraft.filter((r) => !r.plan.blocked).length }}</span></button>
        </div>
      </div>
    </template>
    <div class="step">
      <span class="lab">配方</span>
      <div v-if="rows.length" class="cards">
        <button v-for="r in rows" :key="r.name" class="card" :class="{ on: name === r.name, no: !!r.plan.blocked }" @click="picked = r.name">
          <b>{{ r.invented ? '★ ' : '' }}{{ r.name }}{{ (r.recipe.qty ?? 1) > 1 ? ` ×${r.recipe.qty}` : '' }}</b>
          <span class="muted">{{ query.trim() ? `${craftRules.skills[r.recipe.craft].name}・` : '' }}Lv.{{ r.recipe.level }}・<span :class="status(r).ok ? 'ok' : 'bad'">{{ status(r).text }}</span></span>
          <span class="muted">{{ r.plan.inputs.map((x) => `${x.name} ${Math.min(x.have, x.need)}/${x.need}`).join('、') || '不需要材料' }}</span>
        </button>
      </div>
      <p v-else class="muted">{{ onlyReady ? '沒有現在做得出來的配方。' : '沒有符合的配方。' }}</p>
    </div>

    <div v-if="plan && skill" class="detail">
      <div class="head">
        <b class="name">{{ plan.name }}</b>
        <span class="muted">{{ skill.name }} Lv.{{ plan.recipe.level }}・{{ catName(categoryOf(plan.name)) }}</span>
        <template v-if="s.inventions?.[plan.name]"><span class="tag"><GameIcon name="lightbulb" :size="12" />自創</span> <button class="small" @click="rename"><GameIcon name="edit" :size="13" /> 改名</button> <button class="small" @click="forget">忘記這個配方</button></template>
      </div>
      <p v-if="itemText(s, plan.name)" class="desc">{{ itemText(s, plan.name) }}</p>
      <p v-if="itemEffect(s, plan.name)">效果：{{ itemEffect(s, plan.name) }}</p>
      <div class="kv">
        批數
        <button v-for="n in craftRules.recipe.max_batches" :key="n" class="small" :class="{ primary: plan.batches === n }" @click="batches = n">{{ n }}</button>
        <span class="muted">材料、花費與時間乘批數，只擲一次</span>
      </div>
      <table v-if="plan.inputs.length" class="mats">
        <thead><tr><th>材料</th><th>需要</th><th>持有</th><th>這裡賣</th><th>當場買</th></tr></thead>
        <tbody>
          <tr v-for="x in plan.inputs" :key="x.name">
            <td>{{ x.name }}</td>
            <td>{{ x.need }}</td>
            <td :class="{ short: x.have < x.need }">{{ x.have }}</td>
            <td>{{ x.offer ? `${formatMoney(x.offer.price)}（剩 ${x.offer.stock}）` : '—' }}</td>
            <td>
              <span v-if="x.buy" class="ok">{{ x.buy }} 份・{{ formatMoney(x.buy * x.offer!.price) }}</span>
              <span v-else-if="x.have < x.need" class="short">缺 {{ x.need - x.have }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">不需要材料。</p>
      <label v-if="sold" class="check"><input v-model="buy" type="checkbox" /> 不夠的當場補買（照這間店的售價）</label>
      <table class="outcomes">
        <tbody>
        <tr><th>大成功</th><th>成功</th><th>部分成功</th><th>失敗</th><th>大失敗</th></tr>
        <tr>
          <td>{{ producedQty(plan.qty, 'critical') }} 份</td>
          <td>{{ plan.qty }} 份</td>
          <td>{{ producedQty(plan.qty, 'partial') }} 份</td>
          <td>材料損失一半</td>
          <td>材料全部損失<span class="muted">（花費照付）</span></td>
        </tr>
        </tbody>
      </table>
      <div class="kv">
        <span>{{ skill.name }} <b>{{ crafter.name }} Lv.{{ plan.level }}</b><span class="muted">（這個配方要 Lv.{{ plan.recipe.level }}）</span></span>
        <span>檢定 <b>工藝 +{{ plan.level * craftRules.level_bonus }}、{{ attrName(skill.attr) }}調整值 ÷{{ craftRules.attr_div }}・DC {{ plan.dc }}</b></span>
        <span>時間 <b>約 {{ plan.hours }} 小時</b></span>
        <span>工具 <b>要{{ toolTierName(toolTierFor(plan.recipe.level)) }}</b> <Hint :text="toolWhere(plan.recipe.craft, toolTierFor(plan.recipe.level))" /><span class="muted">・現在 {{ plan.tool.source }}</span></span>
        <span v-if="plan.fee || plan.buyCost">花費 <b>{{ formatMoney(plan.fee) }}</b><span v-if="plan.rent" class="muted">（含工坊租金 {{ formatMoney(plan.rent) }}）</span><template v-if="plan.buyCost">＋補買 <b>{{ formatMoney(plan.buyCost) }}</b></template></span>
      </div>
      <ul v-if="plan.blocked" class="warn blockers"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
      <template v-else>
        <input v-model="text" placeholder="想怎麼做（選填）：例如加一點蜂蜜讓藥比較好入口" />
        <AbilityPicker v-model="use" />
        <div class="go">
          <button class="primary" :disabled="game.judging || !!s.pendingAction" @click="produce"><GameIcon name="scroll" :size="14" /> {{ crafter.isPlayer ? '動手製作' : `請${crafter.name}製作` }}（{{ plan.qty }} 份）</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.recipes { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
.recipes p { margin: 0; }
.intro { display: flex; align-items: center; gap: 4px; }
.step { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; align-items: start; }
.step > .lab { color: var(--muted); font-weight: 600; padding-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips .n { margin-left: 4px; font-size: var(--fs-xs); opacity: 0.75; }
.search { width: 100%; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.card { text-align: left; display: grid; gap: 2px; padding: 6px 9px; }
.card.on { outline: 2px solid var(--accent); outline-offset: -1px; }
.card.no { opacity: 0.6; }
.card .muted { font-size: var(--fs-xs); }
.ok { color: var(--good); }
.bad, .short, .warn { color: var(--danger); }
.detail { border: 1px solid var(--border); border-radius: 4px; padding: 10px 12px; display: grid; gap: 8px; }
.detail input:not([type]) { width: 100%; }
.head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.name { font-size: 1.05rem; }
.desc { color: var(--muted); font-family: var(--font-story); }
table { width: 100%; border-collapse: collapse; }
.mats th { text-align: left; font-weight: 600; color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--border); }
.mats td { padding: 4px 6px; border-bottom: 1px dashed color-mix(in srgb, currentColor 15%, transparent); }
.check { display: flex; gap: 6px; align-items: center; }
.outcomes { text-align: center; font-size: var(--fs-xs); }
.outcomes th { font-weight: 600; color: var(--muted); padding: 4px; border-bottom: 1px solid var(--border); }
.outcomes td { padding: 4px; }
.kv { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
.go { display: flex; justify-content: flex-end; }
@media (max-width: 640px) {
  .step { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .step > .lab { padding-top: 0; }
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
