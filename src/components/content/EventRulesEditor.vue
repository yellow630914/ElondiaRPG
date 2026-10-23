<script setup lang="ts">
import { computed, ref } from 'vue'
import { MODE_NAME } from '@/engine/travel'
import { currentEventRules, ROUTE_MODES, type EventRulesMod } from '@/engine/travelEventMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'

// 事件設定：旅途各種路段每天發生事件的機率、事件種類的權重；城鎮事件的機率、冷卻與分類平衡
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const draft = ref<EventRulesMod>(clone(currentEventRules()))
const saved = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !!content.mods.eventRules?.rules)
function reset() {
  draft.value = clone(currentEventRules())
  saved.value = JSON.stringify(draft.value)
}
function save() {
  try {
    content.saveEventRules(draft.value)
    reset()
    game.flash('已儲存事件設定')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('把事件設定恢復成內建的樣子？')) return
  content.restoreEventRules()
  reset()
}
const WEIGHT_NAME = { auto: '原本的旅途事件與普通檢定', choice: '普通選擇', combat: '戰鬥', advanced: '高階事件' } as const
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>⚙️ 事件設定</h3>
      <span class="tag">{{ edited ? '已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
    </div>
    <fieldset>
      <legend>旅途：每天發生事件的機率（0～1）</legend>
      <div class="grid">
        <label v-for="m in ROUTE_MODES" :key="m">{{ MODE_NAME[m] }} <input v-model.number="draft.chance[m]" type="number" min="0" max="1" step="0.05" class="num" /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>旅途：事件種類的權重（戰鬥只在官道、山道、荒野、地底）</legend>
      <div class="grid">
        <label v-for="(n, k) in WEIGHT_NAME" :key="k">{{ n }} <input v-model.number="draft.weights[k]" type="number" min="0" max="20" step="0.5" class="num" /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>城鎮事件</legend>
      <div class="grid">
        <label>走上設施時的機率（0～1）<input v-model.number="draft.town.chance" type="number" min="0" max="1" step="0.01" class="num" /></label>
        <label>兩次事件至少隔幾小時 <input v-model.number="draft.town.cooldown_hours" type="number" min="0" max="168" class="num" /></label>
        <label>同一事件預設幾天後才會再出現 <input v-model.number="draft.town.repeat_days" type="number" min="0" max="60" class="num" /></label>
        <label>最近出現過的分類，權重乘上（0～1）<input v-model.number="draft.town.recent_penalty" type="number" min="0" max="1" step="0.05" class="num" /></label>
        <label>記住最近幾次的分類 <input v-model.number="draft.town.recent_size" type="number" min="0" max="10" class="num" /></label>
      </div>
      <p class="small muted">分類：{{ Object.values(draft.town.categories).join('、') }}。同一個分類最近出現過一次，權重就乘一次，所以不會一直遇到同一類的事。</p>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
