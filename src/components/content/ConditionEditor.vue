<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, companionRules, describeCondition, type AttrId, type ConditionDef, type Mods } from '@/engine/data'
import { builtinCondition, conditionIds, conditionUsage, SYSTEM_CONDITIONS, type ConditionMod } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'

// 非戰鬥狀態（用餐、喝酒、受罰、祝福……，companions.json 的 conditions）的編輯表單：內建的可以修改，自建的沒有被用到時可以刪除，存檔前是草稿
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): ConditionMod {
  const c = clone(companionRules.conditions[props.id] as ConditionDef)
  c.combat_mods ??= {}
  return c
}
// 空的 combat_mods 不算修改
const snap = (c: ConditionMod) => JSON.stringify(c, (k, v) => (k === 'combat_mods' && v && !Object.values(v).some(Boolean) ? undefined : v))
const draft = ref<ConditionMod>(current())
const saved = ref(snap(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = snap(draft.value)
})
const dirty = computed(() => snap(draft.value) !== saved.value)
const builtin = computed(() => !!builtinCondition(props.id))
const edited = computed(() => builtin.value && !!content.mods.conditions?.[props.id])
const system = computed(() => SYSTEM_CONDITIONS.includes(props.id))
const usage = computed(() => {
  void content.version
  void game.state?.time
  return conditionUsage(props.id, game.state)
})
const preview = computed(() => describeCondition(draft.value))

// ---- 選項 ----
const MODS: Record<keyof Mods, string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '武器傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊閾值降低', threat: '仇恨倍率' }
const others = computed(() => {
  void content.version
  return conditionIds().filter((k) => k !== props.id && !SYSTEM_CONDITIONS.includes(k)).map((k) => ({ id: k, name: companionRules.conditions[k]!.name }))
})
const groups = computed(() => {
  void content.version
  return [...new Set(conditionIds().map((k) => companionRules.conditions[k]!.group).filter(Boolean))] as string[]
})
/** 介面上用「加值」：check_penalty 是減值（負數是加值） */
const checkBonus = computed({
  get: () => (draft.value.check_penalty ? -draft.value.check_penalty : ''),
  set: (v: number | string) => {
    const n = Number(v)
    if (v === '' || !n) delete draft.value.check_penalty
    else draft.value.check_penalty = -n
  },
})

function setMod(k: keyof Mods, v: string) {
  const m = (draft.value.combat_mods ??= {})
  if (v === '' || !Number(v)) delete m[k]
  else m[k] = Number(v)
}
function toggleAttr(a: AttrId, on: boolean) {
  const set = new Set(draft.value.check_attrs ?? [])
  if (on) set.add(a)
  else set.delete(a)
  if (set.size) draft.value.check_attrs = ATTR_IDS.filter((x) => set.has(x))
  else delete draft.value.check_attrs
}
function setClears(on: boolean) {
  if (on) draft.value.clears = 'long_rest'
  else delete draft.value.clears
}
function setGroup(v: string) {
  const g = v.trim()
  if (g) {
    draft.value.group = g
    draft.value.rank ??= 1
  } else {
    delete draft.value.group
    delete draft.value.rank
  }
}
function setStacksTo(v: string) {
  if (v) draft.value.stacks_to = v
  else delete draft.value.stacks_to
}
function toggleReplace(id: string, on: boolean) {
  const set = new Set(draft.value.replaces ?? [])
  if (on) set.add(id)
  else set.delete(id)
  if (set.size) draft.value.replaces = [...set]
  else delete draft.value.replaces
}

function save() {
  try {
    content.saveCondition(props.id, draft.value)
    draft.value = current()
    saved.value = snap(draft.value)
    game.flash(`已儲存「${draft.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function discard() {
  draft.value = current()
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreCondition(props.id)
  draft.value = current()
  saved.value = snap(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteCondition(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="`🏕️ ${draft.name || '（未命名）'}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :usage="usage"
      @save="save" @discard="discard" @restore="restore" @remove="remove"
    />
    <p class="small muted">id：{{ id }}・效果：{{ preview }}</p>
    <p class="small muted">
      非戰鬥狀態記在每個角色身上（不是戰鬥中的 BUFF／DEBUFF），由用餐、食物、工具、事件、地標或休息給予。
      修改後，已經有這個狀態的角色馬上照新的效果算。自建的狀態要在事件、特殊任務、地標的效果選「獲得狀態」，或在物品的使用效果選它，才會給到角色身上。
    </p>
    <p v-if="system" class="small warn-text">這是由遊戲規則加上與解除的狀態：解除時機、同組與疊加不能改，只能改名稱、說明與效果。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" maxlength="10" /></label>
        <label class="check">
          <input type="checkbox" :checked="draft.clears === 'long_rest'" :disabled="system" @change="setClears(($event.target as HTMLInputElement).checked)" />
          下次長休時解除
        </label>
      </div>
      <label class="block"><span>說明 <Hint text="滑過狀態、吃東西前看到的說明。改了數字之後記得一起改，說明不會自動更新。" /></span><textarea v-model="draft.desc" rows="2" maxlength="160" /></label>
    </FoldSet>

    <FoldSet>
      <template #legend>主動行動的檢定</template>
      <div class="row small">
        <label>加值（負的是減值） <input v-model.number="checkBonus" type="number" min="-5" max="5" class="num" placeholder="—" /></label>
        <span>作用在：</span>
        <label v-for="a in ATTR_IDS" :key="a" class="check">
          <input type="checkbox" :checked="draft.check_attrs?.includes(a)" @change="toggleAttr(a, ($event.target as HTMLInputElement).checked)" /> {{ attrName(a) }}
        </label>
        <span class="muted">（都不勾＝所有屬性）</span>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>每場戰鬥</template>
      <div class="grid">
        <label>開始時的暫時生命 <input v-model.number="draft.combat_temp_hp" type="number" min="0" max="50" placeholder="—" /></label>
        <label v-for="(n, k) in MODS" :key="k">{{ n }}
          <input
            type="number" :step="k === 'threat' ? 0.05 : 1" :min="k === 'threat' ? -1 : -5" :max="k === 'threat' ? 2 : 5"
            :value="draft.combat_mods?.[k] ?? ''" placeholder="—" @input="setMod(k, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <p class="small muted">幾個狀態的暫時生命取最高的，不會相加；加減值會相加。</p>
    </FoldSet>

    <FoldSet :disabled="system">
      <template #legend>獲得的規則</template>
      <div class="grid">
        <label>同組（同組只留等級最高的）
          <input :value="draft.group ?? ''" list="cond-groups" placeholder="不分組" @change="setGroup(($event.target as HTMLInputElement).value)" />
          <datalist id="cond-groups"><option v-for="g in groups" :key="g" :value="g" /></datalist>
        </label>
        <label v-if="draft.group">等級 <input v-model.number="draft.rank" type="number" min="1" max="9" /></label>
        <label>已經有了再獲得一次，變成
          <select :value="draft.stacks_to ?? ''" @change="setStacksTo(($event.target as HTMLSelectElement).value)">
            <option value="">（不變）</option>
            <option v-for="o in others" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </label>
      </div>
      <div class="row small">
        <span>獲得時拿掉：</span>
        <label v-for="o in others" :key="o.id" class="check">
          <input type="checkbox" :checked="draft.replaces?.includes(o.id)" @change="toggleReplace(o.id, ($event.target as HTMLInputElement).checked)" /> {{ o.name }}
        </label>
      </div>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
