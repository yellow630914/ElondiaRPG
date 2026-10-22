<script setup lang="ts">
import { choosablePerks, perkDef } from '@/engine/data'
import { npcPerksOf } from '@/engine/perks'
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
import NpcPlacementEditor from './NpcPlacementEditor.vue'
import UsageNote from './UsageNote.vue'

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
// 比較時略過空的條件（表單會先建立空的 requires 物件）
const snap = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'requires' && x && !x.flags?.length && !x.flags_none?.length ? undefined : x))
const saved = ref(snap(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = snap(draft.value)
})
const dirty = computed(() => snap(draft.value) !== saved.value)
const builtin = computed(() => !!builtinNpc(props.id))
const edited = computed(() => builtin.value && !!content.mods.npcs[props.id])

// ---- 選項 ----
const ZONE_NAME: Record<Zone, string> = { town: '城區', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', outskirts: '近郊', dungeon: '地下城' }
const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const places = geography.locations
const tags = computed(() => Object.entries(npcTags.tags).filter(([, t]) => t.kinds.includes(draft.value.kind ?? 'adventurer')))

// ---- 依劇情旗標改變出沒：由上往下第一組條件成立的設定 ----
function addStage() {
  ;(draft.value.stages ??= []).push({ requires: { flags: [] }, location: draft.value.location, haunts: [{ location: draft.value.location, zone: 'town', weight: 1 }] })
}
function moveStage(i: number, d: number) {
  const list = draft.value.stages!
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
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
// 特質：指定時取代依 id 抽的（空的清單＝沒有特質）
const pickPerk = ref('')
function addPerk() {
  if (!pickPerk.value) return
  const list = (draft.value.perks ??= [])
  if (!list.includes(pickPerk.value)) list.push(pickPerk.value)
  pickPerk.value = ''
}
function removePerk(id: string) {
  draft.value.perks = (draft.value.perks ?? []).filter((p) => p !== id)
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
    saved.value = snap(draft.value)
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
  saved.value = snap(draft.value)
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
  void content.version
  void game.state?.time.minute
  return content.usageOf('npc', props.id)
})
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？其他存檔裡已經登場過的這個角色會留著，但不會再更新。`)) return
  try {
    content.deleteNpc(props.id)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
    return
  }
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
      <button v-else class="small danger" :disabled="usage.length > 0" :title="usage.length ? '還有地方用到，不能刪除' : ''" @click="remove">刪除</button>
    </div>
    <UsageNote :usage="usage" :deletable="!builtin" />
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
      <NpcPlacementEditor v-model="draft" />
      <div class="row">
        <span class="small">只在這些劇情旗標成立時出現：</span><FlagInput v-model="requires.flags" />
      </div>
      <div class="row">
        <span class="small">這些旗標成立時不出現：</span><FlagInput v-model="requires.flags_none" />
      </div>
    </fieldset>

    <fieldset>
      <legend>依劇情旗標改變出沒</legend>
      <p class="small muted">例如因為某個事件搬家：加一組「🚩a_moved 成立時：所屬萊茵堡、活躍地點萊茵堡城區」。由上往下找第一組條件成立的設定，都不成立時用上面的設定（沒有填任何旗標的一組，儲存時會被移除）。是同一個角色，親密度、關係與記憶都會延續。</p>
      <div v-for="(st, i) in draft.stages ?? []" :key="i" class="stage">
        <div class="row">
          <b class="small">第 {{ i + 1 }} 組</b>
          <span class="spacer" />
          <button class="small" title="往上" @click="moveStage(i, -1)">▲</button>
          <button class="small" title="往下" @click="moveStage(i, 1)">▼</button>
          <button class="small" @click="draft.stages!.splice(i, 1)">移除</button>
        </div>
        <div class="row small">這些旗標都成立時 <FlagInput v-model="st.requires.flags" /></div>
        <div class="row small">而且這些旗標都不成立 <FlagInput v-model="st.requires.flags_none" /></div>
        <NpcPlacementEditor v-model="draft.stages![i]!" />
      </div>
      <button class="small" @click="addStage">＋ 依旗標改變出沒</button>
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
      <div class="chips">
        <span v-for="id in draft.perks ?? []" :key="id" class="tag chip" :title="perkDef(id)?.desc">🌟 {{ perkDef(id)?.name ?? id }} <button class="x" @click="removePerk(id)">×</button></span>
        <span v-if="!draft.perks" class="small muted">特質：依 id 固定地抽（{{ npcPerksOf(draft).map((id) => perkDef(id)?.name).join('、') || '無' }}）</span>
        <span v-else-if="!draft.perks.length" class="small muted">特質：沒有</span>
      </div>
      <div class="row">
        <select v-model="pickPerk">
          <option value="">指定特質…</option>
          <option v-for="p in choosablePerks()" :key="p.id" :value="p.id">{{ p.name }}：{{ p.desc.slice(0, 40) }}</option>
        </select>
        <button class="small" :disabled="!pickPerk" @click="addPerk">＋ 加入</button>
        <button v-if="draft.perks" class="small" @click="delete draft.perks">恢復隨機</button>
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
.stage { border: 1px dashed var(--border); border-radius: var(--radius); padding: 6px; display: grid; gap: 4px; }
.slot { width: 3em; }
</style>
