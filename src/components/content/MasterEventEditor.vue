<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { abilities, ATTR_IDS, attrName, MASTER_EVENT_POOLS, slaveryRules, tagDef, type MasterEventOption, type MasterEventPool } from '@/engine/data'
import { builtinMasterEvent, masterEventById, masterEventWarnings, MASTER_EVENT_LIMITS, POOL_IDS, type MasterEventMod } from '@/engine/masterEventMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import EffectsEditor from './EffectsEditor.vue'
import Hint from '../ui/Hint.vue'

// 主人事件格式的編輯表單（主人的突發事件、調教、娼館的打工與受訓）：條件、描述、回應（檢定、結果、效果）
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const current = (): MasterEventMod => {
  const m = content.mods.masterEvents?.[props.id]
  if (m) return clone(m)
  const found = masterEventById(props.id)!
  return { ...clone(found.def), pool: found.pool }
}
const draft = ref<MasterEventMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => reset())
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinMasterEvent(props.id))
const edited = computed(() => builtin.value && !!content.mods.masterEvents?.[props.id])
const warnings = computed(() => masterEventWarnings(draft.value))
const isMaster = computed(() => draft.value.pool === 'master')
const isBrothel = computed(() => draft.value.pool === 'brothel_work' || draft.value.pool === 'brothel_train')
const masterTags = Object.keys(slaveryRules.master_tags.tags)
const lewdAbilities = computed(() => {
  void content.version
  return Object.values(abilities).filter((a) => a.classes.includes('lewd')).sort((a, b) => (a.unlock ?? 1) - (b.unlock ?? 1))
})
const L = MASTER_EVENT_LIMITS

function toggle(field: 'tags' | 'tags_none' | 'teaches', v: string, on: boolean) {
  const set = new Set<string>(draft.value[field] ?? [])
  if (on) set.add(v)
  else set.delete(v)
  if (set.size) draft.value[field] = [...set]
  else delete draft.value[field]
}
function setHome(v: string) {
  if (v === 'home') draft.value.at_home = true
  else if (v === 'out') draft.value.at_home = false
  else delete draft.value.at_home
}
function setPool(v: string) {
  draft.value.pool = v as MasterEventPool
}
function toggleCheck(o: MasterEventOption, on: boolean) {
  if (on) {
    o.check = { attr: 'cha', dc: 13 }
    delete o.result
  } else {
    delete o.check
    for (const k of ['success', 'fail', 'effects_success', 'fail_effects', 'stance'] as const) delete o[k]
    if (o.adult_scene === 'success' || o.adult_scene === 'fail') delete o.adult_scene
  }
}
function addOption() {
  draft.value.options.push({ label: '新的回應', result: '' })
}
function save() {
  try {
    content.saveMasterEvent(props.id, draft.value)
    reset()
    game.flash(`已儲存「${props.id}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${props.id}」恢復成內建的樣子？`)) return
  content.restoreMasterEvent(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除「${props.id}」？等待回應中的這個事件會作廢。`)) return
  try {
    content.deleteMasterEvent(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>⛓️ {{ draft.text.slice(0, 24) || '（沒有描述）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="reset">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" @click="remove">刪除</button>
    </div>
    <p class="small muted">
      id：{{ id }}。主人的突發事件：主角被主人帶著時，走動與旅行後依權重抽一件（經過娼館、離家逾期的事件另外擲）。玩家從回應裡選一個，或自己輸入回應交給 AI 判定。
      文字裡的 {master} 會換成主人的名字；效果的親密度選「主人」就是主角的主人。
    </p>
    <p v-for="w in warnings" :key="w" class="small warn-text">⚠️ {{ w }}</p>

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>事件庫
          <select :value="draft.pool" :disabled="builtin" @change="setPool(($event.target as HTMLSelectElement).value)">
            <option v-for="p in POOL_IDS" :key="p" :value="p">{{ MASTER_EVENT_POOLS[p] }}</option>
          </select>
        </label>
        <label>權重 <input v-model.number="draft.weight" type="number" min="0" max="20" step="0.5" class="num" /></label>
        <label>花的時間（小時） <input v-model.number="draft.hours" type="number" min="0.25" max="24" step="0.25" class="num" /></label>
        <label><span>自己回應的參考 DC <Hint :text="`沒填時用 ${slaveryRules.master_events.free_dc}。`" /></span>
          <input v-model.number="draft.free_dc" type="number" min="5" max="30" class="num" :placeholder="String(slaveryRules.master_events.free_dc)" />
        </label>
        <label class="check"><input v-model="draft.adult" type="checkbox" /> 成人向 <Hint text="內容篩選關掉「主角非自願」時不發生。" /></label>
      </div>
      <label class="block">描述（給玩家與 AI）<textarea v-model="draft.text" rows="3" :maxlength="L.text_chars" /></label>
      <label class="block">親密場景（成人向，可以空著）<textarea v-model="draft.scene" rows="2" :maxlength="L.scene_chars" /></label>
    </fieldset>

    <fieldset>
      <legend>條件 <Hint text="沒填、沒勾時不限。" /></legend>
      <div class="row small">
        主人的親密度 <input v-model.number="draft.affinity_min" type="number" min="-100" max="100" class="num" placeholder="下限" />
        ～ <input v-model.number="draft.affinity_max" type="number" min="-100" max="100" class="num" placeholder="上限" />
      </div>
      <div class="row small"><b>主人有其中一個標籤</b>
        <label v-for="t in masterTags" :key="t" class="check">
          <input type="checkbox" :checked="draft.tags?.includes(t)" @change="toggle('tags', t, ($event.target as HTMLInputElement).checked)" /> {{ tagDef(t)?.name ?? t }}
        </label>
      </div>
      <div class="row small"><b>主人有這些標籤時不發生</b>
        <label v-for="t in masterTags" :key="t" class="check">
          <input type="checkbox" :checked="draft.tags_none?.includes(t)" @change="toggle('tags_none', t, ($event.target as HTMLInputElement).checked)" /> {{ tagDef(t)?.name ?? t }}
        </label>
      </div>
      <template v-if="isMaster">
        <div class="row small">
          <label>在哪裡
            <select :value="draft.at_home === true ? 'home' : draft.at_home === false ? 'out' : ''" @change="setHome(($event.target as HTMLSelectElement).value)">
              <option value="">不限</option>
              <option value="home">只在主人的家裡</option>
              <option value="out">只在外面</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" :checked="draft.cell === 'brothel'" @change="($event.target as HTMLInputElement).checked ? (draft.cell = 'brothel', draft.chance ??= 0.3) : (delete draft.cell, delete draft.chance)" /> 經過娼館時</label>
          <label v-if="draft.cell">機率 <input v-model.number="draft.chance" type="number" min="0" max="1" step="0.05" class="num" /></label>
        </div>
        <div class="row small">
          <label class="check"><input v-model="draft.overdue" type="checkbox" /> 離家逾期的「主人要回家」</label>
          <label class="check"><input v-model="draft.free_place" type="checkbox" /> 主角身上還有空的部位（刺青）</label>
          <label class="check"><input v-model="draft.forced_gear" type="checkbox" /> 主人有會強制裝備的東西</label>
        </div>
      </template>
    </fieldset>

    <fieldset>
      <legend>掛的技能 <Hint text="效果「學會事件庫的技能」從同一個事件庫所有事件掛的技能裡，抽一個還沒學的。娼館的事件只抽打工的人還沒學過的技能所掛的事件。" /></legend>
      <div class="row small">
        <label v-for="a in lewdAbilities" :key="a.id" class="check">
          <input type="checkbox" :checked="draft.teaches?.includes(a.id)" @change="toggle('teaches', a.id, ($event.target as HTMLInputElement).checked)" /> {{ a.name }}
        </label>
      </div>
      <div class="row small">
        <label v-if="draft.pool === 'owner'">調教課程 <input v-model="draft.course" maxlength="12" /></label>
        <label v-if="draft.pool === 'owner'">成功幾次保證學會 <input v-model.number="draft.progress" type="number" min="1" max="10" class="num" /></label>
        <label v-if="isBrothel">要求的頭牌等級 <input v-model.number="draft.rank_min" type="number" min="0" max="10" class="num" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>回應（最多 {{ L.options }} 個）</legend>
      <div v-for="(o, i) in draft.options" :key="i" class="option">
        <div class="row small">
          <input v-model="o.label" :maxlength="L.label_chars" class="grow" />
          <label class="check"><input type="checkbox" :checked="!!o.check" @change="toggleCheck(o, ($event.target as HTMLInputElement).checked)" /> 要檢定</label>
          <template v-if="o.check">
            <select v-model="o.check.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
            DC <input v-model.number="o.check.dc" type="number" min="1" max="40" class="num" />
            <select v-model="o.stance" title="依順從加減">
              <option :value="undefined">（不看順從）</option>
              <option value="submit">屈服（順從高加值）</option>
              <option value="resist">抵抗（順從高減值）</option>
            </select>
          </template>
          <select v-if="draft.scene" v-model="o.adult_scene" title="這個回應進入親密場景">
            <option :value="undefined">不進入親密場景</option>
            <option value="always">一定進入親密場景</option>
            <option v-if="o.check" value="success">成功時進入</option>
            <option v-if="o.check" value="fail">失敗時進入</option>
          </select>
          <label>小時 <input v-model.number="o.hours" type="number" min="0.25" max="24" step="0.25" class="num" :placeholder="String(draft.hours)" /></label>
          <button class="small" :disabled="draft.options.length <= 1" @click="draft.options.splice(i, 1)">移除</button>
        </div>
        <template v-if="o.check">
          <label class="block small">成功 <input v-model="o.success" :maxlength="L.result_chars" class="grow" /></label>
          <div class="row small"><span class="muted">成功的效果</span><EffectsEditor v-model="o.effects_success" master /></div>
          <label class="block small">失敗 <input v-model="o.fail" :maxlength="L.result_chars" class="grow" /></label>
          <div class="row small"><span class="muted">失敗的效果</span><EffectsEditor v-model="o.fail_effects" master /></div>
        </template>
        <label v-else class="block small">結果 <input v-model="o.result" :maxlength="L.result_chars" class="grow" /></label>
        <div class="row small"><span class="muted">{{ o.check ? '不論成敗都套用' : '效果' }}</span><EffectsEditor v-model="o.effects" master /></div>
      </div>
      <button class="small" :disabled="draft.options.length >= L.options" @click="addOption">＋ 回應</button>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.option { border: 1px dashed var(--border); border-radius: var(--radius); padding: 6px; display: grid; gap: 4px; margin-bottom: 6px; }
</style>
