<script setup lang="ts">
import { computed } from 'vue'
import { abilities, ATTR_IDS, attrName, contractDef, geography, itemRules, npcs as namedNpcs, choosablePerks, perkDef, slaveryRules, stories, tagDef } from '@/engine/data'
import type { RewardEffect } from '@/engine/effects'
import { gearRules } from '@/engine/gear'
import { STORY_EFFECTS } from '@/engine/storyMods'
import { oathError, oathText, TATTOO_PLACES, placeName, tattooKindName, tattooRules } from '@/engine/tattoos'
import { useContent } from '@/stores/content'

// 效果的清單（任務點的結果、完成的報酬）：金錢、物品、裝備、經驗、聲望、親密度、記憶、能力、入隊、生命值
const model = defineModel<RewardEffect[] | undefined>()
const content = useContent()
const list = computed(() => model.value ?? [])
const items = computed(() => {
  void content.version
  return itemRules.items.map((i) => i.name)
})
const storyList = computed(() => {
  void content.version
  return [...stories].sort((a, b) => Number(b.start.kind === 'manual') - Number(a.start.kind === 'manual'))
})
const factions = [...new Set(geography.locations.map((l) => l.faction).filter(Boolean))] as string[]
type Row = Record<string, unknown> & { type: RewardEffect['type'] }
const rows = computed(() => list.value as unknown as Row[])

const DEFAULTS: Partial<Record<RewardEffect['type'], () => RewardEffect>> = {
  money: () => ({ type: 'money', amount: 100 }),
  item: () => ({ type: 'item', name: '治療藥劑', qty: 1 }),
  gear: () => ({ type: 'gear', spec: { base: 'longsword', material: 'steel' } }),
  xp: () => ({ type: 'xp', amount: 50 }),
  reputation: () => ({ type: 'reputation', faction: factions[0] ?? 'local', delta: 1 }),
  affinity: () => ({ type: 'affinity', npc: namedNpcs[0]?.id ?? '', delta: 5 }),
  memory: () => ({ type: 'memory', summary: '', importance: 2 }),
  ability: () => ({ type: 'ability', target: 'pc', choices: 3 }),
  companion: () => ({ type: 'companion', npc: namedNpcs[0]?.id ?? '', mode: 'voluntary' }),
  hp: () => ({ type: 'hp', target: 'pc', ratio: -0.2 }),
  start_story: () => ({ type: 'start_story', story: stories.find((s) => s.start.kind === 'manual')?.id ?? stories[0]?.id ?? '' }),
  enslave_player: () => ({ type: 'enslave_player', random: {}, contract: slaveryRules.roles.default }),
  perk: () => ({ type: 'perk', perk: choosablePerks()[0]!.id }),
  lose_perk: () => ({ type: 'lose_perk', perk: choosablePerks()[0]!.id }),
  tattoo: () => ({ type: 'tattoo', template: Object.keys(tattooRules.templates)[0]! }),
  remove_tattoo: () => ({ type: 'remove_tattoo', kind: 'plain' }),
}
// 刺青：圖樣，或自己描述（誓約要填屬性的加減）
const tattooTemplates = computed(() => {
  void content.version
  return Object.entries(tattooRules.templates)
})
function tattooMode(r: Row): string {
  return typeof r.template === 'string' ? r.template : `custom:${r.kind === 'oath' ? 'oath' : 'plain'}`
}
function setTattooMode(r: Row, mode: string) {
  for (const k of ['template', 'kind', 'name', 'text', 'attrs']) delete r[k]
  if (mode.startsWith('custom:')) Object.assign(r, { kind: mode.slice(7), name: '', text: '', ...(mode === 'custom:oath' ? { attrs: {} } : {}) })
  else r.template = mode
}
function oathAttrs(r: Row): Record<string, number> {
  return (r.attrs ??= {}) as Record<string, number>
}
function setOathAttr(r: Row, a: string, v: number) {
  const attrs = { ...oathAttrs(r) }
  if (v) attrs[a] = v
  else delete attrs[a]
  r.attrs = attrs
}
function removeTattooMode(r: Row): string {
  return typeof r.place === 'string' ? r.place : `kind:${r.kind ?? 'plain'}`
}
function setRemoveTattooMode(r: Row, mode: string) {
  delete r.place
  delete r.kind
  if (mode.startsWith('kind:')) r.kind = mode.slice(5)
  else r.place = mode
}
// 特質的機會：第一個特質加上其他選項
function perkOptions(r: Row): string[] {
  return (r.options as string[] | undefined) ?? []
}
function setPerkOption(r: Row, i: number, id: string) {
  const list = [...perkOptions(r)]
  if (id) list[i] = id
  else list.splice(i, 1)
  if (list.length) r.options = list
  else delete r.options
}
// 主角淪為奴隸：固定 NPC 當主人，或隨機生成（可以指定身分）
const contracts = computed(() => {
  void content.version
  return Object.keys(slaveryRules.contracts)
})
const masterTags = Object.keys(slaveryRules.master_tags.tags)
function masterMode(r: Row): 'fixed' | 'random' {
  return typeof r.master === 'string' ? 'fixed' : 'random'
}
function setMasterMode(r: Row, mode: string) {
  if (mode === 'fixed') {
    delete r.random
    r.master = namedNpcs[0]?.id ?? ''
  } else {
    delete r.master
    r.random = {}
  }
}
function randomTag(r: Row): string {
  return (r.random as { tag?: string } | undefined)?.tag ?? ''
}
function setRandomTag(r: Row, tag: string) {
  r.random = tag ? { tag } : {}
}
function add(type: RewardEffect['type']) {
  model.value = [...list.value, DEFAULTS[type]!()]
}
function remove(i: number) {
  const next = list.value.filter((_, j) => j !== i)
  model.value = next.length ? next : undefined
}
function spec(r: Row) {
  return r.spec as { base: string; material: string; rarity?: string }
}
function materialsFor(base: string) {
  const kind = gearRules.bases[base]?.kind
  return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind)
}
function setBase(r: Row, base: string) {
  r.spec = { base, material: materialsFor(base)[0]?.[0] ?? '' }
}
</script>

<template>
  <div class="effects">
    <datalist id="effect-items"><option v-for="n in items" :key="n" :value="n" /></datalist>
    <div v-for="(r, i) in rows" :key="i" class="row">
      <span class="tag">{{ STORY_EFFECTS[r.type] ?? r.type }}</span>
      <template v-if="r.type === 'money'"><input v-model.number="r.amount" type="number" class="num" />白鸛幣（負數為花費）</template>
      <template v-else-if="r.type === 'item'">
        <input v-model="r.name" list="effect-items" class="grow" placeholder="物品名稱" />
        ×<input v-model.number="r.qty" type="number" class="num" title="負數為交出" />
      </template>
      <template v-else-if="r.type === 'gear'">
        <select :value="spec(r).base" @change="setBase(r, ($event.target as HTMLSelectElement).value)">
          <option v-for="(b, id) in gearRules.bases" :key="id" :value="id">{{ b.name }}</option>
        </select>
        <select v-model="spec(r).material">
          <option v-for="[id, m] in materialsFor(spec(r).base)" :key="id" :value="id">{{ m.name }}</option>
        </select>
        <input v-model="r.name" maxlength="20" placeholder="名稱（選填）" />
        <input v-model="r.desc" maxlength="80" class="grow" placeholder="描述（選填）" />
      </template>
      <template v-else-if="r.type === 'xp'"><input v-model.number="r.amount" type="number" min="0" class="num" />點（全隊）</template>
      <template v-else-if="r.type === 'reputation'">
        <input v-model="r.faction" list="effect-factions" placeholder="勢力" />
        <datalist id="effect-factions"><option v-for="f in factions" :key="f" :value="f" /></datalist>
        <input v-model.number="r.delta" type="number" class="num" />
      </template>
      <template v-else-if="r.type === 'affinity' || r.type === 'companion'">
        <select v-model="r.npc">
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
        <input v-if="r.type === 'affinity'" v-model.number="r.delta" type="number" class="num" />
        <select v-else v-model="r.mode">
          <option value="voluntary">自願入隊</option>
          <option value="hired">雇傭入隊</option>
        </select>
      </template>
      <template v-else-if="r.type === 'memory'"><input v-model="r.summary" class="grow" maxlength="200" placeholder="記下的事（之後給 AI 參考）" /></template>
      <template v-else-if="r.type === 'ability'">
        <select v-model="r.ability">
          <option :value="undefined">升級時的三選一</option>
          <option v-for="a in Object.values(abilities)" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </template>
      <template v-else-if="r.type === 'start_story'">
        <select v-model="r.story" class="grow">
          <option v-for="s in storyList" :key="s.id" :value="s.id">{{ s.title }}{{ s.start.kind === 'manual' ? '（只由其他事件開啟）' : '' }}</option>
        </select>
        <span class="small muted">已經開始過就略過；不看接取條件</span>
      </template>
      <template v-else-if="r.type === 'enslave_player'">
        <select :value="masterMode(r)" @change="setMasterMode(r, ($event.target as HTMLSelectElement).value)">
          <option value="fixed">固定 NPC 當主人</option>
          <option value="random">隨機的 NPC 當主人</option>
        </select>
        <select v-if="masterMode(r) === 'fixed'" v-model="r.master">
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
        <select v-else :value="randomTag(r)" @change="setRandomTag(r, ($event.target as HTMLSelectElement).value)">
          <option value="">任何身分（依奴隸市場的權重）</option>
          <option v-for="t in masterTags" :key="t" :value="t">{{ tagDef(t)?.name ?? t }}</option>
        </select>
        打算刻
        <select v-model="r.contract">
          <option v-for="c in contracts" :key="c" :value="c">{{ contractDef(c).name }}</option>
        </select>
        <span class="small muted">之後還有刻印檢定；已經是奴隸時改成換主人（印記沿用）；老鴇一律刻娼妓契約</span>
      </template>
      <template v-else-if="r.type === 'perk' || r.type === 'lose_perk'">
        <select v-model="r.perk">
          <option v-for="p in choosablePerks()" :key="p.id" :value="p.id">{{ p.name }}{{ p.flaw ? '（缺陷）' : '' }}</option>
        </select>
        <span v-if="r.type === 'perk' && perkDef(String(r.perk ?? ''))?.flaw" class="small muted">缺陷：直接染上（不是機會，不能選也不能爭取）</span>
        <span v-else-if="r.type === 'lose_perk' && perkDef(String(r.perk ?? ''))?.flaw" class="small muted">克服這個缺陷</span>
        <template v-if="r.type === 'perk' && !perkDef(String(r.perk ?? ''))?.flaw">
          <select v-for="(id, i) in perkOptions(r)" :key="i" :value="id" @change="setPerkOption(r, i, ($event.target as HTMLSelectElement).value)">
            <option value="">（拿掉）</option>
            <option v-for="p in choosablePerks().filter((x) => !x.flaw)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-if="!r.direct && perkOptions(r).length < 5" :value="''" @change="setPerkOption(r, perkOptions(r).length, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
            <option value="">＋ 再提供一個…</option>
            <option v-for="p in choosablePerks().filter((x) => !x.flaw)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <label class="check small"><input v-model="r.direct" type="checkbox" /> 直接學會（不給選擇）</label>
          <span v-if="!r.direct" class="small muted">玩家從中選一個，或寫一段說法擲骰交給 AI</span>
        </template>
      </template>
      <template v-else-if="r.type === 'tattoo'">
        <select :value="tattooMode(r)" @change="setTattooMode(r, ($event.target as HTMLSelectElement).value)">
          <optgroup v-for="k in (['plain', 'oath'] as const)" :key="k" :label="tattooKindName(k)">
            <option v-for="[id, t] in tattooTemplates.filter(([, x]) => x.kind === k)" :key="id" :value="id">{{ t.name }}{{ t.attrs ? `（${oathText(t.attrs)}）` : '' }}</option>
          </optgroup>
          <option value="custom:plain">自己描述（普通刺青）</option>
          <option value="custom:oath">自己描述（誓約印記）</option>
        </select>
        <select :value="r.place ?? ''" @change="($event.target as HTMLSelectElement).value ? (r.place = ($event.target as HTMLSelectElement).value) : delete r.place">
          <option value="">部位：圖樣建議的空位</option>
          <option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}</option>
        </select>
        <template v-if="typeof r.template !== 'string'">
          <input v-model="r.name" maxlength="20" placeholder="名稱" />
          <input v-model="r.text" class="grow" maxlength="160" placeholder="外觀描述" />
          <template v-if="r.kind === 'oath'">
            <label v-for="a in ATTR_IDS" :key="a" class="small">{{ attrName(a) }}
              <input type="number" class="num" min="-3" max="3" :value="oathAttrs(r)[a] ?? 0" @input="setOathAttr(r, a, Number(($event.target as HTMLInputElement).value))" />
            </label>
            <span class="small" :class="oathError(oathAttrs(r)) ? 'warn' : 'muted'">{{ oathError(oathAttrs(r)) ?? '加減平衡' }}</span>
          </template>
        </template>
        <input v-model="r.by" maxlength="20" placeholder="誰刺的（選填）" />
        <span class="small muted">部位已經有刺青、身上沒有空位或誓約太多時不刺</span>
      </template>
      <template v-else-if="r.type === 'remove_tattoo'">
        <select :value="removeTattooMode(r)" @change="setRemoveTattooMode(r, ($event.target as HTMLSelectElement).value)">
          <option value="kind:plain">所有普通刺青</option>
          <option value="kind:oath">所有誓約印記</option>
          <option v-for="p in TATTOO_PLACES" :key="p" :value="p">{{ placeName(p) }}的刺青</option>
        </select>
        <span class="small muted">奴隸印記不會被洗掉（要解除契約）</span>
      </template>
      <template v-else-if="r.type === 'hp'">
        <input type="number" class="num" :value="Math.round(Number(r.ratio ?? 0) * 100)" @input="r.ratio = Number(($event.target as HTMLInputElement).value) / 100" />% 最大生命值（主角）
      </template>
      <button class="small x" @click="remove(i)">×</button>
    </div>
    <select class="small" :value="''" @change="add(($event.target as HTMLSelectElement).value as RewardEffect['type']); ($event.target as HTMLSelectElement).value = ''">
      <option value="">＋ 效果…</option>
      <option v-for="(n, t) in STORY_EFFECTS" :key="t" :value="t">{{ n }}</option>
    </select>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.effects { display: grid; gap: 4px; }
</style>
