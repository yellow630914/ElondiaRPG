<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { abilities, ATTR_IDS, attrName, className, damageTypeName, damageTypes, statuses, type ApplyDef, type AttrId, type DamagePart } from '@/engine/data'
import {
  ABILITY_RESOLVES, ABILITY_TARGETS, ABILITY_TYPES, abilityClasses, builtinAbility, type AbilityMod,
} from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'

// 能力（技能、法術、戲法）的編輯表單：存檔前是草稿，按「儲存」才套用
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): AbilityMod {
  const a = clone(content.mods.abilities[props.id] ?? (abilities[props.id] as AbilityMod))
  a.heal ??= {}
  a.shield ??= {}
  a.uses ??= {}
  return a
}
// 空的 heal、shield、uses 不算修改
const snap = (a: AbilityMod) => JSON.stringify(a, (k, v) => (['heal', 'shield', 'uses'].includes(k) && v && !Object.keys(v).length ? undefined : v))
const draft = ref<AbilityMod>(current())
const saved = ref(snap(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = snap(draft.value)
})
const dirty = computed(() => snap(draft.value) !== saved.value)
const builtin = computed(() => !!builtinAbility(props.id))
const edited = computed(() => builtin.value && !!content.mods.abilities[props.id])

// ---- 選項 ----
const damageIds = damageTypes.types.map((t) => t.id)
// 自建的狀態儲存之後也要列進來
const statusList = computed(() => {
  void content.version
  return Object.entries(statuses).map(([id, s]) => ({ id, ...s }))
})
const classList = abilityClasses()
const TO: Record<NonNullable<ApplyDef['to']>, string> = { target: '目標', self: '自己', allies: '所有隊友', enemies: '所有敵人' }
const ON: Record<NonNullable<ApplyDef['on']>, string> = { hit: '命中時', fail: '豁免失敗時', always: '一定' }
const usage = computed(() => {
  void content.version
  return content.usageOf('ability', props.id)
})

function toggleClass(c: string, on: boolean) {
  const set = new Set(draft.value.classes)
  if (on) set.add(c)
  else set.delete(c)
  draft.value.classes = [...set]
}
function addDamage() {
  ;(draft.value.damage ??= []).push({ dice: '1d6', type: 'slashing' })
}
function setDamageSource(d: DamagePart, weapon: boolean) {
  if (weapon) {
    d.weapon = true
    delete d.dice
  } else {
    delete d.weapon
    d.dice ??= '1d6'
  }
}
function addApply() {
  ;(draft.value.apply ??= []).push({ status: statusList.value[0]!.id, turns: 2 })
}
function setScale(d: DamagePart, dice: string) {
  if (dice) d.scale = { dice, per: d.scale?.per ?? 4 }
  else delete d.scale
}

function save() {
  try {
    content.saveAbility(props.id, draft.value)
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
  content.restoreAbility(props.id)
  draft.value = current()
  saved.value = snap(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteAbility(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.name || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button
        v-else class="small danger" :disabled="usage.length > 0"
        :title="usage.length ? '還有地方用到這個能力，不能刪除' : ''" @click="remove"
      >刪除</button>
    </div>
    <p class="small muted">id：{{ id }}</p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" maxlength="16" /></label>
        <label>種類
          <select v-model="draft.type">
            <option v-for="(n, k) in ABILITY_TYPES" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label v-if="draft.type === 'skill'">幾級可以學 <input v-model.number="draft.unlock" type="number" min="1" max="20" /></label>
        <label v-if="draft.type === 'spell'">環數 <input v-model.number="draft.circle" type="number" min="1" max="9" /></label>
        <label>行動點 <input v-model.number="draft.ap" type="number" min="0" max="12" :placeholder="draft.type === 'spell' ? '依環數' : draft.type === 'cantrip' ? '0' : ''" /></label>
        <label><span>屬性 <Hint text="用來算命中、傷害與 DC。" /></span>
          <select :value="draft.attr ?? ''" @change="draft.attr = (($event.target as HTMLSelectElement).value || undefined) as AttrId | 'casting' | undefined">
            <option value="">（不用）</option>
            <option value="casting">施法屬性（依職業）</option>
            <option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option>
          </select>
        </label>
        <label>額外仇恨 <input v-model.number="draft.threat" type="number" min="-50" max="50" /></label>
      </div>
      <div class="row checks small">
        <span>誰可以學：</span>
        <label v-for="c in classList" :key="c" class="check">
          <input type="checkbox" :checked="draft.classes.includes(c)" @change="toggleClass(c, ($event.target as HTMLInputElement).checked)" />
          {{ c === 'monster' ? '怪物' : className(c) }}
        </label>
      </div>
      <p class="small muted">技能依等級學；法術要有那一環的法術環，花一個法術環；戲法不花行動點、每回合一次。怪物不能用法術。</p>
    </fieldset>

    <fieldset>
      <legend>目標與判定</legend>
      <div class="grid">
        <label>目標
          <select v-model="draft.target">
            <option v-for="(n, k) in ABILITY_TARGETS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label v-if="draft.target === 'random_enemies'">次數 <input v-model.number="draft.count" type="number" min="1" max="10" /></label>
        <label>判定
          <select v-model="draft.resolve">
            <option v-for="(n, k) in ABILITY_RESOLVES" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <template v-if="draft.resolve === 'save'">
          <label>目標豁免的屬性
            <select v-model="draft.save"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
          </label>
          <label>豁免成功時
            <select v-model="draft.on_save"><option value="half">傷害減半</option><option value="none">沒有傷害</option></select>
          </label>
        </template>
        <template v-if="draft.resolve === 'attack'">
          <label>命中修正 <input v-model.number="draft.hit" type="number" min="-10" max="10" /></label>
          <label>幸運一擊門檻降低 <input v-model.number="draft.crit" type="number" min="0" max="5" /></label>
        </template>
        <label>攻擊次數 <input v-model.number="draft.hits" type="number" min="1" max="6" placeholder="1" /></label>
        <label>傷害倍率 <input v-model.number="draft.mult" type="number" min="0.1" max="5" step="0.1" placeholder="1" /></label>
      </div>
      <div v-if="draft.resolve === 'attack'" class="row checks small">
        <label class="check"><input v-model="draft.adv" type="checkbox" /> 優勢（擲兩次取高）</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>傷害</legend>
      <div v-for="(d, i) in draft.damage ?? []" :key="i" class="row small">
        <select :value="d.weapon ? 'weapon' : 'dice'" @change="setDamageSource(d, ($event.target as HTMLSelectElement).value === 'weapon')">
          <option value="weapon">武器傷害</option>
          <option value="dice">骰子</option>
        </select>
        <input v-if="!d.weapon" v-model="d.dice" class="num" placeholder="1d6" />
        <select :value="d.type ?? ''" @change="d.type = ($event.target as HTMLSelectElement).value || undefined">
          <option value="">（沿用武器）</option>
          <option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option>
        </select>
        <label class="check"><input v-model="d.mod" type="checkbox" /> 加屬性調整值</label>
        <label>每 <input :value="d.scale?.per ?? ''" class="num" type="number" min="1" max="20" placeholder="4" @input="d.scale && (d.scale.per = Number(($event.target as HTMLInputElement).value) || 4)" /> 級多</label>
        <input :value="d.scale?.dice ?? ''" class="num" placeholder="（不加）" @change="setScale(d, ($event.target as HTMLInputElement).value.trim())" />
        <button class="small" @click="draft.damage!.splice(i, 1)">移除</button>
      </div>
      <button class="small" @click="addDamage">＋ 傷害</button>
    </fieldset>

    <fieldset>
      <legend>治療與護盾</legend>
      <div class="grid">
        <template v-if="draft.resolve === 'auto'">
          <label>治療（骰子）<input v-model="draft.heal!.dice" placeholder="1d8" /></label>
          <label>治療（固定）<input v-model.number="draft.heal!.flat" type="number" min="0" /></label>
          <label>護盾（暫時生命）<input v-model.number="draft.shield!.flat" type="number" min="0" /></label>
          <label>護盾（每級）<input v-model.number="draft.shield!.level" type="number" min="0" max="10" /></label>
        </template>
        <label>吸血（傷害的比例）<input v-model.number="draft.lifesteal" type="number" min="0" max="1" step="0.05" /></label>
      </div>
      <p v-if="draft.resolve !== 'auto'" class="small muted">治療、護盾、移除負面狀態、回復法術環與直接擊倒只在結算方式是「必中」時有效。</p>
      <div v-if="draft.resolve === 'auto'" class="row checks small">
        <span>治療另外：</span>
        <label class="check"><input v-model="draft.heal!.mod" type="checkbox" /> 加屬性調整值</label>
        <label class="check"><input v-model="draft.heal!.level" type="checkbox" /> 加等級</label>
        <label class="check"><input v-model="draft.heal!.full" type="checkbox" /> 回滿</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>狀態</legend>
      <div v-for="(a, i) in draft.apply ?? []" :key="i" class="row small">
        <select v-model="a.status" class="grow">
          <option v-for="s in statusList" :key="s.id" :value="s.id">{{ s.kind === 'buff' ? '🟢' : '🔴' }} {{ s.name }}</option>
        </select>
        <input v-model.number="a.turns" class="num" type="number" min="1" max="20" /> 回合
        <select :value="a.to ?? 'target'" @change="a.to = ($event.target as HTMLSelectElement).value as ApplyDef['to']">
          <option v-for="(n, k) in TO" :key="k" :value="k">給{{ n }}</option>
        </select>
        <!-- 沒寫時依結算方式：命中骰是命中時、豁免是豁免失敗時、必中是一定 -->
        <select :value="a.on ?? (draft.resolve === 'attack' ? 'hit' : draft.resolve === 'save' ? 'fail' : 'always')" @change="a.on = ($event.target as HTMLSelectElement).value as ApplyDef['on']">
          <option v-for="(n, k) in ON" :key="k" :value="k">{{ n }}</option>
        </select>
        <select :value="a.save ?? ''" @change="a.save = (($event.target as HTMLSelectElement).value || undefined) as AttrId | undefined">
          <option value="">（不能豁免）</option>
          <option v-for="x in ATTR_IDS" :key="x" :value="x">{{ attrName(x) }}豁免</option>
        </select>
        <button class="small" @click="draft.apply!.splice(i, 1)">移除</button>
      </div>
      <button class="small" @click="addApply">＋ 狀態</button>
    </fieldset>

    <fieldset>
      <legend>次數與其他</legend>
      <div class="grid">
        <label>每回合幾次 <input v-model.number="draft.uses!.per_turn" type="number" min="0" max="10" placeholder="不限" /></label>
        <label>每場戰鬥幾次 <input v-model.number="draft.uses!.per_combat" type="number" min="0" max="10" placeholder="不限" /></label>
        <label>每次長休幾次 <input v-model.number="draft.uses!.per_rest" type="number" min="0" max="10" placeholder="不限" /></label>
        <label>獲得行動點 <input v-model.number="draft.ap_gain" type="number" min="0" max="10" /></label>
        <label>命中時獲得行動點 <input v-model.number="draft.ap_gain_on_hit" type="number" min="0" max="10" /></label>
        <label>目標生命值上限 <input v-model.number="draft.hp_limit" type="number" min="0" placeholder="不限" /></label>
      </div>
      <div class="row checks small">
        <label class="check"><input v-model="draft.concentration" type="checkbox" /> 需要專注</label>
        <template v-if="draft.resolve === 'auto'">
          <label class="check"><input v-model="draft.cleanse" type="checkbox" /> 移除目標的所有負面狀態</label>
          <label class="check"><input v-model="draft.recover_slot" type="checkbox" /> 回復一個法術環</label>
          <label class="check"><input v-model="draft.kill" type="checkbox" /> 直接擊倒 <Hint text="配合上面的「目標生命值上限」使用。" /></label>
        </template>
      </div>
    </fieldset>

    <label class="block"><span>說明 <Hint text="玩家與 AI 看到的。" /></span><textarea v-model="draft.desc" rows="2" maxlength="200" /></label>
  </div>
</template>

<style scoped src="./editor.css"></style>
