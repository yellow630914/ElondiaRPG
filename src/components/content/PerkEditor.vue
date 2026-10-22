<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  actionRules, ATTR_IDS, attributeRules, attrName, choosablePerks, className, combatClasses, damageTypes, npcTags, perkRules,
  type AffinityMap, type AttrId, type CheckFilter, type Mods, type PerkEffect,
} from '@/engine/data'
import { builtinPerk, perkEditorLimits, TRAIN_CELLS, type PerkMod } from '@/engine/mods'
import { CELL_NAME } from '@/engine/grid'
import { describeEffects, perkPower } from '@/engine/perks'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import UsageNote from './UsageNote.vue'

// 特質的編輯表單：效果（檢定加值、戰鬥修正、抗性、增傷）、條件、互斥、訓練、NPC 的權重。
// 種族特質只能改名稱、描述與效果（依種族自動擁有）。抗性可以是弱點；勾了「缺陷」的特質才能有負的檢定加值與戰鬥修正。
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): PerkMod {
  return clone(content.mods.perks[props.id] ?? perkRules.perks.find((p) => p.id === props.id)!)
}
const draft = ref<PerkMod>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinPerk(props.id))
const edited = computed(() => builtin.value && !!content.mods.perks[props.id])
const race = computed(() => !!draft.value.race)
const limits = computed(() => perkEditorLimits(!!draft.value.flaw))
const usage = computed(() => {
  void content.version
  void game.state?.time.minute
  return content.usageOf('perk', props.id)
})

// ---- 選項 ----
const contexts = Object.entries(perkRules.contexts)
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name] as const)
const tags = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name] as const)
const dmgTypes = damageTypes.types.map((t) => [t.id, t.name] as const)
const COMBAT: Record<keyof Mods, string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊', threat: '仇恨倍率' } as Record<keyof Mods, string>
const others = computed(() => {
  void content.version
  return choosablePerks().filter((p) => p.id !== props.id)
})
const races = Object.entries(attributeRules.races)
const classList = Object.keys(combatClasses)
type EffectKind = 'check' | 'combat' | 'resist' | 'offense'
const kindOf = (e: PerkEffect): EffectKind => ('check' in e ? 'check' : 'combat' in e ? 'combat' : 'resist' in e ? 'resist' : 'offense')

function addEffect(kind: EffectKind) {
  const list = draft.value.effects
  if (list.length >= limits.value.effects) return
  if (kind === 'check') list.push({ check: {}, bonus: draft.value.flaw ? -1 : 1 })
  else if (kind === 'combat') list.push({ combat: { hit: 1 } })
  else if (kind === 'resist') list.push({ resist: { [dmgTypes[0]![0]]: -0.25 } })
  else list.push({ offense: { [dmgTypes[0]![0]]: 0.25 } })
}
/** 檢定加值的篩選：勾選或取消一個值 */
function toggleFilter(f: CheckFilter, key: keyof CheckFilter, v: string, on: boolean) {
  const set = new Set<string>(f[key] as string[] | undefined)
  if (on) set.add(v)
  else set.delete(v)
  if (set.size) (f as Record<string, string[]>)[key] = [...set]
  else delete f[key]
}
function setCombat(m: Mods, k: keyof Mods, v: string) {
  if (v === '' || !Number(v)) delete m[k]
  else m[k] = Number(v)
}
/** 抗性、增傷：一列一種傷害類型 */
function affinityRows(map: AffinityMap): [string, number][] {
  return Object.entries(map).map(([k, v]) => [k, v ?? 0])
}
function setAffinity(map: AffinityMap, oldKey: string, key: string, value: number) {
  if (oldKey !== key) delete map[oldKey]
  map[key] = value
}
function toggleList(list: string[] | undefined, v: string, on: boolean): string[] | undefined {
  const set = new Set(list)
  if (on) set.add(v)
  else set.delete(v)
  return set.size ? [...set] : undefined
}
function setRequires(key: 'races' | 'classes', v: string, on: boolean) {
  const r = { ...(draft.value.requires ?? {}) }
  const next = toggleList(r[key], v, on)
  if (next) r[key] = next
  else delete r[key]
  if (r.races || r.classes) draft.value.requires = r
  else delete draft.value.requires
}
function setExclusive(v: string, on: boolean) {
  const next = toggleList(draft.value.exclusive, v, on)
  if (next) draft.value.exclusive = next
  else delete draft.value.exclusive
}
function setTrain(on: boolean) {
  if (on) draft.value.train = { cells: ['guild'], price_cc: 300, hours: 8, attr: 'str', dc: 12 }
  else delete draft.value.train
}
function setNpcWeight(v: string) {
  const w = Math.max(0, Math.min(10, Math.round(Number(v) || 0)))
  if (w) draft.value.npc = { ...(draft.value.npc ?? {}), weight: w }
  else delete draft.value.npc
}
const auto = computed(() => describeEffects(draft.value.effects))

function save() {
  try {
    content.savePerk(props.id, draft.value)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
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
  content.restorePerk(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.name}」？`)) return
  try {
    content.deletePerk(props.id)
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
      <span v-if="race" class="tag">種族</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button
        v-else class="small danger" :disabled="usage.length > 0"
        :title="usage.length ? '還有地方用到這個特質，不能刪除' : ''" @click="remove"
      >刪除</button>
    </div>
    <p class="small muted">id：{{ id }}・強度約 {{ perkPower(draft) }}</p>
    <p v-if="race" class="small muted">
      種族特質：{{ attributeRules.races[draft.race!]?.name }}的角色自動擁有（不寫進存檔），不能選、受訓或從書裡學，也不會失去；可以改名稱、描述與效果。
    </p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="perkRules.custom.name_chars" /></label>
        <label v-if="!race" class="check"><input v-model="draft.flaw" type="checkbox" /> 缺陷（負的效果；不會出現在學特質的機會裡，事件直接給，受訓是克服它）</label>
      </div>
      <label class="block">描述（玩家與 AI 看到的；空白時依效果產生：{{ auto }}） <textarea v-model="draft.desc" rows="2" :maxlength="perkRules.custom.desc_chars" /></label>
    </fieldset>

    <fieldset>
      <legend>效果（最多 {{ limits.effects }} 個）</legend>
      <p class="small muted">
        檢定加值 {{ limits.check_bonus[0] }}～{{ limits.check_bonus[1] }}、戰鬥修正 {{ limits.combat[0] }}～{{ limits.combat[1] }}（仇恨倍率 {{ limits.threat![0] }}～{{ limits.threat![1] }}）、
        抗性 {{ limits.resist[0] }}～+{{ limits.resist[1] }}（正的是弱點，可以用來平衡強項）、增傷 {{ limits.offense![0] }}～{{ limits.offense![1] }}。{{ draft.flaw ? '缺陷可以有負的檢定加值與戰鬥修正。' : '負的檢定加值與戰鬥修正要勾「缺陷」。' }}
      </p>
      <div v-for="(e, i) in draft.effects" :key="i" class="effect">
        <div class="row">
          <b class="small">{{ { check: '檢定加值', combat: '戰鬥修正', resist: '抗性（受到的傷害倍率）', offense: '增傷（造成的傷害倍率）' }[kindOf(e)] }}</b>
          <span class="spacer" />
          <button class="small" @click="draft.effects.splice(i, 1)">移除</button>
        </div>
        <template v-if="'check' in e">
          <label class="small">加值 <input v-model.number="e.bonus" type="number" :min="limits.check_bonus[0]" :max="limits.check_bonus[1]" class="num" /></label>
          <p class="small muted">勾選篩選條件：同一欄是「或」，不同欄是「且」，都不勾就是所有檢定。</p>
          <details class="small"><summary>屬性（{{ e.check.attrs?.length ?? 0 }}）</summary>
            <label v-for="a in ATTR_IDS" :key="a" class="check"><input type="checkbox" :checked="e.check.attrs?.includes(a)" @change="toggleFilter(e.check, 'attrs', a, ($event.target as HTMLInputElement).checked)" /> {{ attrName(a as AttrId) }}</label>
          </details>
          <details class="small"><summary>情境（{{ e.check.contexts?.length ?? 0 }}）</summary>
            <label v-for="[k, n] in contexts" :key="k" class="check"><input type="checkbox" :checked="e.check.contexts?.includes(k as never)" @change="toggleFilter(e.check, 'contexts', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
          </details>
          <details class="small"><summary>主動行動（{{ e.check.kinds?.length ?? 0 }}）</summary>
            <label v-for="[k, n] in kinds" :key="k" class="check"><input type="checkbox" :checked="e.check.kinds?.includes(k as never)" @change="toggleFilter(e.check, 'kinds', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
          </details>
          <details class="small"><summary>對象的標籤（{{ e.check.vs_tags?.length ?? 0 }}）</summary>
            <label v-for="[k, n] in tags" :key="k" class="check"><input type="checkbox" :checked="e.check.vs_tags?.includes(k)" @change="toggleFilter(e.check, 'vs_tags', k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
          </details>
        </template>
        <div v-else-if="'combat' in e" class="grid">
          <label v-for="(n, k) in COMBAT" :key="k">{{ n }}
            <input
              type="number" :step="k === 'threat' ? 0.05 : 1" :min="k === 'threat' ? limits.threat![0] : Math.min(0, limits.combat[0])" :max="k === 'threat' ? limits.threat![1] : limits.combat[1]"
              :value="e.combat[k] ?? ''" placeholder="—" @input="setCombat(e.combat, k, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <template v-else>
          <div v-for="[k, v] in affinityRows('resist' in e ? e.resist : e.offense)" :key="k" class="row small">
            <select :value="k" @change="setAffinity('resist' in e ? e.resist : e.offense, k, ($event.target as HTMLSelectElement).value, v)">
              <option v-for="[id, n] in dmgTypes" :key="id" :value="id">{{ n }}</option>
            </select>
            倍率 {{ v >= 0 ? '+' : '' }}{{ v }}（×{{ 1 + v }}）
            <input type="number" step="0.25" :value="v" class="num" @input="setAffinity('resist' in e ? e.resist : e.offense, k, k, Number(($event.target as HTMLInputElement).value))" />
            <button class="small" @click="delete ('resist' in e ? e.resist : e.offense)[k]">×</button>
          </div>
          <button class="small" @click="setAffinity('resist' in e ? e.resist : e.offense, '', dmgTypes.find(([id]) => !(id in ('resist' in e ? e.resist : e.offense)))?.[0] ?? dmgTypes[0]![0], 'resist' in e ? -0.25 : 0.25)">＋ 傷害類型</button>
        </template>
      </div>
      <div class="row">
        <button class="small" :disabled="draft.effects.length >= limits.effects" @click="addEffect('check')">＋ 檢定加值</button>
        <button class="small" :disabled="draft.effects.length >= limits.effects" @click="addEffect('combat')">＋ 戰鬥修正</button>
        <button class="small" :disabled="draft.effects.length >= limits.effects" @click="addEffect('resist')">＋ 抗性</button>
        <button class="small" :disabled="draft.effects.length >= limits.effects" @click="addEffect('offense')">＋ 增傷</button>
      </div>
    </fieldset>

    <template v-if="!race">
      <fieldset>
        <legend>條件與互斥</legend>
        <div class="row checks small">
          <span>只有這些種族可以學（不勾＝不限）：</span>
          <label v-for="[id, r] in races" :key="id" class="check">
            <input type="checkbox" :checked="draft.requires?.races?.includes(id)" @change="setRequires('races', id, ($event.target as HTMLInputElement).checked)" /> {{ r.name }}
          </label>
        </div>
        <div class="row checks small">
          <span>只有這些職業可以學：</span>
          <label v-for="c in classList" :key="c" class="check">
            <input type="checkbox" :checked="draft.requires?.classes?.includes(c)" @change="setRequires('classes', c, ($event.target as HTMLInputElement).checked)" /> {{ className(c) }}
          </label>
        </div>
        <details class="small">
          <summary>和這些特質互斥（{{ draft.exclusive?.length ?? 0 }}）</summary>
          <label v-for="p in others" :key="p.id" class="check">
            <input type="checkbox" :checked="draft.exclusive?.includes(p.id)" @change="setExclusive(p.id, ($event.target as HTMLInputElement).checked)" /> {{ p.name }}
          </label>
        </details>
      </fieldset>

      <fieldset>
        <legend>訓練</legend>
        <label class="check small"><input type="checkbox" :checked="!!draft.train" @change="setTrain(($event.target as HTMLInputElement).checked)" /> 可以在設施花錢學</label>
        <template v-if="draft.train">
          <div class="row checks small">
            <span>在哪裡學：</span>
            <label v-for="c in TRAIN_CELLS" :key="c" class="check">
              <input type="checkbox" :checked="draft.train.cells.includes(c)" @change="draft.train.cells = toggleList(draft.train.cells, c, ($event.target as HTMLInputElement).checked) ?? []" /> {{ CELL_NAME[c] }}
            </label>
          </div>
          <div class="grid">
            <label>學費（白鸛幣） <input v-model.number="draft.train.price_cc" type="number" min="0" /></label>
            <label>花幾小時 <input v-model.number="draft.train.hours" type="number" min="1" max="72" /></label>
            <label>檢定屬性
              <select v-model="draft.train.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a as AttrId) }}</option></select>
            </label>
            <label>DC <input v-model.number="draft.train.dc" type="number" min="5" max="30" /></label>
          </div>
        </template>
      </fieldset>

      <fieldset>
        <legend>NPC</legend>
        <div class="grid">
          <label>NPC 抽到的權重（0＝不會抽到） <input type="number" min="0" max="10" :value="draft.npc?.weight ?? 0" @input="setNpcWeight(($event.target as HTMLInputElement).value)" /></label>
        </div>
        <template v-if="draft.npc">
          <details class="small">
            <summary>更容易抽到的標籤（{{ draft.npc.tags?.length ?? 0 }}）</summary>
            <label v-for="[k, n] in tags" :key="k" class="check">
              <input type="checkbox" :checked="draft.npc.tags?.includes(k)" @change="draft.npc.tags = toggleList(draft.npc.tags, k, ($event.target as HTMLInputElement).checked)" /> {{ n }}
            </label>
          </details>
          <details class="small">
            <summary>更容易抽到的職業（{{ draft.npc.classes?.length ?? 0 }}）</summary>
            <label v-for="c in classList" :key="c" class="check">
              <input type="checkbox" :checked="draft.npc.classes?.includes(c)" @change="draft.npc.classes = toggleList(draft.npc.classes, c, ($event.target as HTMLInputElement).checked)" /> {{ className(c) }}
            </label>
          </details>
        </template>
      </fieldset>
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.effect { border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 6px; display: grid; gap: 4px; margin-bottom: 6px; }
.num { width: 64px; }
.check { margin-right: 8px; }
</style>
