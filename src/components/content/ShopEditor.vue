<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, itemRules, locationById, npcs as namedNpcs, npcTags, perkRules, shopRules, workRules, type AttrId, type ShopType } from '@/engine/data'
import { settlementArea } from '@/engine/grid'
import { builtinPerk, TRAIN_CELLS } from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import {
  builtinCells, buyCategories, canListItem, catalogOptions, CRAFT_KINDS, SHOP_LIMITS, shopUsage, type CellRef, type ShopMod,
} from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import CellPicker from './CellPicker.vue'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'

// 商店的編輯表單。內建的店：圖示、描述、AI 特別商品、店主設定、固定清單、收購類別、工作、受訓與位置（只能移動）；
// 店名、店種、上架的物品類型與店的專屬功能不能改。自建的店每一項都可以改，沒有專屬功能
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

interface FixedRow { item: string; stock: number; price: number | '' }
interface Draft {
  name: string; emoji: string; desc: string; ai: boolean; title: string; tags: string[]
  catalog: string; craft: string[]
  fixed: FixedRow[]; buys: string[]; work: { attr: AttrId; dc: number; rate_cc: number; desc: string } | null; train: string[]
  /** 內建的店：原本的每一格與移到哪裡（null＝留在原地） */
  moves: { from: CellRef; to: CellRef | null }[]
  /** 自建的店：擺在哪些格子 */
  places: CellRef[]
}
const def = computed(() => {
  void content.version
  return shopRules.types[props.id as ShopType]!
})
const custom = computed(() => !!def.value.custom)
const trainable = computed(() => custom.value || (TRAIN_CELLS as readonly string[]).includes(def.value.cell))
// 可以在這裡受訓的特質：目前或內建有受訓設定的（種族天賦除外）
const trainPerks = computed(() => {
  void content.version
  return perkRules.perks.filter((p) => !p.race && (p.train ?? builtinPerk(p.id)?.train))
})
function current(): Draft {
  void content.version
  const d = shopRules.types[props.id as ShopType]!
  const job = workRules.jobs[d.cell]
  const mod = content.mods.shops?.[props.id]
  const moved = mod?.moves ?? []
  return {
    name: d.name, emoji: d.emoji, desc: d.desc, ai: d.ai, title: d.keeper.title, tags: [...(d.keeper.tags ?? [])],
    catalog: d.catalog_tag, craft: [...(d.craft ?? [])],
    fixed: (d.fixed ?? []).map((f) => ({ item: f.item, stock: f.stock, price: f.price_cc ?? '' })),
    buys: [...d.buys],
    work: job ? { attr: job.attr, dc: job.dc, rate_cc: job.rate_cc, desc: job.desc } : null,
    train: perkRules.perks.filter((p) => !p.race && p.train?.cells.includes(d.cell)).map((p) => p.id),
    moves: d.custom ? [] : builtinCells(props.id).map((from) => {
      const m = moved.find((x) => x.from.area === from.area && x.from.x === from.x && x.from.y === from.y)
      return { from, to: m ? { ...m.to } : null }
    }),
    places: d.custom ? (mod?.places ?? []).map((p) => ({ ...p })) : [],
  }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
  openMove.value = null
  adding.value = null
}
watch(() => props.id, reset)
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !custom.value && !!content.mods.shops?.[props.id])
const usage = computed(() => {
  void content.version
  return custom.value ? shopUsage(props.id) : []
})
// 擔任這種店店主的固定 NPC（在固定 NPC 頁設定）
const keepers = computed(() => {
  void content.version
  return namedNpcs.filter((n) => n.keeper === props.id).map((n) => `${n.name}（${locationById(n.location).name}）`)
})
const tagList = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name] as const)
const categories = buyCategories()
const catalogs = catalogOptions()
const catalogName = computed(() => catalogs.find(([t]) => t === def.value.catalog_tag)?.[1] ?? def.value.catalog_tag)
const itemNames = computed(() => {
  void content.version
  return itemRules.items.filter((i) => canListItem(i.name)).map((i) => i.name)
})
const badItems = computed(() => draft.value.fixed.filter((f) => f.item.trim() && !canListItem(f.item.trim())).map((f) => f.item))

function toggle(list: string[], v: string, on: boolean) {
  const set = new Set(list)
  if (on) set.add(v)
  else set.delete(v)
  return [...set]
}
function addFixed() {
  draft.value.fixed.push({ item: '', stock: 3, price: '' })
}
function catalogPrice(name: string) {
  const p = itemRules.items.find((i) => i.name === name.trim())?.price_cc
  return p === undefined ? '' : formatMoney(p)
}
function placeText(r: CellRef) {
  return `${locationById(r.area.split('/')[0]!).name}・${settlementArea(r.area, false)?.name ?? r.area}（${r.x}, ${r.y}）`
}

// 位置：內建的店一次移動一格；自建的店另外加一格
const openMove = ref<number | null>(null)
const adding = ref<CellRef | null>(null)
const addOpen = ref(false)
function moveTo(i: number, to: CellRef | null) {
  draft.value.moves[i]!.to = to
  openMove.value = null
}
function addPlace(r: CellRef | null) {
  if (r && !draft.value.places.some((p) => p.area === r.area && p.x === r.x && p.y === r.y)) draft.value.places.push(r)
  addOpen.value = false
}
function toggleWork(on: boolean) {
  draft.value.work = on ? { attr: 'cha', dc: 12, rate_cc: 3, desc: '在店裡幫忙。' } : null
}

function save() {
  try {
    if (badItems.value.length) throw new Error(`固定清單裡有不能賣的物品：${badItems.value.join('、')}`)
    const d = draft.value
    const m: ShopMod = {
      emoji: d.emoji, desc: d.desc, ai: d.ai, keeper: { title: d.title, tags: d.tags },
      fixed: d.fixed.filter((f) => f.item.trim()).map((f) => ({ item: f.item.trim(), stock: f.stock, ...(f.price !== '' ? { price_cc: Number(f.price) } : {}) })),
      buys: d.buys as ShopMod['buys'],
      ...(d.work ? { work: { ...d.work } } : {}),
      ...(custom.value
        ? { custom: true, name: d.name, catalog: d.catalog, craft: d.craft, places: d.places }
        : { moves: d.moves.filter((x) => x.to).map((x) => ({ from: x.from, to: x.to! })) }),
    }
    const before = JSON.parse(saved.value) as Draft
    content.saveShop(props.id, m)
    if (trainable.value && JSON.stringify([...d.train].sort()) !== JSON.stringify([...before.train].sort())) content.setShopTraining(def.value.cell, d.train)
    reset()
    game.flash(`已儲存「${def.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${def.value.name}」恢復成內建的樣子？（位置回到原處；受訓清單存在各特質上，不會一起恢復）`)) return
  content.restoreShop(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除自建的商店「${def.value.name}」？地圖上的格子會變回道路。`)) return
  try {
    content.deleteShop(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.emoji }} {{ custom ? draft.name : def.name }}</h3>
      <span class="tag">{{ custom ? '自建' : edited ? '內建・已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button v-if="!custom" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small warn" :disabled="usage.length > 0" @click="remove">🗑️ 刪除</button>
    </div>
    <p v-if="!custom" class="small muted">id：{{ id }}。內建的店只能改這裡列出的項目；店名、上架的物品類型（{{ catalogName }}的目錄）與店的專屬功能不能改，也不能刪除。</p>
    <p v-else class="small muted">id：{{ id }}。自建的店沒有專屬功能（治療、招募、情報、刺青……），只有交易、打工、受訓與委託打造。</p>
    <UsageNote :usage="usage" :deletable="custom" />
    <fieldset>
      <legend>外觀</legend>
      <div class="grid">
        <label v-if="custom">店名 <input v-model="draft.name" :maxlength="SHOP_LIMITS.name_chars" /></label>
        <label>圖示 <input v-model="draft.emoji" maxlength="8" /></label>
      </div>
      <label class="block"><span>描述 <Hint text="商店畫面上的說明。" /></span><textarea v-model="draft.desc" rows="2" :maxlength="SHOP_LIMITS.desc_chars" /></label>
      <label class="check small"><input v-model="draft.ai" type="checkbox" /> AI 判定開啟時，請 AI 設計今天的特別商品 <Hint text="關掉就只有規則的商品。" /></label>
    </fieldset>
    <fieldset>
      <legend>店主</legend>
      <div class="grid">
        <label>職稱 <input v-model="draft.title" maxlength="8" /></label>
      </div>
      <div class="row small">
        <span class="muted">身分標籤 <Hint text="生成的店主帶這些標籤。" />：</span>
        <label v-for="[k, n] in tagList" :key="k" class="check"><input type="checkbox" :checked="draft.tags.includes(k)" @change="draft.tags = toggle(draft.tags, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </div>
      <p class="small muted">改了之後，新生成的店主才會用新的職稱與標籤；已經登場的店主不變。要指定某個地點的店主，到「固定 NPC」設定「擔任店主」。</p>
      <p v-if="keepers.length" class="small">目前擔任這種店店主的固定 NPC：{{ keepers.join('、') }}</p>
    </fieldset>
    <fieldset>
      <legend>交易清單</legend>
      <label v-if="custom" class="small">平常上架
        <select v-model="draft.catalog">
          <option value="">只賣固定清單</option>
          <option v-for="[t, n] in catalogs" :key="t" :value="t">照{{ n }}的目錄抽選</option>
        </select>
      </label>
      <p class="small muted">
        <template v-if="!custom">目錄上架的物品類型固定（{{ catalogName }}的目錄）；</template>
        「固定清單」是每天一定上架的物品與數量。價格空白照目錄價（材料照這種店的加成），寫了就用這個價格（仍會乘上聚落的物價）。和目錄重複的以固定清單為準。獨特物品、有屬性加減的裝備與主人強制裝備的東西不能賣。
      </p>
      <div v-for="(f, i) in draft.fixed" :key="i" class="row">
        <input v-model="f.item" class="grow" list="shop-items" placeholder="物品名稱" />
        <label class="check small">每天 <input v-model.number="f.stock" class="qty" type="number" :min="SHOP_LIMITS.stock[0]" :max="SHOP_LIMITS.stock[1]" /> 份</label>
        <label class="check small">價格 <input v-model.number="f.price" class="num" type="number" :min="SHOP_LIMITS.price[0]" :placeholder="catalogPrice(f.item) || '目錄價'" /> 白鸛</label>
        <span v-if="f.item.trim() && !canListItem(f.item.trim())" class="small warn-text">不能賣</span>
        <button class="small x" title="移除" @click="draft.fixed.splice(i, 1)">✕</button>
      </div>
      <div class="row">
        <button class="small" :disabled="draft.fixed.length >= SHOP_LIMITS.fixed" @click="addFixed">＋ 加一項</button>
        <span class="small muted">最多 {{ SHOP_LIMITS.fixed }} 項</span>
      </div>
      <datalist id="shop-items"><option v-for="n in itemNames" :key="n" :value="n" /></datalist>
      <div class="row checks small">
        <span class="muted">收購的類別：</span>
        <label v-for="[k, n] in categories" :key="k" class="check"><input type="checkbox" :checked="draft.buys.includes(k)" @change="draft.buys = toggle(draft.buys, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>工作</legend>
      <label v-if="custom" class="check small"><input type="checkbox" :checked="!!draft.work" @change="toggleWork(($event.target as HTMLInputElement).checked)" /> 可以在這裡打工</label>
      <template v-if="draft.work">
        <div class="grid">
          <label>檢定屬性
            <select v-if="custom" v-model="draft.work.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
            <input v-else :value="attrName(draft.work.attr)" disabled />
          </label>
          <label>DC <input v-model.number="draft.work.dc" type="number" :min="SHOP_LIMITS.work_dc[0]" :max="SHOP_LIMITS.work_dc[1]" /></label>
          <label>時薪（白鸛） <input v-model.number="draft.work.rate_cc" type="number" :min="SHOP_LIMITS.rate_cc[0]" :max="SHOP_LIMITS.rate_cc[1]" /></label>
        </div>
        <label class="block">描述 <textarea v-model="draft.work.desc" rows="2" :maxlength="SHOP_LIMITS.desc_chars" /></label>
      </template>
      <p v-else-if="!custom" class="small muted">這種店沒有打工。</p>
    </fieldset>
    <fieldset>
      <legend>受訓</legend>
      <template v-if="trainable">
        <p class="small muted">勾選的特質可以在這種店受訓（缺陷是克服）。受訓的價格、時數與檢定在「特質」頁設定，存在各特質上{{ custom ? '' : '：恢復這家店的預設不會改回受訓清單' }}。</p>
        <div class="row checks small">
          <label v-for="p in trainPerks" :key="p.id" class="check" :title="p.desc">
            <input type="checkbox" :checked="draft.train.includes(p.id)" @change="draft.train = toggle(draft.train, p.id, ($event.target as HTMLInputElement).checked)" />
            {{ p.flaw ? '⚠️' : '' }}{{ p.name }}
          </label>
        </div>
      </template>
      <p v-else class="small muted">這種店不能受訓。</p>
    </fieldset>
    <fieldset v-if="custom">
      <legend>委託打造</legend>
      <div class="row checks small">
        <span class="muted">接這些材料的打造委託 <Hint text="店主的工藝等級照一般店主。" />：</span>
        <label v-for="[k, n] in CRAFT_KINDS" :key="k" class="check"><input type="checkbox" :checked="draft.craft.includes(k)" @change="draft.craft = toggle(draft.craft, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>位置</legend>
      <template v-if="!custom">
        <p class="small muted">內建的店只能移動、不能刪除：在同一個聚落裡搬到一格空地（道路）。舊存檔讀進來時地圖會跟著變。</p>
        <p v-if="!draft.moves.length" class="small muted">這種店不在聚落的地圖上。</p>
        <div v-for="(m, i) in draft.moves" :key="i" class="move">
          <div class="row small">
            <span>{{ placeText(m.from) }}</span>
            <span class="muted">→ {{ m.to ? placeText(m.to) : '原地' }}</span>
            <button class="small" @click="openMove = openMove === i ? null : i">{{ openMove === i ? '收起' : '移動' }}</button>
            <button v-if="m.to" class="small" @click="moveTo(i, null)">回到原地</button>
          </div>
          <CellPicker v-if="openMove === i" :model-value="m.to" :location="m.from.area.split('/')[0]" lock-location :marker="draft.emoji" :self="def.cell" @update:model-value="moveTo(i, $event)" />
        </div>
      </template>
      <template v-else>
        <p class="small muted">擺在聚落的空地（道路）上，可以擺好幾個地方（最多 {{ SHOP_LIMITS.places }} 處），每個聚落的店各自有店主與庫存。</p>
        <p v-if="!draft.places.length" class="small warn-text">還沒擺在任何地方，遊戲裡找不到這家店。</p>
        <div v-for="(p, i) in draft.places" :key="`${p.area}-${p.x}-${p.y}`" class="row small">
          <span>{{ placeText(p) }}</span>
          <button class="small x" title="移除" @click="draft.places.splice(i, 1)">✕</button>
        </div>
        <button v-if="!addOpen" class="small" :disabled="draft.places.length >= SHOP_LIMITS.places" @click="addOpen = true">＋ 擺到一個地方</button>
        <template v-else>
          <CellPicker :model-value="adding" :marker="draft.emoji" :self="id" @update:model-value="addPlace" />
          <button class="small" @click="addOpen = false">取消</button>
        </template>
      </template>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.move { display: grid; gap: 4px; }
</style>
