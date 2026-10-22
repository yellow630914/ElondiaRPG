<script setup lang="ts">
import { computed, ref } from 'vue'
import { modTotal, useContent, VANILLA, VANILLA_NAME } from '@/stores/content'
import { useGame } from '@/stores/game'

// 世界管理：好幾套自訂內容。開新遊戲時選一個，存檔記住；遊戲進行中不能切換（可以修改它的內容）
const content = useContent()
const game = useGame()
const locked = computed(() => !!game.state)
const msg = ref('')

function run(fn: () => void) {
  msg.value = ''
  try {
    fn()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : String(e)
  }
}

function switchTo(id: string) {
  run(() => content.switchWorld(id))
}
function createNew() {
  const name = prompt('新世界的名字（從原版開始，沒有任何自訂內容）', '新的世界')
  if (name !== null) run(() => content.switchWorld(content.createWorld(name)))
}
function duplicate() {
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
function remove() {
  if (confirm(`刪除世界「${content.activeName}」？裡面的自訂內容會一起刪掉。用這個世界的存檔，讀檔時會用存檔附上的內容還原（沒有附上時改用原版世界）。`)) run(() => content.deleteWorld(content.active))
}
async function importAsNew(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await file.text()
  run(() => {
    const id = content.importMods(text, file.name.replace(/\.json$/i, ''))!
    if (!locked.value) content.switchWorld(id)
    msg.value = `已匯入成新的世界「${content.worldName(id)}」${locked.value ? '（回到首頁才能切換過去）' : ''}`
  })
}
</script>

<template>
  <section class="panel world-bar">
    <div class="row">
      <strong>🌍 世界</strong>
      <select :value="content.active" :disabled="locked" @change="switchTo(($event.target as HTMLSelectElement).value)">
        <option :value="VANILLA">{{ VANILLA_NAME }}（不能修改）</option>
        <option v-for="w in content.worlds" :key="w.id" :value="w.id">{{ w.name }}（{{ modTotal(w.mods) }} 項自訂內容）</option>
      </select>
      <button class="small" :disabled="locked" @click="createNew">＋ 新的世界</button>
      <button class="small" @click="duplicate">📄 複製這個世界</button>
      <button class="small" :disabled="content.readOnly" @click="rename">✏️ 改名</button>
      <label class="small file">📥 匯入成新的世界<input type="file" accept=".json,application/json" @change="importAsNew" /></label>
      <button class="small danger" :disabled="content.readOnly || locked" @click="remove">🗑️ 刪除</button>
    </div>
    <p class="small muted">
      <template v-if="locked">進行中的遊戲用的是「{{ content.activeName }}」，遊戲中不能切換世界（可以修改它的內容）。回到首頁再切換。</template>
      <template v-else>每個世界是一套自訂內容。開新遊戲時選擇要用哪個世界，存檔會記住它，之後繼續或讀檔會自動切換過去。</template>
    </p>
    <p v-if="content.readOnly" class="small warn-text">原版世界不能修改：要自訂內容，先建立或複製一個世界。</p>
    <p v-if="msg" class="small note">{{ msg }}</p>
  </section>
</template>

<style scoped>
.world-bar { display: grid; gap: 6px; }
.world-bar p { margin: 0; }
.row { flex-wrap: wrap; gap: 6px; align-items: center; }
.file { position: relative; cursor: pointer; padding: 2px 8px; border: 1px solid var(--border); border-radius: 6px; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.note { color: var(--accent-2); }
</style>
