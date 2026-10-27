<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { estimateTokens, PROMPT_TARGETS, TARGET_NAME, type PromptEntry, type PromptTarget } from '@/narrator/promptConfig'
import type { TavernPreset, TavernPromptItem } from '@/narrator/tavernPreset'
import { usePrompts, type EntryList } from '@/stores/prompts'
import { useGame } from '@/stores/game'
import AppDialog from './AppDialog.vue'

// 匯入酒館預設：列出預設裡的條目，勾選想要的加到文風或其他提示詞（docs/PROMPTS.md）
const props = defineProps<{ preset: TavernPreset | null }>()
const emit = defineEmits<{ close: [] }>()
const prompts = usePrompts()
const game = useGame()

const picked = reactive(new Set<string>())
const open = ref<string | null>(null)
const onlyEnabled = ref(false)
const targets = ref<PromptTarget[]>(['narration', 'adult'])
const adult = ref(false)
const enable = ref(true)
const merge = ref(false)
const mergeName = ref('')
/** 已經加到哪裡（條目 id → 清單） */
const added = reactive(new Map<string, EntryList[]>())

watch(() => props.preset, (p) => {
  picked.clear()
  added.clear()
  open.value = null
  onlyEnabled.value = false
  merge.value = false
  mergeName.value = p?.name ?? ''
}, { immediate: true })

const items = computed(() => (props.preset?.items ?? []).filter((x) => !onlyEnabled.value || x.enabled))
const chosen = computed(() => (props.preset?.items ?? []).filter((x) => picked.has(x.id)))
const LIST_NAME: Record<EntryList, string> = { styles: '文風', custom: '其他提示詞' }
const HELP = '勾選想要的條目，加到文風或其他提示詞（可以分幾次，加到不同的地方）。{{user}} 會換成主角的名字，註解 {{// …}} 會拿掉；'
  + '其他酒館巨集（{{char}}、{{setvar}}……）遊戲不會處理，會原樣送出，加進來之後記得改掉。'

function toggle(x: TavernPromptItem) {
  if (picked.has(x.id)) picked.delete(x.id)
  else picked.add(x.id)
}
function pickAll(on: boolean) {
  for (const x of items.value) {
    if (on) picked.add(x.id)
    else picked.delete(x.id)
  }
}
function toggleTarget(t: PromptTarget) {
  targets.value = targets.value.includes(t) ? targets.value.filter((x) => x !== t) : PROMPT_TARGETS.filter((x) => x === t || targets.value.includes(x))
}

function entryOf(list: EntryList, name: string, content: string, late: boolean): Omit<PromptEntry, 'id'> {
  return {
    name: name.slice(0, 40),
    content,
    enabled: enable.value,
    targets: [...targets.value],
    ...(list === 'custom' ? { position: late ? 'end' as const : 'system' as const } : {}),
    ...(adult.value ? { adult: true } : {}),
  }
}

function addTo(list: EntryList) {
  const xs = chosen.value
  if (!xs.length) return
  const entries = merge.value
    ? [entryOf(list, mergeName.value.trim() || props.preset!.name, xs.map((x) => x.content).join('\n\n'), xs.every((x) => x.late))]
    : xs.map((x) => entryOf(list, x.name, x.content, x.late))
  const r = prompts.addEntries(list, entries)
  for (const x of xs) added.set(x.id, [...new Set([...(added.get(x.id) ?? []), list])])
  picked.clear()
  game.flash(`已加 ${r.added} 個到${LIST_NAME[list]}${r.skipped ? `，略過 ${r.skipped} 個重複的` : ''}`)
}
</script>

<template>
  <AppDialog :open="!!preset" :title="`匯入酒館預設：${preset?.name ?? ''}`" icon="📥" width="860px" @close="emit('close')">
    <template v-if="preset">
      <p class="small muted">{{ HELP }}</p>
      <div class="row small">
        <label class="check"><input v-model="onlyEnabled" type="checkbox" /> 只顯示預設裡開啟的</label>
        <span class="spacer" />
        <button class="small" @click="pickAll(true)">全選</button>
        <button class="small" @click="pickAll(false)">全不選</button>
      </div>
      <ul class="plain items">
        <li v-for="x in items" :key="x.id" :class="{ off: !x.enabled }">
          <div class="row head">
            <input type="checkbox" :checked="picked.has(x.id)" @change="toggle(x)" />
            <strong class="name" @click="open = open === x.id ? null : x.id">{{ x.name }}</strong>
            <span v-if="!x.enabled" class="tag" title="預設裡沒有開啟">預設關閉</span>
            <span v-if="x.role !== 'system'" class="tag" :title="x.role === 'assistant' ? '酒館以 AI 的身分送出；加進來之後會變成給 AI 的指示' : '酒館以玩家的身分送出'">{{ x.role === 'assistant' ? 'AI' : '使用者' }}</span>
            <span v-if="x.late" class="tag" title="酒館放在聊天紀錄之後；加到其他提示詞時放後段">聊天紀錄之後</span>
            <span v-for="l in added.get(x.id) ?? []" :key="l" class="tag good">已加到{{ LIST_NAME[l] }}</span>
            <span class="small muted">{{ x.content.length }} 字・約 {{ estimateTokens(x.content) }} tokens</span>
            <button class="small tools" @click="open = open === x.id ? null : x.id">{{ open === x.id ? '收起' : '內容' }}</button>
          </div>
          <p v-if="x.macros.length" class="small warn">還有酒館巨集：{{ x.macros.join('、') }}</p>
          <pre v-if="open === x.id" class="content">{{ x.content }}</pre>
        </li>
      </ul>
      <p v-if="!items.length" class="muted small">這份預設沒有可以加的條目。</p>
      <div class="options">
        <div class="row small">
          套用到：
          <label v-for="t in PROMPT_TARGETS" :key="t" class="check"><input type="checkbox" :checked="targets.includes(t)" @change="toggleTarget(t)" /> {{ TARGET_NAME[t] }}</label>
          ｜<label class="check" title="只在設定開啟成人向時送出"><input v-model="adult" type="checkbox" /> 🔞 成人向</label>
          ｜<label class="check"><input v-model="enable" type="checkbox" /> 加進來就開啟</label>
        </div>
        <div class="row small">
          <label class="check"><input v-model="merge" type="checkbox" /> 合併成一個條目</label>
          <input v-if="merge" v-model="mergeName" maxlength="40" placeholder="條目名稱" />
        </div>
        <p class="small muted">「判定」要求 AI 只輸出 JSON，酒館的破甲或格式指示可能讓判定出錯，預設不套用。加到其他提示詞時，酒館放在聊天紀錄之後的條目放後段，其他放前段。</p>
        <div class="row">
          <span class="small muted">已選 {{ chosen.length }} 個</span>
          <span class="spacer" />
          <button class="primary small" :disabled="!chosen.length || !targets.length" @click="addTo('styles')">加到文風</button>
          <button class="primary small" :disabled="!chosen.length || !targets.length" @click="addTo('custom')">加到其他提示詞</button>
          <button class="small" @click="emit('close')">完成</button>
        </div>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.items { display: grid; gap: 4px; max-height: 50vh; overflow: auto; margin: 6px 0; }
.items > li { padding: 4px 6px; border: 1px solid var(--border); border-radius: var(--radius); }
.items > li.off .name { color: var(--muted); }
.head { gap: 6px; flex-wrap: wrap; }
.name { cursor: pointer; }
.tools { margin-left: auto; }
.tag.good { color: var(--good, var(--accent)); }
.warn { color: var(--accent); margin: 2px 0 0; }
.content { white-space: pre-wrap; font-family: inherit; font-size: var(--fs-sm); line-height: 1.6; margin: 6px 0 2px; max-height: 300px; overflow: auto; }
.options { display: grid; gap: 6px; border-top: 1px dashed var(--border); padding-top: 8px; }
.options p { margin: 0; }
label.check { display: inline-flex; gap: 4px; align-items: center; }
.spacer { flex: 1; }
</style>
