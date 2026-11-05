<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { trainOptions } from '@/engine/perkActions'
import { useGame } from '@/stores/game'
import FoldMenu from './ui/FoldMenu.vue'
import Hint from './ui/Hint.vue'

// 受訓：在這個設施，或向身邊的老師（固定 NPC 的 mentor）花錢、花時間學特質（data/rules/perks.json 的 train、mentor）
const game = useGame()
const s = computed(() => game.state!)
// 身上的缺陷可以在這裡克服的，排在前面；老師會教的接在後面
const list = computed(() => {
  void game.cell
  void s.value.time.minute
  return trainOptions(s.value)
})
const text = ref('')

function train(id: string) {
  void game.train(id, text.value)
  text.value = ''
}
</script>

<template>
  <FoldMenu v-if="list.length" id="place.train" class="train" icon="book" label="受訓" detail="花錢、花時間學特質或克服缺陷" :badge="list.length">
    <p class="muted small intro">花錢、花時間受訓 <Hint text="成功時有機會學會（也可以改寫說法爭取別的）；身上的缺陷成功就克服。身邊有老師時，也可以向老師學他會教的特質（好感夠才肯教，學費比較便宜、比較好學）。大成功學費打對折；失敗收一半；大失敗照收。" /></p>
    <input v-model="text" placeholder="怎麼學（選填，會寫進日誌）：例如每天天沒亮就跟著教官練" />
    <ul class="plain small">
      <li v-for="o in list" :key="o.def.id" class="row">
        <div class="grow">
          <span v-if="o.def.flaw" class="tag">克服缺陷</span><span v-if="o.mentor" class="tag">老師：{{ o.mentor.name }}</span><b>{{ o.def.name }}</b>：{{ o.def.desc }}
          <div class="muted">{{ attrName(o.train.attr) }}檢定 DC {{ o.train.dc }}・{{ o.train.hours }} 小時・學費 {{ formatMoney(o.train.price_cc) }}</div>
          <div v-if="o.blocked" class="muted">{{ o.blocked }}</div>
        </div>
        <button class="small" :disabled="game.judging || !!s.pendingAction || !!o.blocked || s.money_cc < o.train.price_cc" @click="train(o.def.id)">受訓</button>
      </li>
    </ul>
  </FoldMenu>
</template>

<style scoped>
.train input { width: 100%; }
.train ul { display: grid; gap: 4px; margin: 0; }
.train li { gap: 8px; align-items: center; }
.grow { flex: 1; }
.train p { margin: 0; }
.intro { display: flex; align-items: center; gap: 4px; }
</style>
