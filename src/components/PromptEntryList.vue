<script setup lang="ts">
import { computed, ref } from 'vue'
import { estimateTokens, TARGET_NAME, type PromptEntry, type PromptTarget } from '@/narrator/promptConfig'
import { useGame } from '@/stores/game'
import { usePrompts, type EntryList } from '@/stores/prompts'
import { dateStamp, download } from './download'

const props = defineProps<{ list: EntryList }>()
const prompts = usePrompts()
const game = useGame()
const fileInput = ref<HTMLInputElement | null>(null)
const label = computed(() => (props.list === 'styles' ? '文風' : '提示詞'))

function exportList(onlyEnabled: boolean) {
  const name = props.list === 'styles' ? 'styles' : 'prompts'
  download(`elondia-${name}${onlyEnabled ? '-enabled' : ''}-${dateStamp()}.json`, prompts.exportEntries(props.list, onlyEnabled))
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  let added = 0
  let skipped = 0
  try {
    for (const f of files) {
      const r = prompts.importEntries(props.list, await f.text(), f.name)
      added += r.added
      skipped += r.skipped
    }
    game.flash(`已匯入 ${added} 個${label.value}${skipped ? `，略過 ${skipped} 個重複的` : ''}`)
  } catch (err) {
    game.error = `匯入${label.value}失敗：${err instanceof Error ? err.message : String(err)}`
  }
}
const entries = computed(() => prompts.config[props.list])
const open = ref<string | null>(null)
const TARGETS: PromptTarget[] = ['narration', 'judge']

function toggleTarget(e: PromptEntry, t: PromptTarget) {
  e.targets = e.targets.includes(t) ? e.targets.filter((x) => x !== t) : [...e.targets, t]
}

function add() {
  open.value = prompts.addEntry(props.list).id
}

function remove(e: PromptEntry) {
  if (confirm(`刪除「${e.name}」？`)) prompts.removeEntry(props.list, e.id)
}

function changed(e: PromptEntry): boolean {
  const p = prompts.presetOf(props.list, e)
  return !!p && (p.content !== e.content || p.name !== e.name)
}
</script>

<template>
  <ul class="plain entries">
    <li v-for="(e, i) in entries" :key="e.id" :class="{ off: !e.enabled }">
      <div class="head row">
        <label class="switch" :title="e.enabled ? '已開啟' : '已關閉'"><input v-model="e.enabled" type="checkbox" /></label>
        <span class="order small muted">#{{ i + 1 }}</span>
        <strong class="name" @click="open = open === e.id ? null : e.id">{{ e.name || '未命名' }}</strong>
        <span v-for="t in TARGETS" :key="t" class="tag" :class="{ dim: !e.targets.includes(t) }">{{ TARGET_NAME[t] }}</span>
        <span v-if="list === 'custom'" class="tag">{{ (e.position ?? 'system') === 'system' ? '前段' : '後段' }}</span>
        <span v-if="e.preset" class="tag" :title="changed(e) ? '內建條目，已修改' : '內建條目'">內建{{ changed(e) ? '・已改' : '' }}</span>
        <span class="small muted">{{ e.content.length }} 字・約 {{ estimateTokens(e.content) }} tokens</span>
        <span class="tools row">
          <button class="small" :disabled="i === 0" title="往前" @click="prompts.moveEntry(list, e.id, -1)">↑</button>
          <button class="small" :disabled="i === entries.length - 1" title="往後" @click="prompts.moveEntry(list, e.id, 1)">↓</button>
          <button class="small" @click="open = open === e.id ? null : e.id">{{ open === e.id ? '收起' : '✏️ 編輯' }}</button>
        </span>
      </div>
      <div v-if="open === e.id" class="editor">
        <label>名稱 <input v-model="e.name" maxlength="40" /></label>
        <div class="row small">
          套用到：
          <label v-for="t in TARGETS" :key="t" class="check"><input type="checkbox" :checked="e.targets.includes(t)" @change="toggleTarget(e, t)" /> {{ TARGET_NAME[t] }}</label>
          <template v-if="list === 'custom'">
            ｜位置：
            <label class="check"><input v-model="e.position" type="radio" value="system" /> 前段（常駐，可快取）</label>
            <label class="check"><input v-model="e.position" type="radio" value="end" /> 後段（每次請求的最後）</label>
          </template>
        </div>
        <textarea v-model="e.content" rows="8" placeholder="寫給 AI 的指示。可以用 {{player}} 代表主角名字。" />
        <div class="row">
          <button class="small" @click="prompts.duplicateEntry(list, e.id)">複製</button>
          <button v-if="e.preset" class="small" :disabled="!changed(e)" @click="prompts.restoreEntry(list, e.id)">恢復原文</button>
          <button class="small danger" @click="remove(e)">刪除</button>
        </div>
      </div>
    </li>
  </ul>
  <p v-if="!entries.length" class="muted small">還沒有任何條目。</p>
  <div class="row">
    <button class="primary small" @click="add">＋ 新增{{ list === 'styles' ? '文風' : '提示詞' }}</button>
    <button class="small" @click="prompts.restorePresets(list)">加回刪掉的內建條目</button>
    <span class="spacer" />
    <button class="small" @click="exportList(false)">📤 匯出全部</button>
    <button class="small" :disabled="!entries.some((e) => e.enabled)" @click="exportList(true)">📤 只匯出開啟的</button>
    <button class="small" title="本遊戲匯出的 JSON，或純文字／Markdown（整份當一個條目，檔名當名稱）" @click="fileInput?.click()">📥 匯入</button>
    <input ref="fileInput" type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" multiple hidden @change="onImport" />
  </div>
  <p class="small muted">匯入的條目加在清單最後，名稱和內容都相同的會略過；也可以匯入 .txt 或 .md 檔，整份當作一個{{ label }}。</p>
</template>

<style scoped>
.entries > li.off .name { color: var(--muted); }
.head { gap: 6px; }
.name { cursor: pointer; }
.order { min-width: 2em; }
.tools { margin-left: auto; gap: 4px; }
.tag.dim { opacity: 0.35; text-decoration: line-through; }
.editor { display: grid; gap: 8px; margin: 8px 0 4px; }
.editor label { display: grid; gap: 4px; }
.editor label.check { display: inline-flex; gap: 4px; align-items: center; }
.editor textarea { width: 100%; font-family: inherit; line-height: 1.6; }
.switch input { width: 16px; height: 16px; }
.spacer { flex: 1; }
</style>
