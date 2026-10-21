<script setup lang="ts">
import { computed } from 'vue'
import { ATTR_IDS, attrName, enemies, geography, npcs as namedNpcs, type StoryNode, type StoryOption } from '@/engine/data'
import { cellName } from '@/engine/grid'
import { LAYER_NAME, NODE_KINDS, SIDE_MAPS, STORY_CELLS, STORY_LAYERS, WHERE_NAME } from '@/engine/storyMods'
import { travelEvents } from '@/engine/road'
import FlagInput from './FlagInput.vue'
import OutcomeEditor from './OutcomeEditor.vue'

// 一個任務點：在哪裡、解鎖的條件、種類（劇情、判定、戰鬥、選擇）、結果
const node = defineModel<StoryNode>({ required: true })
const where = computed(() => node.value.at.where)
const locations = computed(() => geography.locations.filter((l) =>
  where.value === 'dungeon' ? l.type === 'dungeon' : where.value === 'npc' ? true : l.type !== 'dungeon'))
const requires = computed(() => (node.value.requires ??= {}))
const enemyList = computed(() => Object.values(enemies).sort((a, b) => a.level - b.level))

function setKind(kind: StoryNode['kind']) {
  node.value.kind = kind
  if (kind === 'check') node.value.check ??= { attr: 'int', dc: 12 }
  if (kind === 'choice') node.value.options ??= [{ label: '選項一', success: {} }, { label: '選項二', success: {} }]
  if (kind === 'combat') node.value.enemies ??= [['bandit', 1]]
}
function setWhere(w: StoryNode['at']['where']) {
  node.value.at = { ...node.value.at, where: w }
  if (w === 'cell') node.value.at.cell ??= 'tavern'
  if (w === 'dungeon') {
    node.value.at.layer ??= 'outskirts'
    if (!geography.locations.find((l) => l.id === node.value.at.location && l.type === 'dungeon')) node.value.at.location = locations.value.find((l) => l.type === 'dungeon')?.id
  } else if (w !== 'npc' && geography.locations.find((l) => l.id === node.value.at.location)?.type === 'dungeon') {
    node.value.at.location = 'soriel'
  }
  if (w === 'npc') node.value.at.npc ??= namedNpcs[0]?.id
}
function addOption() {
  ;(node.value.options ??= []).push({ label: '新的選項', success: {} })
}
function toggleCheck(o: StoryOption, on: boolean) {
  if (on) o.check = { attr: 'cha', dc: 12 }
  else {
    delete o.check
    delete o.fail
  }
}
function toggleFoe(id: string, on: boolean) {
  const set = new Set(node.value.foes ?? [])
  if (on) set.add(id)
  else set.delete(id)
  node.value.foes = set.size ? [...set] : undefined
}
</script>

<template>
  <div class="node">
    <div class="grid">
      <label>id <input v-model="node.id" maxlength="40" /></label>
      <label>目標（冒險筆記上看到的） <input v-model="node.title" maxlength="40" /></label>
      <label>種類
        <select :value="node.kind" @change="setKind(($event.target as HTMLSelectElement).value as StoryNode['kind'])">
          <option v-for="(n, k) in NODE_KINDS" :key="k" :value="k">{{ n }}</option>
        </select>
      </label>
    </div>
    <label class="block">事件描述（觸發時看到的，也會交給 AI） <textarea v-model="node.text" rows="3" maxlength="600" /></label>

    <div class="grid">
      <label>在哪裡
        <select :value="where" @change="setWhere(($event.target as HTMLSelectElement).value as StoryNode['at']['where'])">
          <option v-for="(n, k) in WHERE_NAME" :key="k" :value="k">{{ n }}</option>
        </select>
      </label>
      <label v-if="where !== 'road' && where !== 'side'">{{ where === 'npc' ? '地點（選填：只在這裡）' : '地點' }}
        <select v-model="node.at.location">
          <option v-if="where === 'npc'" :value="undefined">（跟著角色走）</option>
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
      </label>
      <label v-if="where === 'cell'">設施
        <select v-model="node.at.cell">
          <option v-for="c in STORY_CELLS" :key="c" :value="c">{{ cellName(c) }}</option>
        </select>
      </label>
      <label v-if="where === 'dungeon'">哪一層
        <select v-model="node.at.layer">
          <option v-for="l in STORY_LAYERS" :key="l" :value="l">{{ LAYER_NAME[l] }}</option>
        </select>
      </label>
      <label v-if="where === 'side'">哪一種臨時地圖
        <select v-model="node.at.side_map">
          <option :value="undefined">（任何一種）</option>
          <option v-for="k in SIDE_MAPS()" :key="k" :value="k">{{ travelEvents.side_maps[k]!.name }}</option>
        </select>
      </label>
      <label v-if="where === 'npc'">固定 NPC
        <select v-model="node.at.npc">
          <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </label>
    </div>
    <div class="row small">解鎖需要旗標 <FlagInput v-model="requires.flags" placeholder="全部成立才解鎖" /></div>
    <div class="row small">這些旗標成立時不出現 <FlagInput v-model="requires.flags_none" /></div>

    <template v-if="node.kind === 'check' && node.check">
      <div class="row small">
        檢定
        <select v-model="node.check.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
        DC <input v-model.number="node.check.dc" type="number" min="1" max="40" class="num" />
        <span class="muted">（可以描述做法交給 AI 判定；大成功、成功、部分成功都算成功）</span>
      </div>
      <OutcomeEditor v-model="node.success" label="成功" />
      <OutcomeEditor v-model="node.fail" label="失敗" optional />
    </template>

    <template v-else-if="node.kind === 'combat'">
      <div v-for="(g, i) in node.enemies ?? []" :key="i" class="row small">
        <select v-model="g[0]" class="grow">
          <option v-for="e in enemyList" :key="e.id" :value="e.id">{{ e.name }}（{{ e.level }} 級）</option>
        </select>
        ×<input v-model.number="g[1]" type="number" min="1" max="6" class="num" />
        <button class="small" @click="node.enemies!.splice(i, 1)">移除</button>
      </div>
      <button class="small" @click="(node.enemies ??= []).push(['bandit', 1])">＋ 怪物</button>
      <div class="row checks small">
        <span>敵對的固定 NPC：</span>
        <label v-for="n in namedNpcs" :key="n.id" class="check">
          <input type="checkbox" :checked="node.foes?.includes(n.id)" @change="toggleFoe(n.id, ($event.target as HTMLInputElement).checked)" /> {{ n.name }}
        </label>
      </div>
      <OutcomeEditor v-model="node.success" label="勝利" />
      <OutcomeEditor v-model="node.fail" label="落敗或撤退" optional />
    </template>

    <template v-else-if="node.kind === 'choice'">
      <div v-for="(o, i) in node.options ?? []" :key="i" class="option">
        <div class="row small">
          選項 <input v-model="o.label" maxlength="30" />
          <label class="check"><input type="checkbox" :checked="!!o.check" @change="toggleCheck(o, ($event.target as HTMLInputElement).checked)" /> 要檢定</label>
          <template v-if="o.check">
            <select v-model="o.check.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
            DC <input v-model.number="o.check.dc" type="number" min="1" max="40" class="num" />
          </template>
          <button class="small" @click="node.options!.splice(i, 1)">移除選項</button>
        </div>
        <OutcomeEditor v-model="o.success" :label="o.check ? '成功' : '結果'" />
        <OutcomeEditor v-if="o.check" v-model="o.fail" label="失敗" optional />
      </div>
      <button class="small" @click="addOption">＋ 選項</button>
    </template>

    <OutcomeEditor v-else v-model="node.success" label="結果" />
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.node { display: grid; gap: 6px; }
.option { border: 1px dashed var(--border); border-radius: var(--radius); padding: 6px; display: grid; gap: 4px; }
</style>
