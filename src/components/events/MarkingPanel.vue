<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, contractDef, slaveryRules } from '@/engine/data'
import type { MarkChoice } from '@/engine/slavery'
import { useGame } from '@/stores/game'
import MarkPicker from '../MarkPicker.vue'

// 刻下契約印記：刻印前還有一次檢定，之後選擇要刻的印記
const game = useGame()
const s = computed(() => game.state!)
const pendingMark = computed(() => s.value.pendingMark!)
const master = computed(() => s.value.party.find((m) => m.isPlayer)?.contract?.masterName || '主人')
const markText = ref('')
const markChoice = ref<MarkChoice>('labor')
function doMarking() {
  void game.perform({ kind: 'marking', text: markText.value })
  markText.value = ''
}
</script>

<template>
  <section class="panel marking">
    <h3>🔥 刻下契約印記</h3>
    <template v-if="!pendingMark.rolled">
      <p class="small">
        {{ master }}打算刻下<strong>{{ contractDef(pendingMark.intended).name }}</strong>：{{ contractDef(pendingMark.intended).mark }}
      </p>
      <p class="small muted">
        刻印前還有一次機會（{{ attrName(slaveryRules.marking.attr) }}檢定）：描述你的態度與做法，AI 會依此決定能選哪些印記，或依你的行為描寫印記的樣子。
        大成功可以自訂印記；失敗會換成更重的印記。
      </p>
      <textarea v-model="markText" rows="2" placeholder="例如：低頭順從，懇求用最輕的印記；或趁刻印師分心時掙扎" />
      <button class="small primary" :disabled="game.judging" @click="doMarking">面對刻印</button>
    </template>
    <template v-else>
      <p v-if="pendingMark.suggestion?.name || pendingMark.suggestion?.mark" class="small mark">
        依你的行為，印記會是：{{ pendingMark.suggestion.name }} {{ pendingMark.suggestion.mark }}
        <span class="muted">（選模板時套用這段名稱與描述，數值依模板）</span>
      </p>
      <p class="small muted">選擇要刻上的印記{{ pendingMark.custom ? '，或自訂' : '' }}：</p>
      <MarkPicker :key="pendingMark.allowed?.join()" v-model="markChoice" :allowed="pendingMark.allowed" :allow-custom="pendingMark.custom" :base="pendingMark.intended" />
      <button class="small primary" @click="game.chooseMark(markChoice)">刻下</button>
    </template>
  </section>
</template>

<style scoped>
.marking { display: grid; gap: 6px; border-color: var(--accent); }
.marking h3, .marking p { margin: 0; }
.marking textarea { width: 100%; }
.mark { color: var(--accent-2); }
</style>
