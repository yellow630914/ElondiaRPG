<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { abilities, actionRules, ATTR_IDS, attrName, companionRules, itemRules, perkRules, type CheckFilter } from '@/engine/data'
import { gearRules, SLOTS, slotsFor } from '@/engine/gear'
import {
  builtinParasite, currentParasite, PARASITE_CATEGORY_NAME, PARASITE_KIND_NAME, PARASITE_LIMITS, TWO_FACE_KEYS, TWO_FACE_NAME,
  type ParasiteCategory, type ParasiteMod,
} from '@/engine/parasiteMods'
import { parasiteRules, type BroodDef, type BroodKind } from '@/engine/parasites'
import { BROOD_KIND_NAME } from '@/engine/brood'
import { placeName, TATTOO_PLACES } from '@/engine/tattoos'
import type { GearSlot } from '@/engine/types'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'

// 寄生物的編輯表單（docs/ADULT_EVENTS.md 第 6 節）。內建的不能改種類；自建的 id 是 mod_par_ 開頭。
// 分類：可馴服（任務線的結局把它馴服）、短期寄生（長到最後由發作事件拿掉，沒有馴服）。發作事件在「🎲 事件」頁新增（寄生的發作）。
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()
const L = PARASITE_LIMITS

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const stages = parasiteRules.stages
/** 各階段的陣列補齊（編輯時每一階段都有位置） */
function filled(p: ParasiteMod): ParasiteMod {
  const pad = <T,>(a: T[] | undefined, d: () => T): T[] => Array.from({ length: stages.length }, (_, i) => a?.[i] ?? d())
  return {
    ...p,
    stage_effects: pad(p.stage_effects, () => []),
    stage_abilities: pad(p.stage_abilities, () => []),
    stage_lust: pad(p.stage_lust, () => 0),
    two_face: pad(p.two_face, () => ({})),
  }
}
const current = (): ParasiteMod => filled(clone(content.mods.parasites?.[props.id] ?? currentParasite(props.id)!))
const draft = ref<ParasiteMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinParasite(props.id))
const edited = computed(() => builtin.value && !!content.mods.parasites?.[props.id])
const usage = computed(() => {
  void content.version
  return content.usageOf('parasite', props.id)
})
const outbreaks = computed(() => usage.value.filter((u) => u.startsWith('發作事件')))
const sources = computed(() => usage.value.filter((u) => !u.startsWith('發作事件') && !u.startsWith('目前存檔')))

/** 放得進這個欄位的裝備（沒選欄位時全部）；目前選的就算放不進去也列出來，才看得到 */
function itemsFor(slot: GearSlot | undefined, keep?: string): string[] {
  void content.version
  return itemRules.items.filter((i) => i.gear && (!slot || i.name === keep || slotsFor(i.gear).includes(slot))).map((i) => i.name).sort()
}
const gearItems = computed(() => itemsFor(draft.value.slot, draft.value.item))
const tamedItems = computed(() => itemsFor(draft.value.slot, draft.value.tamed?.item))
/** 欄位的名稱；同名的（兩個戒指、兩個穿孔飾品）後面加第幾個 */
const slotName = (s: GearSlot) => {
  const name = gearRules.slots[s] ?? s
  const same = SLOTS.filter((x) => gearRules.slots[x] === name)
  return same.length > 1 ? `${name} ${same.indexOf(s) + 1}` : name
}
/** 選的物品放不進鎖住的欄位 */
const fits = (name: string | undefined) => {
  const spec = name ? itemRules.items.find((i) => i.name === name)?.gear : undefined
  return !spec || !draft.value.slot || slotsFor(spec).includes(draft.value.slot)
}
const abilityList = computed(() => Object.entries(abilities).map(([id, a]) => ({ id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name)))
const conditionList = computed(() => Object.entries(companionRules.conditions).filter(([k]) => !k.startsWith('$')).map(([id, c]) => ({ id, name: c.name })))
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name] as const)

const problem = computed(() => {
  const d = draft.value
  if (!d.name.trim()) return '要有名稱'
  if (d.kind === 'gear' && (!d.item || !d.slot)) return '寄生裝備要選物品與鎖住的欄位'
  if (d.kind === 'gear' && !fits(d.item)) return `「${d.item}」放不進${slotName(d.slot!)}`
  if (d.kind === 'gear' && d.category === 'tameable' && d.tamed?.item && !fits(d.tamed.item)) return `馴服後的「${d.tamed.item}」放不進${slotName(d.slot!)}`
  if (d.category === 'tameable' && d.tamed && (!d.tamed.scene?.trim() || !d.tamed.text?.trim())) return '馴服之後的場景與結果都要寫'
  return ''
})

function setCategory(c: ParasiteCategory) {
  draft.value.category = c
  if (c === 'tameable') draft.value.tamed ??= { scene: '', text: '' }
  if (c === 'brood') draft.value.brood ??= { kind: 'egg', yields: [] }
  else delete draft.value.brood
}
// 苗床（docs/FAMILY.md 第 13 節）
const brood = computed(() => (draft.value.brood ??= { kind: 'egg' }) as BroodDef)
function setBroodKind(k: BroodKind) {
  const b = brood.value
  b.kind = k
  if (k === 'live') {
    delete b.yields
    delete b.symbiosis
    b.offspring ??= { name: '魔物的幼體', count: [1, 2], value_cc: 50 }
  } else {
    delete b.offspring
    b.yields ??= []
    if (k !== 'parasite') delete b.symbiosis
  }
}
function setOffspring(p: Partial<NonNullable<BroodDef['offspring']>>) {
  const b = brood.value
  b.offspring = { ...(b.offspring ?? { name: '魔物的幼體', count: [1, 2], value_cc: 50 }), ...p }
}
function setSymbiosis(v: string) {
  if (v) brood.value.symbiosis = v
  else delete brood.value.symbiosis
}
const materialNames = computed(() => {
  void content.version
  return itemRules.items.filter((i) => !i.gear && (i.category === 'material' || i.category === 'consumable')).map((i) => i.name).sort()
})
function addEffect(i: number) {
  draft.value.stage_effects![i]!.push({ check: { attrs: ['dex'] }, bonus: -1 })
}
function toggleFilter(f: CheckFilter, key: 'attrs' | 'kinds', v: string, on: boolean) {
  const set = new Set<string>((f[key] as string[] | undefined) ?? [])
  if (on) set.add(v)
  else set.delete(v)
  if (set.size) (f as Record<string, string[]>)[key] = [...set]
  else delete f[key]
}
function setAbilities(i: number, ids: string[]) {
  draft.value.stage_abilities![i] = ids.slice(0, L.abilities)
}
function setTwoFace(i: number, k: (typeof TWO_FACE_KEYS)[number], v: number) {
  const row = { ...(draft.value.two_face![i] ?? {}) }
  if (v) row[k] = v
  else delete row[k]
  draft.value.two_face![i] = row
}
const storiesText = computed({
  get: () => (draft.value.stories ?? []).join(', '),
  set: (v: string) => {
    const ids = v.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean)
    if (ids.length) draft.value.stories = ids
    else delete draft.value.stories
  },
})
const removable = computed({
  get: () => !!draft.value.remove,
  set: (on: boolean) => {
    if (on) draft.value.remove ??= { dc: 14, price: 1000 }
    else delete draft.value.remove
  },
})
const markAttr = (a: string) => (draft.value.tamed?.mark?.attrs as Record<string, number> | undefined)?.[a] ?? 0
function setMarkAttr(a: string, v: number) {
  const t = draft.value.tamed!
  t.mark ??= { name: draft.value.mark?.name ?? draft.value.name, desc: '' }
  const attrs = { ...(t.mark.attrs ?? {}) } as Record<string, number>
  if (v) attrs[a] = v
  else delete attrs[a]
  t.mark.attrs = attrs
}

function save() {
  try {
    content.saveParasite(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreParasite(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteParasite(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
// 受孕倍率（docs/FAMILY.md 第 3 節）：1 是沒有效果（拿掉）
function setFertility(k: 'min' | 'mult', v: number) {
  const f = { min: draft.value.fertility?.min ?? 0, mult: draft.value.fertility?.mult ?? 1, [k]: Number.isFinite(v) ? v : k === 'mult' ? 1 : 0 }
  if (f.mult === 1) delete draft.value.fertility
  else draft.value.fertility = f
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="`🐛 ${draft.name || '（未命名）'}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :blocked="problem" :usage="usage"
      @save="save" @discard="draft = current()" @restore="restore" @remove="remove"
    />
    <p class="small muted">
      id：{{ id }}。寄生物只會寄生在主角身上；侵蝕度 0～100 決定階段（{{ stages.map((s) => `${s.name} ${s.min}+`).join('、') }}）。
      寄生的方法寫在特殊任務、事件的效果（「寄生物：寄生」），發作事件在「🎲 事件」頁新增（種類選「寄生的發作」）。已經寄生在身上的會照新的設定（淫紋的名稱與外觀也會跟著改）。
    </p>
    <UsageNote :usage="usage" :deletable="!builtin" />
    <p v-if="!sources.length" class="small warn-text">⚠️ 沒有任何特殊任務或事件會讓人被寄生：遊戲裡遇不到它。</p>
    <p v-if="!outbreaks.length && draft.category !== 'brood'" class="small warn-text">
      ⚠️ 沒有發作事件：寄生之後不會發作，侵蝕度也不會自己長（「每天自己長」沒有作用），只有任務或事件的效果會改變它；沒有的話一直停在{{ stages[0]?.name }}{{ draft.category === 'short' ? '，也沒有事件把它拿掉（只能解咒）' : '' }}。
      到「🎲 事件」頁新增事件，「在哪裡」選「寄生物的發作」、選這個寄生物。
    </p>

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="L.name_chars" /></label>
        <label><span>種類 <Hint text="寄生裝備：鎖在一個裝備欄位、脫不下來；淫紋：刻在一個部位的詛咒印記（奴隸印記可以把它頂掉）；種子：在體內長大，沒有外觀上的東西。內建的不能改。" /></span>
          <select v-model="draft.kind" :disabled="builtin">
            <option v-for="(n, k) in PARASITE_KIND_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label><span>分類 <Hint text="可馴服：任務線的結局用「寄生物：馴服」把它馴服，之後不再發作、可以主動觸發，得到馴服之後的物品或印記。短期寄生：長得快，長到最後由發作事件把它拿掉（例如種子開花產下），沒有馴服。苗床：怪物的卵、種、幼蟲，沒有發作事件，長到最後產下（成人向，docs/FAMILY.md 第 13 節）。" /></span>
          <select :value="draft.category" @change="setCategory(($event.target as HTMLSelectElement).value as ParasiteCategory)">
            <option v-for="(n, k) in PARASITE_CATEGORY_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
      </div>
      <label class="block"><span>描述 <Hint text="交給 AI 的樣子與習性（還沒馴服時）。" /></span><textarea v-model="draft.desc" rows="2" :maxlength="L.desc_chars" /></label>
    </FoldSet>

    <FoldSet v-if="draft.category === 'brood'" :key="`brood-${id}`" filled>
      <template #legend>苗床 <Hint text="怪物留在主角體內的卵、種、幼蟲（docs/FAMILY.md 第 13 節）。沒有發作事件，侵蝕度每天照長（發作被擋掉也長），長到支配時產下。要內容篩選「怪物的苗床」打開。怎麼變成苗床：怪物頁籤的「苗床」（色情戰敗事件）、能力的「植入苗床」、效果「寄生物：寄生」。" /></template>
      <div class="grid">
        <label><span>種類 <Hint text="卵生：產下時排出卵（物品）。胎生：要有子宮，懷孕中不會、有胎生的苗床時不會懷孕；共生以上泌乳，產下像生產一樣（產後虛弱、泌乳 15 天），生下的幼體當場處理。寄生：破繭時排出（物品），修了獸蟲派入門的人可以選擇共生得到特質。" /></span>
          <select :value="brood.kind" @change="setBroodKind(($event.target as HTMLSelectElement).value as BroodKind)">
            <option v-for="(n, k) in BROOD_KIND_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <template v-if="brood.kind === 'live'">
          <label>幼體的名稱 <input :value="brood.offspring?.name ?? ''" maxlength="20" @input="setOffspring({ name: ($event.target as HTMLInputElement).value })" /></label>
          <label>幾隻：最少 <input type="number" min="1" max="6" :value="brood.offspring?.count[0] ?? 1" class="num" @input="setOffspring({ count: [Number(($event.target as HTMLInputElement).value), brood.offspring?.count[1] ?? 1] })" /></label>
          <label>最多 <input type="number" min="1" max="6" :value="brood.offspring?.count[1] ?? 1" class="num" @input="setOffspring({ count: [brood.offspring?.count[0] ?? 1, Number(($event.target as HTMLInputElement).value)] })" /></label>
          <label><span>每隻的價錢 <Hint text="交給魔物學者時每隻換到的錢（銅幣）。" /></span><input type="number" min="0" max="5000" :value="brood.offspring?.value_cc ?? 0" @input="setOffspring({ value_cc: Number(($event.target as HTMLInputElement).value) })" /></label>
        </template>
        <label v-if="brood.kind === 'parasite'"><span>共生得到的特質 <Hint text="修了獸蟲派入門的人破繭時可以選擇共生，學會這個特質（苗床拿掉）。沒選時不能共生。" /></span>
          <select :value="brood.symbiosis ?? ''" @change="setSymbiosis(($event.target as HTMLSelectElement).value)">
            <option value="">（不能共生）</option>
            <option v-for="p in perkRules.perks" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
      </div>
      <div v-if="brood.kind !== 'live'" class="small">
        <b>產下的物品</b>
        <div v-for="(y, i) in brood.yields ?? []" :key="i" class="row small eff">
          <select v-model="y.item"><option v-for="n in materialNames" :key="n" :value="n">{{ n }}</option></select>
          <span>最少</span><input v-model.number="y.qty[0]" type="number" min="1" max="20" class="num" />
          <span>最多</span><input v-model.number="y.qty[1]" type="number" min="1" max="20" class="num" />
          <button class="small ghost" @click="brood.yields!.splice(i, 1)">✕</button>
        </div>
        <button class="small ghost" @click="(brood.yields ??= []).push({ item: materialNames[0] ?? '', qty: [1, 3] })">＋ 物品</button>
      </div>
    </FoldSet>

    <FoldSet v-if="draft.kind === 'gear'" :key="`gear-${id}`" filled>
      <template #legend>寄生裝備</template>
      <div class="grid">
        <label>鎖住的欄位 <select v-model="draft.slot"><option v-for="s in SLOTS" :key="s" :value="s">{{ slotName(s) }}</option></select></label>
        <label><span>物品 <Hint text="只列出放得進鎖住的欄位的裝備。" /></span><select v-model="draft.item"><option value="">（選一件裝備）</option><option v-for="n in gearItems" :key="n" :value="n">{{ n }}</option></select></label>
      </div>
    </FoldSet>
    <FoldSet v-if="draft.kind === 'mark'" :key="`mark-${id}`" filled>
      <template #legend>淫紋</template>
      <div class="grid">
        <label>部位 <select v-model="draft.place"><option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}</option></select></label>
        <label>印記的名稱 <input :value="draft.mark?.name ?? ''" :maxlength="L.mark_name_chars" @input="draft.mark = { name: ($event.target as HTMLInputElement).value, desc: draft.mark?.desc ?? '' }" /></label>
      </div>
      <label class="block">印記的外觀 <textarea :value="draft.mark?.desc ?? ''" rows="2" :maxlength="L.desc_chars" @input="draft.mark = { name: draft.mark?.name ?? draft.name, desc: ($event.target as HTMLTextAreaElement).value }" /></label>
    </FoldSet>

    <FoldSet>
      <template #legend>成長與解咒</template>
      <div class="grid">
        <label><span>受孕倍率 <Hint text="侵蝕度到下一格以上、沒有沉睡時，受孕的機率乘上這個倍率（魅魔的契紋：60 以上 ×1.5）；1 是沒有效果。docs/FAMILY.md 第 3 節。" /></span>
          <input type="number" min="0" max="5" step="0.1" :value="draft.fertility?.mult ?? 1" @input="setFertility('mult', Number(($event.target as HTMLInputElement).value))" />
        </label>
        <label v-if="draft.fertility">侵蝕度從 <input type="number" min="0" max="100" :value="draft.fertility.min" @input="setFertility('min', Number(($event.target as HTMLInputElement).value))" /> 開始</label>
        <label><span>每天自己長 <Hint text="侵蝕度每天自己增加多少（0～50）；發作時屈服也會上升。短期寄生通常很快（內建的種子 30，三天到支配）。" /></span><input v-model.number="draft.grow_per_day" type="number" min="0" :max="L.grow[1]" /></label>
        <label class="check"><input v-model="removable" type="checkbox" /> 可以解咒（神殿、刻印師）</label>
        <template v-if="draft.remove">
          <label><span>解咒的 DC <Hint text="基準；每 10 點侵蝕度 +1。" /></span><input v-model.number="draft.remove.dc" type="number" :min="L.dc[0]" :max="L.dc[1]" /></label>
          <label><span>解咒的價錢 <Hint text="基準（銅幣）；侵蝕度越高越貴。" /></span><input v-model.number="draft.remove.price" type="number" min="0" :max="L.price[1]" /></label>
        </template>
        <label v-if="draft.kind === 'mark'"><span>紋回來的價錢 <Hint text="淫紋被奴隸印記頂掉或洗掉之後，刻印師紋回來的價錢（沒寫是 500）。" /></span><input v-model.number="draft.reink_price" type="number" min="0" :max="L.price[1]" /></label>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>各階段的效果 <Hint text="被動效果：檢定的加減（平常就有）。技能：還沒馴服時這個階段給的戰鬥技能。失控：開戰時帶著的慾望（慾望上限的比例）。雙面效應：修了任何慾望流派的人，戰鬥中依階段得到的修正（修了獸蟲派 ×1.5）。" /></template>
      <div v-for="(s, i) in stages" :key="i" class="stage">
        <h4 class="small">{{ s.name }}（{{ s.min }}+）</h4>
        <div v-for="(e, j) in draft.stage_effects![i]" :key="j" class="row small eff">
          <span>檢定</span>
          <details><summary>屬性（{{ e.check.attrs?.map(attrName).join('、') || '不限' }}）</summary>
            <label v-for="a in ATTR_IDS" :key="a" class="check"><input type="checkbox" :checked="e.check.attrs?.includes(a)" @change="toggleFilter(e.check, 'attrs', a, ($event.target as HTMLInputElement).checked)" /> {{ attrName(a) }}</label>
          </details>
          <details><summary>主動行動（{{ e.check.kinds?.length ?? 0 }}）</summary>
            <label v-for="[k, n] in kinds" :key="k" class="check"><input type="checkbox" :checked="e.check.kinds?.includes(k as never)" @change="toggleFilter(e.check, 'kinds', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
          </details>
          <input v-model.number="e.bonus" type="number" :min="L.bonus[0]" :max="L.bonus[1]" class="num" />
          <button class="small ghost" @click="draft.stage_effects![i]!.splice(j, 1)">✕</button>
        </div>
        <button v-if="draft.stage_effects![i]!.length < L.effects" class="small ghost" @click="addEffect(i)">＋ 檢定加減</button>
        <div class="grid">
          <label>技能
            <select multiple size="3" :value="draft.stage_abilities![i]" @change="setAbilities(i, [...($event.target as HTMLSelectElement).selectedOptions].map((o) => o.value))">
              <option v-for="a in abilityList" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </label>
          <label>失控（慾望上限的比例） <input v-model.number="draft.stage_lust![i]" type="number" min="0" max="1" step="0.05" /></label>
        </div>
        <div class="row small two-face">
          <span>雙面效應</span>
          <label v-for="k in TWO_FACE_KEYS" :key="k">{{ TWO_FACE_NAME[k] }} <input type="number" :min="L.two_face[0]" :max="L.two_face[1]" :value="draft.two_face![i]?.[k] ?? 0" class="num" @input="setTwoFace(i, k, Number(($event.target as HTMLInputElement).value))" /></label>
        </div>
      </div>
    </FoldSet>

    <FoldSet v-if="draft.category === 'tameable'" :key="`tamed-${id}`" filled>
      <template #legend>馴服之後 <Hint text="特殊任務的結局用「寄生物：馴服」。馴服之後不再發作、侵蝕度歸零，可以主動觸發這裡的場景；寄生裝備換成馴服後的物品，淫紋變成馴服後的印記。" /></template>
      <template v-if="draft.tamed">
        <div class="grid">
          <label v-if="draft.kind === 'gear'">馴服後的物品 <select v-model="draft.tamed.item"><option :value="undefined">（照原本的物品）</option><option v-for="n in tamedItems" :key="n" :value="n">{{ n }}</option></select></label>
          <label>主動觸發後得到 <select v-model="draft.tamed.buff"><option :value="undefined">（沒有）</option><option v-for="c in conditionList" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
          <label><span>獸蟲派的技能 <Hint text="修了獸蟲派的人，馴服之後變成這個技能（每次長休一次）。" /></span><select v-model="draft.tamed.ability"><option :value="undefined">（沒有）</option><option v-for="a in abilityList" :key="a.id" :value="a.id">{{ a.name }}</option></select></label>
        </div>
        <template v-if="draft.kind === 'mark'">
          <div class="grid">
            <label>馴服後的印記名稱 <input :value="draft.tamed.mark?.name ?? ''" :maxlength="L.mark_name_chars" @input="draft.tamed.mark = { ...(draft.tamed.mark ?? { desc: '' }), name: ($event.target as HTMLInputElement).value }" /></label>
            <label v-for="a in ATTR_IDS" :key="a">{{ attrName(a) }} <input type="number" :min="L.mark_attr[0]" :max="L.mark_attr[1]" :value="markAttr(a)" class="num" @input="setMarkAttr(a, Number(($event.target as HTMLInputElement).value))" /></label>
          </div>
          <label class="block">馴服後的外觀 <textarea :value="draft.tamed.mark?.desc ?? ''" rows="2" :maxlength="L.desc_chars" @input="draft.tamed.mark = { ...(draft.tamed.mark ?? { name: draft.name }), desc: ($event.target as HTMLTextAreaElement).value }" /></label>
        </template>
        <label class="block"><span>主動觸發的場景 <Hint text="交給 AI 寫成親密場景（成人向）。" /></span><textarea v-model="draft.tamed.scene" rows="2" :maxlength="L.scene_chars" /></label>
        <label class="block">主動觸發的結果 <textarea v-model="draft.tamed.text" rows="2" :maxlength="L.text_chars" /></label>
      </template>
    </FoldSet>
    <p v-else class="small muted">短期寄生：沒有馴服。記得在「🎲 事件」頁替最後一個階段加一件發作事件，用「寄生物：拿掉」把它拿掉（例如種子開花產下）。</p>

    <FoldSet>
      <template #legend>任務線</template>
      <label class="block"><span>解咒時中止的特殊任務 <Hint text="特殊任務的 id，用逗號分開。解咒時這些任務一起中止，之後再被寄生可以重來。" /></span><input v-model.lazy="storiesText" placeholder="例如 par_lin_look, par_lin_feed" /></label>
      <label><span>劇情旗標的前綴 <Hint text="解咒時把這個前綴開頭的旗標一起清掉（英文小寫、數字、底線，以 _ 結尾）。" /></span><input v-model="draft.flag_prefix" maxlength="25" placeholder="例如 par_lin_" /></label>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.stage { border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 6px; display: grid; gap: 4px; }
.stage h4 { margin: 0; }
.stage .grid { align-items: start; }
.eff, .two-face { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.num { width: 64px; }
details { display: inline-block; }
details label.check { display: inline-flex; gap: 2px; margin-right: 6px; }
</style>
