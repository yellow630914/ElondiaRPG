<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, landmarks, landmarkTypes, locationById, perkRules } from '@/engine/data'
import { settlementArea } from '@/engine/grid'
import { builtinLandmark, LANDMARK_EFFECTS, LANDMARK_LIMITS, landmarkTraining, landmarkUsage, type LandmarkMod } from '@/engine/landmarkMods'
import { builtinPerk } from '@/engine/mods'
import EffectsEditor from './EffectsEditor.vue'
import type { CellRef } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import CellPicker from './CellPicker.vue'
import UsageNote from './UsageNote.vue'

// 城鎮特色地標的編輯表單：名稱、圖示、說明、AI 的氛圍、類型、位置，以及開放條件、參訪、探索、打工與受訓。
// 內建的不能換聚落、不能刪除
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
type Draft = LandmarkMod & { train: string[]; flagsText: string; flagsNoneText: string }
function current(): Draft {
  void content.version
  const l = clone(landmarks[props.id]!)
  return {
    scene: '', ...l, open: l.open ?? {}, ...(builtinLandmark(props.id) ? {} : { custom: true }),
    train: landmarkTraining(props.id), flagsText: (l.open?.flags ?? []).join('、'), flagsNoneText: (l.open?.flags_none ?? []).join('、'),
  }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
const picking = ref(false)
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
  picking.value = false
}
watch(() => props.id, reset)
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinLandmark(props.id))
const edited = computed(() => builtin.value && !!content.mods.landmarks?.[props.id])
const usage = computed(() => {
  void content.version
  return landmarkUsage(props.id)
})
const typeList = Object.entries(landmarkTypes).map(([k, t]) => [k, t.name] as const)

function placeText(r: CellRef) {
  return `${locationById(r.area.split('/')[0]!).name}・${settlementArea(r.area, false)?.name ?? r.area}（${r.x}, ${r.y}）`
}
function toggleType(t: string, on: boolean) {
  const set = new Set(draft.value.types)
  if (on) set.add(t)
  else set.delete(t)
  draft.value.types = [...set]
}
function pick(r: CellRef | null) {
  if (!r) return
  draft.value.at = r
  draft.value.location = r.area.split('/')[0]!
  picking.value = false
}
// 受訓：有受訓設定的特質（種族天賦除外）
const trainPerks = computed(() => {
  void content.version
  return perkRules.perks.filter((p) => !p.race && (p.train ?? builtinPerk(p.id)?.train))
})
function toggleTrain(id: string, on: boolean) {
  const set = new Set(draft.value.train)
  if (on) set.add(id)
  else set.delete(id)
  draft.value.train = [...set]
}
const open = computed(() => draft.value.open!)
const splitFlags = (t: string) => t.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean)
function toggleVisit(on: boolean) {
  if (on) draft.value.visit = { title: '參訪', hours: 0.5, effects: [] }
  else delete draft.value.visit
}
function toggleExplore(on: boolean) {
  if (on) draft.value.explore = { title: '四處探索', attr: 'int', dc: 12, hours: 2, effects: [{ type: 'money', amount: 30 }] }
  else delete draft.value.explore
}
function toggleWork(on: boolean) {
  if (on) draft.value.work = { attr: 'cha', dc: 12, rate_cc: 3, desc: '在這裡幫忙。' }
  else delete draft.value.work
}
function save() {
  try {
    const { train, flagsText, flagsNoneText, ...m } = draft.value
    m.open = { ...m.open, flags: splitFlags(flagsText), flags_none: splitFlags(flagsNoneText) }
    const before = (JSON.parse(saved.value) as Draft).train
    content.saveLandmark(props.id, m)
    if (JSON.stringify([...train].sort()) !== JSON.stringify([...before].sort())) content.setShopTraining(props.id, train)
    reset()
    game.flash(`已儲存「${landmarks[props.id]?.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？（位置也回到原處）`)) return
  content.restoreLandmark(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除自建的地標「${draft.value.name}」？地圖上的格子會變回道路。`)) return
  try {
    content.deleteLandmark(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.emoji }} {{ draft.name }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small warn" :disabled="usage.length > 0" @click="remove">🗑️ 刪除</button>
    </div>
    <p class="small muted">id：{{ id }}。地標是聚落地圖上的一格：特殊任務的任務點、固定 NPC 的站點、公會委託的標的都可以指定它，生成的居民也會依類型聚到這裡。{{ builtin ? '內建的地標只能在同一個聚落裡移動、不能刪除。' : '' }}</p>
    <UsageNote :usage="usage" :deletable="!builtin" />
    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="LANDMARK_LIMITS.name_chars" /></label>
        <label>圖示 <input v-model="draft.emoji" maxlength="8" /></label>
      </div>
      <label class="block">說明（站在這裡時顯示）<textarea v-model="draft.desc" rows="2" :maxlength="LANDMARK_LIMITS.desc_chars" /></label>
      <label class="block">氛圍（站在這裡行動時交給 AI 描寫場景，可以不填）<textarea v-model="draft.scene" rows="2" :maxlength="LANDMARK_LIMITS.scene_chars" /></label>
      <div class="row checks small">
        <span class="muted">類型（最多 {{ LANDMARK_LIMITS.types }} 種；決定聚到這裡的居民與公會委託）：</span>
        <label v-for="[k, n] in typeList" :key="k" class="check">
          <input type="checkbox" :checked="draft.types.includes(k)" :disabled="!draft.types.includes(k) && draft.types.length >= LANDMARK_LIMITS.types" @change="toggleType(k, ($event.target as HTMLInputElement).checked)" /> {{ n }}
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>位置</legend>
      <div class="row small">
        <span>{{ draft.at.area ? placeText(draft.at) : '還沒選' }}</span>
        <button class="small" @click="picking = !picking">{{ picking ? '收起' : builtin ? '移動' : '選位置' }}</button>
      </div>
      <p class="small muted">{{ builtin ? '在同一個聚落裡搬到一格空地（道路），可以換區塊。' : '選聚落與區塊，點一格空地（道路）。' }}舊存檔讀進來時地圖會跟著變。</p>
      <CellPicker v-if="picking" :model-value="draft.at.area ? draft.at : null" :location="draft.location" :lock-location="builtin" :marker="draft.emoji" :self="id" @update:model-value="pick" />
    </fieldset>
    <fieldset>
      <legend>開放的條件</legend>
      <p class="small muted">不開放時不能參訪、探索、打工與受訓（公會委託照樣可以做）。</p>
      <div class="grid">
        <label>時段
          <select v-model="open.hours">
            <option :value="undefined">任何時候</option>
            <option value="day">只在白天</option>
            <option value="night">只在夜裡</option>
          </select>
        </label>
        <label>至少要有的聲望（這裡的勢力） <input v-model.number="open.min_reputation" type="number" :min="LANDMARK_LIMITS.reputation[0]" :max="LANDMARK_LIMITS.reputation[1]" /></label>
      </div>
      <label class="check small"><input v-model="open.official" type="checkbox" /> 官方場所（逃亡奴隸不能用）</label>
      <div class="grid">
        <label>劇情旗標成立時才開放（用頓號分隔） <input v-model="draft.flagsText" /></label>
        <label>這些旗標成立時不開放 <input v-model="draft.flagsNoneText" /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>參訪</legend>
      <label class="check small"><input type="checkbox" :checked="!!draft.visit" @change="toggleVisit(($event.target as HTMLInputElement).checked)" /> 可以參訪（花錢或時間，得到效果；不用檢定）</label>
      <template v-if="draft.visit">
        <div class="grid">
          <label>名稱 <input v-model="draft.visit.title" :maxlength="LANDMARK_LIMITS.title_chars" /></label>
          <label>花費（白鸛） <input v-model.number="draft.visit.money_cc" type="number" min="0" /></label>
          <label>時數 <input v-model.number="draft.visit.hours" type="number" step="0.5" :min="LANDMARK_LIMITS.hours[0]" :max="LANDMARK_LIMITS.hours[1]" /></label>
          <label>隔幾天能再來 <input v-model.number="draft.visit.cooldown_days" type="number" :min="LANDMARK_LIMITS.cooldown[0]" :max="LANDMARK_LIMITS.cooldown[1]" placeholder="1" /></label>
        </div>
        <label class="block">說明 <input v-model="draft.visit.desc" :maxlength="LANDMARK_LIMITS.desc_chars" /></label>
        <div class="small">效果（最多 {{ LANDMARK_LIMITS.effects }} 個）：<EffectsEditor v-model="draft.visit.effects" :types="LANDMARK_EFFECTS" /></div>
      </template>
    </fieldset>
    <fieldset>
      <legend>探索</legend>
      <label class="check small"><input type="checkbox" :checked="!!draft.explore" @change="toggleExplore(($event.target as HTMLInputElement).checked)" /> 可以探索（主動行動的檢定，成功得到效果）</label>
      <template v-if="draft.explore">
        <div class="grid">
          <label>名稱 <input v-model="draft.explore.title" :maxlength="LANDMARK_LIMITS.title_chars" /></label>
          <label>屬性 <select v-model="draft.explore.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select></label>
          <label>DC <input v-model.number="draft.explore.dc" type="number" :min="LANDMARK_LIMITS.dc[0]" :max="LANDMARK_LIMITS.dc[1]" /></label>
          <label>時數 <input v-model.number="draft.explore.hours" type="number" step="0.5" :min="LANDMARK_LIMITS.hours[0]" :max="LANDMARK_LIMITS.hours[1]" /></label>
          <label>隔幾天能再試 <input v-model.number="draft.explore.cooldown_days" type="number" :min="LANDMARK_LIMITS.cooldown[0]" :max="LANDMARK_LIMITS.cooldown[1]" placeholder="7" /></label>
        </div>
        <label class="block">說明 <input v-model="draft.explore.desc" :maxlength="LANDMARK_LIMITS.desc_chars" /></label>
        <div class="small">成功的效果：<EffectsEditor v-model="draft.explore.effects" :types="LANDMARK_EFFECTS" /></div>
        <div class="small">大成功另外的效果：<EffectsEditor v-model="draft.explore.critical" :types="LANDMARK_EFFECTS" /></div>
      </template>
    </fieldset>
    <fieldset>
      <legend>打工</legend>
      <label class="check small"><input type="checkbox" :checked="!!draft.work" @change="toggleWork(($event.target as HTMLInputElement).checked)" /> 可以在這裡打工（和設施的工作一樣）</label>
      <template v-if="draft.work">
        <div class="grid">
          <label>屬性 <select v-model="draft.work.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select></label>
          <label>DC <input v-model.number="draft.work.dc" type="number" :min="LANDMARK_LIMITS.dc[0]" :max="LANDMARK_LIMITS.dc[1]" /></label>
          <label>時薪（白鸛） <input v-model.number="draft.work.rate_cc" type="number" :min="LANDMARK_LIMITS.rate_cc[0]" :max="LANDMARK_LIMITS.rate_cc[1]" /></label>
        </div>
        <label class="block">描述 <input v-model="draft.work.desc" :maxlength="LANDMARK_LIMITS.desc_chars" /></label>
      </template>
    </fieldset>
    <fieldset>
      <legend>受訓</legend>
      <p class="small muted">勾選的特質可以在這裡受訓（缺陷是克服）。受訓的價格、時數與檢定在「特質」頁設定，存在各特質上：恢復這個地標的預設不會改回受訓清單。</p>
      <div class="row checks small">
        <label v-for="p in trainPerks" :key="p.id" class="check" :title="p.desc">
          <input type="checkbox" :checked="draft.train.includes(p.id)" @change="toggleTrain(p.id, ($event.target as HTMLInputElement).checked)" />
          {{ p.flaw ? '⚠️' : '' }}{{ p.name }}
        </label>
      </div>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
