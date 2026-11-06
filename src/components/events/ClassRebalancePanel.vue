<script setup lang="ts">
import { computed } from 'vue'
import { className } from '@/engine/data'
import { NEW_CLASS_SOURCES } from '@/engine/classRebalance'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'

// 新職業的一次性調整（classRebalance.ts）：之前的存檔裡，炎華之地已經生成的冒險者沒有武夫、仙術師。
// 問玩家要不要把一批還沒打過交道的人改成新職業；答應或拒絕都只問這一次
const game = useGame()
const offer = computed(() => game.state?.classRebalance?.offer)
const rows = computed(() => Object.entries(offer.value?.plan ?? {}).map(([cls, n]) => ({
  cls, n, now: offer.value?.current[cls] ?? 0, from: (NEW_CLASS_SOURCES[cls] ?? []).map(className).join('、'),
})))
</script>

<template>
  <section v-if="offer" class="panel rebalance">
    <h3 class="title">🎓 炎華之地的新職業</h3>
    <p class="small">這個存檔是在加入<b>武夫</b>、<b>仙術師</b>之前開始的。炎華之地已經有 {{ offer.total }} 位冒險者，新職業的人比現在生成的少很多。要不要把其中一批隨機改成新職業？</p>
    <ul class="small">
      <li v-for="r in rows" :key="r.cls">{{ className(r.cls) }}：現在 {{ r.now }} 位，改 {{ r.n }} 位（從原本是{{ r.from }}的人裡挑）</li>
    </ul>
    <p class="small muted">只改還沒打過交道的人：隊友、招募過的人、有人際關係或共同記憶的人、神職都不動。改了之後他們的能力與裝備跟著新職業。不論選哪一個，<b>只會問這一次</b>。</p>
    <div class="row">
      <button class="small primary" @click="game.acceptClassRebalance()"><GameIcon name="check" :size="13" /> 改成新職業</button>
      <button class="small" @click="game.declineClassRebalance()"><GameIcon name="close" :size="13" /> 不要改（不再問）</button>
    </div>
  </section>
</template>

<style scoped>
.rebalance { display: grid; gap: 6px; }
.rebalance h3, .rebalance p, .rebalance ul { margin: 0; }
.rebalance ul { padding-left: 1.2em; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
