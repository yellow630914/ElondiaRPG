<script setup lang="ts">
import { computed, ref } from 'vue'
import { geography, npcs as namedNpcs } from '@/engine/data'
import { CONTENT_TAG_IDS, CONTENT_TAGS, tagsAllowed } from '@/engine/content'
import { GEN_KINDS, type GenKind } from '@/engine/questGen'
import { START_KINDS } from '@/engine/storyMods'
import type { StoryDef } from '@/engine/data'
import { MOD_SECTION_NAMES, useContent } from '@/stores/content'
import { useQuestGen } from '@/stores/questGen'
import { useSettings } from '@/stores/settings'
import AppDialog from '../AppDialog.vue'
import StoryGraph from './StoryGraph.vue'

// 特殊任務生成器（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4c）：描述 → 大綱（可以改）→ 完整內容 → 預覽 → 加入世界。
// 數值、id、旗標前綴、格子由程式決定（engine/questGen.ts）；檢查在沙盒裡做，有錯誤時自動交回 AI 修。
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [string] }>()
const gen = useQuestGen()
const content = useContent()
const settings = useSettings()

const ready = computed(() => settings.ready('designer'))
const source = computed(() => settings.sourceFor('designer'))
const tagOptions = CONTENT_TAG_IDS.filter((t) => tagsAllowed([t]))
const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const npcName = (id: string) => namedNpcs.find((n) => n.id === id)?.name ?? id
const npcPick = ref('')
function addNpc() {
  const v = npcPick.value.trim()
  const n = namedNpcs.find((x) => x.id === v || x.name === v)
  if (n && !gen.input.npcs?.includes(n.id)) gen.input.npcs = [...(gen.input.npcs ?? []), n.id]
  npcPick.value = ''
}
function removeNpc(id: string) {
  gen.input.npcs = (gen.input.npcs ?? []).filter((x) => x !== id)
}
function toggleTag(t: string, on: boolean) {
  gen.input.tags = on ? [...new Set([...gen.input.tags, t])] : gen.input.tags.filter((x) => x !== t)
}

const step = computed(() => (gen.result ? 'result' : gen.outline ? 'outline' : 'input'))
const story = computed(() => (gen.result ? (gen.result.mods.stories?.[gen.result.gen.storyId] as StoryDef | undefined) : undefined))
/** 新增的東西（任務以外），依種類 */
const added = computed(() => {
  const m = gen.result?.mods
  if (!m) return []
  return (Object.keys(GEN_KINDS) as GenKind[])
    .map((k) => ({ k, name: MOD_SECTION_NAMES[k], items: Object.entries((m[k] ?? {}) as Record<string, { name?: string }>).map(([id, v]) => v.name ?? id) }))
    .filter((g) => g.items.length)
})
const BUSY: Record<string, string> = { outline: '正在寫大綱…', full: '正在寫完整的任務…', fix: '檢查有錯誤，正在請 AI 修正…' }

function accept() {
  const id = gen.accept()
  if (id) emit('created', id)
}
function backToOutline() {
  gen.result = null
  gen.raw = ''
}
function startOver() {
  gen.reset()
}
</script>

<template>
  <AppDialog :open="open" title="AI 編排特殊任務" icon="✨" width="900px" @close="emit('close')">
    <div class="gen">
      <p v-if="!ready" class="small warn-text">還沒有設定「世界設計」的模型來源：到「設定 → AI」設定模型來源，並在「功能」表格把「世界設計」指到它。</p>
      <p v-else class="small muted">
        模型來源：{{ source.name }}（{{ source.config.model || source.provider }}）。結果加進目前的世界「{{ content.activeName }}」{{ content.readOnly ? '（原版世界：會自動建立你的世界）' : '' }}，之後可以在編輯器繼續改。
      </p>

      <!-- ① 輸入 -->
      <template v-if="step === 'input'">
        <div v-if="gen.drafts.length" class="row small">
          草稿
          <button v-for="d in gen.drafts" :key="d.id" class="small" :title="new Date(d.at).toLocaleString()" @click="gen.openDraft(d.id)">{{ d.title }}</button>
        </div>
        <label class="field">
          <span>描述這個任務 <b class="warn-text">*</b></span>
          <textarea v-model="gen.input.prompt" rows="5" placeholder="例如：索里耶爾港口的燈塔守夜人其實是走私集團的眼線，主角要決定揭發他還是收下封口費。" />
        </label>
        <div class="pins small">
          <label>開頭方式
            <select v-model="gen.input.startKind">
              <option :value="undefined">交給 AI</option>
              <option v-for="(name, k) in START_KINDS" :key="k" :value="k">{{ name }}</option>
            </select>
          </label>
          <label>地點
            <select v-model="gen.input.location">
              <option :value="undefined">交給 AI</option>
              <option v-for="l in settlements" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
          </label>
          <label>建議等級 <input v-model.number="gen.input.level" type="number" min="1" max="20" placeholder="5" /></label>
          <label>任務點最多 <input v-model.number="gen.input.maxNodes" type="number" min="2" max="12" /> 個</label>
        </div>
        <div class="row small">
          要用的現有角色
          <input v-model="npcPick" list="gen-npcs" placeholder="名字或 id" @keydown.enter.prevent="addNpc" />
          <datalist id="gen-npcs"><option v-for="n in namedNpcs" :key="n.id" :value="n.id">{{ n.name }}</option></datalist>
          <button class="small" @click="addNpc">加入</button>
          <span v-for="id in gen.input.npcs ?? []" :key="id" class="tag">{{ npcName(id) }} <button class="link" @click="removeNpc(id)">✕</button></span>
        </div>
        <div class="row small">
          內容標籤
          <label v-for="t in tagOptions" :key="t" class="check" :title="CONTENT_TAGS[t].desc">
            <input type="checkbox" :checked="gen.input.tags.includes(t)" @change="toggleTag(t, ($event.target as HTMLInputElement).checked)" /> {{ CONTENT_TAGS[t].name }}
          </label>
        </div>
        <div class="row small">
          允許新增
          <label v-for="(name, k) in GEN_KINDS" :key="k" class="check"><input v-model="gen.input.allow[k]" type="checkbox" /> {{ name }}</label>
          <label class="check" title="效果「主角淪為奴隸」"><input v-model="gen.input.enslave" type="checkbox" /> 主角淪為奴隸</label>
        </div>
        <p class="small muted">先看大綱（便宜），方向對了再寫完整的任務。完成報酬、物品價格、怪物與技能的數值上限、NPC 的雇用價由程式依建議等級決定。</p>
      </template>

      <!-- ② 大綱 -->
      <template v-else-if="step === 'outline'">
        <p class="small muted">這是 AI 的大綱，可以直接改文字（加減任務點、改分支、改名字），再照它寫完整的任務。</p>
        <textarea v-model="gen.outline" rows="16" class="mono" />
      </template>

      <!-- ③ 預覽 -->
      <template v-else-if="gen.result && story">
        <StoryGraph :def="story" />
        <div class="cols small">
          <div>
            <h4>📜 {{ story.title }}</h4>
            <p class="muted">{{ story.summary }}</p>
            <h4>新增的東西</h4>
            <p v-if="!added.length" class="muted">（只引用現有的內容）</p>
            <p v-for="g in added" :key="g.k">{{ g.name }}：{{ g.items.join('、') }}</p>
            <template v-if="gen.result.gen.notes">
              <h4>AI 的設計說明</h4>
              <p class="pre">{{ gen.result.gen.notes }}</p>
            </template>
          </div>
          <div>
            <p v-if="!gen.result.errors.length" class="ok">✅ 檢查通過</p>
            <p v-for="e in gen.result.errors" :key="e" class="warn-text">⛔ {{ e }}</p>
            <p v-for="w in gen.result.warnings" :key="w" class="warn-text">⚠ {{ w }}</p>
            <p v-for="a in gen.result.gen.adjusted" :key="a">🔧 {{ a }}</p>
            <p v-for="d in gen.result.gen.dropped" :key="d" class="muted">✂ {{ d }}</p>
          </div>
        </div>
      </template>

      <p v-if="gen.error" class="small warn-text">{{ gen.error }}</p>
      <p v-if="gen.busy" class="small">⏳ {{ BUSY[gen.busy] }} <button class="small" @click="gen.cancel()">停止</button></p>
      <p v-if="gen.spent.calls" class="small muted">這次用了 {{ gen.spent.calls }} 次呼叫、輸入 {{ gen.spent.input.toLocaleString() }}、輸出 {{ gen.spent.output.toLocaleString() }} token</p>

      <div class="row foot">
        <button v-if="step !== 'input'" class="small" :disabled="!!gen.busy" @click="startOver">重來</button>
        <span class="spacer" />
        <template v-if="step === 'input'">
          <button class="small" :disabled="!ready || !gen.input.prompt.trim() || !!gen.busy" title="不看大綱，直接寫完整的任務" @click="gen.generate()">直接生成</button>
          <button class="small primary" :disabled="!ready || !gen.input.prompt.trim() || !!gen.busy" @click="gen.makeOutline()">① 先看大綱</button>
        </template>
        <template v-else-if="step === 'outline'">
          <button class="small" :disabled="!!gen.busy" @click="gen.makeOutline()">重寫大綱</button>
          <button class="small primary" :disabled="!gen.outline.trim() || !!gen.busy" @click="gen.generate()">② 照大綱生成</button>
        </template>
        <template v-else>
          <button class="small" :disabled="!!gen.busy" @click="backToOutline">回到大綱</button>
          <button class="small" :disabled="!!gen.busy" @click="gen.generate()">重新生成</button>
          <button v-if="gen.result?.errors.length" class="small" :disabled="!!gen.busy" @click="gen.fixAgain()">請 AI 再修一次</button>
          <button class="small primary" :disabled="!!gen.busy || !!gen.result?.errors.length" :title="gen.result?.errors.length ? '有錯誤，不能加入（請 AI 再修一次、改大綱重新生成）' : ''" @click="accept">加入世界</button>
        </template>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.gen { display: grid; gap: 8px; }
.gen p { margin: 0; }
.field { display: grid; gap: 4px; }
.pins { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.pins input[type='number'] { width: 4.5em; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.check { display: inline-flex; gap: 3px; align-items: center; }
.link { background: none; border: none; padding: 0 2px; cursor: pointer; color: inherit; }
.mono { font-family: inherit; width: 100%; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
.cols h4 { margin: 6px 0 2px; }
.pre { white-space: pre-wrap; }
.ok { color: var(--accent); }
.warn-text { color: var(--danger); }
.spacer { flex: 1; }
.foot { border-top: 1px solid var(--border); padding-top: 6px; }
textarea { width: 100%; box-sizing: border-box; }
</style>
