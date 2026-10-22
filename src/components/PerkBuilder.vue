<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { actionRules, ATTR_IDS, attrName, damageTypes, npcTags, perkRules, type AttrId, type CheckContext } from '@/engine/data'
import { perkPower, sanitizePerk } from '@/engine/perks'
import type { PerkDef } from '@/engine/data'

// 自訂特質：名稱、描述與最多幾個效果（檢定加值、戰鬥修正、抗性）。建立角色時用
// 勾「缺陷」時效果是負的（檢定減值、戰鬥減值、弱點，範圍見 perks.json 的 custom.flaw）
const emit = defineEmits<{ add: [perk: PerkDef] }>()
const props = defineProps<{ allowFlaw?: boolean }>()
const c = perkRules.custom
const flaw = ref(false)
/** 輸入的是大小（正數），缺陷時換成負的 */
const range = computed(() => {
  const f = flaw.value ? c.flaw : c
  const mag = (r: [number, number]) => [Math.min(Math.abs(r[0]), Math.abs(r[1])), Math.max(Math.abs(r[0]), Math.abs(r[1]))] as [number, number]
  return { check: mag(f.check_bonus), combat: mag(f.combat) }
})

type Scope = 'all' | 'attr' | 'context' | 'kind' | 'tag'
interface Row { type: 'check' | 'combat' | 'resist'; scope: Scope; value: string; bonus: number; stat: string; amount: number; dmg: string; resist: number }
const name = ref('')
const desc = ref('')
const rows = reactive<Row[]>([])
const COMBAT: Record<string, string> = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊' }
const contexts = Object.entries(perkRules.contexts) as [CheckContext, string][]
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name] as const)
const tags = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name] as const)
const dmgTypes = damageTypes.types.map((t) => [t.id, t.name] as const)

function addRow() {
  if (rows.length >= c.effects) return
  rows.push({ type: 'check', scope: 'attr', value: 'cha', bonus: 1, stat: 'hit', amount: 1, dmg: dmgTypes[0]?.[0] ?? 'fire', resist: -0.25 })
}
function scopeValues(scope: Scope): readonly (readonly [string, string])[] {
  if (scope === 'attr') return ATTR_IDS.map((a) => [a, attrName(a as AttrId)] as const)
  if (scope === 'context') return contexts
  if (scope === 'kind') return kinds
  if (scope === 'tag') return tags
  return []
}
function setScope(r: Row, scope: Scope) {
  r.scope = scope
  r.value = scopeValues(scope)[0]?.[0] ?? ''
}

const draft = computed(() => {
  const sign = flaw.value ? -1 : 1
  return sanitizePerk({
    name: name.value, desc: desc.value, flaw: flaw.value,
    effects: rows.map((r) => {
      if (r.type === 'combat') return { combat: { [r.stat]: sign * Math.abs(r.amount) } }
      if (r.type === 'resist') return { resist: { [r.dmg]: sign * Math.abs(r.resist) * -1 } }
      const key = { all: '', attr: 'attrs', context: 'contexts', kind: 'kinds', tag: 'vs_tags' }[r.scope]
      return { check: key ? { [key]: [r.value] } : {}, bonus: sign * Math.abs(r.bonus) }
    }),
  }, `c-${Date.now().toString(36)}`, undefined, props.allowFlaw)
})

function add() {
  if (!draft.value) return
  emit('add', draft.value)
  name.value = ''
  desc.value = ''
  flaw.value = false
  rows.splice(0)
}
</script>

<template>
  <div class="builder small">
    <div class="row">
      <label>名稱 <input v-model="name" :maxlength="c.name_chars" placeholder="例如：酒館之子" /></label>
      <label class="grow">描述（選填，沒寫時依效果自動產生）<input v-model="desc" :maxlength="c.desc_chars" /></label>
      <label v-if="allowFlaw" class="check"><input v-model="flaw" type="checkbox" /> 缺陷（效果是負的）</label>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="row effect">
      <select v-model="r.type">
        <option value="check">檢定加值</option>
        <option value="combat">戰鬥修正</option>
        <option value="resist">抗性</option>
      </select>
      <template v-if="r.type === 'check'">
        <select :value="r.scope" @change="setScope(r, ($event.target as HTMLSelectElement).value as Scope)">
          <option value="all">所有檢定</option>
          <option value="attr">某個屬性</option>
          <option value="context">某種情境</option>
          <option value="kind">某種主動行動</option>
          <option value="tag">對某種人</option>
        </select>
        <select v-if="r.scope !== 'all'" v-model="r.value">
          <option v-for="[k, n] in scopeValues(r.scope)" :key="k" :value="k">{{ n }}</option>
        </select>
        {{ flaw ? '−' : '+' }}<input v-model.number="r.bonus" type="number" :min="range.check[0]" :max="range.check[1]" class="num" />
      </template>
      <template v-else-if="r.type === 'combat'">
        <select v-model="r.stat"><option v-for="(n, k) in COMBAT" :key="k" :value="k">{{ n }}</option></select>
        {{ flaw ? '−' : '+' }}<input v-model.number="r.amount" type="number" :min="range.combat[0]" :max="range.combat[1]" class="num" />
      </template>
      <template v-else>
        <select v-model="r.dmg"><option v-for="[k, n] in dmgTypes" :key="k" :value="k">{{ n }}</option></select>
        <select v-if="flaw" v-model.number="r.resist"><option :value="-0.25">傷害 ×1.25</option><option :value="-0.5">傷害 ×1.5</option></select>
        <select v-else v-model.number="r.resist"><option :value="-0.25">傷害 ×0.75</option><option :value="-0.5">傷害 ×0.5</option></select>
      </template>
      <button class="small x" @click="rows.splice(i, 1)">×</button>
    </div>
    <div class="row">
      <button class="small" :disabled="rows.length >= c.effects" @click="addRow">＋ 效果（最多 {{ c.effects }} 個）</button>
      <span v-if="draft" class="muted">{{ draft.desc }}（強度 {{ perkPower(draft) }}）</span>
      <button class="small primary" :disabled="!draft" @click="add">{{ flaw ? '加入這個缺陷' : '加入這個特質' }}</button>
    </div>
  </div>
</template>

<style scoped>
.builder { display: grid; gap: 4px; padding: 6px; border: 1px dashed var(--border); border-radius: 6px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.row label { display: grid; gap: 2px; }
.grow { flex: 1; }
.grow input { width: 100%; }
.num { width: 48px; }
.x { padding: 0 6px; }
</style>
