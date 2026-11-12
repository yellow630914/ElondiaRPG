<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { craftRules, lewdRules } from '@/engine/data'
import { craftPlan, craftRarity, craftTarget, forgeOf, outfitCommission, outfitLewdBonus } from '@/engine/craft'
import { baseShown, baseSlotName, CRAFT_SLOT_ORDER, gearName, gearRules, gearSummary, rarityName, type BaseSlot } from '@/engine/gear'
import { baseExposure, lewdName } from '@/engine/lewd'
import { formatMoney } from '@/engine/money'
import { shopTypeForCell } from '@/engine/trade'
import { currentCell } from '@/engine/grid'
import type { LewdStat } from '@/engine/types'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import AdultDeco from './AdultDeco.vue'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'

// 淫服訂製（成人用品店的委託打造，docs/LEWD_STATS.md 第 25 節）：部位（分類按鈕）→ 款式 → 布料 → 慾望指標 → 訂單。
// 規則和一般的委託打造一樣（craft.ts），只是畫面不同：試衣間的樣子，邊框是紅線與淫紋（AdultDeco）。
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const game = useGame()
const s = computed(() => game.state!)

// 站在店裡時先備好今天的商品清單（當場補買材料要看這裡賣什麼）
onMounted(() => {
  const type = shopTypeForCell(currentCell(s.value).kind)
  if (type) game.shopState(type)
})

// ---- 淫服／拘束具 ----
// 拘束具也在這裡委託（詛咒具這類專屬底材不能做）；拘束具穿在額外飾品欄時，慾望指標與減值以外的加成不生效（gear.ts 的 bonusesOff）。
const MODES = [['outfit', '👗 淫服'], ['restraint', '⛓️ 拘束具']] as const
const mode = ref<(typeof MODES)[number][0]>('outfit')
const isOutfit = computed(() => mode.value === 'outfit')
function pickMode(m: (typeof MODES)[number][0]) {
  mode.value = m
  slot.value = ''
  basePick.value = ''
  filter.value = 'all'
}

// ---- 部位 ----
const bases = computed(() => Object.entries(gearRules.bases)
  .filter(([id, b]) => !b.exclusive && baseShown(id) && (isOutfit.value ? b.outfit === 'adult' && !b.restraint : !!b.restraint))
  .map(([id, b]) => ({ id, ...b, exposure: baseExposure(id) }))
  .sort((a, b) => a.price - b.price))
const slots = computed(() => [
  ...CRAFT_SLOT_ORDER.filter((x) => bases.value.some((b) => b.slot === x)),
  ...[...new Set(bases.value.map((b) => b.slot))].filter((x) => !CRAFT_SLOT_ORDER.includes(x)),
])
const slot = ref<BaseSlot | ''>('')
const slotNow = computed(() => (slot.value && slots.value.includes(slot.value) ? slot.value : slots.value.includes('body' as BaseSlot) ? 'body' as BaseSlot : slots.value[0]!))
const countOf = (x: string) => bases.value.filter((b) => b.slot === x).length
/** 拘束具的種類與拘束等級（例：手部拘束 2） */
const bindOf = (id: string) => {
  const b = gearRules.bases[id]!
  return b.bind_kind ? `${lewdRules.two_face.kinds[b.bind_kind]?.name ?? b.bind_kind}${b.bind ? ` ${b.bind}` : ''}` : '拘束具'
}

// ---- 款式 ----
const FILTERS = [['all', '全部'], ['covered', '遮得住（曝露 0～1）'], ['bold', '大膽（曝露 2～3）']] as const
const filter = ref<(typeof FILTERS)[number][0]>('all')
const styles = computed(() => bases.value.filter((b) => b.slot === slotNow.value
  && (!isOutfit.value || filter.value === 'all' || (filter.value === 'covered' ? b.exposure <= 1 : b.exposure >= 2))))
const basePick = ref('')
const base = computed(() => (styles.value.some((b) => b.id === basePick.value) ? basePick.value : styles.value[0]?.id ?? bases.value[0]!.id))
function pickSlot(x: BaseSlot) {
  slot.value = x
  basePick.value = ''
}

/** 一件裝備的數值（拿掉開頭的稀有度與部位） */
const statsOf = (b: string, m: string) => gearSummary({ base: b, material: m }).split('・').slice(2).join('・')
const kind = computed(() => gearRules.bases[base.value]!.kind)
const materials = computed(() => Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind.value).sort(([, a], [, b]) => a.tier - b.tier).map(([id, m]) => ({ id, ...m })))
const firstMaterial = (k: string) => Object.entries(gearRules.materials).filter(([, m]) => m.kind === k).sort(([, a], [, b]) => a.tier - b.tier)[0]?.[0] ?? 'linen'

// ---- 布料（文字卡；店主的手藝不夠的上鎖） ----
const levelHere = computed(() => craftPlan(s.value, base.value, firstMaterial(kind.value)).level)
const canDo = (tier: number) => levelHere.value >= tier
const matPick = ref('')
const mat = computed(() => {
  if (materials.value.some((m) => m.id === matPick.value && canDo(m.tier))) return matPick.value
  // 預設：做得了、打造材料也夠的最高一級；都不夠就用最低一級（工匠提供）
  const ok = materials.value.filter((m) => canDo(m.tier))
  const enough = (id: string) => ownedOf(id) >= craftPlan(s.value, base.value, id).units
  return ([...ok].reverse().find((m) => ownedOf(m.id) > 0 && enough(m.id)) ?? ok[0] ?? materials.value[0]!).id
})
const ownedOf = (m: string) => s.value.inventory.filter((i) => forgeOf(i.name).includes(m)).reduce((n, i) => n + i.qty, 0)

// ---- 慾望指標 ----
const STAT_EMOJI: Record<string, string> = { lewdness: '💗', sensitivity: '✨', endurance: '🛡️', submission: '🔗' }
const stat = ref<LewdStat | ''>('')
const bonus = computed(() => outfitLewdBonus(base.value, mat.value) ?? 0)

// ---- 訂單 ----
const buy = ref(true)
const opts = computed(() => ({ ...(buy.value ? { buy: true } : {}), ...(stat.value ? { lewd: stat.value } : {}) }))
const plan = computed(() => craftPlan(s.value, base.value, mat.value, [], undefined, opts.value))
const soldHere = computed(() => plan.value.sources.filter((x) => x.price !== undefined))
const DEGREES = [['critical', '大成功'], ['success', '成功'], ['partial', '部分成功']] as const
const hearts = (n: number) => '♥'.repeat(n)
const empty = (n: number) => '♥'.repeat(Math.max(0, 3 - n))
const text = ref('')

function order() {
  void game.perform({ kind: 'craft', target: craftTarget(base.value, mat.value, [], opts.value), text: text.value })
  text.value = ''
  // 下單後關掉，讓結果（或判定卡）在日誌裡看得到
  emit('close')
}
</script>

<template>
  <AppDialog :open="open" :title="isOutfit ? '淫服訂製' : '拘束具訂製'" icon="shirt" width="1240px" variant="atelier" @close="emit('close')">
    <template #frame><AdultDeco kind="atelier" /></template>
    <div class="modes">
      <button v-for="[k, n] in MODES" :key="k" class="mode" :class="{ on: mode === k }" @click="pickMode(k)">{{ n }}</button>
      <span v-if="!isOutfit" class="muted small">拘束具穿在額外飾品欄時只留下減值與慾望指標，其他加成不生效</span>
    </div>
    <div class="atelier">

      <section class="card">
        <h3><span class="step">1</span>部位</h3>
        <div class="slots">
          <button v-for="x in slots" :key="x" class="slot-chip" :class="{ on: x === slotNow }" @click="pickSlot(x)">{{ baseSlotName(x) }}<i>{{ countOf(x) }}</i></button>
        </div>
        <h3 class="mt-h"><span class="step">2</span>款式 <small>・{{ baseSlotName(slotNow) }}（{{ styles.length }} 款）</small></h3>
        <div v-if="isOutfit" class="filters">
          <button v-for="[k, n] in FILTERS" :key="k" class="small" :class="{ on: filter === k }" @click="filter = k">{{ n }}</button>
        </div>
        <div class="styles">
          <button v-for="b in styles" :key="b.id" class="style" :class="{ on: b.id === base }" @click="basePick = b.id">
            <span class="nm">{{ b.name }}</span>
            <span v-if="isOutfit" class="meta">曝露 <span class="hearts">{{ hearts(b.exposure) }}<span class="off">{{ empty(b.exposure) }}</span></span></span>
            <span v-else class="meta bind">⛓️ {{ bindOf(b.id) }}</span>
            <span class="meta stats-line" :title="statsOf(b.id, firstMaterial(b.kind))">{{ statsOf(b.id, firstMaterial(b.kind)) }}</span>
          </button>
          <p v-if="!styles.length" class="muted small">這個部位沒有符合的款式。</p>
        </div>
        <h3 class="mt-h"><span class="step">3</span>{{ isOutfit ? '布料' : '材料' }}</h3>
        <div class="mats">
          <button v-for="m in materials" :key="m.id" class="mat" :class="{ on: m.id === mat, lock: !canDo(m.tier) }" :disabled="!canDo(m.tier)" @click="matPick = m.id">
            <b>{{ m.name }}<template v-if="!canDo(m.tier)"> 🔒</template></b>
            <small>第 {{ m.tier }} 級</small>
            <em>慾望 +{{ outfitLewdBonus(base, m.id) }}</em>
          </button>
        </div>
      </section>

      <div class="right">
        <section class="card">
          <h3><span class="step">4</span>加一項慾望指標 <small>不另外收費</small></h3>
          <div class="stats">
            <button v-for="st in outfitCommission().stats" :key="st" class="stat" :class="{ on: stat === st }" @click="stat = st">
              <span class="em">{{ STAT_EMOJI[st] ?? '♥' }}</span>{{ lewdName(st) }}<b>+{{ bonus }}</b>
            </button>
            <button class="stat none" :class="{ on: !stat }" @click="stat = ''">不加</button>
          </div>
        </section>

        <section class="order">
          <h4>{{ gearName({ base, material: mat }) }}<span v-if="stat" class="bonus">・{{ lewdName(stat) }} +{{ bonus }}</span></h4>
          <div v-if="isOutfit" class="slotline">{{ baseSlotName(gearRules.bases[base]!.slot as BaseSlot) }}・成人向・曝露 <span class="hearts">{{ hearts(baseExposure(base)) }}<span class="off">{{ empty(baseExposure(base)) }}</span></span></div>
          <div v-else class="slotline">{{ baseSlotName(gearRules.bases[base]!.slot as BaseSlot) }}・⛓️ {{ bindOf(base) }}</div>
          <dl>
            <dt>數值</dt><dd>{{ statsOf(base, mat) || '沒有加成' }}</dd>
            <dt>慾望</dt><dd :class="{ bonus: stat }">{{ stat ? `${lewdName(stat)} +${bonus}` : '不加' }}</dd>
            <dt>檢定</dt><dd>店主擲：手藝 +{{ plan.level * craftRules.level_bonus }}・DC {{ plan.dc }}</dd>
            <dt>時間</dt><dd>約 {{ gearRules.craft.hours }} 小時</dd>
            <dt>材料</dt>
            <dd>
              <template v-if="!plan.units">工匠提供</template>
              <template v-else>需要 {{ plan.units }} 份，持有 {{ plan.have }} 份<span v-if="plan.uses.length" class="muted">（用掉 {{ plan.uses.map((u) => `${u.name}×${u.qty}`).join('、') }}）</span></template>
              <label v-if="soldHere.length && plan.units > plan.have" class="check small"><input v-model="buy" type="checkbox" /> 不夠的當場補買<span v-if="plan.buyCost">（{{ formatMoney(plan.buyCost) }}）</span></label>
            </dd>
          </dl>
          <table>
            <tbody>
              <tr><th v-for="[, n] in DEGREES" :key="n">{{ n }}</th><th>失敗</th></tr>
              <tr>
                <td v-for="[d] in DEGREES" :key="d">{{ rarityName(craftRarity(mat, d)!) }}<template v-if="d === 'partial'">・沒有附魔</template></td>
                <td>材料損失一半</td>
              </tr>
            </tbody>
          </table>
          <ul v-if="plan.blocked" class="warn small"><li v-for="b in plan.blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
          <input v-else v-model="text" class="wish" placeholder="想要的樣子（選填）：例如繡上家紋、裙襬綴滿小鈴鐺" />
          <div class="total">
            <span>工錢 <b>{{ formatMoney(plan.fee + plan.buyCost) }}</b></span>
            <button class="order-btn" :disabled="!!plan.blocked || game.judging || !!s.pendingAction" @click="order">下單訂製</button>
          </div>
        </section>
      </div>
    </div>
    <p class="note muted small">
      檢定、DC、工錢、材料、稀有度和附魔都和一般的委託打造一樣（店主擲 d20 + 手藝 ×2）；慾望指標的加成依材料等級：第 1 級 +4、第 2 級 +6、第 3 級 +8、第 4 級以上 +10。
      <Hint text="材料上鎖代表店主的手藝還做不了那一級。成人向服裝與拘束具只在成人用品店委託打造（自己打造也可以，慾望指標的加成照自己的指標打折）；詛咒具做不出來。" />
    </p>
  </AppDialog>
</template>

<style scoped>
.modes { display: flex; gap: 8px; align-items: center; margin: -4px 0 10px; flex-wrap: wrap; position: relative; z-index: 1; }
.mode { padding: 4px 14px; border-radius: 14px; border: 1px solid #b03a6266; background: #fffaf0; }
.mode.on { background: #b03a62; color: #fff; font-weight: 700; }
.style .bind { color: #6c4bd1; }
.atelier { --tone: #b03a62; --tone-soft: #b03a6226; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; align-items: start; }
.card { background: #fff3; border: 1px solid #5a3f2255; border-radius: 4px; padding: 10px 12px; }
h3 { margin: 0 0 8px; font-size: var(--fs-md, 15px); display: flex; align-items: center; gap: 6px; }
h3 small { color: var(--muted); font-weight: 400; }
.mt-h { margin-top: 12px; }
.step { width: 20px; height: 20px; border-radius: 50%; background: var(--tone); color: #fff; font-size: 12px; display: grid; place-items: center; font-family: sans-serif; flex: none; }
button { font: inherit; }
/* 部位：分類按鈕 */
.slots { display: flex; flex-wrap: wrap; gap: 6px; }
.slot-chip { font-size: 13px; padding: 3px 10px; border-radius: 12px; border: 1px solid #6d512866; background: #fffaf0; }
.slot-chip.on { background: var(--tone); color: #fff; border-color: var(--tone); font-weight: 700; }
.slot-chip i { font-style: normal; opacity: 0.7; margin-left: 4px; font-size: 11px; }
/* 款式 */
.filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.filters .on { border-color: var(--tone); color: var(--tone); }
.styles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; max-height: 340px; overflow: auto; padding-right: 4px; }
.style { text-align: left; border: 1px solid #6d512844; border-radius: 4px; padding: 7px 8px; background: #fff5; display: grid; gap: 3px; }
.style.on { border-color: var(--tone); background: var(--tone-soft); box-shadow: 0 0 0 1px var(--tone) inset; }
.style .nm { font-weight: 700; }
.style .meta { font-size: 11.5px; color: var(--muted); }
.style .stats-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.hearts { color: var(--tone); letter-spacing: 1px; font-size: 11px; }
.hearts .off { color: #33231a26; }
/* 布料：文字卡 */
.mats { display: flex; gap: 8px; flex-wrap: wrap; }
.mat { min-width: 92px; padding: 6px 12px; border: 1px solid #6d512855; border-radius: 4px; background: #fff5; display: grid; gap: 1px; text-align: center; }
.mat small { font-size: 11.5px; color: var(--muted); }
.mat em { font-style: normal; font-size: 12px; color: var(--tone); font-weight: 700; }
.mat.on { border-color: var(--tone); background: var(--tone-soft); box-shadow: 0 0 0 1px var(--tone) inset; }
.mat.lock { opacity: 0.45; }
/* 慾望指標 */
.right { display: grid; gap: 12px; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.stat { border: 1px solid #6d512844; border-radius: 4px; padding: 7px 10px; display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 6px; background: #fff5; text-align: left; }
.stat .em { font-size: 17px; }
.stat b { color: var(--tone); }
.stat.on { background: var(--tone-soft); border-color: var(--tone); }
.stat.none { grid-column: 1 / -1; grid-template-columns: 1fr; text-align: center; color: var(--muted); }
/* 訂單 */
.order { background: #fffaf0cc; border-radius: 4px; padding: 12px 14px; border: 1px solid #b03a6266; position: relative; }
.order::before { content: ''; position: absolute; inset: 4px; border: 1px dashed #b03a6255; border-radius: 3px; pointer-events: none; }
.order h4 { margin: 0; font-size: 17px; color: var(--tone); }
.order .slotline { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.order dl { display: grid; grid-template-columns: 4em minmax(0, 1fr); gap: 3px 8px; margin: 6px 0; font-size: 13.5px; }
.order dt { color: var(--muted); }
.order dd { margin: 0; }
.order .check { display: flex; gap: 4px; align-items: center; }
.bonus { color: var(--tone); font-weight: 700; }
.order table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0; }
.order th, .order td { border: 1px solid #33231a22; padding: 3px 4px; text-align: center; }
.order th { background: #33231a0d; font-weight: 400; color: var(--muted); }
.order .warn { color: var(--danger); margin: 6px 0; padding-left: 0; list-style: none; }
.order .wish { width: 100%; margin: 4px 0; position: relative; }
.order .total { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #33231a33; padding-top: 8px; margin-top: 6px; position: relative; }
.order .total b { font-size: 17px; }
.order-btn { background: linear-gradient(180deg, #c45a7e, #93304f); color: #fff6ea; border: 1px solid #5a3f22; padding: 5px 16px; letter-spacing: 0.1em; animation: order-glow 3.6s ease-in-out infinite; }
.order-btn:disabled { animation: none; opacity: 0.55; }
@keyframes order-glow { 0%, 100% { box-shadow: 0 0 4px #e08aa644; } 50% { box-shadow: 0 0 14px #e08aa6aa; } }
@media (prefers-reduced-motion: reduce) { .order-btn { animation: none; } }
.note { margin: 10px 0 0; padding-left: 250px; min-height: 110px; }

/* 窄的畫面：一欄往下 */
@media (max-width: 1000px) {
  .atelier { grid-template-columns: minmax(0, 1fr); }
  .styles { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 260px; }
  .note { padding-left: 0; margin-bottom: 90px; }
}
</style>
