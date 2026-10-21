<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, companionRules, damageTypeName, damageTypes, enemies, itemDef, itemRules, statuses, type AttrId, type ItemUse, type ToolKind } from '@/engine/data'
import { gearPrice, gearRules, gearSummary, rarityName, RARITY_ORDER } from '@/engine/gear'
import { useSummary } from '@/engine/inventory'
import { CHEST_LAYERS, itemSources, sanitizeGearSpecLoose, type ChestLayer, type GatherPlace, type ItemMod } from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import { TOOL_KINDS, toolSummary } from '@/engine/tools'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import AffinityRows from './AffinityRows.vue'

// 物品的編輯表單：基本資料、出現的地方（商店、掉落、寶箱、採集、事件）、消耗品效果、裝備組成
const props = defineProps<{ name: string }>()
const emit = defineEmits<{ renamed: [name: string]; deleted: [] }>()
const content = useContent()
const game = useGame()

interface Drop { enemy: string; chance: number; qty: number }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function current(): { item: ItemMod; drops: Drop[] } {
  const base = content.mods.items[props.name] ?? (itemDef(props.name) as ItemMod)
  const item = clone(base)
  const src = itemSources(props.name)
  item.chests ??= src.chests
  item.gather ??= src.gather
  item.use ??= {}
  return { item, drops: src.drops }
}
const init = current()
const draft = ref<ItemMod>(init.item)
const drops = ref<Drop[]>(init.drops)
const newName = ref(props.name)
const snapshotText = () => JSON.stringify([draft.value, drops.value, newName.value])
const saved = ref(snapshotText())
function reset() {
  const c = current()
  draft.value = c.item
  drops.value = c.drops
  newName.value = props.name
  saved.value = snapshotText()
}
watch(() => props.name, reset)

const dirty = computed(() => snapshotText() !== saved.value)
const custom = computed(() => !!content.mods.items[props.name]?.custom)
const edited = computed(() => !custom.value && !!content.mods.items[props.name])

// ---- 選項 ----
const CATS = itemRules.categories
const damageIds = damageTypes.types.map((t) => t.id)
const statusList = Object.entries(statuses).map(([id, s]) => ({ id, ...s }))
const debuffs = statusList.filter((s) => s.kind === 'debuff')
const buffs = statusList.filter((s) => s.kind === 'buff')
const enemyList = computed(() => {
  void content.version
  return Object.values(enemies).sort((a, b) => a.level - b.level)
})
const LAYER: Record<ChestLayer, string> = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層' }
const SHOPS: Record<string, string> = { general: '雜貨店', temple: '神殿', tavern: '酒館', smith: '鐵匠鋪', tailor: '裁縫店', jeweler: '珠寶店', magic: '魔法物品店', info: '情報商' }
const LOCS: Record<string, string> = { village: '任何聚落', town: '城鎮以上', city: '城市以上', capital: '王都' }
const bases = computed(() => {
  void content.version
  return Object.entries(gearRules.bases)
})
const materials = computed(() => {
  void content.version
  const kind = draft.value.gear ? gearRules.bases[draft.value.gear.base]?.kind : undefined
  return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind)
})

// ---- 欄位 ----
const use = computed(() => (draft.value.use ??= {}) as ItemUse)
// 吃喝可以給的狀態：到下次長休就解除的那些（用餐、喝酒、磨利……）
const conditionList = Object.entries(companionRules.conditions)
  .filter(([id, c]) => !id.startsWith('$') && c.clears === 'long_rest')
  .map(([id, c]) => ({ id, name: `${c.name}：${c.desc}` }))
function setTool(kind: string) {
  if (!kind) delete draft.value.tool
  else draft.value.tool = { kind: kind as ToolKind, ...(itemRules.tools[kind as ToolKind].bonus !== undefined ? { bonus: draft.value.tool?.bonus ?? itemRules.tools[kind as ToolKind].bonus } : {}) }
}
const toolText = computed(() => toolSummary(draft.value.tool))
function toggle<T>(list: T[] | undefined, v: T, on: boolean): T[] {
  const set = new Set(list ?? [])
  if (on) set.add(v)
  else set.delete(v)
  return [...set]
}
function setTag(tag: string, on: boolean) {
  draft.value.tags = toggle(draft.value.tags, tag, on)
}
function setChest(layer: ChestLayer, pct: number) {
  draft.value.chests = { ...(draft.value.chests ?? {}), [layer]: Math.max(0, Math.min(100, pct)) / 100 }
}
function setGather(g: GatherPlace, on: boolean) {
  draft.value.gather = toggle(draft.value.gather, g, on)
}
function setForge(m: string, on: boolean) {
  const list = toggle(draft.value.forge?.materials, m, on)
  draft.value.forge = list.length ? { materials: list } : undefined
}

function ensureGear() {
  if (!draft.value.gear) draft.value.gear = { base: 'longsword', material: 'iron' }
}
watch(() => draft.value.category, (c) => {
  if (c === 'equipment') ensureGear()
})
function setBase(id: string) {
  const kind = gearRules.bases[id]!.kind
  const mat = gearRules.materials[draft.value.gear?.material ?? '']?.kind === kind ? draft.value.gear!.material
    : Object.entries(gearRules.materials).find(([, m]) => m.kind === kind)![0]
  draft.value.gear = { ...draft.value.gear, base: id, material: mat }
}
const enchantMods = computed({
  get: () => draft.value.gear?.enchants?.mods ?? {},
  set: (v) => {
    if (draft.value.gear) draft.value.gear.enchants = { ...(draft.value.gear.enchants ?? {}), mods: v }
  },
})
function setEnchantMod(k: string, v: number) {
  enchantMods.value = { ...enchantMods.value, [k]: v || undefined }
}
const MOD_NAME: Record<string, string> = { hit: '命中', damage: '傷害', evade: '迴避', dr: '減傷', save: '豁免', crit: '幸運一擊', ap_regen: '行動點回復' }
const gearText = computed(() => {
  const g = sanitizeGearSpecLoose(draft.value.gear)
  return g ? gearSummary(g) : '底材與材料的類型要一致'
})
function priceFromGear() {
  const g = sanitizeGearSpecLoose(draft.value.gear)
  if (g) draft.value.price_cc = gearPrice(g)
}
const useText = computed(() => {
  try {
    return useSummary(draft.value.use)
  } catch {
    return ''
  }
})

function addDrop() {
  drops.value.push({ enemy: enemyList.value[0]!.id, chance: 0.3, qty: 1 })
}

// ---- 動作 ----
function save() {
  try {
    const target = content.saveItem(props.name, draft.value, custom.value ? newName.value : undefined)
    content.setItemDrops(target, drops.value)
    game.flash(`已儲存「${target}」`)
    if (target !== props.name) emit('renamed', target)
    else reset()
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${props.name}」恢復成內建的樣子？（怪物掉落的設定改在怪物上，不會一起恢復）`)) return
  content.restoreItem(props.name)
  reset()
}
function remove() {
  if (!confirm(`刪除「${props.name}」？行囊裡已有的會變成無法使用的雜物，怪物也不再掉落。`)) return
  content.deleteItem(props.name)
  content.setItemDrops(props.name, [])
  emit('deleted')
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ name }}</h3>
      <span class="tag">{{ custom ? '自建' : edited ? '內建・已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button v-if="!custom" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" @click="remove">刪除</button>
    </div>

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱
          <input v-if="custom" v-model="newName" maxlength="20" />
          <input v-else :value="name" disabled title="內建物品不能改名（存檔與掉落表用名稱對應）" />
        </label>
        <label>類別
          <select v-model="draft.category">
            <option v-for="(n, k) in CATS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label>價格（{{ formatMoney(draft.price_cc) }}）<input v-model.number="draft.price_cc" type="number" min="0" /></label>
      </div>
      <label class="block">描述 <textarea v-model="draft.desc" rows="2" maxlength="200" /></label>
      <p v-if="draft.category === 'material'" class="small muted">材料的價格是商人的收購價（全額收購）；其他物品賣出時是一半。</p>
    </fieldset>

    <fieldset>
      <legend>在哪裡出現</legend>
      <div class="row checks">
        <span class="small">商店：</span>
        <label v-for="(n, t) in SHOPS" :key="t" class="check small"><input type="checkbox" :checked="draft.tags.includes(String(t))" @change="setTag(String(t), ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
        <label class="small">最低聚落
          <select :value="draft.min_location ?? 'village'" @change="draft.min_location = ($event.target as HTMLSelectElement).value">
            <option v-for="(n, k) in LOCS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
      </div>
      <p v-if="draft.category === 'equipment'" class="small muted">裝備在商店是每天隨機上架幾樣，不是每天都有。</p>
      <div class="row checks">
        <span class="small">寶箱（各層的機率）：</span>
        <label v-for="l in CHEST_LAYERS" :key="l" class="small">{{ LAYER[l] }} <input class="num" type="number" min="0" max="100" :value="Math.round((draft.chests?.[l] ?? 0) * 100)" @change="setChest(l, Number(($event.target as HTMLInputElement).value))" />%</label>
      </div>
      <div class="row checks">
        <span class="small">採集：</span>
        <label class="check small"><input type="checkbox" :checked="draft.gather?.includes('wild')" @change="setGather('wild', ($event.target as HTMLInputElement).checked)" /> 近郊的資源格</label>
        <label class="check small"><input type="checkbox" :checked="draft.gather?.includes('dungeon')" @change="setGather('dungeon', ($event.target as HTMLInputElement).checked)" /> 地下城的資源格</label>
      </div>
      <label class="check small"><input v-model="draft.event" type="checkbox" /> 事件：AI 判定主動行動時可以把它當成報酬（提示詞會列出這個物品）</label>
      <div>
        <span class="small">怪物掉落：</span>
        <div v-for="(d, i) in drops" :key="i" class="row">
          <select v-model="d.enemy" class="grow">
            <option v-for="e in enemyList" :key="e.id" :value="e.id">{{ e.name }}（{{ e.level }} 級）</option>
          </select>
          <label class="small">機率 <input class="num" type="number" min="1" max="100" :value="Math.round(d.chance * 100)" @input="d.chance = Number(($event.target as HTMLInputElement).value) / 100" />%</label>
          <label class="small">數量 <input v-model.number="d.qty" class="num" type="number" min="1" /></label>
          <button class="small" @click="drops.splice(i, 1)">移除</button>
        </div>
        <button class="small" @click="addDrop">＋ 掉落的怪物</button>
        <p class="small muted">掉落設定存在怪物身上（和怪物編輯頁的掉落物是同一份）。</p>
      </div>
    </fieldset>

    <fieldset v-if="draft.category === 'consumable' || draft.category === 'food' || draft.category === 'scroll'">
      <legend>使用效果（{{ useText || '無' }}）</legend>
      <div class="grid">
        <label>吃喝後的狀態（到下次長休）
          <select :value="use.condition ?? ''" @change="use.condition = ($event.target as HTMLSelectElement).value || undefined">
            <option value="">（無）</option>
            <option v-for="c in conditionList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>回復生命（骰子）<input v-model="use.heal" placeholder="2d4+2" /></label>
        <label>回復法術環（N 環以下）<input v-model.number="use.slot" type="number" min="0" max="9" /></label>
        <label>暫時生命 <input v-model.number="use.temp_hp" type="number" min="0" /></label>
        <label>行動點 <input v-model.number="use.ap" type="number" min="0" max="10" /></label>
        <label>救起倒下的隊友（最大生命 %）<input type="number" min="0" max="100" :value="Math.round((use.revive ?? 0) * 100)" @change="use.revive = Number(($event.target as HTMLInputElement).value) / 100 || undefined" /></label>
        <label>給自己或隊友的狀態
          <select :value="use.status?.id ?? ''" @change="use.status = ($event.target as HTMLSelectElement).value ? { id: ($event.target as HTMLSelectElement).value, turns: use.status?.turns ?? 3 } : undefined">
            <option value="">（無）</option>
            <option v-for="s in buffs" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label v-if="use.status">持續回合 <input v-model.number="use.status.turns" type="number" min="1" max="20" /></label>
      </div>
      <div class="row checks">
        <span class="small">解除：</span>
        <label v-for="s in debuffs" :key="s.id" class="check small"><input type="checkbox" :checked="use.cleanse?.includes(s.id)" @change="use.cleanse = toggle(use.cleanse, s.id, ($event.target as HTMLInputElement).checked)" /> {{ s.name }}</label>
      </div>
      <div class="grid">
        <label>投擲傷害（骰子）<input :value="use.damage?.dice ?? ''" placeholder="2d6" @change="use.damage = ($event.target as HTMLInputElement).value ? { dice: ($event.target as HTMLInputElement).value, type: use.damage?.type ?? 'fire' } : undefined" /></label>
        <label v-if="use.damage">傷害類型
          <select v-model="use.damage.type"><option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option></select>
        </label>
        <label>對敵人施加狀態
          <select :value="use.apply?.status ?? ''" @change="use.apply = ($event.target as HTMLSelectElement).value ? { status: ($event.target as HTMLSelectElement).value, turns: use.apply?.turns ?? 2, save: use.apply?.save, dc: use.apply?.dc } : undefined">
            <option value="">（無）</option>
            <option v-for="s in debuffs" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <template v-if="use.apply">
          <label>回合 <input v-model.number="use.apply.turns" type="number" min="1" max="20" /></label>
          <label>豁免屬性
            <select v-model="use.apply.save"><option :value="undefined">（不能豁免）</option><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
          </label>
          <label v-if="use.apply.save">豁免 DC <input v-model.number="use.apply.dc" type="number" min="5" max="30" /></label>
        </template>
        <label v-if="use.damage || use.apply">豁免（成功時傷害減半、不受狀態）
          <select :value="use.save?.attr ?? ''" @change="use.save = ($event.target as HTMLSelectElement).value ? { attr: ($event.target as HTMLSelectElement).value as AttrId, dc: use.save?.dc ?? 13 } : undefined">
            <option value="">（不能豁免）</option>
            <option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option>
          </select>
        </label>
        <label v-if="use.save">豁免 DC <input v-model.number="use.save.dc" type="number" min="5" max="30" /></label>
        <label v-if="use.damage || use.apply">範圍
          <select v-model="use.area"><option value="one">一名敵人</option><option value="all">所有敵人</option></select>
        </label>
      </div>
      <label class="check small"><input v-model="use.escape" type="checkbox" /> 傳送：全隊立刻脫離戰鬥</label>
      <label class="check small"><input v-model="use.combat_only" type="checkbox" /> 只能在戰鬥中使用（回復生命、法術環以外的效果一律只能在戰鬥中用）</label>
    </fieldset>

    <fieldset v-if="draft.category === 'gear'">
      <legend>工具模板（{{ toolText || '無：交給 AI 判斷' }}）</legend>
      <div class="grid">
        <label>模板
          <select :value="draft.tool?.kind ?? ''" @change="setTool(($event.target as HTMLSelectElement).value)">
            <option value="">（無：交給 AI 判斷）</option>
            <option v-for="k in TOOL_KINDS" :key="k" :value="k">{{ itemRules.tools[k].name }}</option>
          </select>
        </label>
        <label v-if="draft.tool && itemRules.tools[draft.tool.kind].bonus !== undefined">加值
          <input v-model.number="draft.tool.bonus" type="number" min="1" :max="itemRules.tools[draft.tool.kind].max ?? 10" />
        </label>
      </div>
      <p class="small muted">行囊裡同一種工具只算加值最高的一件。沒有套模板的雜物，AI 判定主動行動時會看到它在行囊裡，依玩家描述的用法決定有沒有幫助。</p>
    </fieldset>

    <fieldset v-if="draft.category === 'equipment'">
      <legend>裝備組成</legend>
      <div v-if="draft.gear" class="grid">
        <label>底材
          <select :value="draft.gear.base" @change="setBase(($event.target as HTMLSelectElement).value)">
            <option v-for="[id, b] in bases" :key="id" :value="id">{{ b.name }}</option>
          </select>
        </label>
        <label>材料
          <select v-model="draft.gear.material">
            <option v-for="[id, m] in materials" :key="id" :value="id">{{ m.name }}（{{ rarityName(m.rarity) }}）</option>
          </select>
        </label>
        <label>稀有度
          <select :value="draft.gear.rarity ?? ''" @change="draft.gear!.rarity = ($event.target as HTMLSelectElement).value || undefined">
            <option value="">依材料</option>
            <option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ rarityName(r) }}</option>
          </select>
        </label>
      </div>
      <div v-if="draft.gear" class="grid">
        <label v-for="(n, k) in MOD_NAME" :key="k">附魔・{{ n }} <input type="number" :value="enchantMods[k as keyof typeof enchantMods] ?? ''" @change="setEnchantMod(String(k), Number(($event.target as HTMLInputElement).value))" /></label>
      </div>
      <template v-if="draft.gear">
        <AffinityRows :model-value="draft.gear.enchants?.resist" label="附魔・抗性" @update:model-value="draft.gear!.enchants = { ...(draft.gear!.enchants ?? {}), resist: $event }" />
        <AffinityRows :model-value="draft.gear.enchants?.offense" label="附魔・攻擊加成" @update:model-value="draft.gear!.enchants = { ...(draft.gear!.enchants ?? {}), offense: $event }" />
      </template>
      <div class="row">
        <span class="summary small">{{ gearText }}</span>
        <button class="small" @click="priceFromGear">依組成定價</button>
      </div>
      <p class="small muted">這裡設定的數值不受稀有度的附魔點數限制（那是給打造、寶箱與 AI 生成的裝備用的）。</p>
    </fieldset>

    <fieldset v-if="draft.category === 'material'">
      <legend>打造材料</legend>
      <div class="row checks">
        <label v-for="(m, id) in gearRules.materials" :key="id" class="check small">
          <input type="checkbox" :checked="draft.forge?.materials.includes(String(id))" @change="setForge(String(id), ($event.target as HTMLInputElement).checked)" /> {{ m.name }}（{{ m.tier }} 級）
        </label>
      </div>
      <p class="small muted">勾選後可以在鐵匠鋪、裁縫店或珠寶店拿它委託打造對應材料的裝備（第 2 級以上）。</p>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
