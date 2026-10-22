<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName } from '@/engine/data'
import { currentCell } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { overcomablePerks, trainablePerks } from '@/engine/perks'
import { useGame } from '@/stores/game'

// 受訓：在這個設施花錢、花時間學特質（data/rules/perks.json 的 train）
const game = useGame()
const s = computed(() => game.state!)
const pc = computed(() => s.value.party.find((m) => m.isPlayer)!)
// 身上的缺陷可以在這裡克服的，排在前面
const list = computed(() => [...overcomablePerks(pc.value, currentCell(s.value).kind), ...trainablePerks(pc.value, currentCell(s.value).kind)])
const text = ref('')

function train(id: string) {
  void game.train(id, text.value)
  text.value = ''
}
</script>

<template>
  <details v-if="list.length" class="train small">
    <summary>🎓 受訓：學特質（{{ list.length }}）</summary>
    <p class="muted">花錢、花時間受訓，成功時有機會學會（也可以改寫說法爭取別的）；身上的缺陷成功就克服。大成功學費打對折；失敗收一半；大失敗照收。</p>
    <input v-model="text" placeholder="怎麼學（選填，會寫進日誌）：例如每天天沒亮就跟著教官練" />
    <ul class="plain">
      <li v-for="p in list" :key="p.id" class="row">
        <div class="grow"><span v-if="p.flaw" class="tag">克服缺陷</span><b>{{ p.name }}</b>：{{ p.desc }}<div class="muted">{{ attrName(p.train!.attr) }}檢定 DC {{ p.train!.dc }}・{{ p.train!.hours }} 小時・學費 {{ formatMoney(p.train!.price_cc) }}</div></div>
        <button class="small" :disabled="game.judging || !!s.pendingAction || s.money_cc < p.train!.price_cc" @click="train(p.id)">受訓</button>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.train { margin-top: 8px; display: grid; gap: 4px; grid-template-columns: minmax(0, 1fr); }
.train input { width: 100%; }
.train ul { display: grid; gap: 4px; margin: 0; }
.train li { gap: 8px; align-items: center; }
.grow { flex: 1; }
</style>
