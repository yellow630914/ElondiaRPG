<script setup lang="ts">
import { computed, ref } from 'vue'
import { modTotal, useContent, VANILLA, VANILLA_NAME } from '@/stores/content'
import { useGame } from '@/stores/game'
import { usePrompts } from '@/stores/prompts'
import { dateStamp, download } from './download'
import { confirmDiscard } from './content/unsaved'
import type { BuiltinImportReport } from '@/engine/builtinWorld'
import GameIcon from './ui/GameIcon.vue'

// 世界管理：好幾套自訂內容。開新遊戲時選一個，存檔記住；遊戲進行中不能切換（可以修改它的內容）
const content = useContent()
const game = useGame()
const prompts = usePrompts()
const linked = computed(() => content.worlds.find((w) => w.id === content.active)?.promptSet ?? '')
const locked = computed(() => !!game.state)
const msg = ref('')
/** 訊息的種類：完成（綠）、要注意（黃）、失敗（紅） */
const msgKind = ref<'ok' | 'warn' | 'error'>('ok')

function run(fn: () => void) {
  msg.value = ''
  msgKind.value = 'ok'
  try {
    fn()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : String(e)
    msgKind.value = 'error'
  }
}

async function switchTo(id: string, select?: HTMLSelectElement) {
  // 有未儲存的修改又不放棄：選單換回目前的世界
  if (!(await confirmDiscard())) {
    if (select) select.value = content.active
    return
  }
  run(() => content.switchWorld(id))
}
async function createNew() {
  if (!(await confirmDiscard())) return
  const name = prompt('新世界的名字（從原版開始，沒有任何自訂內容）', '新的世界')
  if (name !== null) run(() => content.switchWorld(content.createWorld(name)))
}
async function duplicate() {
  if (!(await confirmDiscard())) return
  const name = prompt('複製出來的世界叫什麼？', `${content.activeName}（複製）`)
  if (name !== null) run(() => {
    const id = content.createWorld(name, content.active === VANILLA ? undefined : content.active)
    if (!locked.value) content.switchWorld(id)
    else msg.value = `已複製成「${content.worldName(id)}」，回到首頁才能切換過去`
  })
}
function rename() {
  const name = prompt('世界的名字', content.activeName)
  if (name) run(() => content.renameWorld(content.active, name))
}
async function remove() {
  if (!(await confirmDiscard())) return
  if (confirm(`刪除世界「${content.activeName}」？裡面的自訂內容會一起刪掉。用這個世界的存檔，讀檔時會用存檔附上的內容還原（沒有附上時改用原版世界）。`)) run(() => content.deleteWorld(content.active))
}
async function importAsNew(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await file.text()
  if (!(await confirmDiscard())) return
  run(() => {
    const r = content.importWorld(text, file.name.replace(/\.json$/i, ''))
    if (!locked.value) content.switchWorld(r.id)
    const set = r.promptSet ? prompts.sets.find((x) => x.id === r.promptSet)?.name : undefined
    msg.value = `已匯入成新的世界「${content.worldName(r.id)}」${set ? `，提示詞組「${set}」，兩者已綁定` : ''}${r.dropped.length ? `；${r.dropped.length} 個特殊任務有錯誤沒有匯入` : ''}${locked.value ? '（回到首頁才能切換過去）' : ''}`
  })
}
function link(setId: string) {
  run(() => {
    content.linkPromptSet(content.active, setId || undefined)
    if (setId && !locked.value) prompts.switchSet(setId)
  })
}
function exportPackage() {
  run(() => download(`elondia-world-${content.activeName}-${dateStamp()}.json`, content.exportWorld()))
}

// ---- 內建世界：匯出原版的全部內容（zip，附說明），改好之後匯入成新的世界 ----
/** 顯示中的匯入結果（剛匯入的，或世界上記著的那一份） */
const report = ref<{ title: string; data: BuiltinImportReport } | null>(null)
/** 目前的世界是「匯入內建世界」建立的：當時的匯入結果 */
const savedReport = computed(() => content.worlds.find((w) => w.id === content.active)?.importReport)
function showSaved() {
  const r = savedReport.value
  if (!r) return
  report.value = report.value?.data === r ? null : { title: `「${content.activeName}」的匯入紀錄（${new Date(r.at).toLocaleString('zh-TW', { hour12: false })}${r.file ? `，${r.file}` : ''}）`, data: r }
}
function exportBuiltin() {
  run(() => download(`elondia-builtin-world-${dateStamp()}.zip`, content.exportBuiltinWorld(), 'application/zip'))
}
async function importBuiltin(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!(await confirmDiscard())) return
  const name = prompt('匯入成新的世界，叫什麼名字？', file.name.replace(/\.zip$/i, ''))
  if (name === null) return
  report.value = null
  run(() => {
    const r = content.importBuiltinWorld(bytes, name, file.name)
    const unreadable = r.report.lines.find((l) => l.label.startsWith('讀不了'))?.items.length ?? 0
    const bad = unreadable ? `有 ${unreadable} 個檔案讀不了，那幾種全部照原版（見下面的清單）` : ''
    if (!r.id) {
      // 什麼都沒改：不建立世界
      msg.value = `沒有任何改動：zip 裡的內容和內建的一樣，沒有建立新的世界${bad ? `；${bad}` : ''}。`
      msgKind.value = 'warn'
    } else {
      if (!locked.value) content.switchWorld(r.id)
      const where = locked.value ? '（回到首頁才能切換過去）' : ''
      msg.value = bad
        ? `已匯入成新的世界「${content.worldName(r.id)}」：${r.report.summary}。但是${bad}${where}`
        : `已匯入成新的世界「${content.worldName(r.id)}」：${r.report.summary}${where}`
      msgKind.value = bad ? 'warn' : 'ok'
    }
    if (r.report.lines.length) report.value = { title: r.id ? `匯入「${content.worldName(r.id)}」時要注意的地方（之後可以按「📋 匯入紀錄」再看）` : '這次匯入的檢查結果', data: r.report }
  })
}
</script>

<template>
  <section class="panel world-bar">
    <div class="row">
      <strong>🌍 世界</strong>
      <select :value="content.active" :disabled="locked" @change="switchTo(($event.target as HTMLSelectElement).value, $event.target as HTMLSelectElement)">
        <option :value="VANILLA">{{ VANILLA_NAME }}（不能修改）</option>
        <option v-for="w in content.worlds" :key="w.id" :value="w.id">{{ w.name }}（{{ modTotal(w.mods) }} 項自訂內容）</option>
      </select>
      <button class="small" :disabled="locked" @click="createNew">＋ 新的世界</button>
      <button class="small" @click="duplicate">📄 複製這個世界</button>
      <button class="small" :disabled="content.readOnly" @click="rename">✏️ 改名</button>
      <label class="small file" title="世界包（內容＋提示詞）或內容檔">📥 匯入成新的世界<input type="file" accept=".json,application/json" @change="importAsNew" /></label>
      <button class="small" :disabled="content.readOnly" title="這個世界的內容，加上綁定（或目前用）的提示詞組" @click="exportPackage">📦 匯出世界包</button>
      <button class="small" title="原版世界的全部內容（怪物、物品、技能、任務……），一種一個 JSON 檔，附說明（README），包成 zip。改好之後用「匯入內建世界」建立成新的世界" @click="exportBuiltin">📤 匯出內建世界</button>
      <label class="small file" title="匯入改過的內建世界（zip）：只記改過與新增的項目，建立成新的世界；規則和內容編輯器一樣（內建的不能刪除、id 不能改）">📥 匯入內建世界<input type="file" accept=".zip,application/zip" @change="importBuiltin" /></label>
      <button v-if="savedReport" class="small" :class="{ active: report?.data === savedReport }" title="這個世界是「匯入內建世界」建立的：當時改了哪些、被調整的欄位、略過的項目" @click="showSaved">📋 匯入紀錄</button>
      <button class="small danger" :disabled="content.readOnly || locked" title="刪除整個世界和它所有的自訂內容" @click="remove">💥 刪除這個世界</button>
    </div>
    <p class="small muted">
      <template v-if="locked">進行中的遊戲用的是「{{ content.activeName }}」，遊戲中不能切換世界（可以修改它的內容）。回到首頁再切換。</template>
      <template v-else>每個世界是一套自訂內容。開新遊戲時選擇要用哪個世界，存檔會記住它，之後繼續或讀檔會自動切換過去。</template>
    </p>
    <div v-if="!content.readOnly" class="row small">
      綁定的提示詞組
      <select :value="linked" @change="link(($event.target as HTMLSelectElement).value)">
        <option value="">（不綁定：用目前選的）</option>
        <option v-for="p in prompts.sets" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span class="muted">切換到這個世界（開新遊戲、讀檔、繼續）時，提示詞組跟著切換。</span>
    </div>
    <p v-if="msg" class="small note" :class="msgKind" :role="msgKind === 'ok' ? 'status' : 'alert'"><GameIcon v-if="msgKind !== 'ok'" name="caution" :size="14" class="note-icon" />{{ msg }}</p>
    <details v-if="report" class="small report" :class="{ warn: report.data.warn }" open>
      <summary>{{ report.title }}</summary>
      <p class="small">{{ report.data.summary }}</p>
      <p v-if="!report.data.lines.length" class="small muted">沒有要注意的地方。</p>
      <div v-for="l in report.data.lines" :key="l.label" :class="{ bad: l.label.startsWith('讀不了') }">
        <b>{{ l.label }}（{{ l.items.length + (l.more ?? 0) }}）</b>
        <ul><li v-for="(x, i) in l.items" :key="i">{{ x }}</li><li v-if="l.more" class="muted">……還有 {{ l.more }} 項（沒有記下來）</li></ul>
      </div>
      <button class="small" @click="report = null">關閉</button>
    </details>
  </section>
</template>

<style scoped>
.world-bar { display: grid; gap: 6px; }
.world-bar p { margin: 0; }
.row { flex-wrap: wrap; gap: 6px; align-items: center; }
.file { position: relative; cursor: pointer; padding: 2px 8px; border: 1px solid var(--border); border-radius: 6px; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.note { color: var(--accent-2); }
.note.warn { color: var(--accent); }
.note.error { color: var(--danger); font-weight: 600; }
.note-icon { vertical-align: -2px; margin-right: 4px; }
.report ul { margin: 2px 0 6px; padding-left: 1.4em; max-height: 14em; overflow: auto; }
.report p { margin: 2px 0 6px; }
.report.warn > summary, .report .bad > b { color: var(--danger); }
</style>
