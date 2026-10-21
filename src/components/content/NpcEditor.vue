<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createNpc } from '@/engine/character'
import {
  abilities as abilityTable, ATTR_IDS, attrName, attributeRules, classAbilities, className, combatClasses, GENDER_IDS, genderName, geography,
  locationById, npcs as namedNpcs, npcTags, raceName, regionById,
} from '@/engine/data'
import { gearName, gearRules, rarityName, RARITY_ORDER, slotName } from '@/engine/gear'
import { blockKeys, CELL_ICON, cellName, settlementArea, ZONES, type Zone } from '@/engine/grid'
import { builtinNpc, type NpcMod } from '@/engine/mods'
import { Rng } from '@/engine/rng'
import type { GearSlot } from '@/engine/types'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import FlagInput from './FlagInput.vue'

// 固定 NPC 的編輯表單：不會因為名單變動消失；可以固定在聚落的某一格、只在劇情旗標符合時出現
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): NpcMod {
  return clone(content.mods.npcs[props.id] ?? (namedNpcs.find((n) => n.id === props.id) as NpcMod))
}
const draft = ref<NpcMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinNpc(props.id))
const edited = computed(() => builtin.value && !!content.mods.npcs[props.id])

// ---- 選項 ----
const ZONE_NAME: Record<Zone, string> = { town: '城區', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', outskirts: '近郊', dungeon: '地下城' }
const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const places = geography.locations
const tags = computed(() => Object.entries(npcTags.tags).filter(([, t]) => t.kinds.includes(draft.value.kind ?? 'adventurer')))

// ---- 出現的方式：活躍地點或固定的格子 ----
const placeMode = computed({
  get: () => (draft.value.fixed ? 'fixed' : 'haunts'),
  set: (v: string) => {
    if (v === 'fixed') draft.value.fixed = { area: blockKeys(draft.value.location)[0]!, x: 0, y: 0 }
    else delete draft.value.fixed
  },
})
const blocks = computed(() => blockKeys(draft.value.location).map((k) => ({ key: k, area: settlementArea(k)! })).filter((b) => b.area))
const block = computed(() => (draft.value.fixed ? settlementArea(draft.value.fixed.area) : undefined))
function pickCell(i: number) {
  const a = block.value
  if (!a || !draft.value.fixed) return
  const kind = a.cells[i]!.kind
  if (kind === 'wall' || kind === 'water') return
  draft.value.fixed = { area: a.key, x: i % a.width, y: Math.floor(i / a.width) }
}
function setBlock(key: string) {
  draft.value.fixed = { area: key, x: 0, y: 0 }
  const a = settlementArea(key)
  const i = a?.cells.findIndex((c) => c.kind !== 'wall' && c.kind !== 'water') ?? -1
  if (a && i >= 0) draft.value.fixed = { area: key, x: i % a.width, y: Math.floor(i / a.width) }
}
function addHaunt() {
  ;(draft.value.haunts ??= []).push({ location: draft.value.location, zone: 'town', weight: 1 })
}

// ---- 劇情條件 ----
const requires = computed(() => (draft.value.requires ??= {}))

// ---- 屬性、能力、裝備 ----
const customAttrs = computed({
  get: () => !!draft.value.attrs,
  set: (on: boolean) => {
    if (on) draft.value.attrs = { ...preview.value.attrs }
    else delete draft.value.attrs
  },
})
const classList = computed(() => (draft.value.kind === 'commoner' ? [] : classAbilities(draft.value.class)))
const pickAbility = ref('')
function addAbility() {
  if (!pickAbility.value) return
  const list = (draft.value.abilities ??= [])
  if (!list.includes(pickAbility.value)) list.push(pickAbility.value)
  pickAbility.value = ''
}
function removeAbility(id: string) {
  draft.value.abilities = (draft.value.abilities ?? []).filter((a) => a !== id)
  if (!draft.value.abilities.length) delete draft.value.abilities
}
const SLOTS = Object.keys(gearRules.slots) as GearSlot[]
const customGear = computed({
  get: () => !!draft.value.gear,
  set: (on: boolean) => {
    if (on) draft.value.gear = Object.fromEntries(Object.entries(preview.value.gear ?? {}).map(([k, g]) => [k, clone(g!.spec)]))
    else delete draft.value.gear
  },
})
function basesFor(slot: GearSlot) {
  return Object.entries(gearRules.bases).filter(([, b]) => b.slot === slot || (b.slot === 'ring' && slot.startsWith('ring')))
}
function materialsFor(base: string) {
  const kind = gearRules.bases[base]?.kind
  return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind)
}
function setBase(slot: GearSlot, base: string) {
  const g = (draft.value.gear ??= {})
  if (!base) {
    delete g[slot]
    return
  }
  g[slot] = { base, material: materialsFor(base)[0]?.[0] ?? '' }
}

// ---- 預覽：照這份設定建立的角色 ----
const preview = computed(() => {
  void content.version
  return createNpc({ ...draft.value, class: draft.value.class || 'noncombatant' }, new Rng(1))
})

const previewAbilities = computed(() => preview.value.abilities.map((id) => abilityTable[id]?.name ?? id).join('、'))

// ---- 動作 ----
function save() {
  try {
    if (draft.value.requires && !draft.value.requires.flags?.length && !draft.value.requires.flags_none?.length) delete draft.value.requires
    content.saveNpc(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function discard() {
  draft.value = current()
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreNpc(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？用到這個角色的特殊任務會找不到人。`)) return
  content.deleteNpc(props.id)
  emit('deleted')
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.name || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" @click="remove">刪除</button>
    </div>
    <p class="small muted">id：{{ id }}（特殊任務用這個 id 指定角色）・已經登場過的角色，出現條件與固定格子會跟著這裡改，其他資料以存檔裡的為準。</p>

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名字 <input v-model="draft.name" maxlength="12" /></label>
        <label>性別
          <select v-model="draft.gender">
            <option v-for="g in GENDER_IDS" :key="g" :value="g">{{ genderName(g) }}</option>
          </select>
        </label>
        <label>種族
          <select v-model="draft.race">
            <option v-for="(r, k) in attributeRules.races" :key="k" :value="k">{{ raceName(String(k)) }}</option>
          </select>
        </label>
        <label>身分
          <select v-model="draft.kind">
            <option value="adventurer">冒險者</option>
            <option value="commoner">普通人</option>
          </select>
        </label>
        <label v-if="draft.kind !== 'commoner'">職業
          <select v-model="draft.class">
            <option v-for="(c, k) in combatClasses" :key="k" :value="k">{{ className(String(k)) }}</option>
          </select>
        </label>
        <label v-else>職業描述 <input v-model="draft.occupation" maxlength="12" placeholder="鐵匠、修女……" /></label>
        <label>等級 <input v-model.number="draft.level" type="number" min="1" max="20" /></label>
        <label v-if="draft.kind !== 'commoner'">雇傭要價（白鸛幣） <input v-model.number="draft.hire_cc" type="number" min="0" /></label>
        <label>勢力 <input v-model="draft.faction" maxlength="30" /></label>
        <label>出身 <input v-model="draft.lineage" maxlength="30" placeholder="部族、氏族……" /></label>
      </div>
      <label class="block">性格 <textarea v-model="draft.personality" rows="2" maxlength="160" /></label>
      <label class="block">外貌 <textarea v-model="draft.appearance" rows="2" maxlength="240" /></label>
      <label class="block">背景 <textarea v-model="draft.background" rows="3" maxlength="400" /></label>
      <div class="row checks">
        <span class="small">標籤：</span>
        <label v-for="[k, t] in tags" :key="k" class="check small" :title="t.ai_hint">
          <input type="checkbox" :checked="draft.tags?.includes(k)" @change="draft.tags = ($event.target as HTMLInputElement).checked ? [...(draft.tags ?? []), k] : (draft.tags ?? []).filter((x) => x !== k)" /> {{ t.name }}
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>出現的地方</legend>
      <div class="grid">
        <label>所屬地點
          <select v-model="draft.location">
            <option v-for="l in settlements" :key="l.id" :value="l.id">{{ regionById(l.region).name }}・{{ l.name }}</option>
          </select>
        </label>
        <label>出現的方式
          <select v-model="placeMode">
            <option value="haunts">活躍地點（每天依權重決定在哪裡）</option>
            <option value="fixed">固定在聚落的一格</option>
          </select>
        </label>
      </div>
      <template v-if="placeMode === 'haunts'">
        <div v-for="(h, i) in draft.haunts ?? []" :key="i" class="row">
          <select v-model="h.location" class="grow">
            <option v-for="l in places" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
          <select v-model="h.zone">
            <option v-for="z in ZONES" :key="z" :value="z">{{ ZONE_NAME[z] }}</option>
          </select>
          <label class="small">權重 <input v-model.number="h.weight" class="num" type="number" min="0.01" step="0.1" /></label>
          <button class="small" @click="draft.haunts!.splice(i, 1)">移除</button>
        </div>
        <button class="small" @click="addHaunt">＋ 活躍地點</button>
        <p v-if="!draft.haunts?.length" class="small muted">沒有活躍地點時，要認識之後才找得到（在所屬地點的城區）。</p>
      </template>
      <template v-else-if="draft.fixed">
        <label class="small">區塊
          <select :value="draft.fixed.area" @change="setBlock(($event.target as HTMLSelectElement).value)">
            <option v-for="b in blocks" :key="b.key" :value="b.key">{{ b.area.name }}</option>
          </select>
        </label>
        <p class="small muted">點一格決定站的位置（{{ draft.fixed.x }}, {{ draft.fixed.y }}：{{ block ? cellName(block.cells[draft.fixed.y * block.width + draft.fixed.x]!.kind) : '' }}）。</p>
        <div v-if="block" class="cells" :style="{ gridTemplateColumns: `repeat(${block.width}, 22px)` }">
          <button
            v-for="(c, i) in block.cells" :key="i" class="cell" :class="[c.kind, { picked: i === draft.fixed.y * block.width + draft.fixed.x }]"
            :title="cellName(c.kind)" @click="pickCell(i)"
          >{{ i === draft.fixed.y * block.width + draft.fixed.x ? '🧍' : CELL_ICON[c.kind] ?? '' }}</button>
        </div>
      </template>
      <div class="row">
        <span class="small">只在這些劇情旗標成立時出現：</span><FlagInput v-model="requires.flags" />
      </div>
      <div class="row">
        <span class="small">這些旗標成立時不出現：</span><FlagInput v-model="requires.flags_none" />
      </div>
    </fieldset>

    <fieldset>
      <legend>能力值、技能與裝備</legend>
      <p class="small muted">
        預覽：{{ className(preview.class) }} Lv.{{ preview.level }}・生命 {{ preview.maxHp }}・{{ ATTR_IDS.map((a) => `${attrName(a)} ${preview.attrs[a]}`).join('、') }}
      </p>
      <label class="check small"><input v-model="customAttrs" type="checkbox" /> 自訂屬性（不勾時依職業、種族與等級決定）</label>
      <div v-if="draft.attrs" class="grid">
        <label v-for="a in ATTR_IDS" :key="a">{{ attrName(a) }} <input v-model.number="draft.attrs[a]" type="number" min="1" max="30" /></label>
      </div>
      <div class="chips">
        <span v-for="a in draft.abilities ?? []" :key="a" class="tag chip" :title="abilityTable[a]?.desc">{{ abilityTable[a]?.name ?? a }} <button class="x" @click="removeAbility(a)">×</button></span>
        <span v-if="!draft.abilities?.length" class="small muted">技能：依職業與等級隨機學（{{ previewAbilities || '無' }}）</span>
      </div>
      <div class="row">
        <select v-model="pickAbility">
          <option value="">指定技能…</option>
          <optgroup :label="`${className(draft.class)}的能力`">
            <option v-for="a in classList" :key="a.id" :value="a.id">{{ a.name }}：{{ a.desc.slice(0, 40) }}</option>
          </optgroup>
          <optgroup label="其他">
            <option v-for="a in Object.values(abilityTable).filter((x) => !classList.includes(x))" :key="a.id" :value="a.id">{{ a.name }}</option>
          </optgroup>
        </select>
        <button class="small" :disabled="!pickAbility" @click="addAbility">＋ 加入</button>
      </div>
      <label class="check small"><input v-model="customGear" type="checkbox" /> 指定初始裝備（不勾時依等級隨機生成）</label>
      <template v-if="draft.gear">
        <div v-for="slot in SLOTS" :key="slot" class="row">
          <span class="small slot">{{ slotName(slot) }}</span>
          <select :value="draft.gear[slot]?.base ?? ''" @change="setBase(slot, ($event.target as HTMLSelectElement).value)">
            <option value="">（空著）</option>
            <option v-for="[id, b] in basesFor(slot)" :key="id" :value="id">{{ b.name }}</option>
          </select>
          <template v-if="draft.gear[slot]">
            <select v-model="draft.gear[slot]!.material">
              <option v-for="[id, m] in materialsFor(draft.gear[slot]!.base)" :key="id" :value="id">{{ m.name }}</option>
            </select>
            <select v-model="draft.gear[slot]!.rarity">
              <option :value="undefined">材料原本的稀有度</option>
              <option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ rarityName(r) }}</option>
            </select>
            <span class="small muted">{{ gearName(draft.gear[slot]!) }}</span>
          </template>
        </div>
      </template>
      <p v-else class="small muted">裝備（隨機）：{{ Object.values(preview.gear ?? {}).map((g) => g!.name).join('、') || '無' }}</p>
    </fieldset>
    <p class="small muted">所屬地點：{{ locationById(draft.location).name }}。具名角色在所屬地點的名單上，不會因為名單變動消失或被取代。</p>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.cells { display: grid; gap: 1px; width: max-content; max-width: 100%; overflow: auto; }
.cell { width: 22px; height: 22px; padding: 0; font-size: 12px; line-height: 1; border-radius: 2px; background: var(--panel-2); border: 1px solid var(--border); }
.cell.wall { background: var(--border); cursor: default; }
.cell.water { background: #2a4a6a; cursor: default; }
.cell.picked { outline: 2px solid var(--accent); }
.slot { width: 3em; }
</style>
