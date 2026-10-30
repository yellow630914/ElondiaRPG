<script setup lang="ts">
import { computed, ref } from 'vue'
import { contractDef, slaveryRules } from '@/engine/data'
import { builtinMarkRules } from '@/engine/mods'
import { currentMarkRules, type MarkRulesMod } from '@/engine/tattooMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'

// 印記的用途與權重：預設印記、老鴇的印記、刻印檢定的輕重順序、奴隸市場與自賣的權重
const content = useContent()
const game = useGame()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): MarkRulesMod => clone(content.mods.markRules?.rules ?? currentMarkRules())
const draft = ref<MarkRulesMod>(current())
const saved = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !!content.mods.markRules?.rules)
const ids = computed(() => {
  void content.version
  return Object.keys(slaveryRules.contracts)
})
const name = (id: string) => contractDef(id).name
const WEIGHTS: { key: 'public' | 'black' | 'self'; label: string }[] = [
  { key: 'public', label: '公開奴隸市場' }, { key: 'black', label: '黑市' }, { key: 'self', label: '自賣（買家打算刻的）' },
]
function weights(key: 'public' | 'black' | 'self'): Record<string, number> {
  return key === 'self' ? draft.value.self_sale : draft.value.market_contracts[key]
}
function setWeight(key: 'public' | 'black' | 'self', id: string, v: number) {
  const w = weights(key)
  if (v > 0) w[id] = v
  else delete w[id]
}
function move(i: number, d: number) {
  const list = draft.value.severity
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
function save() {
  try {
    content.saveMarkRules(draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash('已儲存印記設定')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('把印記設定恢復成內建的樣子？')) return
  content.restoreMarkRules()
  draft.value = clone(builtinMarkRules())
  saved.value = JSON.stringify(draft.value)
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="'⚙️ 印記設定'" :kind="'rules'" :edited="edited" :dirty="dirty"
      @save="save" @discard="draft = current()" @restore="restore"
    />
    <fieldset>
      <legend>用途</legend>
      <div class="grid">
        <label><span>預設的印記 <Hint text="買奴隸、AI 交易清單、劇情沒指定時用的印記。" /></span>
          <select v-model="draft.roles.default"><option v-for="id in ids" :key="id" :value="id">{{ name(id) }}</option></select>
        </label>
        <label><span>老鴇刻的印記 <Hint text="老鴇收下主角、娼妓主人、自賣給老鴇時刻的印記。" /></span>
          <select v-model="draft.roles.madam"><option v-for="id in ids" :key="id" :value="id">{{ name(id) }}</option></select>
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>刻印檢定的輕重順序（由輕到重）</legend>
      <p class="small muted">成為奴隸時的刻印檢定：成功可以選主人打算的或更輕的，失敗加重一級，大失敗最重。不在清單裡的印記只會從事件、市場或自訂出現。</p>
      <ol class="small">
        <li v-for="(id, i) in draft.severity" :key="id">
          {{ name(id) }}
          <button class="small" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button class="small" :disabled="i === draft.severity.length - 1" @click="move(i, 1)">↓</button>
          <button class="small" :disabled="draft.severity.length <= 1" @click="draft.severity.splice(i, 1)">移除</button>
        </li>
      </ol>
      <select class="small" :value="''" @change="draft.severity.push(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
        <option value="">＋ 加入…</option>
        <option v-for="id in ids.filter((x) => !draft.severity.includes(x))" :key="id" :value="id">{{ name(id) }}</option>
      </select>
    </fieldset>
    <fieldset>
      <legend>權重（0 = 不出現）</legend>
      <table class="small">
        <thead><tr><th></th><th v-for="w in WEIGHTS" :key="w.key">{{ w.label }}</th></tr></thead>
        <tbody>
        <tr v-for="id in ids" :key="id">
          <th>{{ name(id) }}</th>
          <td v-for="w in WEIGHTS" :key="w.key">
            <input type="number" min="0" max="100" step="0.1" style="width: 64px" :value="weights(w.key)[id] ?? 0" @input="setWeight(w.key, id, Number(($event.target as HTMLInputElement).value))" />
          </td>
        </tr>
        </tbody>
      </table>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
