<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { slaveryRules } from '@/engine/data'
import { builtinMark } from '@/engine/mods'
import { deriveFunctions, termsFromTemplate } from '@/engine/slavery'
import { MARK_EDITOR_LIMITS as L, type MarkMod } from '@/engine/tattooMods'
import { placeName, TATTOO_PLACES } from '@/engine/tattoos'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'

// 奴隸印記模板的編輯表單。刻印時把條款存一份在角色身上，改模板只影響之後刻的
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): MarkMod => clone(content.mods.marks?.[props.id] ?? (slaveryRules.contracts[props.id] as MarkMod))
const draft = ref<MarkMod>(current())
const saved = ref(JSON.stringify(draft.value))
const sideText = ref(draft.value.side_effects.join('\n'))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
  sideText.value = draft.value.side_effects.join('\n')
})
watch(sideText, (t) => (draft.value.side_effects = t.split('\n').map((x) => x.trim()).filter(Boolean)))
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinMark(props.id))
const edited = computed(() => builtin.value && !!content.mods.marks?.[props.id])
const usage = computed(() => {
  void content.version
  return content.usageOf('mark', props.id)
})
const sealed = computed({
  get: () => draft.value.spell_cap !== undefined,
  set: (on: boolean) => {
    if (on) draft.value.spell_cap = 1
    else delete draft.value.spell_cap
  },
})
const functionNames = computed(() => {
  const names = slaveryRules.functions as Record<string, string>
  return deriveFunctions({ ...termsFromTemplate(props.id), ...draft.value, escape_hp_ratio: draft.value.escape_effects.hp_ratio })
    .map((f) => names[f]?.split('：')[0] ?? f).join('、')
})
function discard() {
  draft.value = current()
  sideText.value = draft.value.side_effects.join('\n')
}

function save() {
  try {
    content.saveMark(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreMark(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
  sideText.value = draft.value.side_effects.join('\n')
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteMark(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>⛓️ {{ draft.name || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" :disabled="usage.length > 0" @click="remove">刪除</button>
    </div>
    <p class="small muted">id：{{ id }}。功能依數值推得：{{ functionNames }}。已經刻在角色身上的印記不受修改影響。要讓它出現在刻印檢定、市場或老鴇身上，到「印記設定」加進去。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />
    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="L.name_chars" /></label>
        <label>部位
          <select v-model="draft.place"><option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}</option></select>
        </label>
      </div>
      <label class="wide"><span>印記的樣子與感覺 <Hint text="會交給 AI 描寫。" /></span><textarea v-model="draft.mark" rows="2" :maxlength="L.mark_chars" /></label>
      <label class="wide">副作用（一行一項，最多 {{ L.side_effects }} 項）<textarea v-model="sideText" rows="3" /></label>
    </fieldset>
    <fieldset>
      <legend>數值</legend>
      <div class="grid">
        <label>收益歸主人（0～1）<input v-model.number="draft.income_share" type="number" step="0.05" :min="L.income_share[0]" :max="L.income_share[1]" /></label>
        <label>談判 DC <input v-model.number="draft.negotiate_dc" type="number" :min="L.negotiate_dc[0]" :max="L.negotiate_dc[1]" /></label>
        <label>逃離 DC <input v-model.number="draft.escape_dc" type="number" :min="L.escape_dc[0]" :max="L.escape_dc[1]" /></label>
        <label>出城 DC <input v-model.number="draft.exit_dc" type="number" :min="L.exit_dc[0]" :max="L.exit_dc[1]" /></label>
        <label>逃亡時被找到的機率 <input v-model.number="draft.recapture_chance" type="number" step="0.05" :min="L.recapture_chance[0]" :max="L.recapture_chance[1]" /></label>
        <label>逃離反噬（生命值比例）<input v-model.number="draft.escape_effects.hp_ratio" type="number" step="0.05" :min="L.escape_hp_ratio[0]" :max="L.escape_hp_ratio[1]" /></label>
        <label>服從懲罰 <input v-model.number="draft.obedience_penalty" type="number" :min="L.obedience_penalty[0]" :max="L.obedience_penalty[1]" /></label>
        <label class="check"><input v-model="sealed" type="checkbox" /> 魔力封印</label>
        <label v-if="sealed">最多施放幾環 <input v-model.number="draft.spell_cap" type="number" :min="L.spell_cap[0]" :max="L.spell_cap[1]" /></label>
        <label title="戴著印記的每這麼多天，順從 +1（0 是不累積；成人向）">順從累積（天） <input v-model.number="draft.submission_every" type="number" min="0" max="7" /></label>
      </div>
      <p class="small muted">範圍比玩家自訂印記寬：談判、逃離 DC {{ L.negotiate_dc.join('～') }}、出城 DC {{ L.exit_dc.join('～') }}、被找到 0～{{ L.recapture_chance[1] * 100 }}%、反噬 0～{{ L.escape_hp_ratio[1] * 100 }}%、服從懲罰 0～{{ L.obedience_penalty[1] }}；超出時自動調整。</p>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
