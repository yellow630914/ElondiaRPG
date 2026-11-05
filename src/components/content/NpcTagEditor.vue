<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { actionRules, ATTR_IDS, attrName, npcTags, perkRules, type AttrId, type CheckFilter } from '@/engine/data'
import { builtinNpcTag } from '@/engine/mods'
import { editableOf, TAG_KINDS, TAG_LIMITS, TAG_LOCATION_TYPES, TAG_ZONES, type NpcTagMod } from '@/engine/npcTagMods'
import { pcTagEffectLines } from '@/engine/pcTags'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'
import NameListInput from './NameListInput.vue'

// 身分標籤（R20 的 C6，docs/CONTENT_EDITOR.md 3.7 節）：NPC 與主角共用的身分。
// 內建標籤寫死的特殊行為（略過聲望、互動 DC 修正……）保留內建的值，不在這裡改
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): NpcTagMod => {
  const m = clone(content.mods.npcTags?.[props.id] ?? editableOf(npcTags.tags[props.id]!))
  // 效果物件一開始就補上（空的存檔時會拿掉），編輯時不用每次檢查
  m.pc_effects ??= {}
  return m
}
const draft = ref<NpcTagMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => builtinNpcTag(props.id))
const edited = computed(() => !!builtin.value && !!content.mods.npcTags?.[props.id])
const usage = computed(() => {
  void content.version
  return content.usageOf('npcTag', props.id)
})
/** 內建標籤寫死、這裡不能改的效果 */
const fixed = computed(() => {
  const b = builtin.value
  if (!b) return []
  return [
    b.pc_effects?.bypass_reputation ? '主角不必聲望也能進入王城、地標與神殿的服務' : '',
    b.dc_mods ? '和帶這個標籤的人互動時的參考 DC 修正' : '',
    b.never_hostile ? '不會因為關係差在野外動手' : '',
    b.crime_reputation ? `對他犯罪被發現時，聲望另外 ${b.crime_reputation}` : '',
    b.class_mult ? '冒險者依職業調整出現的機率' : '',
    b.requires_zone ? '只出現在有這個區域的聚落' : '',
    b.haunt_extra ? '冒險者多出沒幾個地點' : '',
  ].filter(Boolean)
})
const KIND_NAME: Record<string, string> = { commoner: '普通人', adventurer: '冒險者' }
const LOC_NAME: Record<string, string> = { capital: '王都', city: '城市', town: '城鎮', port: '港口', village: '村莊', outpost: '哨站', fortress: '要塞' }
const skills = Object.entries(actionRules.skills).map(([k, v]) => [k, v.name, v.desc] as const)
const contexts = Object.entries(perkRules.contexts)
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name] as const)
const others = computed(() => Object.entries(npcTags.tags).filter(([k]) => k !== props.id).map(([k, v]) => [k, `${v.emoji} ${v.name}`] as const))
/** 預覽：存檔後主角帶著這個標籤會有的效果 */
const preview = computed(() => {
  void content.version
  return pcTagEffectLines(props.id)
})

function toggle<T extends string>(list: T[] | undefined, v: T, on: boolean): T[] | undefined {
  const set = new Set(list ?? [])
  if (on) set.add(v)
  else set.delete(v)
  return set.size ? [...set] : undefined
}
function setKinds(k: (typeof TAG_KINDS)[number], on: boolean) {
  draft.value.kinds = toggle(draft.value.kinds, k, on) ?? ['commoner']
}
function setOpt<K extends keyof NpcTagMod>(k: K, v: NpcTagMod[K] | undefined) {
  if (v === undefined || (Array.isArray(v) && !v.length)) delete draft.value[k]
  else draft.value[k] = v
}
function setZone(z: string, v: string) {
  const zw = { ...(draft.value.zone_weights ?? {}) }
  const n = Number(v)
  if (v === '' || !n) delete zw[z]
  else zw[z] = n
  setOpt('zone_weights', Object.keys(zw).length ? zw : undefined)
}
function numOrNone(v: string): number | undefined {
  return v === '' ? undefined : Number(v)
}
// ---- 主角效果 ----
const pe = computed(() => draft.value.pc_effects!)
function addCheck() {
  const list = (pe.value.checks ??= [])
  if (list.length < TAG_LIMITS.checks) list.push({ check: { skills: ['persuade'] }, bonus: 1 })
}
function toggleFilter(f: CheckFilter, key: keyof CheckFilter, v: string, on: boolean) {
  const next = toggle((f[key] as string[] | undefined), v, on)
  if (next) (f as Record<string, string[]>)[key] = next
  else delete f[key]
}
function setMult(k: 'buy_mult' | 'sell_mult' | 'service_mult' | 'exposure_mult' | 'slave_price_mult', pct: string) {
  const n = Number(pct)
  if (pct === '' || !Number.isFinite(n) || n === 0) delete pe.value[k]
  else pe.value[k] = Math.round((1 + n / 100) * 100) / 100
}
const pctOf = (x: number | undefined) => (x === undefined ? '' : String(Math.round((x - 1) * 100)))

function save() {
  try {
    content.saveNpcTag(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreNpcTag(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteNpcTag(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="`${draft.emoji} ${draft.name || '（未命名）'}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" blocked="" :usage="usage"
      @save="save" @discard="draft = current()" @restore="restore" @remove="remove"
    />
    <p class="small muted">id：{{ id }}。身分標籤 NPC 與主角共用：決定 NPC 怎麼生成、AI 怎麼描寫他，主角帶著時有檢定加成與價格倍率。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />
    <p v-if="fixed.length" class="small muted">內建的特殊效果（不能在這裡改，會保留）：{{ fixed.join('；') }}。</p>

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="TAG_LIMITS.name_chars" /></label>
        <label>Emoji <input v-model="draft.emoji" :maxlength="TAG_LIMITS.emoji_chars" class="emoji" /></label>
        <label title="NPC 的財富：決定他身上的錢與被偷的油水（0 窮 ～ 5 很有錢）">財富 <input v-model.number="draft.wealth" type="number" :min="TAG_LIMITS.wealth[0]" :max="TAG_LIMITS.wealth[1]" /></label>
        <label class="check"><input type="checkbox" :checked="draft.player !== false" @change="setOpt('player', ($event.target as HTMLInputElement).checked ? undefined : false)" /> 主角可以選</label>
      </div>
      <label class="block">給 AI 的描述 <Hint text="NPC 帶著這個標籤時，AI 會照這段描寫他。" /><textarea v-model="draft.ai_hint" rows="2" :maxlength="TAG_LIMITS.hint_chars" /></label>
      <div class="row">
        <span class="small">互斥（不會同時擁有）：</span>
        <label v-for="[k, n] in others" :key="k" class="check small"><input type="checkbox" :checked="draft.exclusive?.includes(k)" @change="setOpt('exclusive', toggle(draft.exclusive, k, ($event.target as HTMLInputElement).checked))" /> {{ n }}</label>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>NPC 怎麼生成 <Hint text="普通人照權重抽（平民 60、商人 22……）；冒險者照機率帶上。出沒的區域權重越高越常在那裡遇到；都沒填時照普通人或冒險者的預設。" /></template>
      <div class="row">
        <span class="small">種類：</span>
        <label v-for="k in TAG_KINDS" :key="k" class="check small"><input type="checkbox" :checked="draft.kinds.includes(k)" @change="setKinds(k, ($event.target as HTMLInputElement).checked)" /> {{ KIND_NAME[k] }}</label>
      </div>
      <div class="grid">
        <label>普通人的權重 <input type="number" min="0" :max="TAG_LIMITS.commoner_weight[1]" :value="draft.commoner_weight ?? ''" @input="setOpt('commoner_weight', numOrNone(($event.target as HTMLInputElement).value))" /></label>
        <label>冒險者帶上的機率 <input type="number" min="0" max="1" step="0.01" :value="draft.adventurer_chance ?? ''" @input="setOpt('adventurer_chance', numOrNone(($event.target as HTMLInputElement).value))" /></label>
        <label title="已經有其他標籤時，再多帶這個標籤的機率">額外帶上的機率 <input type="number" min="0" max="1" step="0.01" :value="draft.extra_chance ?? ''" @input="setOpt('extra_chance', numOrNone(($event.target as HTMLInputElement).value))" /></label>
      </div>
      <div class="row">
        <span class="small">只在這些聚落（都不勾時不限）：</span>
        <label v-for="t in TAG_LOCATION_TYPES" :key="t" class="check small"><input type="checkbox" :checked="draft.location_types?.includes(t)" @change="setOpt('location_types', toggle(draft.location_types, t, ($event.target as HTMLInputElement).checked))" /> {{ LOC_NAME[t] }}</label>
      </div>
      <div class="grid">
        <label v-for="(n, z) in TAG_ZONES" :key="z">出沒：{{ n }} <input type="number" min="0" :max="TAG_LIMITS.zone_weight[1]" step="0.1" :value="draft.zone_weights?.[z] ?? ''" @input="setZone(String(z), ($event.target as HTMLInputElement).value)" /></label>
      </div>
      <div class="block"><span class="small">職業（NPC 的職業描述從這裡挑；可以留空）</span><NameListInput :model-value="draft.occupations" :options="[]" placeholder="例如：鐵匠學徒" @update:model-value="(v) => setOpt('occupations', v)" /></div>
    </FoldSet>

    <FoldSet>
      <template #legend>主角帶著時的效果 <Hint text="檢定加值的篩選和特質一樣：同一欄是「或」，不同欄是「且」。價格是百分比（−5 是便宜 5%）。" /></template>
      <div v-for="(c, i) in pe.checks ?? []" :key="i" class="effect">
        <div class="row">
          <label class="small">檢定加值 <input v-model.number="c.bonus" type="number" :min="TAG_LIMITS.check_bonus[0]" :max="TAG_LIMITS.check_bonus[1]" class="num" /></label>
          <span class="spacer" />
          <button class="small" title="移除" @click="pe.checks!.splice(i, 1)">✕</button>
        </div>
        <details class="small" open><summary>檢定分類（{{ c.check.skills?.length ?? 0 }}）</summary>
          <label v-for="[k, n, d] in skills" :key="k" class="check" :title="d"><input type="checkbox" :checked="c.check.skills?.includes(k as never)" @change="toggleFilter(c.check, 'skills', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
        </details>
        <details class="small"><summary>對象的標籤（{{ c.check.vs_tags?.length ?? 0 }}）</summary>
          <label v-for="[k, v] in Object.entries(npcTags.tags)" :key="k" class="check"><input type="checkbox" :checked="c.check.vs_tags?.includes(k)" @change="toggleFilter(c.check, 'vs_tags', k, ($event.target as HTMLInputElement).checked)" /> {{ v.name }}</label>
        </details>
        <details class="small"><summary>更多：屬性（{{ c.check.attrs?.length ?? 0 }}）、情境（{{ c.check.contexts?.length ?? 0 }}）、行動（{{ c.check.kinds?.length ?? 0 }}）</summary>
          <div><label v-for="a in ATTR_IDS" :key="a" class="check"><input type="checkbox" :checked="c.check.attrs?.includes(a)" @change="toggleFilter(c.check, 'attrs', a, ($event.target as HTMLInputElement).checked)" /> {{ attrName(a as AttrId) }}</label></div>
          <div><label v-for="[k, n] in contexts" :key="k" class="check"><input type="checkbox" :checked="c.check.contexts?.includes(k as never)" @change="toggleFilter(c.check, 'contexts', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label></div>
          <div><label v-for="[k, n] in kinds" :key="k" class="check"><input type="checkbox" :checked="c.check.kinds?.includes(k as never)" @change="toggleFilter(c.check, 'kinds', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label></div>
        </details>
      </div>
      <button class="small" :disabled="(pe.checks?.length ?? 0) >= TAG_LIMITS.checks" @click="addCheck">＋ 檢定加值（最多 {{ TAG_LIMITS.checks }} 個）</button>
      <div class="grid">
        <label>商店買價 % <input type="number" min="-50" max="50" :value="pctOf(pe.buy_mult)" @input="setMult('buy_mult', ($event.target as HTMLInputElement).value)" /></label>
        <label>賣價 % <input type="number" min="-50" max="50" :value="pctOf(pe.sell_mult)" @input="setMult('sell_mult', ($event.target as HTMLInputElement).value)" /></label>
        <label>神殿服務 % <input type="number" min="-50" max="50" :value="pctOf(pe.service_mult)" @input="setMult('service_mult', ($event.target as HTMLInputElement).value)" /></label>
        <label title="成人向">曝露名聲累積 % <input type="number" min="-100" max="200" :value="pctOf(pe.exposure_mult)" @input="setMult('exposure_mult', ($event.target as HTMLInputElement).value)" /></label>
        <label title="成人向">被賣時身價 % <input type="number" min="-50" max="200" :value="pctOf(pe.slave_price_mult)" @input="setMult('slave_price_mult', ($event.target as HTMLInputElement).value)" /></label>
        <label title="成人向；負數是受到的慾望變少">戰鬥中受到的慾望 <input type="number" min="-0.5" max="0.5" step="0.05" :value="pe.lust_resist ?? ''" @input="pe.lust_resist = numOrNone(($event.target as HTMLInputElement).value) || undefined" /></label>
      </div>
      <label class="block">給 AI 的主角身分說明（選填）<input v-model="pe.hint" :maxlength="TAG_LIMITS.pc_hint_chars" /></label>
      <p v-if="preview.length" class="small muted">存檔後的效果：{{ preview.join('；') }}</p>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.emoji { width: 5em; }
.effect { border: 1px dashed var(--border); border-radius: var(--radius); padding: 4px 8px; display: grid; gap: 2px; }
.spacer { flex: 1; }
.num { width: 4em; }
</style>
