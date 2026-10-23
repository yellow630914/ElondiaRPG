<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { attrName, itemRules, locationById, npcs as namedNpcs, npcTags, perkRules, shopRules, workRules, type ShopType } from '@/engine/data'
import { builtinPerk, TRAIN_CELLS } from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import { buyCategories, canListItem, SHOP_LIMITS, type ShopMod } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'

// 內建商店的編輯表單：圖示、描述、AI 特別商品、店主設定、固定清單、收購類別、工作與受訓。
// 店名、店種、上架的物品類型與店的專屬功能不能改
const props = defineProps<{ id: string }>()
const content = useContent()
const game = useGame()

interface FixedRow { item: string; stock: number; price: number | '' }
interface Draft {
  emoji: string; desc: string; ai: boolean; title: string; tags: string[]
  fixed: FixedRow[]; buys: string[]; work: { dc: number; rate_cc: number; desc: string } | null; train: string[]
}
const def = computed(() => {
  void content.version
  return shopRules.types[props.id as ShopType]!
})
const trainable = computed(() => (TRAIN_CELLS as readonly string[]).includes(def.value.cell))
// 可以在這裡受訓的特質：目前或內建有受訓設定的（種族天賦除外）
const trainPerks = computed(() => {
  void content.version
  return perkRules.perks.filter((p) => !p.race && (p.train ?? builtinPerk(p.id)?.train))
})
function current(): Draft {
  void content.version
  const d = shopRules.types[props.id as ShopType]!
  const job = workRules.jobs[d.cell]
  return {
    emoji: d.emoji, desc: d.desc, ai: d.ai, title: d.keeper.title, tags: [...(d.keeper.tags ?? [])],
    fixed: (d.fixed ?? []).map((f) => ({ item: f.item, stock: f.stock, price: f.price_cc ?? '' })),
    buys: [...d.buys],
    work: job ? { dc: job.dc, rate_cc: job.rate_cc, desc: job.desc } : null,
    train: perkRules.perks.filter((p) => !p.race && p.train?.cells.includes(d.cell)).map((p) => p.id),
  }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !!content.mods.shops?.[props.id])
// 擔任這種店店主的固定 NPC（在固定 NPC 頁設定）
const keepers = computed(() => {
  void content.version
  return namedNpcs.filter((n) => n.keeper === props.id).map((n) => `${n.name}（${locationById(n.location).name}）`)
})
const tagList = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name] as const)
const categories = buyCategories()
const itemNames = computed(() => {
  void content.version
  return itemRules.items.filter((i) => canListItem(i.name)).map((i) => i.name)
})
const badItems = computed(() => draft.value.fixed.filter((f) => f.item.trim() && !canListItem(f.item.trim())).map((f) => f.item))
const jobAttr = computed(() => {
  const job = workRules.jobs[def.value.cell]
  return job ? attrName(job.attr) : ''
})

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
function save() {
  try {
    if (badItems.value.length) throw new Error(`固定清單裡有不能賣的物品：${badItems.value.join('、')}`)
    const d = draft.value
    const m: ShopMod = {
      emoji: d.emoji, desc: d.desc, ai: d.ai, keeper: { title: d.title, tags: d.tags },
      fixed: d.fixed.filter((f) => f.item.trim()).map((f) => ({ item: f.item.trim(), stock: f.stock, ...(f.price !== '' ? { price_cc: Number(f.price) } : {}) })),
      buys: d.buys as ShopMod['buys'],
      ...(d.work ? { work: { ...d.work } } : {}),
    }
    const before = JSON.parse(saved.value) as Draft
    content.saveShop(props.id, m)
    if (trainable.value && JSON.stringify([...d.train].sort()) !== JSON.stringify([...before.train].sort())) content.setShopTraining(def.value.cell, d.train)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${def.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${def.value.name}」恢復成內建的樣子？（受訓清單存在各特質上，不會一起恢復）`)) return
  content.restoreShop(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.emoji }} {{ def.name }}</h3>
      <span class="tag">{{ edited ? '內建・已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="draft = current()">放棄修改</button>
      <button class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
    </div>
    <p class="small muted">id：{{ id }}。內建的店只能改這裡列出的項目；店名、上架的物品類型（{{ def.catalog_tag }}）與店的專屬功能不能改，也不能刪除。</p>
    <fieldset>
      <legend>外觀</legend>
      <div class="grid">
        <label>圖示 <input v-model="draft.emoji" maxlength="8" /></label>
      </div>
      <label class="block">描述（商店畫面上的說明）<textarea v-model="draft.desc" rows="2" maxlength="200" /></label>
      <label class="check small"><input v-model="draft.ai" type="checkbox" /> AI 判定開啟時，請 AI 設計今天的特別商品（關掉就只有規則的商品）</label>
    </fieldset>
    <fieldset>
      <legend>店主</legend>
      <div class="grid">
        <label>職稱 <input v-model="draft.title" maxlength="8" /></label>
      </div>
      <div class="row small">
        <span class="muted">身分標籤（生成的店主帶這些標籤）：</span>
        <label v-for="[k, n] in tagList" :key="k" class="check"><input type="checkbox" :checked="draft.tags.includes(k)" @change="draft.tags = toggle(draft.tags, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </div>
      <p class="small muted">改了之後，新生成的店主才會用新的職稱與標籤；已經登場的店主不變。要指定某個地點的店主，到「固定 NPC」設定「擔任店主」。</p>
      <p v-if="keepers.length" class="small">目前擔任這種店店主的固定 NPC：{{ keepers.join('、') }}</p>
    </fieldset>
    <fieldset>
      <legend>交易清單</legend>
      <p class="small muted">目錄上架的物品類型固定（{{ def.catalog_tag }}）；這裡可以另外加「固定清單」：每天一定上架的物品與數量。價格空白照目錄價（材料照這種店的加成），寫了就用這個價格（仍會乘上聚落的物價）。和目錄重複的以固定清單為準。獨特物品、有屬性加減的裝備與主人強制裝備的東西不能賣。</p>
      <div v-for="(f, i) in draft.fixed" :key="i" class="row">
        <input v-model="f.item" class="grow" list="shop-items" placeholder="物品名稱" />
        <label class="check small">每天 <input v-model.number="f.stock" class="qty" type="number" :min="SHOP_LIMITS.stock[0]" :max="SHOP_LIMITS.stock[1]" /> 份</label>
        <label class="check small">價格 <input v-model.number="f.price" class="num" type="number" :min="SHOP_LIMITS.price[0]" :placeholder="catalogPrice(f.item) || '目錄價'" /> 銅</label>
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
      <template v-if="draft.work">
        <div class="grid">
          <label>檢定屬性 <input :value="jobAttr" disabled /></label>
          <label>DC <input v-model.number="draft.work.dc" type="number" :min="SHOP_LIMITS.work_dc[0]" :max="SHOP_LIMITS.work_dc[1]" /></label>
          <label>時薪（銅） <input v-model.number="draft.work.rate_cc" type="number" :min="SHOP_LIMITS.rate_cc[0]" :max="SHOP_LIMITS.rate_cc[1]" /></label>
        </div>
        <label class="block">描述 <textarea v-model="draft.work.desc" rows="2" :maxlength="SHOP_LIMITS.desc_chars" /></label>
      </template>
      <p v-else class="small muted">這種店沒有打工。</p>
    </fieldset>
    <fieldset>
      <legend>受訓</legend>
      <template v-if="trainable">
        <p class="small muted">勾選的特質可以在這種店受訓（缺陷是克服）。受訓的價格、時數與檢定在「特質」頁設定，存在各特質上：恢復這家店的預設不會改回受訓清單。</p>
        <div class="row checks small">
          <label v-for="p in trainPerks" :key="p.id" class="check" :title="p.desc">
            <input type="checkbox" :checked="draft.train.includes(p.id)" @change="draft.train = toggle(draft.train, p.id, ($event.target as HTMLInputElement).checked)" />
            {{ p.flaw ? '⚠️' : '' }}{{ p.name }}
          </label>
        </div>
      </template>
      <p v-else class="small muted">這種店不能受訓。</p>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
