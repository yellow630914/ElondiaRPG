<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatTime } from '@/engine/state'
import { locationById } from '@/engine/data'
import { slotTitle, type SlotMeta } from '@/stores/saves'
import { useGame, type ImportPreview } from '@/stores/game'
import NameTag from './NameTag.vue'
import { download } from './download'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const emit = defineEmits<{ loaded: [] }>()
const game = useGame()
const newName = ref('')
const renaming = ref<string | null>(null)
const renameText = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => game.refreshSlots())

const KIND: Record<SlotMeta['kind'], string> = { manual: '手動', quick: '快速', auto: '自動' }
const groups = computed(() => [
  { title: '手動存檔', items: game.slots.filter((m) => m.kind === 'manual') },
  { title: '快速存檔與自動存檔', items: game.slots.filter((m) => m.kind !== 'manual') },
])

function placeName(id: string): string {
  try {
    return locationById(id).name
  } catch {
    return id
  }
}

function when(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function saveNew() {
  await game.saveToSlot(newName.value)
  newName.value = ''
}

async function overwrite(m: SlotMeta) {
  if (confirm(`用目前的進度覆寫「${m.name}」？`)) await game.saveToSlot(m.name, m.id)
}

async function load(m: SlotMeta) {
  if (game.state && !confirm(`讀取「${m.name}」？目前的進度會先自動存一份。`)) return
  // 首頁：還沒繼續的遊戲會被蓋掉
  const cur = game.resumeMeta
  if (!game.state && cur && !confirm(`讀取「${m.name}」會蓋掉進行中的遊戲（${slotTitle(cur)}）。\n它會先備份到自動存檔欄位，之後可以再讀回來。確定讀取？`)) return
  await game.loadSlot(m.id)
  if (game.state) emit('loaded')
}

async function remove(m: SlotMeta) {
  if (confirm(`刪除「${m.name}」？這個動作無法復原。`)) await game.deleteSlot(m.id)
}

function startRename(m: SlotMeta) {
  renaming.value = m.id
  renameText.value = m.name
}

async function saveRename(id: string) {
  if (renameText.value.trim()) await game.renameSlot(id, renameText.value)
  renaming.value = null
}

// 匯出的選項：自訂內容（預設附上，通常很小）、這一局的形象圖（圖片很大，預設不附）
const withContent = ref(true)
const withPortraitsOut = ref(false)

async function exportSlot(id?: string) {
  try {
    const file = await game.exportFile(id, { content: withContent.value, portraits: withPortraitsOut.value })
    if (file) download(file.name, file.text)
  } catch (e) {
    game.error = `匯出失敗：${e instanceof Error ? e.message : String(e)}`
  }
}

// 匯入：遊戲中只能匯入同一個世界的存檔；附帶形象圖或會建立新的世界時先讓玩家確認（多個檔案時一個一個來）
interface PendingImport { text: string; name: string; preview: ImportPreview }
const queue = ref<PendingImport[]>([])
const pending = computed(() => queue.value[0])
const withPortraitsIn = ref(true)

function resetChoices() {
  withPortraitsIn.value = true
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  for (const f of Array.from(input.files ?? [])) {
    const text = await f.text()
    try {
      const preview = game.previewImport(text, f.name)
      if (preview.blocked) game.error = `匯入失敗：${preview.blocked}`
      else if (preview.newWorld || preview.portraits) queue.value.push({ text, name: f.name, preview })
      else await game.importFile(text, f.name)
    } catch (err) {
      game.error = `匯入失敗：${err instanceof Error ? err.message : String(err)}`
    }
  }
  input.value = ''
  resetChoices()
}

async function confirmImport() {
  const p = pending.value
  if (!p) return
  await game.importFile(p.text, p.name, { portraits: withPortraitsIn.value })
  queue.value.shift()
  resetChoices()
}

function skipImport() {
  queue.value.shift()
  resetChoices()
}

</script>

<template>
  <div class="saves">
    <section v-if="game.state" class="panel new">
      <div class="row">
        <input v-model="newName" placeholder="存檔名稱（選填，例如：進入蛇溪洞窟前）" maxlength="40" @keydown.enter="saveNew" />
        <button class="primary" @click="saveNew"><GameIcon name="save" :size="15" /> 新增存檔</button>
        <button @click="game.quickSave()"><GameIcon name="zap" :size="15" /> 快速存檔</button>
        <button @click="exportSlot()"><GameIcon name="upload" :size="15" /> 匯出目前進度</button>
        <Hint text="快捷鍵：F8 或 Ctrl+S 快速存檔，F9 快速讀檔。長休、抵達目的地與讀檔前會自動存檔（保留最近 3 份）。" />
      </div>
    </section>

    <div class="row tools">
      <button class="small" @click="fileInput?.click()"><GameIcon name="download" :size="13" /> 匯入存檔檔案</button>
      <input ref="fileInput" type="file" accept=".json,application/json" multiple hidden @change="onFile" />
      <Hint text="匯入的存檔會加到列表，不會直接讀取。遊戲中只能匯入同一個世界的存檔，其他世界的請回首頁匯入。" />
    </div>
    <div class="row tools small">
      <span class="muted">匯出時附上：</span>
      <label class="check"><input v-model="withContent" type="checkbox" /> 自訂內容</label>
      <label class="check" title="這一局所有角色目前的形象圖與日誌插圖（不含舊版）；圖片很大，檔案會變大很多"><input v-model="withPortraitsOut" type="checkbox" /> 形象圖與插圖</label>
    </div>

    <section v-if="pending" class="panel importing">
      <h3 class="head"><GameIcon name="download" :size="16" />匯入「{{ pending.name }}」</h3>
      <p class="small muted">{{ slotTitle(pending.preview.meta) }}<span v-if="queue.length > 1">（還有 {{ queue.length - 1 }} 個檔案）</span></p>
      <p v-if="pending.preview.newWorld" class="small">
        <GameIcon name="world" :size="13" /> 這個存檔用的世界「{{ pending.preview.world?.name ?? '沒有記錄' }}」和這個瀏覽器的不同（或不存在）：會用存檔附帶的自訂內容建立新的世界「{{ pending.preview.newWorld }}」，存檔改用它。目前的世界不會變動。
      </p>
      <label v-if="pending.preview.portraits" class="check">
        <input v-model="withPortraitsIn" type="checkbox" /> 還原形象圖與插圖（{{ pending.preview.portraits }} 張）
      </label>
      <div class="row">
        <button class="primary" @click="confirmImport"><GameIcon name="download" :size="15" /> 匯入</button>
        <button @click="skipImport">取消</button>
      </div>
    </section>

    <p v-if="!game.slots.length" class="muted">還沒有任何存檔。</p>

    <section v-for="g in groups" v-show="g.items.length" :key="g.title">
      <h3 class="small muted">{{ g.title }}</h3>
      <ul class="plain">
        <li v-for="m in g.items" :key="m.id" class="slot">
          <div class="info">
            <div class="row">
              <span class="tag">{{ KIND[m.kind] }}</span>
              <template v-if="renaming === m.id">
                <input v-model="renameText" maxlength="40" @keydown.enter="saveRename(m.id)" />
                <button class="small" @click="saveRename(m.id)">確定</button>
              </template>
              <strong v-else>{{ m.name }}</strong>
            </div>
            <div class="small">
              <NameTag :name="m.pcName" :race="m.race" :cls="m.cls" />
              <span class="muted"> Lv.{{ m.level }}・{{ placeName(m.location) }}・{{ formatTime(m.time) }}・{{ m.party }} 人・{{ m.reports }} 則日誌<template v-if="m.world">・世界：{{ m.world }}</template></span>
            </div>
            <div class="small muted">存於 {{ when(m.savedAt) }}</div>
          </div>
          <div class="actions">
            <button class="small primary" @click="load(m)"><GameIcon name="folder" :size="13" /> 讀取</button>
            <button v-if="game.state && m.kind === 'manual'" class="small" @click="overwrite(m)">覆寫</button>
            <button v-if="m.kind === 'manual'" class="small" @click="startRename(m)">改名</button>
            <button class="small" @click="exportSlot(m.id)">匯出</button>
            <button class="small danger" @click="remove(m)">刪除</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 6px; }
.head :deep(.game-icon) { color: var(--accent); }
button :deep(.game-icon) { vertical-align: -0.2em; }
.saves { display: grid; gap: 10px; }
.new input { flex: 1; min-width: 200px; }
.new p { margin: 6px 0 0; }
.slot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.info { display: grid; gap: 2px; }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
h3 { margin: 6px 0 2px; }
.check { display: inline-flex; gap: 4px; align-items: center; }
.importing { display: grid; gap: 6px; border-color: var(--accent); }
.importing h3 { margin: 0; }
.importing p { margin: 0; }
.warn-text { color: var(--danger); }
</style>
