<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { abilities, ATTR_IDS, attrName, className, classRegionMult, combatClasses, equipment, geography, npcClassWeight, npcTags, type AbilityDef, type AttrId } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import {
  builtinClassMod, CASTER_NAME, CLASS_LIMITS, classModOf, levelPoolSizes, PIECE_NAME, START_SLOTS, weaponTypes, type ClassMod,
} from '@/engine/classMods'
import { ABILITY_TYPES } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import type { GearSlot } from '@/engine/types'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'
import AffinityRows from './AffinityRows.vue'

// 職業（docs/CONTENT_EDITOR.md 3.45 節）：定義、裝備模板、NPC 生成的權重與身分標籤倍率合成一份編輯。
// 「誰可以學」存在能力上，這裡的批次勾選存檔時改那些能力
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): ClassMod => clone(content.mods.classes?.[props.id] ?? classModOf(props.id))
/** 目前能學這個職業的能力（不含怪物、色情技能） */
const learnSet = (): string[] => Object.values(abilities).filter((a) => a.classes.includes(props.id)).map((a) => a.id).sort()
const draft = ref<ClassMod>(current())
const learn = ref<string[]>(learnSet())
const saved = ref(JSON.stringify([draft.value, learn.value]))
function reset() {
  draft.value = current()
  learn.value = learnSet()
  saved.value = JSON.stringify([draft.value, learn.value])
}
watch(() => props.id, reset)
const dirty = computed(() => JSON.stringify([draft.value, [...learn.value].sort()]) !== saved.value)
const builtin = computed(() => builtinClassMod(props.id))
const edited = computed(() => !!builtin.value && !!content.mods.classes?.[props.id])
const usage = computed(() => {
  void content.version
  return content.usageOf('class', props.id)
})
/** 存好的版本有初始能力（沒有的話建角與 NPC 都不會用到這個職業） */
const savedStart = computed(() => {
  void content.version
  return !!classModOf(props.id).start.length
})
const blocked = computed(() => (!draft.value.start.length ? '至少要有一個初始能力' : ''))

// ---- 屬性順序：五個屬性各一次，交換位置 ----
function setPriority(i: number, a: AttrId) {
  const p = [...draft.value.priority]
  const j = p.indexOf(a)
  if (j >= 0) p[j] = p[i]!
  p[i] = a
  draft.value.priority = p
}
function setCaster(v: string) {
  draft.value.caster = v as ClassMod['caster']
  if (v === 'none') delete draft.value.casting
  else draft.value.casting ??= draft.value.priority[0]
}

// ---- 能力 ----
const typeLabel = (a: AbilityDef) => `${ABILITY_TYPES[a.type]}${a.type === 'skill' ? ` ${a.unlock ?? 1} 級` : a.type === 'spell' ? ` ${a.circle ?? 1} 環` : ''}`
const sortKey = (a: AbilityDef) => (a.type === 'cantrip' ? 0 : a.type === 'skill' ? a.unlock ?? 1 : 20 + (a.circle ?? 1))
/** 可以勾的能力，依原本屬於哪個職業分組（自己的那組放最前面） */
const groups = computed(() => {
  void content.version
  const list = Object.values(abilities).filter((a) => !a.classes.includes('monster') && !a.classes.includes('lewd'))
  const owner = (a: AbilityDef) => a.classes.find((c) => c !== props.id && combatClasses[c]) ?? ''
  const out = new Map<string, AbilityDef[]>()
  for (const a of list) {
    const k = learn.value.includes(a.id) ? props.id : owner(a)
    out.set(k, [...(out.get(k) ?? []), a])
  }
  return [...out.entries()]
    .map(([k, l]) => ({ key: k, name: k === props.id ? '這個職業能學的' : k ? `${className(k)}的能力` : '沒有職業的能力', list: l.sort((x, y) => sortKey(x) - sortKey(y)) }))
    .sort((a, b) => (a.key === props.id ? -1 : b.key === props.id ? 1 : 0))
})
function toggleLearn(id: string, on: boolean) {
  const s = new Set(learn.value)
  if (on) s.add(id)
  else {
    s.delete(id)
    draft.value.start = draft.value.start.filter((x) => x !== id)
  }
  learn.value = [...s]
}
function toggleStart(id: string, on: boolean) {
  const s = new Set(draft.value.start)
  if (on && s.size < CLASS_LIMITS.start) s.add(id)
  else s.delete(id)
  draft.value.start = [...s]
}
const learnList = computed(() => learn.value.map((id) => abilities[id]).filter((a): a is AbilityDef => !!a).sort((x, y) => sortKey(x) - sortKey(y)))
/** 存檔後的升級選項（照存好的資料算） */
const pools = computed(() => {
  void content.version
  try {
    return levelPoolSizes(props.id)
  } catch {
    return []
  }
})
const short = computed(() => pools.value.map((n, i) => ({ lv: i + 2, n })).filter((x) => x.n < 6))

// ---- 裝備 ----
const SLOT_NAME: Partial<Record<GearSlot, string>> = { main_hand: '主手', off_hand: '副手', body: '上身' }
const basesFor = (slot: GearSlot) => Object.entries(gearRules.bases).filter(([, b]) => b.slot === slot && !b.restraint && !b.exclusive).map(([k, b]) => [k, b.name] as const)
const listKey: Record<string, 'main' | 'off' | 'body'> = { main_hand: 'main', off_hand: 'off', body: 'body' }
function setStartGear(slot: GearSlot, v: string) {
  const s = { ...draft.value.gear.start }
  if (v) s[slot] = v
  else delete s[slot]
  draft.value.gear.start = s
}
function toggleBase(slot: GearSlot, b: string, on: boolean) {
  const k = listKey[slot]!
  const set = new Set(draft.value.gear[k])
  if (on) set.add(b)
  else set.delete(b)
  draft.value.gear[k] = [...set]
}
const types = weaponTypes()
function setWeaponLimit(on: boolean) {
  if (on) draft.value.gear.weapons = []
  else delete draft.value.gear.weapons
}
function toggleWeaponType(t: string, on: boolean) {
  const set = new Set(draft.value.gear.weapons ?? [])
  if (on) set.add(t)
  else set.delete(t)
  draft.value.gear.weapons = [...set]
}
const weaponOptions = Object.entries(equipment.weapons).map(([k, w]) => [k, `${w.name}${w.natural ? '（天生）' : ''}`] as const)
const armorOptions = Object.entries(equipment.armors).map(([k, a]) => [k, a.name] as const)

// ---- NPC 生成 ----
const advTags = computed(() => Object.entries(npcTags.tags).filter(([, t]) => t.kinds.includes('adventurer')).map(([k, t]) => [k, `${t.emoji} ${t.name}`] as const))
function setTagMult(t: string, v: string) {
  const tm = { ...(draft.value.tag_mult ?? {}) }
  const n = Number(v)
  if (v === '' || !Number.isFinite(n) || n === 1) delete tm[t]
  else tm[t] = n
  if (Object.keys(tm).length) draft.value.tag_mult = tm
  else delete draft.value.tag_mult
}
const weightShare = computed(() => {
  const others = Object.keys(combatClasses).filter((k) => k !== props.id).reduce((s, k) => s + Math.max(0, combatClasses[k]!.npc_weight ?? 1), 0)
  const w = Math.max(0, Number(draft.value.npc_weight) || 0)
  return w + others > 0 ? Math.round((w / (w + others)) * 1000) / 10 : 0
})

// ---- 地區職業倍率 ----
const regionOptions = [...geography.regions.map((r) => [r.id, r.name] as const), ['other', '其他地區'] as const]
function setRegionMult(k: string, v: string) {
  const rm = { ...(draft.value.region_mult ?? {}) }
  const n = Number(v)
  if (v === '' || !Number.isFinite(n) || n === 1) delete rm[k]
  else rm[k] = n
  if (Object.keys(rm).length) draft.value.region_mult = rm
  else delete draft.value.region_mult
}
/** 有寫倍率的地區（加上「其他地區」）各有大約多少冒險者是這個職業 */
const regionShares = computed(() => {
  const rm = draft.value.region_mult ?? {}
  if (!Object.keys(rm).length) return []
  const w = Math.max(0, Number(draft.value.npc_weight) || 0)
  const keys = [...geography.regions.map((r) => r.id).filter((r) => rm[r] !== undefined)]
  const otherRegion = geography.regions.find((r) => rm[r.id] === undefined)?.id
  const rows = keys.map((r) => ({ name: geography.regions.find((g) => g.id === r)?.name ?? r, region: r }))
  if (otherRegion) rows.push({ name: '其他地區', region: otherRegion })
  return rows.map(({ name, region }) => {
    const mine = w * classRegionMult(draft.value, region)
    const others = Object.keys(combatClasses).filter((k) => k !== props.id).reduce((s, k) => s + npcClassWeight(k, region), 0)
    return { name, share: mine + others > 0 ? Math.round((mine / (mine + others)) * 1000) / 10 : 0 }
  })
})

function save() {
  try {
    const name = draft.value.name
    // 剛新增的職業（還沒有初始能力、權重 0）第一次存好初始能力時，沒動過權重就改回一般的 1
    const was = content.mods.classes?.[props.id]
    if (was?.custom && !was.start.length && was.npc_weight === 0 && draft.value.npc_weight === 0 && draft.value.start.length) draft.value.npc_weight = 1
    content.saveClass(props.id, draft.value)
    content.setClassAbilities(props.id, learn.value)
    // 只能學的能力才能當初始能力：取消勾選的能力已經從初始能力拿掉，這裡再存一次對齊
    const start = draft.value.start.filter((x) => abilities[x]?.classes.includes(props.id))
    if (start.length !== draft.value.start.length) content.saveClass(props.id, { ...draft.value, start })
    reset()
    game.flash(`已儲存「${name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？（能學的能力不會跟著恢復，要在技能頁籤各自恢復）`)) return
  content.restoreClass(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？能力的「誰可以學」會拿掉這個職業。用到這個職業的存檔之後會讀不了（重新新增的職業代號不同，加不回來）。`)) return
  try {
    if (usage.value.length) throw new Error(`還有地方用到，不能刪除：${usage.value.slice(0, 3).join('、')}`)
    content.setClassAbilities(props.id, [])
    content.deleteClass(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="`${draft.emoji} ${draft.name || '（未命名）'}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :blocked="blocked" :usage="usage"
      @save="save" @discard="reset" @restore="restore" @remove="remove"
    />
    <p class="small muted">id：{{ id }}。職業決定建角時的屬性分配、生命骰、施法、初始能力與升級時能學的能力、開局與 NPC 的裝備，以及 NPC 隨機抽到的機率。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="CLASS_LIMITS.name_chars" /></label>
        <label>Emoji <input v-model="draft.emoji" :maxlength="CLASS_LIMITS.emoji_chars" class="emoji" /></label>
        <label title="短休時花費生命骰回復生命值">生命骰
          <select v-model.number="draft.hit_die"><option v-for="d in [4, 6, 8, 10, 12]" :key="d" :value="d">d{{ d }}</option></select>
        </label>
        <label title="開戰時的仇恨值（越高越容易被敵人盯上）">初始仇恨 <input v-model.number="draft.threat.start" type="number" :min="CLASS_LIMITS.threat_start[0]" :max="CLASS_LIMITS.threat_start[1]" /></label>
        <label title="造成傷害時累積仇恨的倍率">仇恨倍率 <input v-model.number="draft.threat.mult" type="number" step="0.1" :min="CLASS_LIMITS.threat_mult[0]" :max="CLASS_LIMITS.threat_mult[1]" /></label>
      </div>
      <label class="block">定位說明（建角畫面與 AI 參考）<input v-model="draft.role" :maxlength="CLASS_LIMITS.role_chars" /></label>
      <div class="row">
        <span class="small">屬性分配順序 <Hint text="建角時基礎陣列 15、14、13、12、10 依序分給這五個屬性；升級的屬性點也加在第一個。" />：</span>
        <select v-for="(a, i) in draft.priority" :key="i" :value="a" @change="setPriority(i, ($event.target as HTMLSelectElement).value as AttrId)">
          <option v-for="x in ATTR_IDS" :key="x" :value="x">{{ i + 1 }}. {{ attrName(x) }}</option>
        </select>
      </div>
      <div class="grid">
        <label>施法
          <select :value="draft.caster" @change="setCaster(($event.target as HTMLSelectElement).value)">
            <option v-for="(n, k) in CASTER_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label v-if="draft.caster !== 'none'" title="法術命中與豁免 DC 用的屬性">施法屬性
          <select v-model="draft.casting"><option v-for="x in ATTR_IDS" :key="x" :value="x">{{ attrName(x) }}</option></select>
        </label>
        <label title="沒有拿武器時的攻擊；武僧的拳腳這種「天生」的才有作用">徒手的攻擊
          <select v-model="draft.weapon"><option v-for="[k, n] in weaponOptions" :key="k" :value="k">{{ n }}</option></select>
        </label>
        <label title="只在沒有裝備資料的很舊的存檔用">預設防具
          <select v-model="draft.armor"><option v-for="[k, n] in armorOptions" :key="k" :value="k">{{ n }}</option></select>
        </label>
      </div>
      <AffinityRows v-model="draft.resist" label="職業本身的抗性（-0.25 是受到的傷害 ×0.75）" :max="CLASS_LIMITS.resist[1]" />
    </FoldSet>

    <FoldSet>
      <template #legend>能力（{{ learn.length }} 個能學，{{ draft.start.length }} 個初始）
        <Hint text="勾「能學」的能力會出現在升級的三選一；「初始」是建角就會的能力（要先能學）。內建職業每一級都至少有 6 個能力可以選，才能重抽。改的是能力本身的「誰可以學」，存檔時一起存。" />
      </template>
      <p v-if="!learn.length" class="small warn">還沒有能學的能力：從下面勾，或到「✨ 技能」頁籤新增。</p>
      <div v-if="learnList.length" class="row">
        <span class="small">初始能力（最多 {{ CLASS_LIMITS.start }} 個）：</span>
        <label v-for="a in learnList" :key="a.id" class="check small" :title="a.desc">
          <input type="checkbox" :checked="draft.start.includes(a.id)" :disabled="!draft.start.includes(a.id) && draft.start.length >= CLASS_LIMITS.start" @change="toggleStart(a.id, ($event.target as HTMLInputElement).checked)" /> {{ a.name }}
        </label>
      </div>
      <p v-if="short.length && !dirty" class="small warn">升級時能學的能力不夠：{{ short.map((x) => `${x.lv} 級 ${x.n} 個`).join('、') }}（少於 3 個湊不滿三選一，少於 6 個不能重抽）。</p>
      <p v-else-if="pools.length && !dirty" class="small muted">2～20 級每一級都至少有 {{ Math.min(...pools) }} 個能力可以選。</p>
      <details v-for="g in groups" :key="g.key" class="small" :open="g.key === id">
        <summary>{{ g.name }}（{{ g.list.length }}）</summary>
        <label v-for="a in g.list" :key="a.id" class="check" :title="a.desc">
          <input type="checkbox" :checked="learn.includes(a.id)" @change="toggleLearn(a.id, ($event.target as HTMLInputElement).checked)" /> {{ a.name }} <span class="muted">{{ typeLabel(a) }}</span>
        </label>
      </details>
    </FoldSet>

    <FoldSet>
      <template #legend>裝備 <Hint text="開局（主角）與等級最低的夥伴穿第一級材料的這幾件；隨機生成的 NPC 從「可以用的底材」挑。職業武器限制是存檔規則：打開時主手只能拿勾選的類型。" /></template>
      <div class="grid">
        <label v-for="slot in START_SLOTS" :key="slot">開局的{{ SLOT_NAME[slot] }}
          <select :value="draft.gear.start[slot] ?? ''" @change="setStartGear(slot, ($event.target as HTMLSelectElement).value)">
            <option value="">（沒有）</option>
            <option v-for="[k, n] in basesFor(slot)" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label>頭腿手腳的材料
          <select v-model="draft.gear.pieces"><option v-for="(n, k) in PIECE_NAME" :key="k" :value="k">{{ n }}</option></select>
        </label>
      </div>
      <details v-for="slot in START_SLOTS" :key="slot" class="small">
        <summary>NPC 可以用的{{ SLOT_NAME[slot] }}（{{ draft.gear[listKey[slot]!].length }}）</summary>
        <label v-for="[k, n] in basesFor(slot)" :key="k" class="check"><input type="checkbox" :checked="draft.gear[listKey[slot]!].includes(k)" @change="toggleBase(slot, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </details>
      <div class="row">
        <label class="check small"><input type="checkbox" :checked="!!draft.gear.weapons" @change="setWeaponLimit(($event.target as HTMLInputElement).checked)" /> 限制主手的武器類型</label>
        <template v-if="draft.gear.weapons">
          <label v-for="t in types" :key="t" class="check small"><input type="checkbox" :checked="draft.gear.weapons.includes(t)" @change="toggleWeaponType(t, ($event.target as HTMLInputElement).checked)" /> {{ t }}</label>
          <span v-if="!draft.gear.weapons.length" class="small muted">（都不勾＝不拿武器，只用拳腳）</span>
        </template>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>NPC 怎麼生成 <Hint text="隨機生成的冒險者照權重抽職業（內建職業都是 1）；地區的倍率再乘在權重上，在那個地區生成的人才算（沒列出的地區用「其他地區」，空白是 1），例如武夫、仙術師在炎華之地 ×3、其他地區 ×0.3。身分標籤的倍率乘在「冒險者帶上這個標籤的機率」上：例如聖騎士的惡人 ×0.1、牧師的神官 ×4。" /></template>
      <div class="grid">
        <label>出現的權重 <input v-model.number="draft.npc_weight" type="number" step="0.1" :min="CLASS_LIMITS.npc_weight[0]" :max="CLASS_LIMITS.npc_weight[1]" /></label>
      </div>
      <div class="grid">
        <label v-for="[k, n] in regionOptions" :key="k">{{ n }}的倍率 <input type="number" step="0.1" :min="CLASS_LIMITS.region_mult[0]" :max="CLASS_LIMITS.region_mult[1]" :value="draft.region_mult?.[k] ?? ''" placeholder="1" @input="setRegionMult(k, ($event.target as HTMLInputElement).value)" /></label>
      </div>
      <p v-if="savedStart && draft.npc_weight > 0 && regionShares.length" class="small muted">各地區大約：{{ regionShares.map((x) => `${x.name} ${x.share}%`).join('、') }}。</p>
      <p v-if="!savedStart" class="small warn">還沒存好初始能力：建角選單與 NPC 都還不會用到這個職業。{{ draft.npc_weight === 0 ? '第一次存好初始能力時，出現的權重會改成 1（之後可以再改）。' : '' }}</p>
      <p v-else-if="!(draft.npc_weight > 0 && regionShares.length)" class="small muted">{{ draft.npc_weight > 0 ? `大約 ${weightShare}% 的冒險者是這個職業。` : 'NPC 不會隨機抽到這個職業（主角、固定 NPC 與指定職業的人還是可以用）。' }}</p>
      <div class="grid">
        <label v-for="[k, n] in advTags" :key="k">{{ n }}的倍率 <input type="number" step="0.1" :min="CLASS_LIMITS.tag_mult[0]" :max="CLASS_LIMITS.tag_mult[1]" :value="draft.tag_mult?.[k] ?? ''" placeholder="1" @input="setTagMult(k, ($event.target as HTMLInputElement).value)" /></label>
      </div>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.emoji { width: 5em; }
.warn { color: var(--warn, #c77700); }
</style>
