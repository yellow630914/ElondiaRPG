<script setup lang="ts">
import { CLASS_WEAPONS } from '@/engine/gameRules'
import Hint from './Hint.vue'

// 存檔規則「職業武器限制」的「?」：每個職業主手能拿的武器，用表格列出（新遊戲與設定共用）
defineProps<{ note?: string }>()
</script>

<template>
  <Hint :width="300">
    <div class="class-weapons">
      <div>勾選時，主手只能拿職業能用的武器；副手（盾牌、法器）不限。</div>
      <table>
        <thead><tr><th>職業</th><th>主手武器</th></tr></thead>
        <tbody>
          <tr v-for="r in CLASS_WEAPONS" :key="r.cls"><td>{{ r.cls }}</td><td>{{ r.weapons }}</td></tr>
        </tbody>
      </table>
      <div v-if="note">{{ note }}</div>
    </div>
  </Hint>
</template>

<style scoped>
.class-weapons { display: grid; gap: 6px; white-space: normal; }
table { border-collapse: collapse; width: 100%; line-height: 1.5; }
th, td { text-align: left; padding: 2px 6px; border-bottom: 1px solid #b8955a55; vertical-align: top; }
th { font-weight: 600; white-space: nowrap; }
td:first-child { white-space: nowrap; }
</style>
