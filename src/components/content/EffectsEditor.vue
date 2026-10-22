<script setup lang="ts">
import { computed } from 'vue'
import { abilities, contractDef, geography, itemRules, npcs as namedNpcs, slaveryRules, stories, tagDef } from '@/engine/data'
import type { RewardEffect } from '@/engine/effects'
import { gearRules } from '@/engine/gear'
import { STORY_EFFECTS } from '@/engine/storyMods'
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
  enslave_player: () => ({ type: 'enslave_player', random: {}, contract: 'labor' }),
}
// 主角淪為奴隸：固定 NPC 當主人，或隨機生成（可以指定身分）
const contracts = Object.keys(slaveryRules.contracts)
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
