<script setup lang="ts">
import { computed, ref } from 'vue'
import { className, classes } from '@/engine/data'
import { currentFamilyRules, FAMILY_GROUPS, type FamilyField, type FamilyRulesMod } from '@/engine/familyMods'
import { PREG_STAGE_NAME } from '@/engine/travelEventMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'

// 懷孕與泌乳設定（docs/FAMILY.md 第 12 節）：family.json 的數值。懷孕的事件在「🎲 事件」，刺青與寄生物的受孕倍率在各自的頁籤
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const draft = ref<FamilyRulesMod>(clone(currentFamilyRules()))
const saved = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !!content.mods.family?.rules)
function reset() {
  draft.value = clone(currentFamilyRules())
  saved.value = JSON.stringify(draft.value)
}
function save() {
  try {
    content.saveFamilyRules(draft.value)
    reset()
    game.flash('已儲存懷孕與泌乳設定')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('把懷孕與泌乳設定恢復成內建的樣子？')) return
  content.restoreFamilyRules()
  reset()
}

function valueOf(fd: FamilyField): number {
  return Number(fd.path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), draft.value) ?? 0)
}
function setValue(fd: FamilyField, v: string) {
  const keys = fd.path.split('.')
  let o = draft.value as Record<string, unknown>
  for (const k of keys.slice(0, -1)) o = ((o[k] ??= {}) as Record<string, unknown>)
  o[keys.at(-1)!] = Number(v)
}

// 生產時算「有治療的人」的職業
const classIds = computed(() => Object.keys(classes).filter((id) => !classes[id]!.noncombat))
const birth = computed(() => (draft.value.birth ??= {}) as { healer_classes?: string[] })
function toggleHealer(id: string, on: boolean) {
  const set = new Set(birth.value.healer_classes ?? [])
  if (on) set.add(id)
  else set.delete(id)
  birth.value.healer_classes = classIds.value.filter((x) => set.has(x))
}
const discover = computed(() => (draft.value.discover ??= {}) as { auto_stage?: string })
</script>

<template>
  <div class="editor">
    <EditorHeader :title="'⚙️ 懷孕與泌乳設定'" :kind="'rules'" :edited="edited" :dirty="dirty" @save="save" @discard="reset" @restore="restore" />
    <p class="small muted">懷孕、生產、育幼院與泌乳的數值（docs/FAMILY.md）。懷孕的事件在「🎲 事件」的「🍼 懷孕的事件」；淫紋・子宮、魅魔的契紋這類受孕倍率在刺青與寄生物的頁籤。存檔規則「受孕機率」「孕期天數」在設定裡，每個存檔各自調。</p>
    <FoldSet v-for="g in FAMILY_GROUPS" :key="g.name">
      <template #legend>{{ g.name }}</template>
      <div class="grid">
        <label v-for="fd in g.fields" :key="fd.path">
          <span>{{ fd.label }} <Hint v-if="fd.hint" :text="fd.hint" /></span>
          <input type="number" :min="fd.min" :max="fd.max" :step="fd.step" :value="valueOf(fd)" class="num" @change="setValue(fd, ($event.target as HTMLInputElement).value)" />
        </label>
        <label v-if="g.name === '察覺與懷孕的事件'">到這個階段自動察覺
          <select v-model="discover.auto_stage">
            <option v-for="st in ['early', 'mid', 'late'] as const" :key="st" :value="st">{{ PREG_STAGE_NAME[st] }}</option>
          </select>
        </label>
      </div>
      <div v-if="g.name === '生產'" class="row small"><b>算「有治療的人」的職業</b>
        <label v-for="id in classIds" :key="id" class="check"><input type="checkbox" :checked="birth.healer_classes?.includes(id)" @change="toggleHealer(id, ($event.target as HTMLInputElement).checked)" /> {{ className(id) }}</label>
      </div>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
