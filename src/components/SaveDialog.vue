<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatTime } from '@/engine/state'
import { locationById } from '@/engine/data'
import type { SlotMeta } from '@/stores/saves'
import { useGame } from '@/stores/game'
import NameTag from './NameTag.vue'

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

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  // 有些瀏覽器要把連結放進頁面裡，檔名才會生效
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportSlot(id?: string) {
  const file = await game.exportFile(id)
  if (file) download(file.name, file.text)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  for (const f of Array.from(input.files ?? [])) await game.importFile(await f.text(), f.name)
  input.value = ''
}
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
</style>
