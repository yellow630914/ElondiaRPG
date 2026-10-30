<script setup lang="ts">
import { computed, ref } from 'vue'
import { ATTR_IDS, attrName, BIND_KINDS, LOCK_GRADES, statuses, type AttrId, type BindKind, type CheckContext, type CheckFilter } from '@/engine/data'
import { BIND_COMBAT_KEYS, BIND_COMBAT_NAME, BIND_CONTEXT_NAME, BIND_CONTEXTS, currentBindRules, type BindCombatKey, type BindRulesMod } from '@/engine/bindRulesMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import Hint from '../ui/Hint.vue'

// 雙面效應設定（docs/LEWD_STATS.md 第 7 節）：各種拘束的平常減值、受影響的檢定、戰鬥增益、免疫的狀態；忍耐、流派與鎖的倍率
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const draft = ref<BindRulesMod>(clone(currentBindRules()))
const saved = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const edited = computed(() => !!content.mods.bindRules?.rules)
function reset() {
  draft.value = clone(currentBindRules())
  saved.value = JSON.stringify(draft.value)
}
function save() {
  try {
    content.saveBindRules(draft.value)
    reset()
    game.flash('已儲存雙面效應設定')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('把雙面效應設定恢復成內建的樣子？')) return
  content.restoreBindRules()
  reset()
}

// 負面狀態（免疫用）
const statusName = (id: string) => statuses[id]?.name ?? id
const debuffs = Object.entries(statuses).filter(([, s]) => s.kind !== 'buff').map(([id, s]) => ({ id, name: s.name }))

function toggle<T extends string>(list: T[] | undefined, v: T, on: boolean): T[] | undefined {
  const next = new Set(list ?? [])
  if (on) next.add(v)
  else next.delete(v)
  return next.size ? [...next] : undefined
}
function setAttr(f: CheckFilter, a: AttrId, on: boolean) {
  const v = toggle(f.attrs, a, on)
  if (v) f.attrs = v
  else delete f.attrs
}
function setContext(f: CheckFilter, c: CheckContext, on: boolean) {
  const v = toggle(f.contexts, c, on)
  if (v) f.contexts = v
  else delete f.contexts
}
function setImmune(k: BindKind, id: string, on: boolean) {
  const v = toggle(draft.value.kinds[k].immune, id, on)
  if (v) draft.value.kinds[k].immune = v
  else delete draft.value.kinds[k].immune
}
function setCombat(k: BindKind, level: number, key: BindCombatKey, v: number) {
  const row = draft.value.kinds[k].combat[level] as Record<string, number>
  if (v) row[key] = Math.round(v)
  else delete row[key]
}
const filterText = (f: CheckFilter) => {
  const parts = [...(f.attrs ?? []).map((a) => `${attrName(a)}檢定`), ...(f.contexts ?? []).map((c) => BIND_CONTEXT_NAME[c] ?? c)]
  return parts.length ? parts.join('、') : '所有檢定'
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>⚙️ 雙面效應設定</h3>
      <span class="tag">{{ edited ? '已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
    </div>
    <p class="small muted">拘束具（底材的「拘束」種類與程度 1～3，物品可以有自己的程度）平常是檢定的減值；修了任何慾望流派、而且上了鎖時，戰鬥中反轉成增益（乘上鎖的倍率，流派契合再乘）。慾望戰鬥關閉時沒有增益，減值照算。</p>
    <fieldset>
      <legend>倍率</legend>
      <div class="grid">
        <label><span>忍耐每幾點減輕 1 點減值 <Hint text="平常的檢定減值：每件拘束具各自扣掉 忍耐 ÷ 這個數（無條件捨去）。" /></span><input v-model.number="draft.endurance_per" type="number" min="1" max="100" class="num" /></label>
        <label><span>流派契合的倍率 <Hint text="修的流派的「契合」包含這種拘束時，戰鬥增益再乘上這個數。" /></span><input v-model.number="draft.fit" type="number" min="0" max="5" step="0.05" class="num" /></label>
        <label><span>隸從派有主人時的倍率 <Hint text="修了隸從派、而且有主人時用這個數（取代流派契合）。" /></span><input v-model.number="draft.servitude_master" type="number" min="0" max="5" step="0.05" class="num" /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>鎖 <Hint text="戰鬥增益乘上鎖的倍率；沒上鎖時沒有增益。" /></legend>
      <div class="grid">
        <label v-for="g in LOCK_GRADES" :key="g">
          <span>{{ g }}</span>
          <span class="pair"><input v-model="draft.locks[g].name" maxlength="12" /> × <input v-model.number="draft.locks[g].mult" type="number" min="0" max="5" step="0.05" /></span>
        </label>
      </div>
    </fieldset>
    <fieldset v-for="k in BIND_KINDS" :key="k">
      <legend>{{ draft.kinds[k].name }}（{{ k }}）</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.kinds[k].name" maxlength="12" /></label>
        <label v-for="lv in [0, 1, 2]" :key="lv">程度 {{ lv + 1 }} 的減值 <input v-model.number="draft.kinds[k].penalty[lv]" type="number" min="0" max="10" class="num" /></label>
      </div>
      <div class="small">受影響的檢定（符合任一組就算）：{{ draft.kinds[k].checks.map(filterText).join('；') }}</div>
      <div v-for="(f, i) in draft.kinds[k].checks" :key="i" class="summary small">
        <div class="row checks">
          <span class="muted">第 {{ i + 1 }} 組・屬性：</span>
          <label v-for="a in ATTR_IDS" :key="a" class="check"><input type="checkbox" :checked="f.attrs?.includes(a)" @change="setAttr(f, a, ($event.target as HTMLInputElement).checked)" /> {{ attrName(a) }}</label>
        </div>
        <div class="row checks">
          <span class="muted">情境：</span>
          <label v-for="c in BIND_CONTEXTS" :key="c" class="check"><input type="checkbox" :checked="f.contexts?.includes(c)" @change="setContext(f, c, ($event.target as HTMLInputElement).checked)" /> {{ BIND_CONTEXT_NAME[c] }}</label>
          <span class="spacer" />
          <button class="small" :disabled="draft.kinds[k].checks.length <= 1" @click="draft.kinds[k].checks.splice(i, 1)">移除這組</button>
        </div>
        <div class="muted">同一組裡屬性和情境都勾時，兩個都要符合；都不勾是所有檢定。</div>
      </div>
      <div><button class="small" :disabled="draft.kinds[k].checks.length >= 6" @click="draft.kinds[k].checks.push({})">＋ 一組檢定</button></div>
      <table class="small bind-table">
        <thead><tr><th>戰鬥增益</th><th v-for="lv in [1, 2, 3]" :key="lv">程度 {{ lv }}</th></tr></thead>
        <tbody>
          <tr v-for="key in BIND_COMBAT_KEYS" :key="key">
            <td>{{ BIND_COMBAT_NAME[key] }}</td>
            <td v-for="lv in [0, 1, 2]" :key="lv">
              <input type="number" class="num" min="-10" max="10" :value="(draft.kinds[k].combat[lv] as Record<string, number>)[key] ?? 0" @change="setCombat(k, lv, key, Number(($event.target as HTMLInputElement).value))" />
            </td>
          </tr>
        </tbody>
      </table>
      <details>
        <summary class="small">免疫的狀態（{{ draft.kinds[k].immune?.map(statusName).join('、') || '沒有' }}）</summary>
        <div class="row checks small">
          <label v-for="s in debuffs" :key="s.id" class="check"><input type="checkbox" :checked="draft.kinds[k].immune?.includes(s.id)" @change="setImmune(k, s.id, ($event.target as HTMLInputElement).checked)" /> {{ s.name }}</label>
        </div>
      </details>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.bind-table { border-collapse: collapse; margin-top: 4px; }
.bind-table th, .bind-table td { padding: 2px 6px; text-align: left; }
.bind-table th { font-weight: normal; color: var(--muted); }
</style>
