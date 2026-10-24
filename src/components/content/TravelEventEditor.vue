<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, geography, type LocationType, type RouteMode } from '@/engine/data'
import { cellName, type CellKind } from '@/engine/grid'
import { travelEvents, type RoadOption } from '@/engine/road'
import { MODE_NAME } from '@/engine/travel'
import { builtinTravelEvent, LOCATION_TYPE_NAME, ROUTE_MODES, townEventCells, travelEventWarnings, type TravelEventMod } from '@/engine/travelEventMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import FlagInput from './FlagInput.vue'
import OutcomeEditor from './OutcomeEditor.vue'
import Hint from '../ui/Hint.vue'

// 旅途事件或城鎮事件的編輯表單：在哪裡出現、檢定或選項、結果
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
// requires 先放一個空的（表單綁定用；儲存時空的條件會被拿掉），才不會一打開就顯示「未儲存」
const current = (): TravelEventMod => {
  const t = clone(content.mods.travelEvents?.[props.id] ?? (travelEvents.templates.find((x) => x.id === props.id) as TravelEventMod))
  t.requires ??= {}
  return t
}
const draft = ref<TravelEventMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => reset())
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinTravelEvent(props.id))
const edited = computed(() => builtin.value && !!content.mods.travelEvents?.[props.id])
const town = computed(() => draft.value.scope === 'town')
const warnings = computed(() => travelEventWarnings(draft.value))
const requires = computed(() => draft.value.requires!)
const categories = computed(() => travelEvents.town?.categories ?? {})
const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const cellLabel = (c: string) => cellName(c as CellKind)

function toggle<T extends string>(field: 'modes' | 'cells' | 'location_types' | 'locations', v: T, on: boolean) {
  const set = new Set<string>((draft.value[field] as string[] | undefined) ?? [])
  if (on) set.add(v)
  else set.delete(v)
  if (set.size) (draft.value as unknown as Record<string, string[]>)[field] = [...set]
  else delete draft.value[field]
}
function setKind(kind: 'check' | 'choice') {
  draft.value.kind = kind
  if (kind === 'check') draft.value.check ??= { attr: 'int', dc: 12 }
  if (kind === 'choice' && !draft.value.options?.length) draft.value.options = [{ label: '離開', success: {} }]
}
function setTier(tier: 'normal' | 'advanced') {
  draft.value.tier = tier
}
function addOption() {
  ;(draft.value.options ??= []).push({ label: '新的選項', success: {} })
}
function toggleCheck(o: RoadOption, on: boolean) {
  if (on) o.check = { attr: 'cha', dc: 12 }
  else {
    delete o.check
    delete o.fail
  }
}
function save() {
  try {
    content.saveTravelEvent(props.id, draft.value)
    reset()
    game.flash(`已儲存「${draft.value.title}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.title}」恢復成內建的樣子？`)) return
  content.restoreTravelEvent(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除「${draft.value.title}」？等待中的這個事件會作廢。`)) return
  try {
    content.deleteTravelEvent(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ town ? '🏘️' : '🧭' }} {{ draft.title || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" @click="remove">刪除</button>
    </div>
    <p class="small muted">
      id：{{ id }}。{{ town ? '城鎮事件：走上聚落裡符合的設施時，依「事件設定」的機率與冷卻出現。' : '旅途事件：出發時依路段的機率與種類權重擲好，放在旅途的格子上。' }}
      檢定由隊伍裡最擅長那個屬性的人來擲。
    </p>
    <p v-for="w in warnings" :key="w" class="small warn-text">⚠️ {{ w }}</p>

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>標題 <input v-model="draft.title" maxlength="20" /></label>
        <label>在哪裡
          <select :value="draft.scope ?? 'road'" @change="draft.scope = ($event.target as HTMLSelectElement).value === 'town' ? 'town' : undefined">
            <option value="road">旅途上</option>
            <option value="town">城鎮的設施上</option>
          </select>
        </label>
        <label>種類
          <select :value="draft.kind" @change="setKind(($event.target as HTMLSelectElement).value as 'check' | 'choice')">
            <option value="check">檢定（走到時直接擲骰揭曉）</option>
            <option value="choice">選擇（玩家選一個選項）</option>
          </select>
        </label>
        <label v-if="!town">等級
          <select :value="draft.tier" @change="setTier(($event.target as HTMLSelectElement).value as 'normal' | 'advanced')">
            <option value="normal">普通事件</option>
            <option value="advanced">高階事件（✨，可以帶進臨時地圖）</option>
          </select>
        </label>
        <label><span>分類 <Hint text="城鎮事件依最近的分類平衡。" /></span>
          <select v-model="draft.category">
            <option :value="undefined">（無）</option>
            <option v-for="(n, k) in categories" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label v-if="town">同一事件幾天後才會再出現 <input v-model.number="draft.cooldown_days" type="number" min="0" max="60" class="num" :placeholder="String(travelEvents.town?.repeat_days ?? 7)" /></label>
      </div>
      <label class="block">描述（給玩家與 AI）<textarea v-model="draft.text" rows="3" maxlength="400" /></label>
    </fieldset>

    <fieldset v-if="!town">
      <legend>路段 <Hint text="沒勾時任何路段都會出現。" /></legend>
      <div class="row">
        <label v-for="m in ROUTE_MODES" :key="m" class="check small">
          <input type="checkbox" :checked="draft.modes?.includes(m)" @change="toggle<RouteMode>('modes', m, ($event.target as HTMLInputElement).checked)" /> {{ MODE_NAME[m] }}
        </label>
      </div>
    </fieldset>
    <fieldset v-else>
      <legend>出現的地方 <Hint text="每一項沒勾時不限。" /></legend>
      <div class="row small"><b>設施</b>
        <label v-for="c in townEventCells()" :key="c" class="check">
          <input type="checkbox" :checked="draft.cells?.includes(c)" @change="toggle('cells', c, ($event.target as HTMLInputElement).checked)" /> {{ cellLabel(c) }}
        </label>
      </div>
      <div class="row small"><b>聚落規模</b>
        <label v-for="(n, k) in LOCATION_TYPE_NAME" :key="k" class="check">
          <input type="checkbox" :checked="draft.location_types?.includes(k)" @change="toggle<LocationType>('location_types', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}
        </label>
      </div>
      <div class="row small"><b>只在這些地點</b>
        <label v-for="l in settlements" :key="l.id" class="check">
          <input type="checkbox" :checked="draft.locations?.includes(l.id)" @change="toggle('locations', l.id, ($event.target as HTMLInputElement).checked)" /> {{ l.name }}
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>劇情條件</legend>
      <div class="row small">需要旗標 <FlagInput v-model="requires.flags" placeholder="全部成立才出現" /></div>
      <div class="row small">這些旗標成立時不出現 <FlagInput v-model="requires.flags_none" /></div>
    </fieldset>

    <fieldset v-if="draft.kind === 'check'">
      <legend>檢定 <Hint v-if="draft.tier === 'advanced'" text="成功時接著出現下面的選項。" /></legend>
      <div class="row small">
        <select v-model="draft.check!.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
        DC <input v-model.number="draft.check!.dc" type="number" min="1" max="40" class="num" />
      </div>
      <OutcomeEditor v-model="draft.success" label="成功" optional event />
      <OutcomeEditor v-model="draft.fail" label="失敗" optional event />
    </fieldset>

    <fieldset v-if="draft.kind === 'choice' || draft.tier === 'advanced'">
      <legend>選項（最多 5 個）</legend>
      <div v-for="(o, i) in draft.options ?? []" :key="i" class="option">
        <div class="row small">
          <input v-model="o.label" maxlength="30" class="grow" />
          <label class="check"><input type="checkbox" :checked="!!o.check" @change="toggleCheck(o, ($event.target as HTMLInputElement).checked)" /> 要檢定</label>
          <template v-if="o.check">
            <select v-model="o.check.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
            DC <input v-model.number="o.check.dc" type="number" min="1" max="40" class="num" />
          </template>
          <button class="small" @click="draft.options!.splice(i, 1)">移除</button>
        </div>
        <OutcomeEditor v-model="o.success" :label="o.check ? '成功' : '結果'" optional event />
        <OutcomeEditor v-if="o.check" v-model="o.fail" label="失敗" optional event />
      </div>
      <button class="small" :disabled="(draft.options?.length ?? 0) >= 5" @click="addOption">＋ 選項</button>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.option { border: 1px dashed var(--border); border-radius: var(--radius); padding: 6px; display: grid; gap: 4px; margin-bottom: 6px; }
</style>
