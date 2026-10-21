<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { affinityStage } from '@/engine/character'
import { geography, npcs as namedNpcs, stories, type StoryNode } from '@/engine/data'
import { RANK_ORDER } from '@/engine/materialQuests'
import { placeText } from '@/engine/story'
import { builtinStory, flagUsage, NODE_KINDS, newNode, START_KINDS, storyIssues, type StoryMod } from '@/engine/storyMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import EffectsEditor from './EffectsEditor.vue'
import FlagInput from './FlagInput.vue'
import StoryNodeEditor from './StoryNodeEditor.vue'

// 特殊任務的編輯表單：開頭、任務點（依劇情旗標解鎖）、完成報酬；下方檢查任務鏈與旗標的流向
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function current(): StoryMod {
  return clone(content.mods.stories[props.id] ?? (stories.find((s) => s.id === props.id) as StoryMod))
}
const draft = ref<StoryMod>(current())
// 比較時略過空的條件（表單會先建立空的 requires 物件）
const snap = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'requires' && x && !x.flags?.length && !x.flags_none?.length ? undefined : x))
const saved = ref(snap(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = snap(draft.value)
  open.value = 0
})
const dirty = computed(() => snap(draft.value) !== saved.value)
const builtin = computed(() => !!builtinStory(props.id))
const edited = computed(() => builtin.value && !!content.mods.stories[props.id])

const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const startReq = computed(() => (draft.value.start.requires ??= {}))
const open = ref<number | null>(0)
const issues = computed(() => storyIssues(draft.value))
const flags = computed(() => flagUsage(draft.value))
const ICON: Record<StoryNode['kind'], string> = { story: '📜', check: '🎲', combat: '⚔️', choice: '🔀' }

function setsOf(n: StoryNode): string[] {
  const outs = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]
  return [...new Set(outs.flatMap((o) => o?.set_flags ?? []))]
}
function ends(n: StoryNode): string {
  const outs = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]
  return [outs.some((o) => o?.complete) ? '✅' : '', outs.some((o) => o?.fail_quest) ? '❌' : ''].join('')
}
function addNode() {
  draft.value.nodes.push(newNode(draft.value))
  open.value = draft.value.nodes.length - 1
}
function move(i: number, d: number) {
  const list = draft.value.nodes
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  open.value = j
}
function duplicate(i: number) {
  const n = clone(draft.value.nodes[i]!)
  n.id = `${n.id}_copy`
  n.title = `${n.title}（複製）`.slice(0, 40)
  draft.value.nodes.splice(i + 1, 0, n)
  open.value = i + 1
}
function removeNode(i: number) {
  if (!confirm(`刪除任務點「${draft.value.nodes[i]!.title}」？`)) return
  draft.value.nodes.splice(i, 1)
  open.value = null
}
function setStartKind(kind: StoryMod['start']['kind']) {
  draft.value.start = { ...draft.value.start, kind }
  if (kind !== 'npc') delete draft.value.start.min_affinity
  if (kind === 'npc') draft.value.start.npc ??= namedNpcs[0]?.id
  if (kind === 'guild') draft.value.start.location ??= 'soriel'
  if (kind === 'travel') draft.value.start.chance ??= 0.2
  if (kind === 'informant') draft.value.start.price ??= 100
}

function setMinAffinity(v: string) {
  if (v.trim() === '' || !Number.isFinite(Number(v))) delete draft.value.start.min_affinity
  else draft.value.start.min_affinity = Math.max(-100, Math.min(100, Math.round(Number(v))))
}

// ---- 動作 ----
function save() {
  try {
    content.saveStory(props.id, draft.value)
    draft.value = current()
    saved.value = snap(draft.value)
    game.flash(`已儲存「${draft.value.title}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function discard() {
  draft.value = current()
}
function restore() {
  if (!confirm(`把「${draft.value.title}」恢復成內建的樣子？`)) return
  content.restoreStory(props.id)
  draft.value = current()
  saved.value = snap(draft.value)
}
function remove() {
  if (!confirm(`刪除「${draft.value.title}」？進行中的存檔會找不到這個任務。`)) return
  content.deleteStory(props.id)
  emit('deleted')
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.title || '（未命名）' }}</h3>
      <span class="tag">{{ builtin ? (edited ? '內建・已修改' : '內建') : '自建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="discard">放棄修改</button>
      <button v-if="builtin" class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
      <button v-else class="small danger" @click="remove">刪除</button>
    </div>
    <p class="small muted">id：{{ id }}・旗標名稱只用在劇情（存成 story:名稱）；以 ai: 開頭的名稱讀 AI 判定寫下的旗標。</p>

    <fieldset>
      <legend>基本</legend>
      <div class="grid">
        <label>任務名稱 <input v-model="draft.title" maxlength="30" /></label>
        <label>建議等級
          <select v-model="draft.rank">
            <option :value="undefined">（不限）</option>
            <option v-for="r in RANK_ORDER" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
      </div>
      <label class="block">簡介（冒險筆記與接任務時看到） <textarea v-model="draft.summary" rows="2" maxlength="300" /></label>
    </fieldset>

    <fieldset>
      <legend>開頭</legend>
      <div class="grid">
        <label>從哪裡開始
          <select :value="draft.start.kind" @change="setStartKind(($event.target as HTMLSelectElement).value as StoryMod['start']['kind'])">
            <option v-for="(n, k) in START_KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <label v-if="draft.start.kind === 'guild' || draft.start.kind === 'informant'">{{ draft.start.kind === 'guild' ? '哪座城鎮的公會' : '哪座城鎮的情報商' }}
          <select v-model="draft.start.location">
            <option v-if="draft.start.kind === 'informant'" :value="undefined">（任何情報商）</option>
            <option v-for="l in settlements" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </label>
        <label v-if="draft.start.kind === 'npc'">固定 NPC（在身邊時可以接）
          <select v-model="draft.start.npc">
            <option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </label>
        <label v-if="draft.start.kind === 'npc'">親密度至少
          <input
            type="number" min="-100" max="100" placeholder="不限" :value="draft.start.min_affinity ?? ''"
            @input="setMinAffinity(($event.target as HTMLInputElement).value)"
          />
          <span v-if="draft.start.min_affinity !== undefined" class="small muted">（{{ affinityStage(draft.start.min_affinity) }}以上；沒見過面算 0）</span>
        </label>
        <label v-if="draft.start.kind === 'travel'">每段旅程遇到的機率（%）
          <input type="number" min="1" max="100" :value="Math.round((draft.start.chance ?? 0.2) * 100)" @input="draft.start.chance = Number(($event.target as HTMLInputElement).value) / 100" />
        </label>
        <label v-if="draft.start.kind === 'informant'">情報的價格（白鸛幣） <input v-model.number="draft.start.price" type="number" min="0" /></label>
        <label>主角至少幾級 <input v-model.number="draft.start.min_level" type="number" min="1" max="20" placeholder="不限" /></label>
      </div>
      <div v-if="draft.start.kind === 'travel'" class="row checks small">
        <span>只在前往這些地區時（不勾＝任何地區）：</span>
        <label v-for="r in geography.regions" :key="r.id" class="check">
          <input type="checkbox" :checked="draft.start.regions?.includes(r.id)" @change="draft.start.regions = ($event.target as HTMLInputElement).checked ? [...(draft.start.regions ?? []), r.id] : (draft.start.regions ?? []).filter((x) => x !== r.id)" /> {{ r.name }}
        </label>
      </div>
      <label class="block">開頭的事件描述（旅途、情報商、NPC 拜託時看到；沒有時用簡介） <textarea v-model="draft.start.text" rows="2" maxlength="400" /></label>
      <div class="row small">接取需要旗標 <FlagInput v-model="startReq.flags" /></div>
      <div class="row small">這些旗標成立時不出現 <FlagInput v-model="startReq.flags_none" /></div>
      <div class="row small">開始時設定的旗標（任務鏈的第一個旗標） <FlagInput v-model="draft.start_flags" /></div>
    </fieldset>

    <fieldset>
      <legend>任務點（{{ draft.nodes.length }}）</legend>
      <p class="small muted">任務點在解鎖條件（劇情旗標）成立時出現；用結果設定的旗標串起順序與分支。同時解鎖多個任務點時，玩家可以自己選順序。</p>
      <div v-for="(n, i) in draft.nodes" :key="i" class="node-card" :class="{ open: open === i }">
        <div class="row node-head" @click="open = open === i ? null : i">
          <span>{{ ICON[n.kind] }}</span>
          <b class="grow">{{ n.title }}</b>
          <span class="small muted">{{ NODE_KINDS[n.kind] }}・{{ placeText(n) }}</span>
          <span v-for="f in n.requires?.flags ?? []" :key="`r-${f}`" class="tag small">需要 🚩{{ f }}</span>
          <span v-for="f in setsOf(n)" :key="`s-${f}`" class="tag small set">→ 🚩{{ f }}</span>
          <span>{{ ends(n) }}</span>
          <button class="small" title="往上" @click.stop="move(i, -1)">▲</button>
          <button class="small" title="往下" @click.stop="move(i, 1)">▼</button>
          <button class="small" title="複製" @click.stop="duplicate(i)">📄</button>
          <button class="small" title="刪除" @click.stop="removeNode(i)">🗑️</button>
        </div>
        <StoryNodeEditor v-if="open === i" v-model="draft.nodes[i]!" />
      </div>
      <button class="small" @click="addNode">＋ 任務點</button>
    </fieldset>

    <fieldset>
      <legend>完成報酬（獨特報酬）</legend>
      <EffectsEditor v-model="draft.rewards" />
    </fieldset>

    <fieldset>
      <legend>檢查任務鏈</legend>
      <p v-if="!issues.length" class="small">✅ 沒有發現問題。</p>
      <ul v-else class="small warn-text">
        <li v-for="(x, i) in issues" :key="i">{{ x }}</li>
      </ul>
      <table v-if="flags.length" class="flags small">
        <thead><tr><th>旗標</th><th>設定</th><th>清除</th><th>需要它</th><th>需要它不成立</th></tr></thead>
        <tbody>
          <tr v-for="u in flags" :key="u.flag">
            <td>🚩{{ u.flag }}</td>
            <td>{{ u.setBy.join('、') || '—' }}</td>
            <td>{{ u.clearedBy.join('、') || '—' }}</td>
            <td>{{ u.requiredBy.join('、') || '—' }}</td>
            <td>{{ u.blockedBy.join('、') || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.node-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 6px; display: grid; gap: 6px; }
.node-card.open { border-color: var(--accent); }
.node-head { cursor: pointer; gap: 6px; }
.tag.set { border-color: var(--accent); }
.flags { border-collapse: collapse; width: 100%; }
.flags th, .flags td { border-bottom: 1px solid var(--border); padding: 3px 6px; text-align: left; vertical-align: top; }
</style>
