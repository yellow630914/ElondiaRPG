<script setup lang="ts">
import { blueprintName, blueprintRules } from '@/engine/blueprints'
import { computed, onMounted, ref, watch } from 'vue'
import { attrName, craftRules, damageTypeName, itemDef } from '@/engine/data'
import { canCraftHere, commissionHere, craftPlan, craftRarity, craftTarget, forgeOf, isAdultCraft, makeTarget, outfitCommission, selfFeeName, selfLewdBonus, type AuxItem } from '@/engine/craft'
import { lewdName } from '@/engine/lewd'
import type { LewdStat } from '@/engine/types'
import { craftForKind, crafters, skillOf, toolTierFor, toolTierName, toolWhere } from '@/engine/crafting'
import {
  baseShown, baseSlotName, baseType, CRAFT_SLOT_ORDER, gearName, gearRules, gearSummary, MATERIAL_KIND_NAME, rarityName, rarityPoints, sortBaseTypes, type BaseSlot,
} from '@/engine/gear'
import { formatMoney } from '@/engine/money'
import { shopTypeForCell } from '@/engine/trade'
import { currentCell } from '@/engine/grid'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import AppDialog from './AppDialog.vue'
import BuildingMenu, { type MenuItem } from './place/BuildingMenu.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import ContentIcon from './icons/ContentIcon.vue'

// 打造裝備（data/rules/gear.json 的 craft；docs/CRAFTING.md）：部位 → 類型 → 底材 → 材料，可以描述想要的樣子。
// commission：在鐵匠鋪、裁縫店、珠寶店委託店主；make：主角或肯幫忙的夥伴自己動手（crafts.json）
const props = withDefaults(defineProps<{ mode?: 'commission' | 'make' }>(), { mode: 'commission' })
const make = computed(() => props.mode === 'make')
// 店裡的委託打造是選單的一列，點了打開對話框；工藝對話框裡直接顯示
const menuItem = computed<MenuItem>(() => ({
  id: 'commission', icon: 'tools', label: '委託打造', detail: `店主擲工藝檢定，約 ${gearRules.craft.hours} 小時`,
}))
const open = ref(false)
const emit = defineEmits<{ started: [] }>()
const game = useGame()
const s = computed(() => game.state!)
// 成人用品店的委託打造在自己的畫面（adult/OutfitAtelier.vue），這裡不列
const here = computed(() => make.value || (canCraftHere(s.value) && currentCell(s.value).kind !== outfitCommission().shop))

// 站在店裡時先備好今天的商品清單（當場補買材料要看這裡賣什麼）
onMounted(() => {
  const type = shopTypeForCell(currentCell(s.value).kind)
  if (type) game.shopState(type)
})

// 自己動手：誰來做（不肯幫忙的列出原因）
const who = computed(() => crafters(s.value))
const crafterId = ref('pc')
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer)!)

// ---- 部位 → 類型 → 底材 ----
// 委託：只列這間店做得出來的底材（鐵匠鋪：金屬、木材；裁縫店：皮革、布料；珠寶店：寶石；成人向服裝只在成人用品店）；自己動手：全部
const bases = computed(() => Object.entries(gearRules.bases)
  // 拘束具只能自己動手打造（委託在成人用品店的訂製畫面）；詛咒具這類專屬底材不能打造
  .filter(([id, b]) => !b.exclusive && (!b.restraint || make.value) && baseShown(id) && (make.value || commissionHere(s.value, id)))
  .map(([id, b]) => ({ id, ...b, type: baseType(id) }))
  .sort((a, b) => a.price - b.price))
const slots = computed(() => [
  ...CRAFT_SLOT_ORDER.filter((x) => bases.value.some((b) => b.slot === x)),
  ...[...new Set(bases.value.map((b) => b.slot))].filter((x) => !CRAFT_SLOT_ORDER.includes(x)),
])

// 上次選的部位與類型記在瀏覽器裡
const MEMO = 'elondia.craftPick'
function recall(): { slot?: string; type?: string; base?: string } {
  try {
    return JSON.parse(localStorage.getItem(MEMO) ?? '{}') as { slot?: string; type?: string; base?: string }
  } catch {
    return {}
  }
}
const memo = recall()
const slotPick = ref(memo.slot ?? '')
const typePick = ref(memo.type ?? '')
const basePick = ref(memo.base ?? '')
const slot = computed(() => (slots.value.includes(slotPick.value as BaseSlot) ? slotPick.value : slots.value[0] ?? 'main_hand'))
const inSlot = computed(() => bases.value.filter((b) => b.slot === slot.value))
const types = computed(() => sortBaseTypes(inSlot.value.map((b) => b.type)))
const type = computed(() => (types.value.includes(typePick.value) ? typePick.value : types.value[0] ?? ''))
const list = computed(() => inSlot.value.filter((b) => b.type === type.value))
const base = computed(() => (list.value.some((b) => b.id === basePick.value) ? basePick.value : list.value[0]?.id ?? 'longsword'))
watch([slot, type, base], ([a, b, c]) => {
  try {
    localStorage.setItem(MEMO, JSON.stringify({ slot: a, type: b, base: c }))
  } catch {
    // 瀏覽器不給存：只是下次不記得
  }
})
function pickSlot(x: string) {
  slotPick.value = x
  typePick.value = ''
}

// 搜尋：直接跳到底材（玩家找不到「皮頭盔」，實際叫「皮帽」）
const query = ref('')
const hits = computed(() => {
  const q = query.value.trim()
  return q ? bases.value.filter((b) => b.name.includes(q)).slice(0, 12) : []
})
function jump(id: string) {
  const b = bases.value.find((x) => x.id === id)
  if (!b) return
  slotPick.value = b.slot
  typePick.value = b.type
  basePick.value = b.id
  query.value = ''
}

/** 一件裝備的數值（拿掉開頭的稀有度與部位） */
const statsOf = (b: string, m: string) => gearSummary({ base: b, material: m }).split('・').slice(2).join('・')
const firstMaterial = (kind: string) => Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind).sort(([, a], [, b]) => a.tier - b.tier)[0]?.[0] ?? 'iron'

// ---- 材料：比較每種材料做出來的數值 ----
const kind = computed(() => gearRules.bases[base.value]!.kind)
const materials = computed(() => Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind.value).sort(([, a], [, b]) => a.tier - b.tier).map(([id, m]) => ({ id, ...m })))
/** 做得了第幾級（自己動手看做的人，委託看店主；工藝照材料類型） */
const levelHere = computed(() => (make.value
  ? skillOf(crafter.value, craftForKind(kind.value)).level
  : craftPlan(s.value, base.value, firstMaterial(kind.value)).level))
const canDo = (tier: number) => levelHere.value >= tier
const material = ref('')
const mat = computed(() => {
  if (materials.value.some((m) => m.id === material.value)) return material.value
  // 預設：做得了的材料裡，有持有的最高一級；都沒有就用最低一級
  const ok = materials.value.filter((m) => canDo(m.tier))
  return ([...ok].reverse().find((m) => ownedOf(m.id) > 0) ?? ok[0] ?? materials.value[0]!).id
})
const ownedOf = (m: string) => s.value.inventory.filter((i) => forgeOf(i.name).includes(m)).reduce((n, i) => n + i.qty, 0)

// ---- 打造材料的來源：選用哪一種、不夠時當場補買 ----
const usePick = ref('')
const buy = ref(true)
// 輔料：行囊裡的任何材料（最多三種），不論結果都會用掉
const aux = ref<AuxItem[]>([])
const auxPick = ref('')
const auxRules = gearRules.craft.aux
const auxOptions = computed(() => s.value.inventory.filter((i) => itemDef(i.name)?.category === 'material' && !aux.value.some((a) => a.name === i.name)))
function addAux() {
  if (!auxPick.value || aux.value.length >= auxRules.max_kinds) return
  aux.value.push({ name: auxPick.value, qty: 1 })
  auxPick.value = ''
}
// 自己打造成人向服裝、拘束具：另外選一項慾望指標，加成照做的人自己的指標（craft.ts 的 selfLewdBonus）
const lewdPick = ref<LewdStat | ''>('')
const lewdStats = computed(() => (make.value && isAdultCraft(base.value)
  ? outfitCommission().stats.map((st) => ({ st, bonus: selfLewdBonus(crafter.value, st, base.value, mat.value) }))
  : []))
const opts = computed(() => ({
  ...(usePick.value ? { use: usePick.value } : {}), ...(buy.value ? { buy: true } : {}),
  ...(lewdPick.value && lewdStats.value.some((x) => x.st === lewdPick.value && x.bonus > 0) ? { lewd: lewdPick.value } : {}),
}))
const plan = computed(() => craftPlan(s.value, base.value, mat.value, aux.value, make.value ? crafter.value : undefined, opts.value))
const skill = computed(() => craftRules.skills[plan.value.craft])
/** 這間店有賣能做成這種材料的東西 */
const soldHere = computed(() => plan.value.sources.filter((x) => x.price !== undefined))
const needBuy = computed(() => plan.value.units > plan.value.have)
const text = ref('')
const use = ref('')
const slotLabel = (x: string) => baseSlotName(x as BaseSlot)
const name = computed(() => gearName({ base: base.value, material: mat.value }))
// 數值：自己打造選了慾望指標時，一起算進去（和底材預設的加值合在一起，每項最多 item_cap）
const line = computed(() => {
  const pick = opts.value.lewd
  const bonus = pick ? lewdStats.value.find((x) => x.st === pick)?.bonus ?? 0 : 0
  return gearSummary({ base: base.value, material: mat.value, ...(pick && bonus ? { lewd: { [pick]: bonus } } : {}) }).split('・').slice(2).join('・')
})
/** 這個材料做不出加成時：換哪一種才有 */
const better = computed(() => (line.value ? undefined : materials.value.find((m) => statsOf(base.value, m.id))))
const DEGREES = [['critical', '大成功'], ['success', '成功'], ['partial', '部分成功']] as const

function craft() {
  const u = parseUse(use.value)
  const target = make.value
    ? makeTarget(crafter.value.id, base.value, mat.value, aux.value, opts.value)
    : craftTarget(base.value, mat.value, aux.value, opts.value)
  void game.perform({ kind: make.value ? 'make' : 'craft', target, text: text.value, ...(u ? { use: u } : {}) })
  text.value = ''
  aux.value = []
  use.value = ''
  open.value = false
  emit('started')
}
</script>

<template>
  <BuildingMenu v-if="!make && here" :items="[menuItem]" @pick="open = true" />
  <component
    :is="make ? 'div' : AppDialog"
    v-if="here"
    v-bind="make ? {} : { open, title: '委託打造', icon: 'tools', width: '860px' }"
    v-on="make ? {} : { close: () => (open = false) }"
  >
  <div class="craft small">
    <p v-if="!make" class="muted intro">
      選部位、類型、底材，再選材料
      <Hint text="第一級材料由工匠提供；第二級以上要用行囊裡的打造材料（不夠時，這間店有賣就能當場補買）。店主的工藝等級要達到材料等級，比需要的高時做得更好。" />
    </p>
    <p v-else class="muted intro">
      自己打造
      <Hint text="每件裝備要用幾份打造材料；行囊裡不夠的，站在有賣的店裡可以當場補買。做的人擲屬性檢定，加上工藝等級；做的人得到工藝經驗：材料等級 × 用了幾份材料 × 成功程度（大成功 3、成功 2、部分成功與失敗 1），大件的經驗比小件多。" />
    </p>

    <div v-if="make" class="step">
      <span class="lab">誰來做</span>
      <select v-model="crafterId">
        <option v-for="w in who" :key="w.member.id" :value="w.member.id" :disabled="!!w.refusal">{{ w.member.name }}{{ w.refusal ? `（${w.refusal}）` : '' }}</option>
      </select>
    </div>

    <div class="step">
      <span class="lab">搜尋</span>
      <div>
        <input v-model="query" class="search" placeholder="直接找底材，例如「帽」「靴」「弓」" />
        <div v-if="hits.length" class="chips hits">
          <button v-for="b in hits" :key="b.id" class="small" @click="jump(b.id)">{{ slotLabel(b.slot) }}・{{ b.type }}・{{ b.name }}</button>
        </div>
        <p v-else-if="query.trim()" class="muted">沒有名字裡有「{{ query.trim() }}」的底材{{ make ? '' : '（這間店做的）' }}。</p>
      </div>
    </div>

    <div class="step">
      <span class="lab">部位</span>
      <div class="chips">
        <button v-for="x in slots" :key="x" class="small" :class="{ primary: slot === x }" @click="pickSlot(x)">
          {{ slotLabel(x) }}<span class="n">{{ bases.filter((b) => b.slot === x).length }}</span>
        </button>
      </div>
    </div>

    <div class="step">
      <span class="lab">類型</span>
      <div class="chips">
        <button v-for="t in types" :key="t" class="small" :class="{ primary: type === t }" @click="typePick = t">
          {{ t }}<span class="n">{{ inSlot.filter((b) => b.type === t).length }}</span>
        </button>
      </div>
    </div>

    <div class="step">
      <span class="lab">底材</span>
      <div class="bases">
        <button v-for="b in list" :key="b.id" class="base" :class="{ on: base === b.id }" @click="basePick = b.id">
          <b>{{ b.name }}</b>
          <span class="muted">{{ MATERIAL_KIND_NAME[b.kind] }}<template v-if="statsOf(b.id, firstMaterial(b.kind))">・{{ statsOf(b.id, firstMaterial(b.kind)) }}</template></span>
        </button>
      </div>
    </div>

    <div class="step">
      <span class="lab">材料</span>
      <div>
        <table class="mats">
          <thead><tr><th>材料</th><th>等級</th><th class="wide">適合</th><th>持有</th><th>做出來的數值</th></tr></thead>
          <tbody>
            <tr v-for="m in materials" :key="m.id" class="mrow" :class="{ on: mat === m.id, locked: !canDo(m.tier) }" @click="material = m.id">
              <td class="nm"><ContentIcon kind="material" :id="m.id" :size="18" /> {{ m.name }}</td>
              <td class="nw">第 {{ m.tier }} 級<template v-if="!canDo(m.tier)"> 🔒</template></td>
              <td class="nw wide">建議 Lv.{{ m.level }}</td>
              <td class="nw">{{ m.tier === 1 && !make ? '工匠提供' : `${ownedOf(m.id)} 份` }}</td>
              <td :class="statsOf(base, m.id) ? 'stat' : 'muted'">{{ statsOf(base, m.id) || '沒有加成' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="muted note">
          <template v-if="materials.some((m) => !canDo(m.tier))">🔒 {{ make ? `${crafter.name}的${skill.name}是 Lv.${levelHere}` : `這裡的工匠${skill.name}是 Lv.${levelHere}` }}，還做不了這一級。</template>
          數值由材料決定；成功程度只影響稀有度與附魔點數。
        </p>
      </div>
    </div>

    <!-- 打造材料的來源 -->
    <div v-if="plan.units" class="step">
      <span class="lab">打造材料</span>
      <div class="source">
        <div :class="{ short: plan.have < plan.units && !plan.buys.length }">
          需要 {{ plan.units }} 份能做成{{ gearRules.materials[mat]!.name }}的材料，持有 {{ plan.have }} 份
          <span v-if="plan.uses.length" class="muted">（用掉 {{ plan.uses.map((u) => `${u.name}×${u.qty}`).join('、') }}）</span>
        </div>
        <label v-if="plan.sources.filter((x) => x.have > 0 || x.price !== undefined).length > 1" class="row">
          優先用
          <select v-model="usePick">
            <option value="">最便宜的</option>
            <option v-for="x in plan.sources.filter((y) => y.have > 0 || y.price !== undefined)" :key="x.name" :value="x.name">
              {{ x.name }}（持有 {{ x.have }}{{ x.price !== undefined ? `・這裡賣 ${formatMoney(x.price)}` : '' }}）
            </option>
          </select>
        </label>
        <label v-if="soldHere.length && (needBuy || buy)" class="row check">
          <input v-model="buy" type="checkbox" /> 不夠的當場補買
          <span class="muted">（這裡有賣：{{ soldHere.map((x) => `${x.name} ${formatMoney(x.price!)}／份，剩 ${x.stock}`).join('、') }}）</span>
        </label>
        <div v-if="plan.buys.length" class="muted">當場買 {{ plan.buys.map((b) => `${b.name}×${b.qty}`).join('、') }}：{{ formatMoney(plan.buyCost) }}</div>
        <div v-else-if="needBuy && !soldHere.length" class="muted">這裡沒有賣；可以到{{ kind === 'metal' || kind === 'wood' ? '鐵匠鋪或雜貨店' : kind === 'jewel' ? '珠寶店' : '裁縫店或雜貨店' }}買，或打怪、開寶箱取得。</div>
      </div>
    </div>

    <!-- 成品 -->
    <div class="result">
      <h3>{{ name }} <span class="muted">{{ slotLabel(gearRules.bases[base]!.slot) }}・{{ type }}</span></h3>
      <div v-if="lewdStats.length" class="lewd-row">
        <label>慾望指標
          <select v-model="lewdPick">
            <option value="">不加</option>
            <option v-for="x in lewdStats" :key="x.st" :value="x.st" :disabled="!x.bonus">{{ lewdName(x.st) }} +{{ x.bonus }}</option>
          </select>
        </label>
        <Hint text="自己打造成人向服裝、拘束具時可以加一項慾望指標：（委託的加成 + 1～2）× 做的人自己那一項的基本值 ÷ 100：指標 100 時第 1、2、3、4 級以上分別是 +5、+7、+10、+12，比成人用品店委託（+4、+6、+8、+10）多一點。" />
      </div>
      <div :class="line ? 'stat' : 'muted'">
        數值：{{ line || '這個材料做出來沒有加成' }}<template v-if="better">（換成{{ better.name }}：{{ statsOf(base, better.id) }}）</template>
      </div>
      <table class="outcomes">
        <tbody>
        <tr><th v-for="[, n] in DEGREES" :key="n">{{ n }}</th><th>失敗</th></tr>
        <tr>
          <td v-for="[d] in DEGREES" :key="d">
            {{ rarityName(craftRarity(mat, d)!) }}
            <div class="muted">{{ d === 'partial' ? '沒有附魔' : `附魔 ${rarityPoints(craftRarity(mat, d)!)} 點（隨機）` }}</div>
          </td>
          <td>材料損失一半</td>
        </tr>
        </tbody>
      </table>
      <div class="kv">
        <span>{{ skill.name }} <b>{{ make ? `${crafter.name} Lv.${skillOf(crafter, plan.craft).level}` : `工匠 Lv.${plan.level}` }}</b><span class="muted">（這個材料要 Lv.{{ plan.tier }}）</span></span>
        <span>檢定 <b><template v-if="make">工藝 +{{ plan.level * craftRules.level_bonus }}、{{ attrName(skill.attr) }}調整值 ÷{{ craftRules.attr_div }}</template><template v-else>店主擲：手藝 +{{ plan.level * craftRules.level_bonus }}</template>・DC {{ plan.dc }}</b></span>
        <span v-if="make">圖紙 <b :class="plan.blueprint ? '' : 'warn-text'">{{ plan.blueprint ? `有${blueprintName(plan.base)}` : `沒有（DC +${blueprintRules().dc_without}）` }}</b> <Hint text="每個底材一張圖紙，不會用掉、任何材料都適用。鐵匠鋪、裁縫店、珠寶店有賣，寶箱與人形的敵人身上也可能找到。委託店家打造不需要。" /></span>
        <span>時間 <b>約 {{ make ? craftRules.self.hours : gearRules.craft.hours }} 小時</b></span>
        <span v-if="make">工具 <b>要{{ toolTierName(toolTierFor(plan.tier)) }}</b> <Hint :text="toolWhere(plan.craft, toolTierFor(plan.tier))" /><span class="muted">・現在 {{ plan.tool?.source }}</span></span>
        <span>{{ make ? selfFeeName(plan) : '工錢' }} <b>{{ formatMoney(plan.fee) }}</b><Hint v-if="plan.materialCost" text="第 1 級材料：材料費照底材的價格算（底材價格的一半，乘這裡的物價），用掉的打造材料抵掉它們的價值。" /><template v-if="plan.buyCost">＋補買 <b>{{ formatMoney(plan.buyCost) }}</b></template></span>
      </div>
      <div class="aux-row">
        <span>輔料 <Hint :text="`選填，最多 ${auxRules.max_kinds} 種；不論結果都會用掉。價值越高越可能讓稀有度再高一級（部分成功時照成功做）；名稱與描述決定附魔偏向的屬性。`" /></span>
        <span v-for="(a, i) in aux" :key="a.name" class="tag">
          {{ a.name }} ×<input v-model.number="a.qty" type="number" min="1" :max="auxRules.max_qty" class="qty" />
          <button class="x" @click="aux.splice(i, 1)">×</button>
        </span>
        <template v-if="aux.length < auxRules.max_kinds && auxOptions.length">
          <select v-model="auxPick">
            <option value="">加入材料…</option>
            <option v-for="i in auxOptions" :key="i.name" :value="i.name">{{ i.name }}（持有 {{ i.qty }}）</option>
          </select>
          <button class="small" :disabled="!auxPick" @click="addAux">＋</button>
        </template>
        <span v-else-if="!aux.length" class="muted">行囊裡沒有材料。</span>
        <span v-if="aux.length" class="muted">
          {{ Math.round(plan.auxChance * 100) }}% 機率稀有度再高一級<template v-if="plan.elements.length">・附魔偏向 {{ plan.elements.map((e) => damageTypeName(e)).join('、') }}</template>
        </span>
      </div>
      <ul v-if="plan.blocked" class="warn blockers"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
      <template v-else>
        <input v-model="text" placeholder="想要的樣子（選填）：例如刻上家紋、劍身帶著火焰紋路、取名「破曉」" />
        <AbilityPicker v-model="use" />
        <div class="go">
          <button class="primary" :disabled="game.judging || !!s.pendingAction" @click="craft"><GameIcon name="tools" :size="14" /> {{ make ? `${crafter.isPlayer ? '親手' : `請${crafter.name}`}打造` : '委託打造' }}</button>
        </div>
      </template>
    </div>
  </div>
  </component>
</template>

<style scoped>
.warn-text { color: var(--danger); }
.craft { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
.craft p { margin: 0; }
.intro { display: flex; align-items: center; gap: 4px; }
.step { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; align-items: start; }
.step > .lab { color: var(--muted); font-weight: 600; padding-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips .n { margin-left: 4px; font-size: var(--fs-xs); opacity: 0.7; }
.search { width: 100%; }
.hits { margin-top: 6px; }
.bases { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.base { text-align: left; display: grid; gap: 2px; padding: 6px 9px; }
.base.on { outline: 2px solid var(--accent); outline-offset: -1px; }
.base .muted { font-size: var(--fs-xs); }
table { width: 100%; border-collapse: collapse; }
.mats th { text-align: left; font-weight: 600; color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--border); }
.mats td { padding: 4px 6px; border-bottom: 1px dashed color-mix(in srgb, currentColor 15%, transparent); vertical-align: top; }
.mats .mrow { cursor: pointer; }
.mats .mrow:hover td { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.mats .mrow.on td { background: color-mix(in srgb, var(--accent) 22%, transparent); font-weight: 600; }
.mats .mrow.locked td { opacity: 0.55; }
.mats .nm { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.mats .nw { white-space: nowrap; }
.stat { color: var(--good); }
.note { margin-top: 4px; font-size: var(--fs-xs); }
.source { display: grid; gap: 4px; }
.source .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.short { color: var(--danger); }
.result { border: 1px solid var(--border); border-radius: 4px; padding: 10px 12px; display: grid; gap: 8px; }
.result h3 { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.result h3 .muted { font-weight: 400; font-size: var(--fs-sm); }
.result input:not([type]) { width: 100%; }
.outcomes { text-align: center; font-size: var(--fs-xs); }
.outcomes th { font-weight: 600; color: var(--muted); padding: 4px; border-bottom: 1px solid var(--border); }
.outcomes td { padding: 4px; vertical-align: top; }
.kv { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.aux-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.aux-row .qty { width: 46px; }
.lewd-row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
.aux-row .x { padding: 0 4px; }
.warn { color: var(--danger); }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
.go { display: flex; justify-content: flex-end; }
@media (max-width: 640px) {
  .step { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .step > .lab { padding-top: 0; }
  .bases { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mats .wide { display: none; }
}
</style>
