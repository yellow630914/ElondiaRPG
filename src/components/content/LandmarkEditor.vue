<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { landmarks, landmarkTypes, locationById } from '@/engine/data'
import { settlementArea } from '@/engine/grid'
import { builtinLandmark, LANDMARK_LIMITS, landmarkUsage, type LandmarkMod } from '@/engine/landmarkMods'
import type { CellRef } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import CellPicker from './CellPicker.vue'
import UsageNote from './UsageNote.vue'

// 城鎮特色地標的編輯表單：名稱、圖示、說明、AI 的氛圍、類型與位置。內建的不能換聚落、不能刪除
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): LandmarkMod {
  void content.version
  return { scene: '', ...clone(landmarks[props.id]!), ...(builtinLandmark(props.id) ? {} : { custom: true }) }
}
const draft = ref<LandmarkMod>(current())
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
function save() {
  try {
    content.saveLandmark(props.id, draft.value)
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
  </div>
</template>

<style scoped src="./editor.css"></style>
