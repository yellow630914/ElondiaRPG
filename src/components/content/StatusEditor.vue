<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { damageTypeName, damageTypes, describeStatus, statuses, type AffinityMap, type LuckRoll, type Mods } from '@/engine/data'
import { builtinStatus, LUCK_ROLLS, STATUS_CONTROLS, STATUS_SPECIALS, type StatusMod } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'

// 狀態（BUFF／DEBUFF）的編輯表單：數值修正、幸運骰、優勢劣勢、傷害倍率、持續效果、命中附加、控制。存檔前是草稿
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): StatusMod {
  const s = clone(content.mods.statuses[props.id] ?? (statuses[props.id] as StatusMod))
  s.mods ??= {}
  return s
}
// 空的 mods 不算修改
const snap = (s: StatusMod) => JSON.stringify(s, (k, v) => (k === 'mods' && v && !Object.values(v).some(Boolean) ? undefined : v))
const draft = ref<StatusMod>(current())
const saved = ref(snap(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = snap(draft.value)
})
const dirty = computed(() => snap(draft.value) !== saved.value)
const builtin = computed(() => !!builtinStatus(props.id))
const edited = computed(() => builtin.value && !!content.mods.statuses[props.id])
const usage = computed(() => {
  void content.version
  void game.state?.combat?.round
  return content.usageOf('status', props.id)
})
const preview = computed(() => describeStatus(draft.value))

// ---- 選項 ----
const MODS: Record<keyof Mods, string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '武器傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊閾值降低', threat: '仇恨倍率' }
const damageIds = damageTypes.types.map((t) => t.id)
const affinityKeys = [...damageIds, ...Object.keys(damageTypes.groups)]
const others = computed(() => {
  void content.version
  return Object.entries(statuses).filter(([id]) => id !== props.id).map(([id, s]) => ({ id, name: s.name, kind: s.kind }))
})

function setMod(k: keyof Mods, v: string) {
  const m = (draft.value.mods ??= {})
  if (v === '' || !Number(v)) delete m[k]
  else m[k] = Number(v)
}
function toggleRoll(field: 'luck_on' | 'advantage' | 'disadvantage', r: LuckRoll, on: boolean) {
  const set = new Set(draft.value[field] ?? [])
  if (on) set.add(r)
  else set.delete(r)
  if (set.size) draft.value[field] = [...set]
  else delete draft.value[field]
}
/** 傷害倍率：一列一種傷害類型（或群組） */
function rows(map?: AffinityMap): [string, number][] {
  return Object.entries(map ?? {}).map(([k, v]) => [k, v ?? 0])
}
function addAffinity(field: 'resist' | 'offense') {
  const map = (draft.value[field] ??= {})
  const free = affinityKeys.find((k) => !(k in map)) ?? 'all'
  map[free] = field === 'resist' ? -0.25 : 0.25
}
function setAffinity(field: 'resist' | 'offense', oldKey: string, key: string, value: number) {
  const map = (draft.value[field] ??= {})
  delete map[oldKey]
  map[key] = value
}
function removeAffinity(field: 'resist' | 'offense', key: string) {
  const map = draft.value[field]
  if (!map) return
  delete map[key]
  if (!Object.keys(map).length) delete draft.value[field]
}
function toggleTyped(field: 'dot' | 'pulse', on: boolean) {
  if (on) draft.value[field] = { dice: '1d6', type: field === 'dot' ? 'poison' : 'force' }
  else delete draft.value[field]
}
type OnHitKind = '' | 'damage' | 'status'
const onHitKind = computed<OnHitKind>(() => (draft.value.on_hit?.status ? 'status' : draft.value.on_hit?.dice ? 'damage' : ''))
function setOnHit(kind: OnHitKind) {
  if (kind === 'damage') draft.value.on_hit = { dice: '1d4', type: 'radiant' }
  else if (kind === 'status') draft.value.on_hit = { status: others.value.find((s) => s.kind === 'debuff')?.id ?? others.value[0]!.id, turns: 2 }
  else delete draft.value.on_hit
}

function save() {
  try {
    content.saveStatus(props.id, draft.value)
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
  content.restoreStatus(props.id)
  draft.value = current()
  saved.value = snap(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deleteStatus(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.kind === 'buff' ? '🟢' : '🔴' }} {{ draft.name || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button
        v-else class="small danger" :disabled="usage.length > 0"
        :title="usage.length ? '還有地方用到這個狀態，不能刪除' : ''" @click="remove"
      >刪除</button>
    </div>
    <p class="small muted">id：{{ id }}・效果：{{ preview }}</p>
    <p class="small muted">持續回合由施加的能力或物品決定，在擁有者的回合開始時 -1。狀態要由能力（技能編輯器的「狀態」）或物品施加才會出現在戰鬥裡。</p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" maxlength="10" /></label>
        <label>種類
          <select v-model="draft.kind">
            <option value="buff">增益（BUFF）</option>
            <option value="debuff">減益（DEBUFF，可被淨化）</option>
          </select>
        </label>
        <label>生效幾次後消失 <input v-model.number="draft.charges" type="number" min="0" max="10" placeholder="不限（看回合）" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>數值修正（負的是減益）</legend>
      <div class="grid">
        <label v-for="(n, k) in MODS" :key="k">{{ n }}
          <input
            type="number" :step="k === 'threat' ? 0.05 : 1" :min="k === 'threat' ? -1 : -10" :max="k === 'threat' ? 2 : 10"
            :value="draft.mods?.[k] ?? ''" placeholder="—" @input="setMod(k, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>擲骰</legend>
      <div class="row small">
        <label>幸運骰 <input v-model="draft.luck" class="num" placeholder="1d4 或 -1d4" /></label>
        <span>作用在：</span>
        <label v-for="(n, r) in LUCK_ROLLS" :key="r" class="check">
          <input type="checkbox" :checked="draft.luck_on?.includes(r)" @change="toggleRoll('luck_on', r, ($event.target as HTMLInputElement).checked)" /> {{ n }}
        </label>
      </div>
      <div class="row small">
        <span>優勢：</span>
        <label v-for="(n, r) in LUCK_ROLLS" :key="r" class="check">
          <input type="checkbox" :checked="draft.advantage?.includes(r)" @change="toggleRoll('advantage', r, ($event.target as HTMLInputElement).checked)" /> {{ n }}
        </label>
        <span>劣勢：</span>
        <label v-for="(n, r) in LUCK_ROLLS" :key="`d-${r}`" class="check">
          <input type="checkbox" :checked="draft.disadvantage?.includes(r)" @change="toggleRoll('disadvantage', r, ($event.target as HTMLInputElement).checked)" /> {{ n }}
        </label>
      </div>
      <div class="row checks small">
        <label class="check"><input v-model="draft.attacked_advantage" type="checkbox" /> 被攻擊時對方優勢</label>
        <label class="check"><input v-model="draft.attacked_disadvantage" type="checkbox" /> 被攻擊時對方劣勢</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>傷害倍率（-0.25 = ×0.75）</legend>
      <div v-for="field in (['resist', 'offense'] as const)" :key="field">
        <b class="small">{{ field === 'resist' ? '受到的傷害' : '造成的傷害' }}</b>
        <div v-for="[k, v] in rows(draft[field])" :key="k" class="row small">
          <select :value="k" @change="setAffinity(field, k, ($event.target as HTMLSelectElement).value, v)">
            <option v-for="id in affinityKeys" :key="id" :value="id">{{ damageTypeName(id) }}</option>
          </select>
          <input type="number" step="0.05" min="-1" max="2" class="num" :value="v" @input="setAffinity(field, k, k, Number(($event.target as HTMLInputElement).value))" />
          <span class="muted">×{{ Math.round((1 + v) * 100) / 100 }}</span>
          <button class="small" @click="removeAffinity(field, k)">移除</button>
        </div>
        <button class="small" @click="addAffinity(field)">＋ {{ field === 'resist' ? '受到的傷害倍率' : '造成的傷害倍率' }}</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>持續效果（回合開始時）</legend>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="!!draft.dot" @change="toggleTyped('dot', ($event.target as HTMLInputElement).checked)" /> 持續傷害</label>
        <template v-if="draft.dot">
          <input v-model="draft.dot.dice" class="num" />
          <select v-model="draft.dot.type"><option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option></select>
        </template>
      </div>
      <div class="row small">
        <label>持續治療 <input v-model="draft.hot" class="num" placeholder="1d6" /></label>
      </div>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="!!draft.pulse" @change="toggleTyped('pulse', ($event.target as HTMLInputElement).checked)" /> 對隨機敵人攻擊</label>
        <template v-if="draft.pulse">
          <input v-model="draft.pulse.dice" class="num" />
          <select v-model="draft.pulse.type"><option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option></select>
          <label class="check"><input v-model="draft.pulse.mod" type="checkbox" /> 加施放者的屬性調整值</label>
        </template>
      </div>
    </fieldset>

    <fieldset>
      <legend>武器命中時</legend>
      <div class="row small">
        <select :value="onHitKind" @change="setOnHit(($event.target as HTMLSelectElement).value as OnHitKind)">
          <option value="">（沒有）</option>
          <option value="damage">附加傷害</option>
          <option value="status">使目標得到狀態</option>
        </select>
        <template v-if="draft.on_hit?.dice !== undefined && onHitKind === 'damage'">
          <input v-model="draft.on_hit.dice" class="num" />
          <select v-model="draft.on_hit.type"><option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option></select>
        </template>
        <template v-if="draft.on_hit && onHitKind === 'status'">
          <select v-model="draft.on_hit.status">
            <option v-for="s in others" :key="s.id" :value="s.id">{{ s.kind === 'buff' ? '🟢' : '🔴' }} {{ s.name }}</option>
          </select>
          <input v-model.number="draft.on_hit.turns" class="num" type="number" min="1" max="20" /> 回合
        </template>
      </div>
    </fieldset>

    <fieldset>
      <legend>控制與特殊</legend>
      <div class="grid">
        <label>控制
          <select :value="draft.control ?? ''" @change="draft.control = (($event.target as HTMLSelectElement).value || undefined) as StatusMod['control']">
            <option value="">（沒有）</option>
            <option v-for="(n, k) in STATUS_CONTROLS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label>特殊
          <select :value="draft.special ?? ''" @change="draft.special = (($event.target as HTMLSelectElement).value || undefined) as StatusMod['special']">
            <option value="">（沒有）</option>
            <option v-for="(n, k) in STATUS_SPECIALS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>慾望戰鬥 <Hint text="成人向（docs/COMBAT_SYSTEM.md 第 8.5 節）；存檔規則「慾望戰鬥」關閉時沒有作用。" /></legend>
      <div class="grid">
        <label>受到的慾望倍率 ± <input v-model.number="draft.lust_mult" type="number" min="-1" max="3" step="0.05" placeholder="—" /></label>
        <label>生命傷害轉成慾望的比例 <input v-model.number="draft.convert" type="number" min="0" max="1" step="0.05" placeholder="—" /></label>
        <label><span>被侍奉（代受）的轉換比例 <Hint text="下一次受到的攻擊由施加者承受，承受的傷害這個比例改成慾望。" /></span><input v-model.number="draft.guard" type="number" min="0" max="1" step="0.05" placeholder="—" /></label>
        <label>每回合慾望 + <input v-model.number="draft.lust_tick" type="number" min="0" max="100" placeholder="—" /></label>
        <label>慾望上限倍率 ± <input v-model.number="draft.lust_max" type="number" min="-0.9" max="3" step="0.05" placeholder="—" /></label>
      </div>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="!!draft.lust_scale" @change="($event.target as HTMLInputElement).checked ? (draft.lust_scale = { stat: 'damage', per: 1, max: 5 }) : delete draft.lust_scale" /> 依慾望的修正</label>
        <template v-if="draft.lust_scale">
          慾望每 10%，<select v-model="draft.lust_scale.stat"><option v-for="(n, k) in MODS" :key="k" :value="k">{{ n }}</option></select>
          + <input v-model.number="draft.lust_scale.per" type="number" min="1" max="5" class="num" />（最多 <input v-model.number="draft.lust_scale.max" type="number" min="1" max="20" class="num" />）
        </template>
      </div>
      <div class="row small">
        <label class="check"><input v-model="draft.lust_hold" type="checkbox" /> 慾望不會消退</label>
        <label class="check"><input v-model="draft.no_climax" type="checkbox" /> 不會高潮</label>
        <label class="check"><input v-model="draft.no_cleanse" type="checkbox" /> 淨化拿不掉</label>
        <label class="check"><input v-model="draft.lust_dump" type="checkbox" /> 下一個自己的回合開始時慾望全部消退</label>
        <label class="check"><input v-model="draft.climax_guard" type="checkbox" /> 下一次高潮不扣生命（用掉這個狀態）</label>
      </div>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="draft.struggle !== undefined" @change="($event.target as HTMLInputElement).checked ? (draft.struggle = 0) : delete draft.struggle" /> 戰鬥中的拘束（可以掙脫、撕開）</label>
        <template v-if="draft.struggle !== undefined">DC 加減 <input v-model.number="draft.struggle" type="number" min="-5" max="10" class="num" /></template>
      </div>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="!!draft.convert_low" @change="($event.target as HTMLInputElement).checked ? (draft.convert_low = { below: 0.3, ratio: 1 }) : delete draft.convert_low" /> 生命低時傷害轉成慾望</label>
        <template v-if="draft.convert_low">
          生命低於 <input v-model.number="draft.convert_low.below" type="number" min="0.05" max="1" step="0.05" class="num" />，轉換比例 <input v-model.number="draft.convert_low.ratio" type="number" min="0.05" max="1" step="0.05" class="num" />
        </template>
      </div>
      <div class="row small">
        <label class="check"><input type="checkbox" :checked="!!draft.on_release" @change="($event.target as HTMLInputElement).checked ? (draft.on_release = { amount: 6, level: true, type: 'necrotic' }) : delete draft.on_release" /> 高潮或引爆時對所有敵人造成傷害</label>
        <template v-if="draft.on_release">
          <input v-model.number="draft.on_release.amount" type="number" min="0" max="200" class="num" />
          <label class="check"><input v-model="draft.on_release.level" type="checkbox" /> + 等級</label>
          <select v-model="draft.on_release.type"><option v-for="t in damageTypes.types.filter((x) => x.id !== 'lust')" :key="t.id" :value="t.id">{{ damageTypeName(t.id) }}</option></select>
        </template>
      </div>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
