<script setup lang="ts">
import { ref } from 'vue'
import { combatRules, progression } from '@/engine/data'
import { useGame } from '@/stores/game'

const emit = defineEmits<{ settings: [] }>()
const game = useGame()

const name = ref('')
const race = ref('human')
const classId = ref('fighter')
const classes = progression.classes.filter((c) => combatRules.classes[c.id])
const importText = ref('')
const importError = ref('')

function start() {
  game.start(name.value.trim() || '旅人', race.value, classId.value)
}

function doImport() {
  importError.value = ''
  try {
    game.importSave(importText.value)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <section class="panel">
    <h2>建立角色</h2>
    <p class="muted small">你將以 F 級冒險者的身分，從聖環教廷所在的索里耶爾出發。</p>
    <div class="form">
      <label>名字 <input v-model="name" placeholder="旅人" maxlength="20" /></label>
      <label>
        種族
        <select v-model="race">
          <option v-for="r in progression.races" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label>
        職業
        <select v-model="classId">
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
    </div>
    <div class="row">
      <button class="primary" @click="start">開始冒險</button>
      <button @click="emit('settings')">AI 設定</button>
    </div>
  </section>

  <details class="panel">
    <summary>匯入存檔</summary>
    <textarea v-model="importText" rows="5" placeholder="貼上匯出的存檔 JSON" style="width: 100%; margin-top: 8px" />
    <div class="row">
      <button :disabled="!importText" @click="doImport">匯入</button>
      <span v-if="importError" class="small" style="color: var(--danger)">{{ importError }}</span>
    </div>
  </details>
</template>

<style scoped>
.form { display: grid; gap: 10px; max-width: 320px; margin: 12px 0; }
.form label { display: grid; gap: 4px; }
</style>
