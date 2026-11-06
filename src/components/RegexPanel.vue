<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  applyRegex, BUILTIN_REGEX, cleanFlags, defaultRegexRules, hasTavernRegex, importTavernRegex, normalizeRegexRules, regexError,
  REGEX_SCOPE_NAME, REGEX_SCOPES, type RegexRule, type RegexScope,
} from '@/narrator/regex'
import { usePrompts } from '@/stores/prompts'
import { dateStamp, download } from './download'
import Hint from './ui/Hint.vue'

// 正文正則（提示詞與正則頁籤）：AI 寫的日誌正文在顯示、存檔前照這些規則尋找與取代。跟著提示詞組存

const prompts = usePrompts()
const rules = computed(() => prompts.config.regex)

function newRule(): RegexRule {
  return { id: `regex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: '新的規則', enabled: true, find: '', flags: 'g', replace: '', scopes: [...REGEX_SCOPES] }
}
function add() {
  prompts.config.regex.push(newRule())
}
function remove(id: string) {
  const r = rules.value.find((x) => x.id === id)
  if (r && confirm(`刪除「${r.name}」？`)) prompts.config.regex = rules.value.filter((x) => x.id !== id)
}
function move(id: string, dir: -1 | 1) {
  const arr = prompts.config.regex
  const i = arr.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
}
function toggleScope(r: RegexRule, s: RegexScope, on: boolean) {
  const next = on ? [...new Set([...r.scopes, s])] : r.scopes.filter((x) => x !== s)
  r.scopes = REGEX_SCOPES.filter((x) => next.includes(x))
}
const builtinOf = (r: RegexRule) => BUILTIN_REGEX.find((b) => b.builtin === r.builtin)
const edited = (r: RegexRule) => {
  const b = builtinOf(r)
  return !!b && (b.find !== r.find || b.flags !== r.flags || b.replace !== r.replace || b.name !== r.name)
}
function restore(r: RegexRule) {
  const b = builtinOf(r)
  if (b) Object.assign(r, { name: b.name, find: b.find, flags: b.flags, replace: b.replace })
}
/** 被刪掉的內建規則加回來（放在最前面） */
const missingBuiltins = computed(() => BUILTIN_REGEX.filter((b) => !rules.value.some((r) => r.builtin === b.builtin)))
function restoreBuiltins() {
  prompts.config.regex = [...defaultRegexRules().filter((b) => missingBuiltins.value.some((m) => m.builtin === b.builtin)), ...rules.value]
}

// ---- 試試看 ----
const sample = ref('<think_nya>\n喵呼呼～收到人類發來的指令啦！\n</think_nya>\n\n你推開酒館的門，暖黃的燈光撲面而來。')
const sampleScope = ref<RegexScope>('narration')
const sampleOut = computed(() => applyRegex(sample.value, rules.value, sampleScope.value))

// ---- 匯出、匯入 ----
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')
function exportRules() {
  download(`elondia-regex-${dateStamp()}.json`, JSON.stringify({ kind: 'elondia-regex', rules: rules.value }, null, 2))
}
async function importFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  message.value = ''
  let raw: unknown
  try {
    raw = JSON.parse(await f.text())
  } catch {
    message.value = '檔案不是 JSON'
    return
  }
  // 本遊戲匯出的檔案，或酒館的 regex 腳本（單一、陣列、預設或角色卡裡的 regex_scripts）
  const own = raw && typeof raw === 'object' && (raw as { kind?: string }).kind === 'elondia-regex'
  if (own) {
    const list = normalizeRegexRules((raw as { rules?: unknown }).rules).map((r) => ({ ...r, id: `${r.id}-${Date.now().toString(36)}` }))
    const fresh = list.filter((r) => !rules.value.some((x) => x.find === r.find && x.replace === r.replace && x.flags === r.flags))
    prompts.config.regex.push(...fresh.map(({ builtin: _, ...r }) => r))
    message.value = `加入 ${fresh.length} 條規則${list.length > fresh.length ? `（${list.length - fresh.length} 條和現有的相同，略過）` : ''}。`
    return
  }
  if (!hasTavernRegex(raw)) {
    message.value = '檔案裡沒有正則規則（可以匯入本遊戲匯出的檔案，或 SillyTavern 的 regex 腳本、帶 regex_scripts 的預設與角色卡）'
    return
  }
  const res = importTavernRegex(raw)
  prompts.config.regex.push(...res.rules)
  message.value = [
    `從 SillyTavern 轉換了 ${res.rules.length} 條規則。`,
    res.skipped.length ? `略過 ${res.skipped.length} 個：${res.skipped.map((s) => `「${s.name}」${s.why}`).join('；')}。` : '',
    res.notes.length ? `這些設定沒有對應的功能，轉換時拿掉了：${res.notes.join('、')}。` : '',
  ].filter(Boolean).join('\n')
}
</script>

<template>
  <div class="regex">
    <p class="small muted">
      AI 寫的日誌正文在顯示與存檔前，照順序用這些規則尋找與取代。適合清掉自訂預設帶來的雜訊，例如模型在正文裡寫出的 <code>&lt;think_nya&gt;…&lt;/think_nya&gt;</code> 思考區塊。
      規則跟著提示詞組存（切換提示詞組時一起換）。正文寫完時套用一次、存下處理過的文字；寫到一半時畫面上先藏起還沒寫完的思考區塊。已經存下的舊日誌不會重新處理。
    </p>
    <div class="row">
      <button class="primary small" @click="add">＋ 新增規則</button>
      <button class="small" @click="fileInput?.click()">📥 匯入…</button>
      <Hint text="可以匯入本遊戲匯出的正則檔，或 SillyTavern 的 regex 腳本（單一腳本、腳本陣列，或帶 regex_scripts 的預設、角色卡）。酒館的腳本會轉成這裡的格式：只收套用在 AI 輸出的，{{match}} 換成 $&，trimStrings 變成另一條刪除規則；只改送出內容（promptOnly）的略過，深度範圍這類沒有對應功能的設定會拿掉並列出來。" />
      <button class="small" :disabled="!rules.length" @click="exportRules">📤 匯出</button>
      <button v-if="missingBuiltins.length" class="small" @click="restoreBuiltins">↩️ 加回內建規則</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
    </div>
    <p v-if="message" class="small note">{{ message }}</p>
    <p v-if="!rules.length" class="small muted">沒有任何規則：正文照 AI 寫的原樣顯示。</p>

    <article v-for="(r, i) in rules" :key="r.id" class="rule" :class="{ off: !r.enabled }">
      <div class="row head">
        <label class="check"><input v-model="r.enabled" type="checkbox" /></label>
        <input v-model="r.name" class="name" maxlength="60" />
        <span v-if="r.builtin" class="tag">內建</span>
        <span v-if="edited(r)" class="tag">已修改</span>
        <span class="spacer" />
        <button v-if="edited(r)" class="small ghost" title="恢復成內建的內容" @click="restore(r)">↩️</button>
        <button class="small ghost" :disabled="i === 0" title="往上" @click="move(r.id, -1)">▲</button>
        <button class="small ghost" :disabled="i === rules.length - 1" title="往下" @click="move(r.id, 1)">▼</button>
        <button class="small ghost" title="刪除" @click="remove(r.id)">🗑️</button>
      </div>
      <div class="grid">
        <label>尋找（正規表示式）
          <input v-model="r.find" class="mono" spellcheck="false" placeholder="例如 &lt;think&gt;[\s\S]*?&lt;/think&gt;" />
        </label>
        <label class="flags">旗標
          <input :value="r.flags" class="mono" maxlength="5" spellcheck="false" @change="r.flags = cleanFlags(($event.target as HTMLInputElement).value)" />
        </label>
        <label>取代成（留空就是刪掉；可以用 $1、$&amp;）
          <input v-model="r.replace" class="mono" spellcheck="false" />
        </label>
      </div>
      <label v-if="r.trim?.length" class="small trim">取代時，<code>$&amp;</code> 先去掉這些字（酒館的 trimStrings，用「｜」分隔）
        <input :value="r.trim.join('｜')" class="mono" spellcheck="false" @change="r.trim = ($event.target as HTMLInputElement).value.split('｜').filter(Boolean)" />
      </label>
      <div class="row small">
        套用到：
        <label v-for="s in REGEX_SCOPES" :key="s" class="check">
          <input type="checkbox" :checked="r.scopes.includes(s)" @change="toggleScope(r, s, ($event.target as HTMLInputElement).checked)" /> {{ REGEX_SCOPE_NAME[s] }}
        </label>
      </div>
      <p v-if="r.enabled && regexError(r)" class="small bad">⚠ {{ regexError(r) }}（這條規則不會套用）</p>
    </article>

    <details class="try">
      <summary>試試看</summary>
      <div class="row small">
        <label>套用範圍
          <select v-model="sampleScope"><option v-for="s in REGEX_SCOPES" :key="s" :value="s">{{ REGEX_SCOPE_NAME[s] }}</option></select>
        </label>
      </div>
      <div class="cols">
        <label>原文<textarea v-model="sample" rows="6" spellcheck="false" /></label>
        <label>處理後<textarea :value="sampleOut" rows="6" readonly /></label>
      </div>
    </details>
  </div>
</template>

<style scoped>
.regex { display: grid; gap: 10px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.check { display: inline-flex; align-items: center; gap: 4px; }
.rule { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; display: grid; gap: 6px; }
.rule.off { opacity: 0.6; }
.rule .name { flex: 1 1 200px; min-width: 0; font-weight: 600; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) 70px minmax(0, 1fr); gap: 8px; }
.grid label, .cols label { display: grid; gap: 2px; font-size: var(--fs-sm); }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; min-width: 0; }
.tag { font-size: var(--fs-sm); border: 1px solid var(--border); border-radius: 4px; padding: 0 6px; color: var(--muted); }
.bad { color: var(--danger); margin: 0; }
.note { white-space: pre-line; color: var(--accent-2); }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cols textarea { width: 100%; font-family: ui-monospace, Menlo, Consolas, monospace; }
@media (max-width: 720px) {
  .grid { grid-template-columns: minmax(0, 1fr) 70px; }
  .grid label:last-child { grid-column: 1 / -1; }
  .cols { grid-template-columns: 1fr; }
}
</style>
