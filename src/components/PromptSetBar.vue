<script setup lang="ts">
import { ref } from 'vue'
import { usePrompts } from '@/stores/prompts'

// 提示詞管理：好幾組提示詞（文風、其他提示詞、世界書的修改），隨時可以切換
const prompts = usePrompts()
const msg = ref('')

function run(fn: () => void) {
  msg.value = ''
  try {
    fn()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : String(e)
  }
}
function createNew() {
  const name = prompt('新提示詞組的名字（從預設內容開始）', '新的提示詞組')
  if (name !== null) run(() => prompts.switchSet(prompts.createSet(name)))
}
function duplicate() {
  const name = prompt('複製出來的提示詞組叫什麼？', `${prompts.activeName}（複製）`)
  if (name !== null) run(() => prompts.switchSet(prompts.createSet(name, prompts.active)))
}
function rename() {
  const name = prompt('提示詞組的名字', prompts.activeName)
  if (name) run(() => prompts.renameSet(prompts.active, name))
}
function remove() {
  if (confirm(`刪除提示詞組「${prompts.activeName}」？`)) run(() => prompts.deleteSet(prompts.active))
}
</script>

<template>
  <section class="panel set-bar">
    <div class="row">
      <strong>🧩 提示詞組</strong>
      <select :value="prompts.active" @change="prompts.switchSet(($event.target as HTMLSelectElement).value)">
        <option v-for="x in prompts.sets" :key="x.id" :value="x.id">{{ x.name }}</option>
      </select>
      <button class="small" @click="createNew">＋ 新的一組</button>
      <button class="small" @click="duplicate">📄 複製這一組</button>
      <button class="small" @click="rename">✏️ 改名</button>
      <button class="small danger" :disabled="prompts.sets.length <= 1" @click="remove">🗑️ 刪除</button>
    </div>
    <p class="small muted">每一組有自己的文風、其他提示詞與世界書的修改，隨時可以切換（遊戲中也可以），下一次呼叫 AI 就用新的一組。</p>
    <p v-if="msg" class="small warn-text">{{ msg }}</p>
  </section>
</template>

<style scoped>
.set-bar { display: grid; gap: 6px; }
.set-bar p { margin: 0; }
.row { flex-wrap: wrap; gap: 6px; align-items: center; }
</style>
