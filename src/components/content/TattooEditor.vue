<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName } from '@/engine/data'
import { builtinTattoo } from '@/engine/mods'
import type { TattooMod } from '@/engine/tattooMods'
import { oathError, oathText, placeName, TATTOO_PLACES, tattooRules } from '@/engine/tattoos'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'

// 刺青圖樣（普通刺青、誓約印記）的編輯表單。角色身上的刺青是刺上時存的一份，改圖樣只影響之後刺的
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): TattooMod => clone(content.mods.tattoos?.[props.id] ?? (tattooRules.templates[props.id] as TattooMod))
const draft = ref<TattooMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinTattoo(props.id))
const edited = computed(() => builtin.value && !!content.mods.tattoos?.[props.id])
const usage = computed(() => {
  void content.version
  return content.usageOf('tattoo', props.id)
})
const problem = computed(() => (draft.value.kind === 'oath' ? oathError(draft.value.attrs) : undefined))
const max = tattooRules.oath.max_change

function setKind(kind: 'plain' | 'oath') {
  draft.value.kind = kind
  if (kind === 'oath') draft.value.attrs ??= { str: 1, int: -1 }
  else delete draft.value.attrs
}
function setAttr(a: string, v: number) {
  const attrs = { ...(draft.value.attrs ?? {}) } as Record<string, number>
  if (v) attrs[a] = v
  else delete attrs[a]
  draft.value.attrs = attrs
}
function togglePlace(p: (typeof TATTOO_PLACES)[number], on: boolean) {
  const set = new Set(draft.value.places ?? [])
  if (on) set.add(p)
  else set.delete(p)
  if (set.size) draft.value.places = TATTOO_PLACES.filter((x) => set.has(x))
  else delete draft.value.places
}
function save() {
  try {
    content.saveTattoo(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreTattoo(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteTattoo(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="`🖋️ ${draft.name || '（未命名）'}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :blocked="problem ?? ''" :usage="usage"
      @save="save" @discard="draft = current()" @restore="restore" @remove="remove"
    />
    <p class="small muted">id：{{ id }}。普通刺青只是外觀；誓約印記的屬性有加有減（加總為 0、每項 ±{{ max }} 以內、最多 {{ tattooRules.oath.max_attrs }} 項）。已經刺在角色身上的不受修改影響。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />
    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" maxlength="12" /></label>
        <label>種類
          <select :value="draft.kind" @change="setKind(($event.target as HTMLSelectElement).value as 'plain' | 'oath')">
            <option value="plain">普通刺青</option>
            <option value="oath">誓約印記</option>
          </select>
        </label>
      </div>
      <label class="wide"><span>外觀 <Hint text="會交給 AI 描寫。" /></span><textarea v-model="draft.desc" rows="2" maxlength="160" /></label>
    </FoldSet>
    <FoldSet v-if="draft.kind === 'oath'">
      <template #legend>屬性的加減 <span class="small" :class="problem ? 'warn-text' : 'muted'">{{ problem ?? oathText(draft.attrs ?? {}) }}</span></template>
      <div class="grid">
        <label v-for="a in ATTR_IDS" :key="a">{{ attrName(a) }}
          <input type="number" :min="-max" :max="max" :value="draft.attrs?.[a] ?? 0" @input="setAttr(a, Number(($event.target as HTMLInputElement).value))" />
        </label>
      </div>
    </FoldSet>
    <FoldSet v-if="draft.kind === 'plain'">
      <template #legend>淫紋（成人向） <Hint text="慾望戰鬥的效果：慾望上限的比例（0.15 = +15%）、造成的慾望 +N。都是 0 時只是外觀。" /></template>
      <div class="grid">
        <label>慾望上限 <input type="number" min="0" max="0.5" step="0.05" :value="draft.lust?.max ?? 0" @input="draft.lust = { ...draft.lust, max: Number(($event.target as HTMLInputElement).value) || undefined }" /></label>
        <label>造成的慾望 + <input type="number" min="0" max="5" :value="draft.lust?.bonus ?? 0" @input="draft.lust = { ...draft.lust, bonus: Number(($event.target as HTMLInputElement).value) || undefined }" /></label>
        <label>另外加的價錢 <input v-model.number="draft.price" type="number" min="0" max="10000" /></label>
        <label class="check"><input v-model="draft.adult" type="checkbox" /> 成人向</label>
      </div>
    </FoldSet>
    <FoldSet>
      <template #legend>建議的部位 <Hint text="沒勾時任何部位都可以。" /></template>
      <div class="row">
        <label v-for="p in TATTOO_PLACES" :key="p" class="check small">
          <input type="checkbox" :checked="draft.places?.includes(p)" @change="togglePlace(p, ($event.target as HTMLInputElement).checked)" /> {{ placeName(p) }}
        </label>
      </div>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
