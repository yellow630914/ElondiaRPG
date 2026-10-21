<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatTime } from '@/engine/state'
import { locationById } from '@/engine/data'
import { slotTitle, type SlotMeta } from '@/stores/saves'
import { useGame, type ImportPreview } from '@/stores/game'
import NameTag from './NameTag.vue'
import { download } from './download'

const emit = defineEmits<{ loaded: [] }>()
const game = useGame()
const newName = ref('')
const renaming = ref<string | null>(null)
const renameText = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => game.refreshSlots())

const KIND: Record<SlotMeta['kind'], string> = { manual: '💾 手動', quick: '⚡ 快速', auto: '🔄 自動' }
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

// 匯入：附有自訂內容或形象圖時先讓玩家決定要不要合併、還原（多個檔案時一個一個來）
interface PendingImport { text: string; name: string; preview: ImportPreview }
const queue = ref<PendingImport[]>([])
const pending = computed(() => queue.value[0])
const merge = ref(true)
const take = ref<string[]>([])
const withPortraitsIn = ref(true)
const hasDiff = computed(() => !!pending.value?.preview.diff && (pending.value.preview.diff.added.length + pending.value.preview.diff.changed.length) > 0)

function resetChoices() {
  merge.value = true
  take.value = []
  withPortraitsIn.value = true
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  for (const f of Array.from(input.files ?? [])) {
    const text = await f.text()
    try {
      const preview = game.previewImport(text, f.name)
      const d = preview.diff
      if ((d && d.added.length + d.changed.length) || preview.portraits) queue.value.push({ text, name: f.name, preview })
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
  await game.importFile(p.text, p.name, { merge: hasDiff.value && merge.value, take: take.value, portraits: withPortraitsIn.value })
  queue.value.shift()
  resetChoices()
}

function skipImport() {
  queue.value.shift()
  resetChoices()
}

const listText = (labels: string[]) => labels.length > 12 ? `${labels.slice(0, 12).join('、')} 等 ${labels.length} 項` : labels.join('、')
</script>

<template>
  <div class="saves">
    <section v-if="game.state" class="panel new">
      <div class="row">
        <input v-model="newName" placeholder="存檔名稱（選填，例如：進入蛇溪洞窟前）" maxlength="40" @keydown.enter="saveNew" />
        <button class="primary" @click="saveNew">💾 新增存檔</button>
        <button @click="game.quickSave()">⚡ 快速存檔</button>
        <button @click="exportSlot()">📤 匯出目前進度</button>
      </div>
      <p class="small muted">快捷鍵：F8 或 Ctrl+S 快速存檔，F9 快速讀檔。長休、抵達目的地與讀檔前會自動存檔（保留最近 3 份）。</p>
    </section>

    <div class="row tools">
      <button class="small" @click="fileInput?.click()">📥 匯入存檔檔案</button>
      <input ref="fileInput" type="file" accept=".json,application/json" multiple hidden @change="onFile" />
      <span class="small muted">匯入的存檔會加到列表，不會直接讀取。</span>
    </div>
    <div class="row tools small">
      <span class="muted">匯出時附上：</span>
      <label class="check"><input v-model="withContent" type="checkbox" /> 自訂內容</label>
      <label class="check" title="這一局所有角色的形象圖；圖片很大，檔案會變大很多"><input v-model="withPortraitsOut" type="checkbox" /> 形象圖</label>
    </div>

    <section v-if="pending" class="panel importing">
      <h3>📥 匯入「{{ pending.name }}」</h3>
      <p class="small muted">{{ slotTitle(pending.preview.meta) }}<span v-if="queue.length > 1">（還有 {{ queue.length - 1 }} 個檔案）</span></p>
      <template v-if="hasDiff">
        <label class="check"><input v-model="merge" type="checkbox" /> 合併存檔附上的自訂內容</label>
        <div v-if="merge" class="small merge">
          <p v-if="pending.preview.diff!.added.length">
            會新增（這個瀏覽器沒有）：{{ listText(pending.preview.diff!.added.map((e) => e.label)) }}
          </p>
          <div v-if="pending.preview.diff!.changed.length">
            <p>和這個瀏覽器不同（勾選的換成存檔裡的版本，沒勾的保留你的）：</p>
            <label v-for="e in pending.preview.diff!.changed" :key="e.key" class="check">
              <input v-model="take" type="checkbox" :value="e.key" /> {{ e.label }}
            </label>
          </div>
          <p class="muted">
            <template v-if="pending.preview.diff!.same">相同的 {{ pending.preview.diff!.same }} 項略過；</template>這個瀏覽器其他的自訂內容不會變動。
          </p>
        </div>
        <p v-else class="small warn-text">不合併時，這個存檔用到的自訂怪物、物品、角色或任務可能不會出現或無法使用。</p>
      </template>
      <label v-if="pending.preview.portraits" class="check">
        <input v-model="withPortraitsIn" type="checkbox" /> 還原形象圖（{{ pending.preview.portraits }} 張）
      </label>
      <div class="row">
        <button class="primary" @click="confirmImport">📥 匯入</button>
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
              <span class="muted"> Lv.{{ m.level }}・{{ placeName(m.location) }}・{{ formatTime(m.time) }}・{{ m.party }} 人・{{ m.reports }} 則日誌</span>
            </div>
            <div class="small muted">存於 {{ when(m.savedAt) }}</div>
          </div>
          <div class="actions">
            <button class="small primary" @click="load(m)">📂 讀取</button>
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
.merge { display: grid; gap: 4px; padding-left: 20px; }
.merge .check { display: flex; }
.warn-text { color: var(--danger); }
</style>
